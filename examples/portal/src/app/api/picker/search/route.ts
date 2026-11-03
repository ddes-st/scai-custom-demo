/**
 * GET /api/picker/search?definition=<Edge type>&q=<text>[&f=<filters JSON>][&rest=1][&sort=name|name-desc|updated|updated-asc][&offset=n] — what the
 * "Content Hub items" Marketplace app lists: the published entities of one definition (brand
 * scope applied), filtered by title, subtitle, summary or id and by the picker's filters
 * (`f` = {"<facet key>": ["<value id>", …]}, AND across facets, OR within one; see
 * src/lib/ch/facets.ts). `counts` = matches per filter value given the text and the other
 * filters; REST filters take part once the app has loaded them (`rest=1`). Reads the same 60 s caches as the site, so it
 * is cheap to call per keystroke; nothing here is more public than the site's listings.
 * 60 items per answer from `offset` (the app's "Load more"); `total` counts all matches.
 * `kind=product|press` is still accepted for the first version of the app.
 */
import { applyRequestSite } from "src/lib/portal/sites";
import { NextRequest, NextResponse } from "next/server";
import { env } from "src/lib/ch/env";
import { profileFor, searchEntities, MAX_LIST, type EntityCard } from "src/lib/ch/entities";
import { edgeFacets, matches, parseFacetFilter, restFacets, type FacetData } from "src/lib/ch/facets";
import { normalizeDefinition } from "src/lib/portal/picks";
import { pickImage } from "src/lib/ch/image-links";
import { imageFromOrigin, sizedFileUrl } from "src/lib/ch/fileUrl";
import { toolsDenied, pickableDefinition } from "src/lib/portal/auth/tools";

export const dynamic = "force-dynamic";

const LEGACY: Record<string, string> = { product: "M_PCM_Product", press: "M_Content_PressRelease" };
const SORTS = new Set(["name", "name-desc", "updated", "updated-asc"]);
const PAGE = 60;

export async function GET(request: NextRequest) {
  // one deployment can serve several sites (joint microsites): answer for the one asked (?site=)
  applyRequestSite(request);
  const denied = toolsDenied(request);
  if (denied) return denied;
  const sp = request.nextUrl.searchParams;
  const definition = normalizeDefinition(sp.get("definition")) || LEGACY[(sp.get("kind") || "").toLowerCase()] || "";
  const q = (sp.get("q") || "").trim().slice(0, 80);
  const headers = { "Cache-Control": "no-store" };
  if (!definition) return NextResponse.json({ error: "definition is required" }, { status: 400, headers });
  if (!pickableDefinition(definition)) return NextResponse.json({ error: `${definition} can't be picked.` }, { status: 403, headers });
  if (!env.edgeToken) return NextResponse.json({ error: "Experience Edge for Content Hub isn't connected (EDGE_TOKEN)." }, { status: 503, headers });
  try {
    const profile = await profileFor(definition);
    if (!profile) return NextResponse.json({ error: `Experience Edge doesn't publish ${definition}.` }, { status: 404, headers });
    const filter = parseFacetFilter(sp.get("f"));
    const { items: all } = await searchEntities(definition, q, MAX_LIST);
    // the filters' membership: Edge always; REST when asked for or a REST filter is set
    const edge = await edgeFacets(definition).catch(() => ({ facets: [], membership: {} }) as FacetData);
    const needRest = sp.get("rest") === "1" || Object.keys(filter).some((k) => !edge.facets.some((f) => f.key === k));
    const rest = needRest ? await restFacets(definition).catch(() => ({ facets: [], membership: {} }) as FacetData) : { facets: [], membership: {} };
    const membership: FacetData["membership"] = { ...edge.membership };
    for (const [id, m] of Object.entries(rest.membership)) membership[id] = { ...(membership[id] ?? {}), ...m };
    const hits = all.filter((c) => matches(membership, c.id, filter));
    // per value: how many entities match the text and every OTHER filter
    const counts: Record<string, Record<string, number>> = {};
    for (const f of [...edge.facets, ...rest.facets]) {
      const c: Record<string, number> = {};
      for (const e of all) if (matches(membership, e.id, filter, f.key)) for (const v of membership[e.id]?.[f.key] ?? []) c[v] = (c[v] ?? 0) + 1;
      counts[f.key] = c;
    }
    // a page of the hits in the chosen order (name A–Z is the list's own order); "Load more" asks for the next
    const sort = SORTS.has(sp.get("sort") ?? "") ? sp.get("sort")! : "name";
    // by Content Hub's modified date, undated items last; ties keep the A–Z order (stable sort)
    const byDate = (dir: 1 | -1) => (a: EntityCard, b: EntityCard) => (!a.modified ? (b.modified ? 1 : 0) : !b.modified ? -1 : dir * a.modified.localeCompare(b.modified));
    const ordered = sort === "name-desc" ? hits.slice().reverse() : sort === "updated" ? hits.slice().sort(byDate(-1)) : sort === "updated-asc" ? hits.slice().sort(byDate(1)) : hits;
    const offset = Math.max(0, Math.min(Number.parseInt(sp.get("offset") || "0", 10) || 0, ordered.length));
    const items = ordered.slice(offset, offset + PAGE);
    return NextResponse.json({ definition, label: profile.labelPlural, total: hits.length, offset, counts, items: items.map((c) => ({ id: c.id, name: c.title, sub: c.subtitle || c.summary.slice(0, 80), image: imageFromOrigin(sizedFileUrl(c.thumb || c.image, 320)), large: c.image ? sizedFileUrl(pickImage(c.imageLinks, "detail", c.image, "", 1100).src, 1280) : "" })) }, { headers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Content Hub didn't answer" }, { status: 502, headers });
  }
}
