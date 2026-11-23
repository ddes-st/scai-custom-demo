import { loadLocalEnvFiles } from "../shared/load-local-env";
import {
  resolveDataItemVersions,
  resolveDictionaryDefinitionVersions,
  resolveEnumerationListVersions,
  resolveFieldValidatorVersions,
} from "../shared/normalize-versions";
import { primarySaiHandle, saiHandleFrom } from "../shared/sai-handle";
import {
  definitionKeyFromRef,
  isDefinitionKeyRef,
} from "../shared/definition-ref";
import { applyComponentDefinition } from "./apply/component";
import { applyComponentTemplateContent } from "../content/apply/items";
import { applyDataDefinition } from "./apply/data";
import { applyDictionaryDefinition } from "./apply/dictionary";
import { applyEnumerationDefinition } from "./apply/enumeration";
import { applyFieldValidatorDefinition } from "./apply/field-validator";
import { applyMediaDefinition } from "./apply/media";
import { applyParametersDefinition } from "./apply/parameters";
import { discoverFiles, importAllDefinitions } from "../shared/discover";
import {
  emptyWriteStats,
  formatWriteStats,
  mergeWriteStats,
  type ScsWriteStats,
} from "../shared/authoring-item-model";
import path from "node:path";
import type {
  DataDefinition,
  Definition,
  MediaDefinition,
  RenderingDefinition,
  VariantsDefinition,
} from "./types";
import { applyRenderingDefinition } from "./apply/rendering";
import { applyVariantsDefinition } from "./apply/variants";
import {
  clearCollectionApplyCache,
  applyCollectionDefinition,
} from "./apply/collection";
import { applySiteDefinition } from "./apply/site";
import type { CollectionDefinition, SiteDefinition } from "./types";
import { applySitePresentationDefinition } from "./apply/site-presentation";
import { applyPageStubDefinition } from "./apply/page-stub";
import type { SitePresentationDefinition, PageStubDefinition } from "./types";
import { healCollidingPageStubDefinitionKeys } from "../create-section-components/stub-pages.mjs";
import { getDictionaryRoot } from "../shared/scopes";
import { DEFAULT_PROJECT_COLLECTION } from "../shared/data-placement";
import {
  SitesApiOwnedLedger,
  setActiveSitesApiOwnedLedger,
} from "../shared/sites-api-owned-state";
import { pruneOrphanedSitesApiEntities } from "../shared/sites-api-orphan-prune";
import { clearAuthoringPathCache } from "../shared/authoring-path-cache";
import { clearProjectCollectionRootCache } from "../shared/project-collection-roots";
import { setAuthoringApplyOptions } from "../shared/authoring-apply-bridge";
import { clearItemIdByPathCmCache } from "../shared/resolve-item-id-by-path";
import {
  beginApplyApiDefinition,
  beginApplyApiRun,
  endApplyApiDefinition,
  endApplyApiRun,
  isApplyApiVerbose,
} from "../shared/apply-api-run-log";
import { clearSiblingItemNameRegistry } from "../shared/sibling-item-names";
import { clearLinkListReuseIndexes } from "../shared/link-list-reuse";
import {
  clearValidatorSaiHandleRegistry,
  DEFAULT_VALIDATOR_FOLDER,
} from "../shared/field-validators";
import {
  clearMediaDefinitionRegistry,
  setMediaDefinitionRegistry,
} from "../shared/media-registry";
import { clearMediaEnsureCaches } from "../shared/media-from-source";
import {
  clearVariantsDefinitionRegistry,
  setVariantsDefinitionRegistry,
} from "../shared/variants-registry";
import { ApplyManifest } from "../shared/apply-manifest";
import { isBqPruneSkipped } from "../shared/bq-prune-flags";
import {
  setActiveApplyManifest,
  setActiveApplyRunLog,
  getActiveApplyRunLog,
  setActiveAiLedger,
  clearMediaAltCache,
  getActiveApplyManifest,
} from "../shared/apply-context";
import {
  beginApplyInventorySession,
  canSkipFromApplyInventory,
  clearApplyInventorySession,
  computeDefinitionPackageFacets,
  computeDefinitionPackageHash,
  endApplyInventorySession,
  getActiveApplyInventorySession,
  loadApplyInventory,
  resolveApplySlicePlan,
} from "../shared/apply-inventory";
import { createAiLedger } from "../create-section-components/ai-ledger.mjs";
import { ApplyRunLog } from "../shared/apply-run-log";
import {
  filterDefinitionsByKeyAllowlist,
  filterDefinitionsByScope,
  formatScopeLog,
  parseDefinitionKeyAllowlist,
  parseBootstrapSitesOnly,
  parseGenerateScope,
  parseSitecoreEndpoint,
  parseSkipPull,
  parseSkipSites,
  resolveScopeCollection,
  shouldForceApplyForDefinition,
} from "../shared/generate-scope";
import { requireSitecoreEndpointName } from "../shared/sitecore-auth";
import {
  applyForceTranslations,
  parseAuthoringForce,
  shouldForce,
} from "../shared/authoring-force-kinds.mjs";
import {
  canSkipApplyFromSourceCache,
  computeApplySourceHash,
  formatApplyEta,
  isDefinitionApplyDirty,
  readScopeApplyTiming,
  readScopeLastSuccessful,
  recordApplySourceCache,
  recordApplyTimingSample,
} from "../shared/apply-source-cache.mjs";
import { shouldForceApply } from "../shared/authoring-force-kinds.mjs";
import {
  getTranslationRunStats,
  resetTranslationRunStats,
  setForceTranslations,
} from "../shared/translate";
import { ensureBqConsole } from "../shared/bq-console.mjs";
import {
  logPhase,
  logPhaseDone,
  logRunStart,
  logRunSummary,
  readPhaseNest,
} from "../shared/phase-log.mjs";
import {
  resolveGeneratePhasePlan,
  type GeneratePhasePlan,
} from "./generate-phase-plan";

ensureBqConsole();

const DEF_TOOL = "bq:definitions:generate";

/** Set at start of main from bootstrap / scope / prune flags. */
let defPhaseTotal = resolveGeneratePhasePlan({
  bootstrapSitesOnly: false,
  scopeActive: false,
  skipSites: false,
  pruneSkipped: false,
}).total;

function defPhase(phase: number, title: string, _detail?: string | string[]): void {
  logPhase({
    tool: DEF_TOOL,
    phase,
    total: defPhaseTotal,
    title,
  });
}

function applyPhasePlan(plan: GeneratePhasePlan): void {
  defPhaseTotal = plan.total;
}

type LoadedDefinition = { file: string; definition: Definition };

function definitionKindRank(kind: Definition["kind"]): number {
  switch (kind) {
    case "collection":
      return -2;
    case "site":
      return -1;
    case "field-validator":
      return 0;
    case "media":
      return 1;
    case "parameters":
      return 2;
    case "variants":
      return 3;
    case "rendering":
      return 4;
    case "component":
      return 5;
    case "page-stub":
    case "page":
      return 6;
    case "site-presentation":
      return 7;
    default:
      return 8;
  }
}

function sortRenderingsByDependency(
  items: LoadedDefinition[],
): LoadedDefinition[] {
  const renderingItems = items.filter(
    (item) => item.definition.kind === "rendering",
  );
  const byKey = new Map(
    renderingItems.map((item) => [item.definition.definitionKey, item]),
  );
  const sorted: LoadedDefinition[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(item: LoadedDefinition): void {
    const key = item.definition.definitionKey;
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw new Error(
        `[bq:definitions:generate] Circular parameters { definitionKey } among rendering definitions (cycle at "${key}")`,
      );
    }
    visiting.add(key);
    const def = item.definition as RenderingDefinition;
    if (isDefinitionKeyRef(def.parameters)) {
      const ref = byKey.get(definitionKeyFromRef(def.parameters));
      if (ref) visit(ref);
    }
    visiting.delete(key);
    visited.add(key);
    sorted.push(item);
  }

  for (const item of renderingItems) visit(item);
  return sorted;
}

function isSitesApiDefinition(definition: Definition): boolean {
  return definition.kind === "collection" || definition.kind === "site";
}

function byKey(a: LoadedDefinition, b: LoadedDefinition): number {
  return a.definition.definitionKey.localeCompare(b.definition.definitionKey);
}

/**
 * Phase 1 (Sites API): collections, then sites (ser pull when mutated).
 * Phase 2: remaining definitions so folders from pull exist.
 * Orphan Sites API entities (definition file removed) are pruned before Phase 1.
 */
function buildProcessingOrder(loaded: LoadedDefinition[]): LoadedDefinition[] {
  const collections = loaded
    .filter((item) => item.definition.kind === "collection")
    .sort(byKey);
  const sites = loaded
    .filter((item) => item.definition.kind === "site")
    .sort(byKey);

  const rest = loaded.filter((item) => !isSitesApiDefinition(item.definition));
  const nonRenderings = rest
    .filter((item) => item.definition.kind !== "rendering")
    .sort(
      (a, b) =>
        definitionKindRank(a.definition.kind) -
        definitionKindRank(b.definition.kind),
    );
  const renderings = sortRenderingsByDependency(rest);

  return [...collections, ...sites, ...nonRenderings, ...renderings];
}

/** Last applyDefinition() translate cache delta (hits are silent except this suffix). */
let lastApplyTranslateExtra = "";

function formatTranslateCacheDelta(
  before: ReturnType<typeof getTranslationRunStats>,
): string {
  const after = getTranslationRunStats();
  const hits = after.cacheHits - before.cacheHits;
  const ai = after.cacheMissAi - before.cacheMissAi;
  return `translate: cacheHits=${hits} ai=${ai}`;
}

/** Set in the emit loop so inventory can stamp sourceContentHash. */
let currentApplyDefinitionFile: string | null = null;

/** Last applyDefinition wall time (ms) for definitionResultLine. */
let lastApplyDefinitionMs = 0;

/** Scope used to persist rolling emit timing (set in main). */
let applyTimingScope: {
  collectionSystem: string | null;
  siteSystem: string | null;
} = { collectionSystem: null, siteSystem: null };

async function applyDefinition(
  definition: Definition,
  sectionTitle: string,
  emit: () => Promise<ScsWriteStats>,
): Promise<{ stats: ScsWriteStats }> {
  const beforeTranslate = getTranslationRunStats();
  const applyStarted = Date.now();
  console.log(`[bq:definitions:generate] ${sectionTitle} … applying`);
  getActiveApplyRunLog()?.beginDefinition(sectionTitle);
  const defKey =
    "definitionKey" in definition && definition.definitionKey
      ? String(definition.definitionKey)
      : undefined;
  if (defKey) {
    beginApplyInventorySession(defKey);
    beginApplyApiDefinition({
      definitionKey: defKey,
      definitionFile: currentApplyDefinitionFile,
    });
  }
  try {
    const stats = await emit();
    let sourceHash: string | null = null;
    if (currentApplyDefinitionFile) {
      try {
        const facets = await computeDefinitionPackageFacets(
          currentApplyDefinitionFile,
        );
        sourceHash = facets.packageHash;
        getActiveApplyInventorySession()?.setFacets(facets);
      } catch {
        sourceHash = null;
      }
    }
    if (defKey) {
      endApplyInventorySession(sourceHash);
    }
    lastApplyTranslateExtra = formatTranslateCacheDelta(beforeTranslate);
    lastApplyDefinitionMs = Date.now() - applyStarted;
    if (applyTimingScope.collectionSystem || applyTimingScope.siteSystem) {
      await recordApplyTimingSample({
        collectionSystem: applyTimingScope.collectionSystem,
        siteSystem: applyTimingScope.siteSystem,
        ms: lastApplyDefinitionMs,
      });
    }
    return { stats };
  } catch (err) {
    clearApplyInventorySession();
    throw err;
  } finally {
    endApplyApiDefinition();
  }
}

function definitionResultLine(options: {
  handle: string;
  name: string;
  stats: ScsWriteStats;
  where: string;
  extra?: string;
}): string {
  const timing =
    lastApplyDefinitionMs > 0 ? `apply ${lastApplyDefinitionMs}ms` : "";
  const suffix = [options.extra, lastApplyTranslateExtra, timing]
    .filter(Boolean)
    .join("; ");
  return `[bq:definitions:generate] ${options.handle} (${options.name}) → ${formatWriteStats(options.stats)} [${options.where}]${suffix ? `; ${suffix}` : ""}`;
}

function dataLogHandle(definition: DataDefinition): string {
  const versions = (definition.items ?? []).flatMap((item) =>
    resolveDataItemVersions(item),
  );
  if (!versions.length) {
    return saiHandleFrom(definition.definitionKey, 1);
  }
  return primarySaiHandle(definition.definitionKey, versions);
}

async function main(): Promise<void> {
  const bootstrapSitesOnly = parseBootstrapSitesOnly();
  const skipSites = parseSkipSites();
  // Deprecated CLI flag — Authoring-first never pulls; accept silently for compat.
  parseSkipPull();
  let scope = parseGenerateScope();
  let phasePlan = resolveGeneratePhasePlan({
    bootstrapSitesOnly,
    scopeActive: scope.active,
    skipSites,
    pruneSkipped: isBqPruneSkipped(),
  });
  applyPhasePlan(phasePlan);

  if (!readPhaseNest()) {
    logRunStart({
      tool: DEF_TOOL,
      extra: bootstrapSitesOnly ? "bootstrapSitesOnly" : undefined,
    });
  }

  defPhase(1, "Resolve endpoint and init");
  loadLocalEnvFiles();
  const endpointFromCli = parseSitecoreEndpoint();
  if (endpointFromCli) {
    process.env.BQ_SITECORE_ENDPOINT = endpointFromCli;
  }
  const endpointName = requireSitecoreEndpointName(endpointFromCli);
  console.log(`[bq:definitions:generate] Sitecore CLI endpoint: ${endpointName}`);
  clearAuthoringPathCache();
  clearItemIdByPathCmCache();
  setAuthoringApplyOptions({ endpointName });
  beginApplyApiRun({
    endpointName,
    verbose: isApplyApiVerbose(),
  });

  const forceKinds = parseAuthoringForce();
  resetTranslationRunStats();
  if (shouldForce(forceKinds, "translations")) {
    setForceTranslations(true);
    applyForceTranslations(true);
    console.log(
      "[bq:definitions:generate] translations: force (cache bypass)",
    );
  }

  // Fast path: scoped CLI with both site + collection — skip before load/apply.
  applyTimingScope = {
    collectionSystem: scope.collectionSystem,
    siteSystem: scope.siteSystem,
  };
  let applySourceHash: string | null = null;
  if (scope.active && scope.siteSystem && scope.collectionSystem) {
    const skipCheck = await canSkipApplyFromSourceCache({
      collectionSystem: scope.collectionSystem,
      siteSystem: scope.siteSystem,
      forceKinds,
    });
    applySourceHash = skipCheck.hash;
    if (skipCheck.skip) {
      console.log(
        `[bq:definitions:generate] skip: ${skipCheck.reason} ` +
          `(use --force:apply to regenerate)`,
      );
      return;
    }
  }

  clearValidatorSaiHandleRegistry();
  clearMediaDefinitionRegistry();
  clearMediaEnsureCaches();
  clearVariantsDefinitionRegistry();
  clearCollectionApplyCache();
  clearProjectCollectionRootCache();
  clearSiblingItemNameRegistry();
  clearLinkListReuseIndexes();

  defPhase(2, "Discover, load, and scope definitions");
  // Page stubs used to share bare keys (stub-individuals) across sites — heal before load.
  await healCollidingPageStubDefinitionKeys();
  const files = discoverFiles(".definition.ts");
  if (files.length === 0) {
    console.log("[bq:definitions:generate] No *.definition.ts files found.");
    return;
  }

  const loaded: LoadedDefinition[] = [];
  for (const file of files) {
    const definitions = await importAllDefinitions<Definition>(file);
    for (const definition of definitions) {
      loaded.push({ file, definition });
    }
  }

  const duplicateKeys = new Map<string, string[]>();
  for (const { file, definition } of loaded) {
    const list = duplicateKeys.get(definition.definitionKey) ?? [];
    list.push(file);
    duplicateKeys.set(definition.definitionKey, list);
  }
  for (const [key, paths] of duplicateKeys) {
    if (paths.length > 1) {
      throw new Error(
        `[bq:definitions:generate] Duplicate definitionKey "${key}" in:\n  - ${paths.join("\n  - ")}`,
      );
    }
  }

  scope = resolveScopeCollection(
    scope,
    loaded.map((l) => l.definition),
  );
  phasePlan = resolveGeneratePhasePlan({
    bootstrapSitesOnly,
    scopeActive: scope.active,
    skipSites,
    pruneSkipped: isBqPruneSkipped(),
  });
  applyPhasePlan(phasePlan);
  let scopedLoaded = filterDefinitionsByScope(loaded, scope);
  if (scope.active) {
    console.log(
      `[bq:definitions:generate] ${formatScopeLog(scope, scopedLoaded.length, loaded.length)}`,
    );
    if (scopedLoaded.length === 0) {
      throw new Error(
        `[bq:definitions:generate] Scope matched 0 definitions ` +
          `(site=${scope.siteSystem || "*"} collection=${scope.collectionSystem || "*"}).`,
      );
    }
  }

  // Keep the full site/collection-scoped set for registry lookups. `--definitionKeys`
  // narrows *emit* only — site-presentation still resolves nested parent placeholders /
  // datasources for siblings that are not in this allowlist (e.g. --only footer while
  // the page still wires a hero composite).
  const registrySourceLoaded = scopedLoaded;

  const keyAllowlist = parseDefinitionKeyAllowlist();
  if (keyAllowlist) {
    const beforeKeys = scopedLoaded.length;
    scopedLoaded = filterDefinitionsByKeyAllowlist(scopedLoaded, keyAllowlist);
    console.log(
      `[bq:definitions:generate] definitionKey allowlist: ${keyAllowlist.size} key(s) ` +
        `→ ${scopedLoaded.length}/${beforeKeys} after always-required kinds ` +
        `(collection/site/presentation/validators/enums/dictionaries)`,
    );
    if (scopedLoaded.length === 0) {
      throw new Error(
        `[bq:definitions:generate] definitionKey allowlist matched 0 definitions ` +
          `(keys=${[...keyAllowlist].join(",") || "(infra only)"}).`,
      );
    }
  }

  if (scope.active && scope.siteSystem && scope.collectionSystem) {
    if (!applySourceHash) {
      applySourceHash = await computeApplySourceHash({
        collectionSystem: scope.collectionSystem,
        siteSystem: scope.siteSystem,
      });
    }
    const skipCheck = await canSkipApplyFromSourceCache({
      collectionSystem: scope.collectionSystem,
      siteSystem: scope.siteSystem,
      forceKinds,
      hash: applySourceHash,
    });
    if (skipCheck.skip) {
      console.log(
        `[bq:definitions:generate] skip: ${skipCheck.reason} ` +
          `(use --force:apply to regenerate)`,
      );
      return;
    }
  }

  // Sites API first; then remaining definitions.
  let processingOrder = buildProcessingOrder(scopedLoaded);
  let collectionDefs = scopedLoaded
    .map(({ definition }) => definition)
    .filter((d): d is CollectionDefinition => d.kind === "collection");
  let siteDefs = scopedLoaded
    .map(({ definition }) => definition)
    .filter((d): d is SiteDefinition => d.kind === "site");

  if (skipSites) {
    console.log(
      `[bq:definitions:generate] --skipSites — skipping collection/site emit`,
    );
    processingOrder = processingOrder.filter(
      (item) => !isSitesApiDefinition(item.definition),
    );
    collectionDefs = [];
    siteDefs = [];
  }

  if (bootstrapSitesOnly) {
    processingOrder = processingOrder.filter((item) =>
      isSitesApiDefinition(item.definition),
    );
    console.log(
      "[bq:definitions:generate] --bootstrapSitesOnly — Sites API only, then stop",
    );
  }

  const ownedLedger = new SitesApiOwnedLedger();
  setActiveSitesApiOwnedLedger(ownedLedger);
  const runLog = new ApplyRunLog();
  setActiveApplyRunLog(runLog);
  const aiLedger = createAiLedger();
  setActiveAiLedger(aiLedger);
  clearMediaAltCache();
  try {
    let phaseNo = 2;

    // Sites API orphan prune: full unscoped only. Scoped / BQ_SKIP_PRUNE / --skipSites → silent.
    if (phasePlan.includeOrphanPrune) {
      phaseNo += 1;
      defPhase(phaseNo, "Sites API orphan prune");
      const orphanStats = await pruneOrphanedSitesApiEntities({
        collectionDefs,
        siteDefs,
        previous: ownedLedger.getPrevious(),
      });
      if (orphanStats.deletedSites || orphanStats.deletedCollections) {
        console.log(
          `[bq:definitions:generate] Removed definitions → Sites API deleted ` +
            `${orphanStats.deletedSites} site(s), ${orphanStats.deletedCollections} collection(s)`,
        );
      }
    }

    const apiCount = collectionDefs.length + siteDefs.length;
    phaseNo += 1;
    if (apiCount > 0) {
      defPhase(
        phaseNo,
        `Apply collections and sites (Sites API) — ${apiCount} definition(s)`,
      );
    } else {
      defPhase(
        phaseNo,
        "Apply collections and sites (Sites API) — skipped (none to apply: --skipSites or out of scope)",
      );
    }

    const definitionRegistry = new Map<string, Definition>(
      registrySourceLoaded.map(({ definition }) => [
        definition.definitionKey,
        definition,
      ]),
    );

    setMediaDefinitionRegistry(
      registrySourceLoaded
        .map(({ definition }) => definition)
        .filter((d): d is MediaDefinition => d.kind === "media"),
    );

    setVariantsDefinitionRegistry(
      registrySourceLoaded
        .map(({ definition }) => definition)
        .filter((d): d is VariantsDefinition => d.kind === "variants"),
    );

    const runManifest = new ApplyManifest();
    setActiveApplyManifest(runManifest);

    let totalStats = emptyWriteStats();
    let loggedYamlPhase = false;
    let sourceMtimeSkipped = 0;
    let emittedCount = 0;

    const scopeActive = Boolean(
      scope.active && scope.siteSystem && scope.collectionSystem,
    );
    const scopeLast = scopeActive
      ? await readScopeLastSuccessful({
          collectionSystem: scope.collectionSystem,
          siteSystem: scope.siteSystem,
        })
      : { yamlsAt: null, componentsAt: null, pipelineVersion: null };
    const yamlsAt = scopeLast.yamlsAt;
    const forceApply = shouldForceApply(forceKinds);

    const remainingYamlCount = processingOrder.filter(
      (item) => !isSitesApiDefinition(item.definition),
    ).length;
    const remainingDefsPhase = phaseNo + 1;

    for (const { file, definition } of processingOrder) {
      if (!isSitesApiDefinition(definition) && !loggedYamlPhase) {
        loggedYamlPhase = true;
        const timing = await readScopeApplyTiming({
          collectionSystem: scope.collectionSystem,
          siteSystem: scope.siteSystem,
        });
        const eta = formatApplyEta(timing, remainingYamlCount);
        defPhase(
          remainingDefsPhase,
          eta
            ? `Apply remaining definitions — ${eta}`
            : "Apply remaining definitions — no prior apply timing yet",
        );
      }

      const defKeyForSkip =
        "definitionKey" in definition && definition.definitionKey
          ? String(definition.definitionKey)
          : "";
      const forceThis = shouldForceApplyForDefinition(
        definition,
        forceApply,
        keyAllowlist,
      );

      // Content-hash inventory skip — bypassed when forceThis (--force / --force:apply).
      if (!forceThis && file && defKeyForSkip) {
        try {
          const pkgHash = await computeDefinitionPackageHash(file);
          const invSkip = canSkipFromApplyInventory({
            definitionKey: defKeyForSkip,
            sourceContentHash: pkgHash,
            force: false,
          });
          if (invSkip.skip && invSkip.inventory) {
            sourceMtimeSkipped += 1;
            const manifest = getActiveApplyManifest();
            const runLogSkip = getActiveApplyRunLog();
            for (const e of invSkip.inventory.entries) {
              if (!e.diskPath) continue;
              manifest?.track(e.diskPath);
              // Keep for scoped orphan prune — treat as unchanged keep.
              runLogSkip?.recordWrite("unchanged", e.diskPath);
            }
            console.log(
              `[bq:definitions:generate] ${defKeyForSkip} skip: ${invSkip.reason}`,
            );
            continue;
          }
        } catch {
          /* fall through to mtime / emit */
        }
      }

      if (scopeActive && !forceThis && file) {
        // Do not pass site-wide forceKinds: scoped --force:apply must not mark
        // infra definitions dirty via shouldForceApply inside this helper.
        const dirty = await isDefinitionApplyDirty({
          definitionFile: file,
          yamlsAt,
          forceKinds: new Set(),
          scopeActive: true,
        });
        if (!dirty.dirty) {
          sourceMtimeSkipped += 1;
          const handle = defKeyForSkip || path.basename(file);
          const prior = loadApplyInventory(handle);
          if (prior?.entries?.length) {
            const runLogSkip = getActiveApplyRunLog();
            for (const e of prior.entries) {
              if (!e.diskPath) continue;
              getActiveApplyManifest()?.track(e.diskPath);
              runLogSkip?.recordWrite("unchanged", e.diskPath);
            }
          }
          console.log(
            `[bq:definitions:generate] ${handle} skip: definition source not newer than lastSuccessful.yamlsAt`,
          );
          continue;
        }
      }

      let stats: ScsWriteStats;
      emittedCount += 1;
      currentApplyDefinitionFile = file || null;

      if (definition.kind === "field-validator") {
        const handle = primarySaiHandle(
          definition.definitionKey,
          resolveFieldValidatorVersions(definition),
        );
        const folder = definition.folder?.trim() || DEFAULT_VALIDATOR_FOLDER;
        ({ stats } = await applyDefinition(
          definition,
          `${handle} (${definition.name})`,
          () => applyFieldValidatorDefinition(definition),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: definition.name,
            stats,
            where: `Field Rules/${folder}`,
            extra: definition.cultures?.length
              ? `cultures: ${definition.cultures.join(",")}`
              : undefined,
          }),
        );
      } else if (definition.kind === "media") {
        const handle = saiHandleFrom(definition.definitionKey, 1);
        const folder = definition.location?.folder?.join("/") || "(media root)";
        ({ stats } = await applyDefinition(
          definition,
          `${handle} (${definition.name})`,
          () => applyMediaDefinition(definition),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: definition.name,
            stats,
            where: `media-library/…/${folder}`,
          }),
        );
      } else if (definition.kind === "parameters") {
        const handle = saiHandleFrom(definition.definitionKey, 1);
        const collection =
          definition.collectionSystem ?? DEFAULT_PROJECT_COLLECTION;
        ({ stats } = await applyDefinition(
          definition,
          `${handle} (${definition.name} Parameters)`,
          () => applyParametersDefinition(definition),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: `${definition.name} Parameters`,
            stats,
            where: `sai/templates/${collection}/${definition.name}`,
          }),
        );
      } else if (definition.kind === "variants") {
        const handle = saiHandleFrom(definition.definitionKey, 1);
        ({ stats } = await applyDefinition(
          definition,
          `${handle} (${definition.componentName})`,
          () => Promise.resolve(applyVariantsDefinition(definition)),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: definition.componentName,
            stats,
            where: `site/…/Presentation/Headless Variants/${definition.componentName}`,
          }),
        );
      } else if (definition.kind === "rendering") {
        const handle = saiHandleFrom(definition.definitionKey, 1);
        const collection =
          definition.collectionSystem ?? DEFAULT_PROJECT_COLLECTION;
        ({ stats } = await applyDefinition(
          definition,
          `${handle} (${definition.name})`,
          () => applyRenderingDefinition(definition, definitionRegistry),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: definition.name,
            stats,
            where: `sai/templates+renderings+systemSettings/${collection}`,
          }),
        );
      } else if (definition.kind === "component") {
        const handle = saiHandleFrom(definition.definitionKey, 1);
        const collection =
          definition.collectionSystem ?? DEFAULT_PROJECT_COLLECTION;
        let sliceNote = "";
        ({ stats } = await applyDefinition(
          definition,
          `${handle} (${definition.componentName})`,
          async () => {
            let applyModel = true;
            let applyContent = true;
            if (file) {
              try {
                const facets = await computeDefinitionPackageFacets(file);
                const slice = resolveApplySlicePlan({
                  facets,
                  inventory: loadApplyInventory(defKeyForSkip),
                });
                if (!slice.skipAll) {
                  applyModel = slice.applyModel;
                  applyContent = slice.applyContent;
                  sliceNote = slice.reason;
                  getActiveApplyInventorySession()?.setFacets(facets);
                  if (!applyModel) {
                    const prior = loadApplyInventory(defKeyForSkip);
                    const session = getActiveApplyInventorySession();
                    for (const e of prior?.entries || []) {
                      if (
                        e.kind === "template" ||
                        e.kind === "other" ||
                        e.kind === "folder"
                      ) {
                        session?.record(e);
                        if (e.diskPath) {
                          getActiveApplyManifest()?.track(e.diskPath);
                        }
                      }
                    }
                    console.log(
                      `[bq:definitions:generate] ${defKeyForSkip} slice: skip model (${slice.reason})`,
                    );
                  }
                }
              } catch {
                /* full emit */
              }
            }
            let componentStats = emptyWriteStats();
            if (applyModel) {
              componentStats = mergeWriteStats(
                componentStats,
                await applyComponentDefinition(definition, definitionRegistry),
              );
            }
            if (applyContent && definition.content) {
              componentStats = mergeWriteStats(
                componentStats,
                await applyComponentTemplateContent(definition),
              );
            } else if (!applyContent && definition.content) {
              const prior = loadApplyInventory(defKeyForSkip);
              const session = getActiveApplyInventorySession();
              for (const e of prior?.entries || []) {
                if (e.kind === "content" || e.kind === "media") {
                  session?.record(e);
                  if (e.diskPath) {
                    getActiveApplyManifest()?.track(e.diskPath);
                  }
                }
              }
            }
            return componentStats;
          },
        ));
        const extras = [
          definition.content
            ? `content: ${definition.content.location.root}/${definition.content.location.folder?.join("/") ?? ""}`
            : undefined,
          definition.content?.cultures?.length
            ? `cultures: ${definition.content.cultures.join(",")}`
            : undefined,
          sliceNote || undefined,
        ].filter(Boolean);
        console.log(
          definitionResultLine({
            handle,
            name: definition.componentName,
            stats,
            where: `sai/templates+renderings+systemSettings/${collection}`,
            extra: extras.length ? extras.join("; ") : undefined,
          }),
        );
      } else if (definition.kind === "enumeration") {
        const folder =
          definition.location.folder?.join("/") || "(enumerations root)";
        const rootLabel =
          definition.location.scope === "system"
            ? "system/Enums"
            : `${definition.location.scope}/Enums`;
        const handle = primarySaiHandle(
          definition.definitionKey,
          resolveEnumerationListVersions(definition),
        );
        ({ stats } = await applyDefinition(
          definition,
          `${handle} (${definition.name})`,
          () => applyEnumerationDefinition(definition),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: definition.name,
            stats,
            where: `${rootLabel}/${folder}`,
            extra: definition.cultures?.length
              ? `cultures: ${definition.cultures.join(",")}`
              : undefined,
          }),
        );
      } else if (definition.kind === "dictionary") {
        const dictRoot = getDictionaryRoot(definition.location.scope).folder.join(
          "/",
        );
        const folder = definition.location.folder?.join("/");
        const pathLabel = folder
          ? `${definition.location.scope}/${dictRoot}/${folder}`
          : `${definition.location.scope}/${dictRoot || "Dictionary"}`;
        const handle = primarySaiHandle(
          definition.definitionKey,
          resolveDictionaryDefinitionVersions(definition),
        );
        ({ stats } = await applyDefinition(
          definition,
          `${handle} (${definition.name})`,
          () => applyDictionaryDefinition(definition),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: definition.name,
            stats,
            where: pathLabel,
            extra: definition.cultures?.length
              ? `cultures: ${definition.cultures.join(",")}`
              : undefined,
          }),
        );
      } else if (definition.kind === "data") {
        const pathLabel = `${definition.location.root}/${definition.location.folder.join("/")}`;
        const handle = dataLogHandle(definition);
        ({ stats } = await applyDefinition(
          definition,
          `${handle} (${definition.name})`,
          () => applyDataDefinition(definition),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: definition.name,
            stats,
            where: pathLabel,
            extra: definition.cultures?.length
              ? `cultures: ${definition.cultures.join(",")}`
              : undefined,
          }),
        );
      } else if (definition.kind === "collection") {
        const systemName =
          definition.systemName?.trim() || definition.name.trim();
        const handle = saiHandleFrom(definition.definitionKey, 1);
        ({ stats } = await applyDefinition(
          definition,
          `${handle} (${definition.name})`,
          () => applyCollectionDefinition(definition),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: definition.name,
            stats,
            where: `collection/${systemName}`,
          }),
        );
      } else if (definition.kind === "site") {
        const systemName =
          definition.systemName?.trim() || definition.name.trim();
        const collectionLabel =
          "collectionSystem" in definition && definition.collectionSystem
            ? definition.collectionSystem
            : definition.collection?.systemName ||
              definition.collection?.name ||
              "?";
        const handle = saiHandleFrom(definition.definitionKey, 1);
        ({ stats } = await applyDefinition(
          definition,
          `${handle} (${definition.name})`,
          () => applySiteDefinition(definition),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: definition.name,
            stats,
            where: `site/${collectionLabel}/${systemName}`,
          }),
        );
      } else if (definition.kind === "page" || definition.kind === "page-stub") {
        const stub = definition as PageStubDefinition;
        const handle = saiHandleFrom(stub.definitionKey, 1);
        ({ stats } = await applyDefinition(
          stub,
          `${handle} (${stub.name})`,
          () => applyPageStubDefinition(stub, definitionRegistry),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: stub.name,
            stats,
            where: `Home${stub.routePath}`,
          }),
        );
      } else if (definition.kind === "site-presentation") {
        const pres = definition as SitePresentationDefinition;
        const handle = saiHandleFrom(pres.definitionKey, 1);
        ({ stats } = await applyDefinition(
          pres,
          `${handle} (${pres.siteSystem})`,
          () => applySitePresentationDefinition(pres, definitionRegistry),
        ));
        console.log(
          definitionResultLine({
            handle,
            name: pres.definitionKey,
            stats,
            where: `site/${pres.collectionSystem}/${pres.siteSystem}/Presentation`,
          }),
        );
      } else {
        console.warn(
          `[bq:definitions:generate] Skipping unsupported definition kind in ${file}`,
        );
        continue;
      }

      totalStats = mergeWriteStats(totalStats, stats);
    }

    // Create bootstrap: stop after Sites API (no remaining-defs phase).
    if (bootstrapSitesOnly) {
      ownedLedger.flush();
      const tStatsBootstrap = getTranslationRunStats();
      console.log(
        `[bq:definitions:generate] Done (bootstrapSitesOnly). ${scopedLoaded.length} definition(s), ` +
          `${emittedCount} applied, ${sourceMtimeSkipped} apply skipped (inventory/mtime), ` +
          `${formatWriteStats(totalStats)}. ` +
          `translate cache: hits=${tStatsBootstrap.cacheHits} ai=${tStatsBootstrap.cacheMissAi}`,
      );
      aiLedger.printPageTotals();
      const detailPathBootstrap = runLog.writeToDisk();
      console.log(`[bq:definitions:generate] Detail log: ${detailPathBootstrap}`);
      logPhaseDone();
      if (!readPhaseNest()) {
        logRunSummary({ tool: DEF_TOOL, ai: aiLedger.totals() });
      }
      return;
    }

    if (!loggedYamlPhase) {
      defPhase(
        remainingDefsPhase,
        "Apply remaining definitions — skipped (none in scope for this generate)",
      );
    }

    runLog.logApplySummaryToConsole({
      label: scope.active ? "scoped generate" : "full generate",
    });

    ownedLedger.flush();

    const tStats = getTranslationRunStats();
    console.log(
      `[bq:definitions:generate] Done. ${scopedLoaded.length} definition(s), ` +
        `${emittedCount} applied, ${sourceMtimeSkipped} apply skipped (inventory/mtime), ` +
        `${formatWriteStats(totalStats)}. ` +
        `translate cache: hits=${tStats.cacheHits} ai=${tStats.cacheMissAi} ` +
        `sameCulture=${tStats.skippedSameCulture} nonTranslatable=${tStats.skippedNonTranslatable}` +
        (shouldForce(forceKinds, "translations") ? " (force:translations)" : ""),
    );
    aiLedger.printPageTotals();

    runLog.setValidateResult({
      ok: true,
      summary: "skipped (Authoring apply)",
      output: "",
    });

    if (
      scope.active &&
      scope.siteSystem &&
      scope.collectionSystem &&
      applySourceHash
    ) {
      await recordApplySourceCache({
        collectionSystem: scope.collectionSystem,
        siteSystem: scope.siteSystem,
        hash: applySourceHash,
      });
    }

    const detailPath = runLog.writeToDisk();
    console.log(`[bq:definitions:generate] Detail log: ${detailPath}`);
    logPhaseDone();
    if (!readPhaseNest()) {
      logRunSummary({
        tool: DEF_TOOL,
        ai: aiLedger.totals(),
      });
    }
  } finally {
    setActiveApplyManifest(undefined);
    setActiveApplyRunLog(undefined);
    setActiveAiLedger(undefined);
    clearMediaAltCache();
    setActiveSitesApiOwnedLedger(undefined);
    clearAuthoringPathCache();
    clearItemIdByPathCmCache();
    const apiLogDir = endApplyApiRun();
    if (apiLogDir) {
      console.log(`[bq:definitions:generate] Apply API log: ${apiLogDir}`);
    }
  }
}

main().catch((error) => {
  console.error("[bq:definitions:generate] Failed:", error);
  try {
    endApplyApiRun();
  } catch {
    /* ignore */
  }
  process.exitCode = 1;
});
