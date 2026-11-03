import "server-only";
import { unstable_cache } from "next/cache";
import { edgeAll, edgeTypeFields, hasField } from "./portalEdge";

/**
 * Files the brand made for one partner (BrandSite.Partner → partnerToAsset: the documents the
 * Demo Builder writes per partner, and approved partner uploads) are that partner's only: they
 * stay out of the media library and the picker, and /api/asset serves them to that partner and
 * to staff only, never through the shared CDN. Asset id → the partners' Edge ids. Empty when
 * Edge has no Partner type (tenants the Demo Builder hasn't given partner records yet).
 */
async function partnerOnlyUncached(): Promise<Array<[string, string[]]>> {
  const fields = await edgeTypeFields("BrandSite_Partner");
  if (!hasField(fields, "partnerToAsset")) return [];
  const partners = await edgeAll("allBrandSite_Partner", "id partnerToAsset { results { id } }", { max: 5000 });
  const owners = new Map<string, string[]>();
  for (const p of partners) for (const a of p.partnerToAsset?.results ?? []) {
    const id = String(a.id);
    owners.set(id, [...(owners.get(id) ?? []), String(p.id)]);
  }
  return [...owners.entries()];
}
const cached = unstable_cache(partnerOnlyUncached, ["portal-partner-only"], { revalidate: 60, tags: ["ch", "ch:ch-partners"] });

/** Asset id → the partners (Edge ids) it belongs to. */
export async function partnerOnlyAssets(): Promise<Map<string, string[]>> {
  return new Map(await cached());
}
