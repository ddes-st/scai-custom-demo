import {
  createSitesApiContext,
  syncCollectionViaApi,
  syncSiteViaApi,
  type SitesApiContext,
} from "../definitions/apply/sites-api";
import type { CollectionDefinition, SiteDefinition } from "../definitions/types";
import {
  readSitesApiOwnedState,
  type OwnedCollectionRecord,
  type OwnedSiteRecord,
  type SitesApiOwnedState,
} from "./sites-api-owned-state";
import { toItemSystemName } from "../definitions/blueprints/clone-blueprint";

function resolveCollectionSystemName(
  definition: Pick<CollectionDefinition, "name" | "systemName">,
): string {
  return (
    definition.systemName?.trim() || toItemSystemName(definition.name)
  ).trim();
}

function resolveSiteSystemName(
  definition: Pick<SiteDefinition, "name" | "systemName">,
): string {
  return (
    definition.systemName?.trim() || toItemSystemName(definition.name)
  ).trim();
}

function resolveSiteCollectionSystem(definition: SiteDefinition): string {
  if ("collectionSystem" in definition && definition.collectionSystem) {
    return definition.collectionSystem.trim();
  }
  if ("collection" in definition && definition.collection) {
    return (
      definition.collection.systemName?.trim() ||
      toItemSystemName(definition.collection.name)
    );
  }
  return "";
}

/**
 * Delete Sites API entities that were owned last run but have no matching
 * definition file this run. Sites first, then collections (API collection
 * delete removes child sites).
 */
export async function pruneOrphanedSitesApiEntities(options: {
  collectionDefs: CollectionDefinition[];
  siteDefs: SiteDefinition[];
  previous?: SitesApiOwnedState;
}): Promise<{ deletedSites: number; deletedCollections: number }> {
  const previous = options.previous ?? readSitesApiOwnedState();
  const desiredCollectionKeys = new Set(
    options.collectionDefs.map((d) => d.definitionKey),
  );
  const desiredSiteKeys = new Set(options.siteDefs.map((d) => d.definitionKey));

  const stillReferencedCollectionSystems = new Set<string>();
  for (const site of options.siteDefs) {
    const system = resolveSiteCollectionSystem(site);
    if (system) stillReferencedCollectionSystems.add(system.toLowerCase());
  }

  const orphanSites: Array<{ key: string; record: OwnedSiteRecord }> = [];
  for (const [key, record] of Object.entries(previous.sites)) {
    if (!desiredSiteKeys.has(key)) orphanSites.push({ key, record });
  }

  const orphanCollections: Array<{
    key: string;
    record: OwnedCollectionRecord;
  }> = [];
  for (const [key, record] of Object.entries(previous.collections)) {
    if (desiredCollectionKeys.has(key)) continue;
    if (
      stillReferencedCollectionSystems.has(record.systemName.toLowerCase())
    ) {
      console.warn(
        `[sites-api-owned] Keeping collection "${record.systemName}" ` +
          `(definitionKey "${key}" removed, but a site definition still references it)`,
      );
      continue;
    }
    orphanCollections.push({ key, record });
  }

  if (!orphanSites.length && !orphanCollections.length) {
    return { deletedSites: 0, deletedCollections: 0 };
  }

  // Prefer auth from any remaining def; otherwise from first orphan's prior run defaults.
  const apiHint =
    options.siteDefs[0]?.api ||
    options.collectionDefs[0]?.api ||
    undefined;
  const ctx = await createSitesApiContext(apiHint);

  let deletedSites = 0;
  for (const { key, record } of orphanSites.sort((a, b) =>
    a.key.localeCompare(b.key),
  )) {
    console.log(
      `[sites-api-owned] definition removed ("${key}") — deleting site "${record.systemName}"`,
    );
    const result = await syncSiteViaApi(ctx, {
      siteName: record.systemName,
      previousSystemName: record.systemName,
      delete: true,
      forceDelete: true,
    });
    if (result.action === "deleted") deletedSites += 1;
  }

  let deletedCollections = 0;
  for (const { key, record } of orphanCollections.sort((a, b) =>
    a.key.localeCompare(b.key),
  )) {
    console.log(
      `[sites-api-owned] definition removed ("${key}") — deleting collection "${record.systemName}"`,
    );
    const result = await syncCollectionViaApi(ctx, {
      name: record.systemName,
      previousSystemName: record.systemName,
      delete: true,
    });
    if (result.action === "deleted") deletedCollections += 1;
  }

  return { deletedSites, deletedCollections };
}

/** Resolve previousSystemName from owned state when the definition omits it. */
export function resolvePreviousSystemNameFromOwnedState(options: {
  kind: "collection" | "site";
  definitionKey: string;
  systemName: string;
  explicit?: string;
  previous?: SitesApiOwnedState;
}): string | undefined {
  if (options.explicit?.trim()) return options.explicit.trim();
  const previous = options.previous ?? readSitesApiOwnedState();
  const record =
    options.kind === "collection"
      ? previous.collections[options.definitionKey]
      : previous.sites[options.definitionKey];
  if (!record?.systemName) return undefined;
  if (record.systemName.toLowerCase() === options.systemName.toLowerCase()) {
    return undefined;
  }
  return record.systemName;
}

export function buildDesiredCollectionRecord(
  definition: CollectionDefinition,
): OwnedCollectionRecord {
  return { systemName: resolveCollectionSystemName(definition) };
}

export function buildDesiredSiteRecord(
  definition: SiteDefinition,
): OwnedSiteRecord {
  return {
    systemName: resolveSiteSystemName(definition),
    collectionSystem: resolveSiteCollectionSystem(definition),
  };
}

/** Re-export for emitters that already have a context. */
export type { SitesApiContext };
