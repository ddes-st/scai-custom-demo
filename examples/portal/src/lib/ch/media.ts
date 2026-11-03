import "server-only";
/**
 * The media library: every asset Experience Edge publishes (approved assets), with its brands
 * and — when the publishing settings expose CollectionToAsset, which the demo builder switches
 * on when asked — its collections. Filtering and search run in the browser.
 * Loaders THROW when Edge doesn't answer (never cached).
 */
import { cachedByCulture, SCOPED } from "./culture";
import { brandScope } from "../portal/scope";
import { partnerOnlyAssets } from "./partner-assets";
import { loadPartners } from "../portal/partners";
import { collectionsOf, kitMembersViaRest } from "./kit-members";
import { ASSET_SELECTION, EDGE_LIST_MAX, edgeAll, edgeTypeFields, hasField, inScope, loc, toPortalAsset, type PortalAsset } from "./portalEdge";

export interface MediaItem extends PortalAsset {
  brands: string[];
  collections: string[];
  /** The collections' Edge ids (a partner kit is a collection). */
  collectionIds: string[];
}

export interface MediaCollection { id: string; name: string; description: string; count: number }

export interface MediaLibrary {
  items: MediaItem[];
  collections: MediaCollection[];
  brands: string[];
  /** False when Edge doesn't publish the asset → collection link. */
  collectionLink: boolean;
  capped: boolean;
}

const MAX = EDGE_LIST_MAX;

async function loadMediaUncached(): Promise<MediaLibrary | null> {
  const [fields, colFields] = await Promise.all([edgeTypeFields("M_Asset"), edgeTypeFields("M_Collection")]);
  if (!fields) return null;
  const collectionLink = hasField(fields, "collectionToAsset") && !!colFields;
  const brandLink = hasField(fields, "pCMBrandToAsset");
  const sel = [ASSET_SELECTION, brandLink ? "pCMBrandToAsset { results { id brandName } }" : "", collectionLink ? "collectionToAsset { results { id } }" : ""].filter(Boolean).join(" ");
  const colSel = ["id", hasField(colFields, "collectionName") ? "collectionName" : "", hasField(colFields, "description") ? "description" : ""].filter(Boolean).join(" ");
  const [only, assets, cols, partnerOnly, kitsViaRest] = await Promise.all([
    brandScope(),
    edgeAll("allM_Asset", sel, { max: MAX }),
    collectionLink ? edgeAll("allM_Collection", colSel, { max: EDGE_LIST_MAX }) : Promise.resolve([] as any[]),
    // no fallback: without the list a partner's documents would show in the public library
    partnerOnlyAssets(),
    // without the collection link on Edge, the partner kits' files from REST — a kit-only file stays private
    collectionLink ? Promise.resolve(new Map<string, string[]>()) : loadPartners().then((ps) => kitMembersViaRest(ps.map((p) => p.kit))),
  ]);
  const colName = new Map(cols.map((c: any) => [String(c.id), loc(c.collectionName) || String(c.id)]));
  const items: MediaItem[] = [];
  for (const a of assets) {
    if (!inScope(a.pCMBrandToAsset, only)) continue;
    // a partner's own documents are its partner area's, never the library's
    if (partnerOnly.has(String(a.id))) continue;
    const pa = toPortalAsset(a);
    // Nothing to show or download (public mode without a public link yet): leave it out.
    if (!pa || (!pa.preview && !pa.download)) continue;
    items.push({
      ...pa,
      brands: (a.pCMBrandToAsset?.results ?? []).map((b: any) => loc(b?.brandName)).filter(Boolean),
      collections: (a.collectionToAsset?.results ?? []).map((c: any) => colName.get(String(c.id))).filter((n: unknown): n is string => !!n),
      collectionIds: collectionsOf(collectionLink ? (a.collectionToAsset?.results ?? []).map((c: any) => String(c.id)) : null, String(a.id), kitsViaRest),
    });
  }
  const count = new Map<string, number>();
  for (const i of items) for (const c of i.collections) count.set(c, (count.get(c) ?? 0) + 1);
  const collections = cols
    .map((c: any) => ({ id: String(c.id), name: colName.get(String(c.id))!, description: loc(c.description), count: count.get(colName.get(String(c.id))!) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const brands = [...new Set(items.flatMap((i) => i.brands))].sort();
  return { items, collections, brands, collectionLink, capped: assets.length >= MAX };
}

/** null when Edge has no asset type on this tenant. */
export const loadMedia = cachedByCulture("portal-media", loadMediaUncached, SCOPED);
