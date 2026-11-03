import "server-only";
import { unstable_cache } from "next/cache";
import { chGet, ChHttpError, queryEntities } from "./rest";

/**
 * The partner kits' files through Content Hub REST, for a tenant whose Experience Edge doesn't publish
 * CollectionToAsset: without it every file would look as if it were in no collection, and a file that
 * sits only in a partner kit would count as public material (media library, /api/asset). Asset
 * identifier → the kits (collection identifiers) it is in. One lookup and one query per kit, cached
 * 60 s; THROWS when Content Hub doesn't answer (never cached), so the callers refuse rather than open up.
 */
export async function kitMembersUncached(kits: string[]): Promise<Array<[string, string[]]>> {
  const members = new Map<string, string[]>();
  for (const kit of kits) {
    // 404: no such collection (a kit named in the partner items but not on this tenant)
    const entity = await chGet(`/api/entities/identifier/${encodeURIComponent(kit)}`).catch((e) => {
      if (e instanceof ChHttpError && e.status === 404) return null;
      throw e;
    });
    const id = Number(entity?.id);
    if (!(id > 0)) continue;
    for (const asset of await queryEntities(`Definition.Name=='M.Asset' AND Parent('CollectionToAsset').id==${id}`)) {
      const identifier = String(asset?.identifier ?? "");
      if (identifier) members.set(identifier, [...(members.get(identifier) ?? []), kit]);
    }
  }
  return [...members.entries()];
}

/** Asset identifier → the partner kits it is in (empty without kits). */
export async function kitMembersViaRest(kits: Iterable<string>): Promise<Map<string, string[]>> {
  const list = [...new Set([...kits].filter(Boolean))].sort();
  if (!list.length) return new Map();
  return new Map(await unstable_cache(() => kitMembersUncached(list), ["portal-kit-members", ...list], { revalidate: 60, tags: ["ch", "ch:kit-members"] })());
}

/** A library file's collections: Edge's when it publishes the link (an array), else the kits from REST. */
export function collectionsOf(edgeCollections: string[] | null, identifier: string, viaRest: Map<string, string[]>): string[] {
  return edgeCollections ?? viaRest.get(identifier) ?? [];
}

const parentIds = (rel: any): number[] =>
  (rel?.parents ?? (rel?.parent ? [rel.parent] : [])).map((p: any) => Number(/\/entities\/(\d+)/.exec(String(p?.href ?? ""))?.[1])).filter((n: number) => n > 0);

/**
 * One file's collections (identifiers) through REST, for the access check on a tenant without
 * CollectionToAsset on Edge: every collection, not only the current site's kits, since a grant is
 * cached per file for every site of the deployment. THROWS when Content Hub doesn't answer.
 */
export async function assetCollectionsViaRest(numericId: string): Promise<string[]> {
  // 400/404: no such relation on this tenant
  const rel = await chGet(`/api/entities/${numericId}/relations/CollectionToAsset`).catch((e) => {
    if (e instanceof ChHttpError && (e.status === 400 || e.status === 404)) return null;
    throw e;
  });
  const out: string[] = [];
  for (const p of parentIds(rel)) {
    const c = await chGet(`/api/entities/${p}`);
    if (c?.identifier) out.push(String(c.identifier));
  }
  return out;
}
