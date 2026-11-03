import "server-only";
import { activeCulture, pickCulture } from "./culture";
/**
 * Experience Edge helpers for the portal's use cases (products, press, media): paging, the
 * schema (types differ per tenant — industry fields, content types, publishing settings),
 * localized values and asset URLs.
 *
 * Asset URLs: public mode uses the asset's public links as Edge publishes them in `urls`
 * ({relativeUrl: {url, resource}}) — the "preview" link for grids, "downloadOriginal" for
 * downloads. Gated mode never uses public links: versioned same-origin /api/asset/<id> URLs
 * (lib/fileUrl.ts), cached by Vercel's CDN until the asset changes.
 */
import { env } from "./env";
import { edgeRequest, linkExpired, originalUrl } from "./edge";
import { gatedFileUrl } from "./fileUrl";
import { imageLinksOf, type ImageLink } from "./image-links";

/** The most an all<Type> list loads (40 pages of 50). */
export const EDGE_LIST_MAX = 2000;

/** Every result of an all<Type> query, `pageSize` per page (capped at `max`, warned when the
 *  cap cuts the list). Throws when a page fails — a partial list must not be cached as the
 *  whole one. */
export async function edgeAll(field: string, selection: string, opts: { max?: number; pageSize?: number } = {}): Promise<any[]> {
  const out: any[] = [];
  let after: string | null = null;
  const max = opts.max ?? 1000;
  const size = opts.pageSize ?? 50;
  let more = false;
  for (let page = 0; page < 40 && out.length < max; page++) {
    const data = await edgeRequest(
      `query($after: String) { list: ${field}(first: ${size}, after: $after) { pageInfo { hasNext endCursor } results { ${selection} } } }`,
      { after },
    );
    const list = data?.list;
    more = false;
    if (!list) break;
    out.push(...(list.results ?? []));
    if (!list.pageInfo?.hasNext || !list.pageInfo?.endCursor) break;
    more = true;
    after = String(list.pageInfo.endCursor);
  }
  if (more || out.length > max) console.warn(`edge: ${field} capped at ${Math.min(max, out.length)} results (more are published)`);
  return out.slice(0, max);
}

/** Brand scope (the Portal Settings item's CH brand identifiers): true when the record may
 *  show — linked to a portal brand, or to no brand at all (unbranded products / assets).
 *  An empty scope = everything. */
export function inScope(brandRel: any, only: ReadonlySet<string>): boolean {
  if (!only.size) return true;
  const ids: string[] = (brandRel?.results ?? []).map((b: any) => String(b?.id ?? ""));
  return ids.length === 0 || ids.some((id) => only.has(id));
}

export interface EdgeField { name: string; kind: string; typeName: string }

const typeCache = new Map<string, { at: number; fields: EdgeField[] | null }>();

/** A type's fields (null when the type isn't on Edge), cached 5 minutes — a missing type
 *  only 1 minute, since a new content type or published relation shows up a minute after
 *  the publishing settings change. */
export async function edgeTypeFields(typeName: string): Promise<EdgeField[] | null> {
  const hit = typeCache.get(typeName);
  if (hit && Date.now() - hit.at < (hit.fields ? 5 : 1) * 60 * 1000) return hit.fields;
  // throws when Edge doesn't answer (never cached); null = the type really isn't there
  const data = await edgeRequest(`query($t: String!) { __type(name: $t) { fields { name type { kind name ofType { kind name } } } } }`, { t: typeName });
  const raw = data?.__type?.fields;
  const fields: EdgeField[] | null = Array.isArray(raw)
    ? raw.map((f: any) => ({
        name: String(f.name),
        kind: String(f.type?.kind === "NON_NULL" ? f.type?.ofType?.kind : f.type?.kind),
        typeName: String(f.type?.name ?? f.type?.ofType?.name ?? ""),
      }))
    : null;
  typeCache.set(typeName, { at: Date.now(), fields });
  return fields;
}

export const hasField = (fields: EdgeField[] | null, name: string) => !!fields?.some((f) => f.name === name);

/** A plain string from a String or a localized Json value ({"en-US": "…"}). */
export function loc(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return pickCulture(v as Record<string, unknown>, activeCulture());
  return "";
}

/** "activeSubstance" → "Active substance", "aTCCode" → "ATC code". */
export function fieldLabel(name: string): string {
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  const words = pascal.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").split(" ").filter(Boolean);
  return words.map((w, i) => (i === 0 || /^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");
}

// ---------- assets ----------

/** The asset fields every use case selects. */
export const ASSET_SELECTION = "id title fileName fileSize urls mainFile modifiedOn";

export type AssetKind = "image" | "video" | "document" | "audio" | "other";

export interface PortalAsset {
  id: string;
  title: string;
  fileName: string;
  /** Size in MB as Content Hub reports it, when known. */
  sizeMb?: number;
  kind: AssetKind;
  /** Image to show (preview rendition); empty when there's none. */
  preview: string;
  /** A small image for tiles and thumbnails (Content Hub's thumbnail rendition); "" without one — use preview then. */
  thumb?: string;
  /** The original file. */
  download: string;
  /** Every image public link with its size (preview, original, crops) — picked per box by ChImage. */
  links?: ImageLink[];
}

function urlFor(urls: any, resource: string): string {
  if (!urls || typeof urls !== "object") return "";
  for (const entry of Object.values(urls) as any[]) if (entry?.resource === resource && entry?.url && !linkExpired(entry.expiredOn)) return String(entry.url);
  return "";
}

function kindOf(a: any): AssetKind {
  const mime = String(a?.mainFile?.properties?.content_type ?? "").toLowerCase();
  const ext = String(a?.fileName ?? "").toLowerCase().split(".").pop() ?? "";
  if (mime.startsWith("image/") || /^(jpe?g|png|gif|webp|tiff?|svg|heic|psd|ai|eps)$/.test(ext)) return "image";
  if (mime.startsWith("video/") || /^(mp4|mov|m4v|avi|webm|mkv)$/.test(ext)) return "video";
  if (mime.startsWith("audio/") || /^(mp3|wav|aac|m4a|ogg)$/.test(ext)) return "audio";
  if (/pdf|word|presentation|sheet|excel|powerpoint|text/.test(mime) || /^(pdf|docx?|pptx?|xlsx?|txt|csv|rtf|indd)$/.test(ext)) return "document";
  return "other";
}

/** Formats a browser shows as an image (the original can stand in for a missing preview). */
const WEB_IMAGE = /\.(jpe?g|png|gif|webp|avif|svg)$/i;

export function toPortalAsset(a: any): PortalAsset | null {
  if (!a?.id) return null;
  const id = String(a.id);
  const kind = kindOf(a);
  const size = Number(a.fileSize);
  const fileName = String(a.fileName ?? "");
  let preview: string;
  let download: string;
  let thumb = "";
  if (env.gatedFiles) {
    // Content Hub renders a preview for images, videos and PDFs; asking for one elsewhere
    // only costs a failing REST call per tile.
    const hasPreview = kind === "image" || kind === "video" || /\.pdf$/i.test(fileName);
    preview = hasPreview ? gatedFileUrl(id, { preview: true, version: a.modifiedOn }) : "";
    thumb = hasPreview ? gatedFileUrl(id, { rendition: "thumbnail", version: a.modifiedOn }) : "";
    download = gatedFileUrl(id, { version: a.modifiedOn });
  } else {
    download = originalUrl(a.urls);
    preview = urlFor(a.urls, "preview") || (WEB_IMAGE.test(fileName) ? download : "");
    thumb = urlFor(a.urls, "thumbnail");
  }
  const links = kind === "image" || kind === "video" || preview ? imageLinksOf(a.urls, env.gatedFiles ? { id, version: a.modifiedOn } : undefined) : [];
  return {
    id, kind, preview, download,
    ...(thumb ? { thumb } : {}),
    ...(links.length ? { links } : {}),
    title: loc(a.title) || String(a.fileName ?? id),
    fileName: String(a.fileName ?? ""),
    ...(Number.isFinite(size) && size > 0 ? { sizeMb: size } : {}),
  };
}

export const assetsOf = (rel: any): PortalAsset[] =>
  (rel?.results ?? []).map(toPortalAsset).filter((x: PortalAsset | null): x is PortalAsset => !!x);

/** An identifier safe as one URL segment. */
export const idParam = (id: string) => encodeURIComponent(id);

/** A route param as the id: Next already decodes params; a second decode only for an id
 *  that still carries escapes, and never a throw on a stray "%". */
export function routeId(param: string): string {
  if (!/%[0-9a-f]{2}/i.test(param)) return param;
  try { return decodeURIComponent(param); } catch { return param; }
}

/** Run a loader; an Edge failure becomes `{ error }` for the page's error state (and is not
 *  cached — the loaders throw inside unstable_cache). */
export async function attempt<T>(load: () => Promise<T>): Promise<{ data: T; error?: undefined } | { data: null; error: string }> {
  try { return { data: await load() }; } catch (e: any) {
    console.warn("portal section load failed:", e?.message ?? e);
    return { data: null, error: "Experience Edge didn't answer — reload the page in a moment." };
  }
}
