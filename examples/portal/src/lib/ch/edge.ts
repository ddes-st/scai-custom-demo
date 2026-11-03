import "server-only";
/**
 * Experience Edge GraphQL access for the three content-backed sections.
 *
 * Published M.Content only — the Delivery API serves what Content Hub auto-publishes when a
 * content item's lifecycle reaches Final. Types follow the ContentType prefix (verified on the
 * tenant): M_Content_BrandDoDont, M_Content_TargetPersona, M_Content_Characteristics; fields are
 * camelCased conditional properties (brandDoDont_Description, ...).
 *
 * Master images resolve through cmpContentToMasterLinkedAsset -> asset.urls, the public-link map
 * ({relativeUrl: {url, resource}}) — we pick the downloadOriginal entry, so image URLs are public
 * links to the original rendition.
 */
import { env } from "./env";
import { gatedFileUrl } from "./fileUrl";
import { edgeTypeFields, hasField, type EdgeField } from "./portalEdge";
import { CharacteristicItem, DoDontItem, PersonaItem } from "./types";

// NOTE: html fields are RAW here — sanitizeHtml needs DOMParser, which only exists in the
// browser, so the client panels sanitize at render time (same place it ran in the portal).

const DODONT_NEGATIVE = /\b(don'?t|do not|never|avoid|not|no longer|stop)\b/i;

/**
 * The portal sections' Edge request: variables instead of string-pasted values, and errors
 * THROWN (HTTP, network, any GraphQL error) — callers run inside unstable_cache, which keeps
 * a resolved value for 60s but never a rejection, so a hiccup isn't cached as "nothing
 * published".
 */
export async function edgeRequest(query: string, variables?: Record<string, unknown>): Promise<any> {
  if (!env.edgeToken) throw new Error("Experience Edge isn't connected (no EDGE_TOKEN)");
  const r = await fetch(env.edgeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-GQL-Token": env.edgeToken },
    body: JSON.stringify(variables ? { query, variables } : { query }),
    signal: AbortSignal.timeout(12000), // within a page's ~15 s (maxDuration)
  });
  if (!r.ok) throw new Error(`Edge GraphQL HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const body = await r.json();
  if (body.errors?.length) throw new Error(`Edge GraphQL: ${JSON.stringify(body.errors).slice(0, 300)}`);
  return body.data ?? {};
}

/**
 * The downloadOriginal public link from an Edge asset urls map. Assets can carry several
 * downloadOriginal links (named crop variants like "...-linkedInCompanyCoverImage-1536x768"),
 * so the UNCROPPED one — auto-generated 32-hex relative URL — is preferred over any crop.
 */
/** True when a public link's expiry (Edge `expiredOn`, REST `ExpirationDate`) has passed — it no longer serves. */
export function linkExpired(v: unknown): boolean {
  if (!v || typeof v !== "string") return false;
  const t = Date.parse(v);
  return Number.isFinite(t) && t < Date.now();
}

export function originalUrl(urls: any): string {
  if (!urls || typeof urls !== "object") return "";
  let fallback = "";
  for (const [relativeUrl, entry] of Object.entries(urls) as [string, any][]) {
    if (entry?.resource !== "downloadOriginal" || !entry?.url || linkExpired(entry.expiredOn)) continue;
    if (/^[0-9a-f]{32}$/i.test(relativeUrl)) return entry.url;
    if (!fallback) fallback = entry.url;
  }
  return fallback;
}

function masterImage(item: any): string {
  const results = item?.cmpContentToMasterLinkedAsset?.results || [];
  if (!results.length) return "";
  if (env.gatedFiles) {
    // a versioned same-origin URL (Edge ids ARE CH identifiers): cached by Vercel's CDN and
    // the browser, no Content Hub call while the page renders
    const asset = results[0];
    return asset?.id ? gatedFileUrl(String(asset.id), { preview: true, version: asset.modifiedOn }) : "";
  }
  return originalUrl(results[0]?.urls);
}

export interface EdgeContent {
  doDonts: DoDontItem[];
  personas: PersonaItem[];
  characteristics: CharacteristicItem[];
}

export const EMPTY_EDGE_CONTENT: EdgeContent = { doDonts: [], personas: [], characteristics: [] };

/**
 * One request for all three sections, filtered to the brand by its Content Hub identifier
 * (Edge entity ids ARE the CH identifiers). Only the types (and fields) this tenant's Edge
 * publishes are asked for, so a missing content type is an empty section, not a failed query.
 * THROWS when Edge doesn't answer — the brand book's loader runs inside unstable_cache, which
 * must not keep empty sections for a hiccup. Empty without an Edge token.
 */
export async function loadEdgeContent(brandIdentifier: string): Promise<EdgeContent> {
  if (!env.edgeToken) return EMPTY_EDGE_CONTENT;
  const [ddFields, tpFields, chFields] = await Promise.all([
    edgeTypeFields("M_Content_BrandDoDont"),
    edgeTypeFields("M_Content_TargetPersona"),
    edgeTypeFields("M_Content_Characteristics"),
  ]);
  const brandFilter = `where: { brandToContent: { m_Brand_ids: ${JSON.stringify(brandIdentifier)} } }`;
  const part = (alias: string, type: string, fields: EdgeField[] | null, names: string[], image: boolean) => {
    if (!fields || !hasField(fields, "brandToContent")) return "";
    const sel = ["id", ...names.filter((n) => hasField(fields, n)), image && hasField(fields, "cmpContentToMasterLinkedAsset") ? "cmpContentToMasterLinkedAsset { results { id urls modifiedOn } }" : ""].filter(Boolean).join(" ");
    return `${alias}: all${type}(first: 100, ${brandFilter}) { results { ${sel} } }`;
  };
  const parts = [
    part("doDonts", "M_Content_BrandDoDont", ddFields, ["content_Name", "brandDoDont_Summary", "brandDoDont_Description"], true),
    part("personas", "M_Content_TargetPersona", tpFields, ["content_Name", "targetPersona_TagLine", "targetPersona_PersonaDetails"], true),
    part("characteristics", "M_Content_Characteristics", chFields, ["content_Name", "characteristics_Characteristic"], false),
  ].filter(Boolean);
  if (!parts.length) return EMPTY_EDGE_CONTENT;
  const data = await edgeRequest(`{ ${parts.join(" ")} }`);

  const doDonts: DoDontItem[] = (data.doDonts?.results || []).map((item: any) => {
    const name = item.content_Name || item.id;
    return {
      contentId: String(item.id),
      name,
      summary: item.brandDoDont_Summary || name,
      html: item.brandDoDont_Description || "",
      imageUrl: masterImage(item),
      isDont: DODONT_NEGATIVE.test(name),
    };
  });
  doDonts.sort((a, b) => Number(a.isDont) - Number(b.isDont) || a.name.localeCompare(b.name));

  const personas: PersonaItem[] = (data.personas?.results || []).map((item: any) => ({
    contentId: String(item.id),
    name: item.content_Name || item.id,
    tagLine: item.targetPersona_TagLine || "",
    detailsHtml: item.targetPersona_PersonaDetails || "",
    imageUrl: masterImage(item),
  }));
  personas.sort((a, b) => a.name.localeCompare(b.name));

  const characteristics: CharacteristicItem[] = (data.characteristics?.results || []).map((item: any) => ({
    contentId: String(item.id),
    name: item.content_Name || item.id,
    html: item.characteristics_Characteristic || "",
  }));

  return { doDonts, personas, characteristics };
}
