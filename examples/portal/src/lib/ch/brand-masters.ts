import "server-only";
import { cachedByCulture } from "./culture";
import { ASSET_SELECTION, edgeAll, edgeTypeFields, hasField, toPortalAsset } from "./portalEdge";
import type { ImageLink } from "./image-links";

/**
 * Each brand's master asset (M.Brand → PCMBrandToMasterAsset, the brand's own image or logo as
 * Content Hub shows it on the brand), from Experience Edge: brand identifier → its preview and
 * public links. The brand grid uses it for its "logo" variant and where a brand has no logo file
 * from the Brand guidelines app. Empty when Edge doesn't publish the relation.
 */
export interface BrandMaster { src: string; links?: ImageLink[]; title: string }

async function brandMastersUncached(): Promise<Array<[string, BrandMaster]>> {
  const fields = await edgeTypeFields("M_Brand");
  if (!hasField(fields, "pCMBrandToMasterAsset")) return [];
  const brands = await edgeAll("allM_Brand", `id pCMBrandToMasterAsset { results { ${ASSET_SELECTION} } }`, { max: 200 });
  const out: Array<[string, BrandMaster]> = [];
  for (const b of brands) {
    const a = toPortalAsset(b?.pCMBrandToMasterAsset?.results?.[0]);
    if (a?.preview) out.push([String(b.id), { src: a.preview, links: a.links, title: a.title }]);
  }
  return out;
}

const cached = cachedByCulture("brand-masters", brandMastersUncached);

export async function brandMasters(): Promise<Map<string, BrandMaster>> {
  return new Map(await cached());
}
