import "server-only";
import { unstable_cache } from "next/cache";
import { edgeRequest } from "../ch/edge";
import { env } from "../ch/env";
import { cardsFor, type EntityCard } from "../ch/entities";
import { loadMedia, type MediaCollection, type MediaItem } from "../ch/media";
import { ASSET_SELECTION, edgeTypeFields, hasField, inScope, loc, toPortalAsset, type EdgeField } from "../ch/portalEdge";
import { brandScope } from "./scope";
import type { PartnerProfile } from "./partners";

/**
 * Everything the brand shares with one channel partner, from its Content Hub Partner record
 * (BrandSite.Partner on Experience Edge, the Demo Builder's since phase 3):
 *  - files: the documents made for it (partnerToAsset, partner-only — see partner-assets.ts) and
 *    every library file in its kit collection or its other collections (partnerToCollection);
 *  - products (partnerToProduct), content (partnerToContent) and the collections themselves.
 * A partner without a record (deployed before the record existed) gets its kit collection only.
 * The same view for the partner itself and for staff looking at that partner.
 */
export interface PartnerArea {
  partner: PartnerProfile;
  files: MediaItem[];
  collections: MediaCollection[];
  products: EntityCard[];
  content: EntityCard[];
  /** False when Edge doesn't carry the Partner record (the kit alone is shown). */
  record: boolean;
  collectionLink: boolean;
}

/** A partner file's fields: the asset basics, plus its brands and collections where M_Asset has those
 *  links on Edge — Edge rejects a query naming a field it doesn't publish (no collectionToAsset, say). */
export function partnerFileSelection(assetFields: EdgeField[] | null): string {
  return [
    ASSET_SELECTION,
    hasField(assetFields, "pCMBrandToAsset") ? "pCMBrandToAsset { results { id brandName } }" : "",
    hasField(assetFields, "collectionToAsset") ? "collectionToAsset { results { id } }" : "",
  ].filter(Boolean).join(" ");
}

/** The record's links: ids, plus its own documents (which the library leaves out) and its collections' names. */
async function partnerRecordUncached(entity: string): Promise<any | null> {
  const [fields, assetFields] = await Promise.all([edgeTypeFields("BrandSite_Partner"), edgeTypeFields("M_Asset")]);
  if (!fields) return null;
  const rel = (name: string, sel: string) => (hasField(fields, name) ? `${name} { results { ${sel} } }` : "");
  const sel = [
    "id",
    rel("partnerToAsset", partnerFileSelection(assetFields)),
    rel("partnerToProduct", "id"),
    rel("partnerToContent", "id"),
    rel("partnerToCollection", "id collectionName description"),
  ].filter(Boolean).join(" ");
  const data = await edgeRequest(`query($id: String!) { p: brandSite_Partner(id: $id) { ${sel} } }`, { id: entity });
  return data?.p ?? null;
}
const partnerRecord = (entity: string) =>
  unstable_cache(() => partnerRecordUncached(entity), ["portal-partner-record", entity], { revalidate: 60, tags: ["ch", "ch:ch-partners"] })();

const results = (rel: any): any[] => rel?.results ?? [];

/** The partner's area; null when Edge has no asset type. Throws when Edge doesn't answer. */
export async function loadPartnerArea(partner: PartnerProfile): Promise<PartnerArea | null> {
  if (!env.edgeToken) return null;
  const [lib, rec, only] = await Promise.all([loadMedia(), partner.entity ? partnerRecord(partner.entity) : Promise.resolve(null), brandScope()]);
  if (!lib) return null;
  const recCollections = results(rec?.partnerToCollection);
  const collectionIds = new Set<string>([partner.kit, ...recCollections.map((c: any) => String(c.id))].filter(Boolean));
  const files: MediaItem[] = lib.items.filter((i) => i.collectionIds.some((c) => collectionIds.has(c)));
  // the partner's own documents: straight from the record (the library leaves them out)
  const colName = new Map<string, string>([...lib.collections.map((c) => [c.id, c.name] as [string, string]), ...recCollections.map((c: any) => [String(c.id), loc(c.collectionName) || String(c.id)] as [string, string])]);
  for (const a of results(rec?.partnerToAsset)) {
    if (files.some((f) => f.id === String(a.id)) || !inScope(a.pCMBrandToAsset, only)) continue;
    const pa = toPortalAsset(a);
    if (!pa || (!pa.preview && !pa.download)) continue;
    const ids = results(a.collectionToAsset).map((c: any) => String(c.id));
    files.push({ ...pa, brands: results(a.pCMBrandToAsset).map((b: any) => loc(b?.brandName)).filter(Boolean), collections: ids.map((id) => colName.get(id)).filter((n): n is string => !!n), collectionIds: ids });
  }
  const collections: MediaCollection[] = [...collectionIds]
    .map((id) => {
      const fromLib = lib.collections.find((c) => c.id === id);
      const fromRec = recCollections.find((c: any) => String(c.id) === id);
      const name = fromLib?.name ?? (fromRec ? loc(fromRec.collectionName) || id : "");
      return name ? { id, name, description: fromLib?.description ?? loc(fromRec?.description), count: files.filter((f) => f.collectionIds.includes(id)).length } : null;
    })
    .filter((c): c is MediaCollection => !!c && c.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const productIds = results(rec?.partnerToProduct).map((p: any) => String(p.id));
  const contentIds = results(rec?.partnerToContent).map((c: any) => String(c.id));
  const [products, content] = await Promise.all([
    productIds.length ? cardsFor("M_PCM_Product", productIds).then((r) => r.cards).catch(() => []) : Promise.resolve([] as EntityCard[]),
    contentIds.length ? cardsFor("M_Content", contentIds).then((r) => r.cards).catch(() => []) : Promise.resolve([] as EntityCard[]),
  ]);
  return { partner, files, collections, products, content, record: !!rec, collectionLink: lib.collectionLink };
}
