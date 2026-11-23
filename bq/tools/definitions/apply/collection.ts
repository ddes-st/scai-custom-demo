import { toItemSystemName } from "../blueprints/clone-blueprint";
import { createSitesApiContext, syncCollectionViaApi } from "./sites-api";
import {
  emptyWriteStats,
  mergeWriteStats,
  type ScsWriteStats,
} from "../../shared/authoring-item-model";
import type { CollectionDefinition } from "../types";
import { getActiveSitesApiOwnedLedger } from "../../shared/sites-api-owned-state";
import { resolvePreviousSystemNameFromOwnedState } from "../../shared/sites-api-orphan-prune";
import { sanitizeSingleLineText } from "../../shared/naming";

export type ResolvedCollection = {
  systemName: string;
  name: string;
  description: string;
  /** True when remote entity already existed (update/unchanged), not newly created. */
  reused: boolean;
  stats: ScsWriteStats;
  /** Sites API sync action for this run. */
  action: "created" | "updated" | "unchanged" | "deleted" | "missing";
  remoteId?: string;
};

const ensuredThisRun = new Map<string, ResolvedCollection>();

export function clearCollectionApplyCache(): void {
  ensuredThisRun.clear();
}

/** Collection resolved earlier in this generate run (if any). */
export function getEnsuredCollectionThisRun(
  systemName: string,
): ResolvedCollection | undefined {
  return ensuredThisRun.get(systemName.trim());
}

export function resolveCollectionSystemName(
  definition: Pick<CollectionDefinition, "name" | "systemName">,
): string {
  return (
    definition.systemName?.trim() || toItemSystemName(definition.name)
  ).trim();
}

/**
 * Create / update / rename a collection via Sitecore Sites API (GET list first;
 * POST only if missing; PATCH displayName/description when they differ).
 */
export async function ensureCollectionViaApi(options: {
  name: string;
  systemName?: string;
  previousSystemName?: string;
  description?: string;
  definitionKey?: string;
  api?: CollectionDefinition["api"];
}): Promise<ResolvedCollection> {
  const systemName = (
    options.systemName?.trim() || toItemSystemName(options.name)
  ).trim();
  const name = sanitizeSingleLineText(options.name);
  const description =
    sanitizeSingleLineText(options.description) || `${name} description`;

  const cached = ensuredThisRun.get(systemName);
  if (cached) return cached;

  const previousSystemName = options.definitionKey
    ? resolvePreviousSystemNameFromOwnedState({
        kind: "collection",
        definitionKey: options.definitionKey,
        systemName,
        explicit: options.previousSystemName,
      })
    : options.previousSystemName?.trim();

  const ctx = await createSitesApiContext(options.api);
  const result = await syncCollectionViaApi(ctx, {
    name: systemName,
    displayName: name,
    description,
    previousSystemName,
  });

  const remoteId = result.collection?.id?.replace(/[{}]/g, "") || undefined;

  const resolved: ResolvedCollection = {
    systemName,
    name,
    description,
    reused: result.action === "unchanged" || result.action === "updated",
    stats: emptyWriteStats(),
    action: result.action,
    remoteId,
  };
  ensuredThisRun.set(systemName, resolved);

  if (options.definitionKey) {
    getActiveSitesApiOwnedLedger()?.trackCollection(options.definitionKey, {
      systemName,
      id: remoteId,
    });
  }

  console.log(
    `[bq:definitions:generate] collection "${systemName}" via Sites API (${result.action})`,
  );
  return resolved;
}

export async function applyCollectionDefinition(
  definition: CollectionDefinition,
): Promise<ScsWriteStats> {
  const resolved = await ensureCollectionViaApi({
    name: definition.name,
    systemName: definition.systemName,
    previousSystemName: definition.previousSystemName,
    description: definition.description,
    definitionKey: definition.definitionKey,
    api: definition.api,
  });
  return resolved.stats;
}

/** Sites API–managed trees — no local YAML prune roots. */
export function getCollectionPruneRoots(
  _definition: CollectionDefinition,
): string[] {
  return [];
}

export function mergeCollectionStats(
  a: ScsWriteStats,
  b: ScsWriteStats,
): ScsWriteStats {
  return mergeWriteStats(a, b);
}
