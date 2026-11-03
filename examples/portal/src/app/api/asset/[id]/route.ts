/**
 * File delivery in hybrid and gated mode: /api/asset/<id>?r=preview|thumbnail&v=<version>.
 *
 * Pages never carry Content Hub public links in these modes; every binary comes through here.
 * The handler checks that the file is one of the portal's (brand scope), decides per viewer
 * (staff: everything; a partner: public files and its own kit; anonymous in hybrid mode:
 * public files only — a file that exists only in partner kits, with no public collection and
 * no product/press/campaign/brand link, is private; nobody in gated mode without a session), resolves
 * a short-lived SIGNED delivery URL from Content Hub (leaked URLs die on their own), then
 * streams previews and files up to 4 MB (CDN-cacheable when versioned) and 302-redirects
 * larger files to the signed URL (functions return at most 4.5 MB on Vercel).
 * `?pl=<relative url>` asks for one of the asset's PUBLIC LINKS instead (a crop such as
 * 95738-HomePageHero-2000x800, picked per image box by ChImage): after the same access check
 * it is streamed from here, so its Content Hub URL never reaches the page; a crop too large to
 * stream falls back to the signed preview.
 * `?w=160|320|640|960|1280|1920` returns an image resized to that width (never enlarged), as WebP without
 * metadata — Content Hub's renditions of generated images carry ~300 KB of content credentials
 * (C2PA) and high-quality JPEG data, 400–900 KB even for a 350 px thumbnail; the picker's tiles
 * ask for w=320. Resized after the same access check, cached under the same rules.
 */
import { NextRequest } from "next/server";
import { env } from "src/lib/ch/env";
import { getViewer, type Viewer } from "src/lib/ch/viewer";
import { assetGrant, cdnShareable, isPublicMaterial, proxiedFileHeaders, type AssetGrant } from "src/lib/ch/assetAccess";
import { IMAGE_WIDTHS } from "src/lib/ch/fileUrl";
import { invalidateSignedHref, resolveSignedHref, resolveSignedHrefStatus } from "src/lib/ch/signedHref";
import { loadPartners } from "src/lib/portal/partners";
import { unstable_cache } from "next/cache";
import { edgeRequest } from "src/lib/ch/edge";
import { partnerOnlyAssets } from "src/lib/ch/partner-assets";

export const dynamic = "force-dynamic";

const MAX_STREAM_BYTES = Math.min(4 * 1024 * 1024, Number(process.env.PORTAL_MAX_STREAM_BYTES) || Infinity);
const CDN_FILE_TTL = 30 * 24 * 60 * 60;
const CDN_REDIRECT_TTL = 60 * 60;
const NO_STORE = { "Cache-Control": "no-store" };

/** The requested width snapped up to an allowed one; 0 = as delivered. */
const widthOf = (raw: string | null) => { const n = Number(raw || 0); return n > 0 ? IMAGE_WIDTHS.find((w) => w >= n) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1] : 0; };

/** The upstream image, resized to `w` (WebP, metadata dropped) when asked and possible; else as it came. */
async function respond(res: Response, headers: Record<string, string>, w: number): Promise<Response> {
  if (!w || !/^image\/(jpe?g|png|webp|gif|avif|tiff)/i.test(res.headers.get("content-type") || "")) return new Response(res.body, { headers });
  const original = Buffer.from(await res.arrayBuffer());
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(original, { failOn: "none" }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    return new Response(new Uint8Array(out), { headers: { ...headers, "Content-Type": "image/webp", "X-Portal-Width": String(w) } });
  } catch {
    return new Response(new Uint8Array(original), { headers });
  }
}

/** The Content Hub URL of one of an asset's public links (by relative url), from Edge; "" when it has none. */
const publicLinkHref = (id: string, key: string, version: string) =>
  unstable_cache(async () => {
    const d = await edgeRequest(`query($id: String!) { a: m_Asset(id: $id) { urls } }`, { id });
    const entry = (d?.a?.urls ?? {})[key];
    const url = typeof entry?.url === "string" ? entry.url : "";
    // only Content Hub's own public-content endpoint, never an arbitrary URL from the data
    return url.startsWith(`${env.chHost}/api/public/content/`) ? url : "";
  }, ["asset-public-link", id, key, version], { revalidate: version ? 86400 : 300 })();

/** May this viewer fetch a file with this grant? `owners`: the partners (Edge ids) a
 *  partner-only document belongs to (BrandSite.Partner → partnerToAsset), else undefined. */
const partnerKits = async () => new Set((await loadPartners()).map((p) => p.kit).filter(Boolean));

async function allowedFor(viewer: Viewer, grant: AssetGrant, owners?: string[]): Promise<boolean> {
  if (!grant.ok || viewer.kind === "none") return false;
  if (viewer.kind === "staff") return true;
  // a partner's own document: that partner only (staff above)
  if (owners?.length) return viewer.kind === "partner" && !!viewer.partner.entity && owners.includes(viewer.partner.entity);
  const kits = await partnerKits();
  const inKits = grant.collections.filter((c) => kits.has(c));
  // public portal material: a brand-book file, linked to a product, press release, campaign or brand, or in a public collection
  if (isPublicMaterial(grant, kits)) return true;
  // private: only in partner kits — for the partners whose kit holds it
  return viewer.kind === "partner" && inKits.includes(viewer.partner.kit);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!env.gatedFiles) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const version = (sp.get("v") || "").slice(0, 40);
  // thumbnail: Content Hub's small rendition (the picker's tiles); preview: the large one
  const rendition = sp.get("r") === "preview" ? "preview" : sp.get("r") === "thumbnail" ? "thumbnail" : "downloadOriginal";
  const forceStream = sp.get("proxy") === "1";
  const w = widthOf(sp.get("w"));

  const viewer = await getViewer();
  if (viewer.kind === "none") return new Response("Authentication required", { status: 401, headers: NO_STORE });
  const grant = await assetGrant(id, version);
  // partner-only documents are keyed by identifier (a numeric id must not slip past); when the
  // lookup fails nothing is served — a partner's document must never fall back to "public"
  const partnerOnly = await partnerOnlyAssets().catch(() => null);
  if (!partnerOnly) return new Response("Temporarily unavailable", { status: 503, headers: { ...NO_STORE, "Retry-After": "30" } });
  // a file a public model entity shows (a sponsorship's logo) is public even when it also sits
  // among a partner's documents; everything else in a partner's documents is that partner's
  const owners = grant.shownByModel ? undefined : partnerOnly.get(grant.identifier || id) ?? partnerOnly.get(id);
  if (!(await allowedFor(viewer, grant, owners))) return new Response("Not found", { status: 404, headers: NO_STORE });

  // only what anonymous visitors may see goes into the shared CDN — never a partner's document. A signed-in
  // viewer asking for such a file is served the same bytes, so the CDN keeps it for them too (cdnShareable).
  const shared = !owners && (viewer.kind === "public" || cdnShareable(env.siteMode, grant, await partnerKits(), owners));
  const pl = (sp.get("pl") || "").slice(0, 120);
  if (pl && /^[\w.-]+$/.test(pl)) {
    const plHref = await publicLinkHref(id, pl, version).catch(() => "");
    const res = plHref ? await fetch(plHref, { cache: "no-store" }).catch(() => null) : null;
    const size = Number(res?.headers.get("content-length") || NaN);
    if (res?.ok && res.body && (!Number.isFinite(size) || size <= MAX_STREAM_BYTES)) {
      const headers = proxiedFileHeaders(res.headers.get("Content-Type") || "", version ? "private, max-age=31536000, immutable" : "private, max-age=300");
      if (version && shared) headers["Vercel-CDN-Cache-Control"] = `max-age=${CDN_FILE_TTL}`;
      headers["X-Portal-File"] = "public-link";
      return respond(res, headers, w);
    }
    // no such link, or too large to pass through: the signed preview instead
  }
  const wanted = pl ? "preview" : rendition;
  const resolved = await resolveSignedHrefStatus(id, wanted);
  let href = resolved.href;
  // Content Hub didn't answer in time (many tiles at once): try again shortly, not "not found"
  if (!href && resolved.transient) return new Response("Content Hub is busy — try again", { status: 503, headers: { ...NO_STORE, "Retry-After": "3" } });
  if (!href) return new Response("Asset not found or no such rendition", { status: 404, headers: NO_STORE });

  let ac = new AbortController();
  let upstream = await fetch(href, { cache: "no-store", signal: ac.signal });
  if (upstream.status === 403) {
    invalidateSignedHref(id, wanted);
    href = await resolveSignedHref(id, wanted);
    if (href) { ac = new AbortController(); upstream = await fetch(href, { cache: "no-store", signal: ac.signal }); }
  }
  if (!upstream.ok || !upstream.body) return new Response(`Upstream ${upstream.status}`, { status: 502, headers: NO_STORE });

  const size = Number(upstream.headers.get("content-length") || NaN);
  const small = wanted === "preview" || wanted === "thumbnail" || (Number.isFinite(size) && size <= MAX_STREAM_BYTES);
  // files only partners/staff may see are never kept by the shared CDN (`shared` above)
  if (small || forceStream) {
    const headers = proxiedFileHeaders(upstream.headers.get("Content-Type") || "", version ? "private, max-age=31536000, immutable" : "private, max-age=300");
    if (version && small && shared) headers["Vercel-CDN-Cache-Control"] = `max-age=${CDN_FILE_TTL}`;
    headers["X-Portal-File"] = version && small ? "cached-stream" : "stream";
    return small ? respond(upstream, headers, w) : new Response(upstream.body, { headers });
  }
  ac.abort();
  const headers: Record<string, string> = { Location: href, "Cache-Control": "private, max-age=600", "X-Portal-File": "redirect" };
  if (version && shared) headers["Vercel-CDN-Cache-Control"] = `max-age=${CDN_REDIRECT_TTL}`;
  return new Response(null, { status: 302, headers });
}
