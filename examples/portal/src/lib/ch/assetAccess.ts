import "server-only";
/**
 * Gated mode: /api/asset/<id> serves only the portal's own files, not any asset in the
 * tenant (the site reads Content Hub with a login that can see far more):
 *  - an asset Experience Edge publishes (approved) within the portal's brands — what the
 *    product, press and media sections and the brand book's do & don't / persona images use;
 *  - or an APPROVED file linked to one of the portal's brands (PCMBrandToAsset) — the brand
 *    book's colours, logos, fonts, guidelines and templates. A partner's upload is never
 *    granted this way (it is on its partner's brand, but under review or that partner's own).
 * Who may fetch it is decided per viewer in /api/asset (partner kits are only for their
 * partner and staff; in hybrid mode anonymous visitors get public-section files only). A brand-book
 * file (a portal brand's logo, colour, font, guideline or template) is public even when it also sits in a
 * dealer's kit: the brand book shows it to everyone — and so is a portal brand's master asset (its logo).
 * Decisions are cached per file VERSION in Next's Data Cache (shared by every instance) for a
 * day — a version changes whenever the asset does, approval included — and in this instance's
 * memory (allowed 10 minutes, refused 1 minute). A failed lookup is never cached.
 */
import { unstable_cache } from "next/cache";
import { ChHttpError, chGet, resolveIdentifierStrict } from "./rest";
import { edgeRequest } from "./edge";
import { env } from "./env";
import { edgeTypeFields, hasField, inScope, type EdgeField } from "./portalEdge";
import { portalModel } from "./sports";
import { brandScope } from "../portal/scope";
import { assetCollectionsViaRest } from "./kit-members";

const cache = new Map<string, { grant: AssetGrant; at: number }>();

async function brandIdentifiers(numericId: string, relation = "PCMBrandToAsset"): Promise<string[]> {
  // 400/404: no such relation on this tenant
  const rel = await chGet(`/api/entities/${numericId}/relations/${relation}`).catch((e) => { if (e instanceof ChHttpError && (e.status === 400 || e.status === 404)) return null; throw e; });
  const parents: any[] = rel?.parents ?? (rel?.parent ? [rel.parent] : []);
  const out: string[] = [];
  for (const p of parents) {
    const id = /\/entities\/(\d+)/.exec(String(p?.href ?? ""))?.[1];
    if (!id) continue;
    const b = await chGet(`/api/entities/${id}`);
    if (b?.identifier) out.push(String(b.identifier));
  }
  return out;
}

/** What is known about a file: whether it is one of the portal's files, the Content Hub
 *  collections it belongs to, and whether a public entity (product, content, campaign, brand)
 *  links it — a file that sits only in a partner kit is that partner's (and staff's). */
export interface AssetGrant {
  ok: boolean;
  collections: string[];
  linked: boolean;
  /** The asset's Content Hub identifier (= its Experience Edge id), however it was requested. */
  identifier: string;
  /** Shown by an entity of the portal's industry model (a sponsorship's logo, a game's photos): public portal material. */
  shownByModel?: boolean;
  /** A brand-book file: a brand-book asset type on one of the portal's brands, or a portal brand's master asset (its logo). */
  brandBook?: boolean;
}

/** The asset types the brand book shows (data.ts reads a brand's files by these). */
export const BRAND_BOOK_TYPES: ReadonlySet<string> = new Set(["M.AssetType.BrandColor", "M.AssetType.Brand.Guideline", "M.AssetType.Brand.Font", "M.AssetType.Brand.Logo", "M.AssetType.Brand.Templates"]);

const anyInScope = (brandIds: string[], only: ReadonlySet<string>) => brandIds.length > 0 && (!only.size || brandIds.some((b) => only.has(b)));

/**
 * Is a file a brand-book file of this portal? A portal brand's master asset (`masterOf`: the brands it is the
 * master of — the brand's logo), or a brand-book asset type on a portal brand. `only`: the brand scope, empty = every brand.
 */
export function isBrandBookFile(typeIds: string[], brandIds: string[], only: ReadonlySet<string>, masterOf: string[] = []): boolean {
  return anyInScope(masterOf, only) || (typeIds.some((t) => BRAND_BOOK_TYPES.has(t)) && anyInScope(brandIds, only));
}

/**
 * Is a granted file public portal material (anyone the portal lets in may fetch it), rather than only for the
 * partners whose kits hold it? `kits`: the partner-kit collections. Public: a brand-book file, a file a
 * product / press release / campaign / brand / model entity shows, one in a collection that isn't a kit,
 * or one in no collection. A partner's own documents and uploads are decided before this (never public).
 */
export function isPublicMaterial(grant: Pick<AssetGrant, "linked" | "collections" | "brandBook">, kits: ReadonlySet<string>): boolean {
  if (grant.brandBook || grant.linked) return true;
  const inKits = grant.collections.filter((c) => kits.has(c));
  return inKits.length === 0 || inKits.length < grant.collections.length;
}

const parentIds = (rel: any): number[] =>
  (rel?.parents ?? (rel?.parent ? [rel.parent] : [])).map((p: any) => Number(/\/entities\/(\d+)/.exec(String(p?.href ?? ""))?.[1])).filter((n: number) => n > 0);

/** The links that make a file portal material (shown by a product, a content item, a campaign, or a brand's logo). */
const LINKS = ["pCMProductToAsset", "pCMProductToMasterAsset", "cmpContentToLinkedAsset", "cmpContentToMasterLinkedAsset", "cmpCampaignToAsset", "cmpCampaignToMasterAsset", "pCMBrandToMasterAsset"];

/**
 * The access check's Edge query for one asset, naming only the links this tenant's M_Asset has on Edge:
 * Edge rejects a query that names a field it doesn't publish, and every file would then be refused
 * (Sodexo: no collectionToAsset). `model`: the industry model's asset relations. `links`: the ones asked for.
 */
export function grantQuery(assetFields: EdgeField[] | null, model: string[] = []): { query: string; links: string[] } {
  const has = (f: string) => hasField(assetFields, f);
  const links = [...new Set([...LINKS, ...model])].filter(has);
  const sel = ["id", ...["pCMBrandToAsset", "collectionToAsset", "assetTypeToAsset"].filter(has), ...links].map((f) => (f === "id" ? f : `${f} { results { id } }`));
  return { query: `query($id: String!) { a: m_Asset(id: $id) { ${sel.join(" ")} } }`, links };
}

/** The asset's REST id; throws when Content Hub doesn't know it (the check then refuses, uncached). */
async function restIdOf(numeric: string, identifier: string): Promise<string> {
  const id = numeric || String((await chGet(`/api/entities/identifier/${encodeURIComponent(identifier)}`))?.id ?? "");
  if (!id) throw new Error(`asset ${identifier}: no Content Hub id`);
  return id;
}

async function decide(idOrIdentifier: string): Promise<AssetGrant> {
  const numeric = /^\d+$/.test(idOrIdentifier) ? idOrIdentifier : "";
  const identifier = numeric ? String((await chGet(`/api/entities/${numeric}`))?.identifier ?? "") : idOrIdentifier;
  const only = await brandScope();
  // no M_Asset on Edge (null): the REST check below
  const assetFields = identifier && env.edgeToken ? await edgeTypeFields("M_Asset") : null;
  if (identifier && assetFields) {
    // the demo's industry model (PORTAL_MODEL): files its entities show — a game's photos, a
    // player's headshot, a sponsorship's partner logo — are portal material whatever their brand
    const MODEL = [...new Set(portalModel().flatMap((d) => d.relations.filter((r) => /M\.Asset/i.test(r.target)).map((r) => r.edge)))].filter((e) => hasField(assetFields, e));
    const typeOnEdge = hasField(assetFields, "assetTypeToAsset");
    const { query, links } = grantQuery(assetFields, MODEL);
    const d = await edgeRequest(query, { id: identifier });
    const fromModel = MODEL.some((l) => (d?.a?.[l]?.results ?? []).length > 0);
    const masterOf = (d?.a?.pCMBrandToMasterAsset?.results ?? []).map((b: any) => String(b.id));
    if (d?.a?.id && (inScope(d.a.pCMBrandToAsset, only) || fromModel || anyInScope(masterOf, only))) {
      const brands = (d.a.pCMBrandToAsset?.results ?? []).map((b: any) => String(b.id));
      // the asset type: from Edge, else (only for a branded file) from REST
      const types = typeOnEdge ? (d.a.assetTypeToAsset?.results ?? []).map((t: any) => String(t.id)) : brands.length ? await assetTypeIdentifiers(numeric || identifier) : [];
      // without CollectionToAsset on Edge the collections come from REST: a kit-only file must never look public
      const collections = hasField(assetFields, "collectionToAsset") ? (d.a.collectionToAsset?.results ?? []).map((c: any) => String(c.id)) : await assetCollectionsViaRest(await restIdOf(numeric, identifier));
      return { ok: true, collections, linked: fromModel || links.some((l) => (d.a[l]?.results ?? []).length > 0), identifier, shownByModel: fromModel, brandBook: isBrandBookFile(types, brands, only, masterOf) };
    }
  }
  const id = numeric || String((await chGet(`/api/entities/identifier/${encodeURIComponent(identifier)}`))?.id ?? "");
  const no: AssetGrant = { ok: false, collections: [], linked: false, identifier };
  if (!id) return no;
  // a partner's upload: under review, or once approved that partner's own (Edge decides above)
  // (400/404 = no such relation on this tenant; a failure throws — never cached as a grant)
  const uploads = await chGet(`/api/entities/${id}/relations/PartnerToUpload`).catch((e) => { if (e instanceof ChHttpError && (e.status === 400 || e.status === 404)) return null; throw e; });
  if (parentIds(uploads).length) return no;
  // only approved files (drafts, rejected and in-review assets carry a brand too)
  // a failed lookup throws (never cached as a refusal)
  const approved = await resolveIdentifierStrict("M.Final.LifeCycle.Status.Approved");
  if (!approved || !parentIds(await chGet(`/api/entities/${id}/relations/FinalLifeCycleStatusToAsset`)).includes(approved)) return no;
  // linked to a brand, or a brand's master asset (its logo)
  const brands = [...new Set([...(await brandIdentifiers(id)), ...(await brandIdentifiers(id, "PCMBrandToMasterAsset"))])];
  if (!brands.length) return no;
  // a brand-book file (linked to a portal brand through REST) is public portal material
  return { ok: anyInScope(brands, only), collections: [], linked: true, identifier, brandBook: true };
}

/** An asset's types (identifiers) through REST; numeric id or identifier. */
async function assetTypeIdentifiers(idOrIdentifier: string): Promise<string[]> {
  const id = /^\d+$/.test(idOrIdentifier) ? idOrIdentifier : String((await chGet(`/api/entities/identifier/${encodeURIComponent(idOrIdentifier)}`))?.id ?? "");
  if (!id) return [];
  const rel = await chGet(`/api/entities/${id}/relations/AssetTypeToAsset`).catch((e) => { if (e instanceof ChHttpError && (e.status === 400 || e.status === 404)) return null; throw e; });
  const out: string[] = [];
  for (const p of parentIds(rel)) { const t = await chGet(`/api/entities/${p}`); if (t?.identifier) out.push(String(t.identifier)); }
  return out;
}

/**
 * May Vercel's shared cache keep this file (for anyone who asks for the same URL)? Only when an anonymous
 * visitor would get exactly this file anyway: never in gated mode, never a partner's own document
 * (`owners`), never a file only partner kits hold — public portal material on a site that isn't gated.
 * The viewer who asked doesn't matter: the bytes are the same for a signed-in author.
 */
export function cdnShareable(siteMode: string, grant: Pick<AssetGrant, "ok" | "linked" | "collections" | "brandBook">, kits: ReadonlySet<string>, owners?: string[]): boolean {
  if (siteMode === "gated" || owners?.length || !grant.ok) return false;
  return isPublicMaterial(grant, kits);
}

const DENIED: AssetGrant = { ok: false, collections: [], linked: false, identifier: "" };

export async function assetGrant(idOrIdentifier: string, version = ""): Promise<AssetGrant> {
  const id = String(idOrIdentifier);
  const key = `${id}#${version}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.grant.ok ? 10 : 1) * 60 * 1000) return hit.grant;
  try {
    // shared across instances; an unversioned request only briefly
    // tags: dropped with every Content Hub cache, and with the SitecoreAI ones (the brand scope decides)
    const grant = await unstable_cache(() => decide(id), ["asset-grant-v7", id, version], { revalidate: version ? 86400 : 300, tags: ["ch", "ch:asset-grant", "xmc-site"] })();
    cache.set(key, { grant, at: Date.now() });
    return grant;
  } catch (e) {
    logGrantFailure(id, e);
    return DENIED; // not cached: a Content Hub hiccup must not lock a file out
  }
}

/** Why a file was refused, in the Vercel log (once a minute per reason, not per file): a refusal is
 *  otherwise a plain 404, and a failing check refuses every file. Never a key — the messages carry
 *  Edge's or Content Hub's answer and the asset id only. */
const loggedAt = new Map<string, number>();
export function logGrantFailure(id: string, e: unknown, log: (line: string) => void = console.warn): void {
  const reason = String((e as any)?.message ?? e).slice(0, 300);
  const now = Date.now();
  if (now - (loggedAt.get(reason) ?? 0) < 60_000) return;
  loggedAt.set(reason, now);
  log(`asset access: ${String(id).slice(0, 120)} refused — the check failed: ${reason}`);
}

export const assetAllowed = async (idOrIdentifier: string, version = "") => (await assetGrant(idOrIdentifier, version)).ok;

/** Headers for bytes this origin streams: never sniffed, never run as a page here; anything
 *  that isn't a PDF, font or raster image downloads instead of rendering. */
export function proxiedFileHeaders(contentType: string, cacheControl: string): Record<string, string> {
  const type = contentType || "application/octet-stream";
  const inline = /^(application\/pdf|font\/|application\/font|application\/x-font|image\/(png|jpe?g|gif|webp|avif))/i.test(type);
  return {
    "Content-Type": type,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
    ...(inline ? {} : { "Content-Disposition": "attachment" }),
  };
}
