import { resolveComponentContentVersions } from "../shared/normalize-versions";
import { primarySaiHandle } from "../shared/sai-handle";
import { discoverFiles, importAllDefinitions, importDefaultExport } from "../shared/discover";
import {
  emptyWriteStats,
  formatWriteStats,
  mergeWriteStats,
} from "../shared/authoring-item-model";
import { applyComponentContent } from "./apply/items";
import type { ComponentContentDefinition } from "./types";
import type {
  ComponentTemplateDefinition,
  Definition,
} from "../definitions/types";
import {
  componentKeyAllowed,
  componentKeyInAllowlist,
  parseDefinitionKeyAllowlist,
  parseGenerateScope,
  resolveScopeCollection,
} from "../shared/generate-scope";
import {
  applyForceTranslations,
  parseAuthoringForce,
  shouldForce,
} from "../shared/authoring-force-kinds.mjs";
import { canSkipApplyFromSourceCache } from "../shared/apply-source-cache.mjs";
import {
  getTranslationRunStats,
  resetTranslationRunStats,
  setForceTranslations,
} from "../shared/translate";
import { ensureBqConsole } from "../shared/bq-console.mjs";
import { logPhase, logPhaseDone } from "../shared/phase-log.mjs";

ensureBqConsole();

async function loadComponentDefinitionsByKey(): Promise<{
  map: Map<string, ComponentTemplateDefinition>;
  collectionByKey: Map<string, string | null>;
  siteByKey: Map<string, string | null>;
  allDefs: Definition[];
}> {
  const map = new Map<string, ComponentTemplateDefinition>();
  const collectionByKey = new Map<string, string | null>();
  const siteByKey = new Map<string, string | null>();
  const allDefs: Definition[] = [];
  for (const file of discoverFiles(".definition.ts")) {
    const defs = await importAllDefinitions<Definition>(file);
    for (const def of defs) {
      allDefs.push(def);
      if (def.kind === "component") {
        map.set(def.definitionKey, def);
        collectionByKey.set(
          def.definitionKey,
          def.collectionSystem?.trim().toLowerCase() || null,
        );
        siteByKey.set(
          def.definitionKey,
          def.siteSystem?.trim().toLowerCase() || null,
        );
      }
    }
  }
  return { map, collectionByKey, siteByKey, allDefs };
}

async function main(): Promise<void> {
  // When nested under create/authoring, authoring-generate.mjs already printed the banner.
  logPhase({
    tool: "bq:content:generate",
    phase: 1,
    total: 1,
    title: "Apply content",
  });
  const forceKinds = parseAuthoringForce();
  resetTranslationRunStats();
  if (shouldForce(forceKinds, "translations")) {
    setForceTranslations(true);
    applyForceTranslations(true);
    console.log("[bq:content:generate] translations: force (cache bypass)");
  }

  let scope = parseGenerateScope();
  if (scope.active && scope.siteSystem && scope.collectionSystem) {
    const skipCheck = await canSkipApplyFromSourceCache({
      collectionSystem: scope.collectionSystem,
      siteSystem: scope.siteSystem,
      forceKinds,
    });
    if (skipCheck.skip) {
      console.log(
        `[bq:content:generate] skip: ${skipCheck.reason} ` +
          `(use --force:apply to regenerate)`,
      );
      return;
    }
  }

  const files = discoverFiles(".content.ts");
  if (files.length === 0) {
    console.log("[bq:content:generate] No *.content.ts files found.");
    return;
  }

  const { map: componentDefs, collectionByKey, siteByKey, allDefs } =
    await loadComponentDefinitionsByKey();
  scope = resolveScopeCollection(scope, allDefs);
  if (scope.active) {
    console.log(
      `[bq:content:generate] scope: site=${scope.siteSystem || "*"} collection=${scope.collectionSystem || "*"}`,
    );
  }
  const keyAllowlist = parseDefinitionKeyAllowlist();
  if (keyAllowlist) {
    console.log(
      `[bq:content:generate] definitionKey allowlist: ${keyAllowlist.size} key(s)`,
    );
  }

  let totalStats = emptyWriteStats();
  let emitted = 0;
  for (const file of files) {
    const content = await importDefaultExport<ComponentContentDefinition>(file);
    if (content.kind !== "component-content") {
      console.warn(`[bq:content:generate] Skipping non-content file: ${file}`);
      continue;
    }

    if (
      !componentKeyAllowed(
        content.definitionKey,
        collectionByKey,
        scope,
        siteByKey,
      )
    ) {
      continue;
    }
    if (!componentKeyInAllowlist(content.definitionKey, keyAllowlist)) {
      continue;
    }

    const componentDefinition = componentDefs.get(content.definitionKey);
    if (!componentDefinition) {
      throw new Error(
        `[bq:content:generate] No component definition found for definitionKey "${content.definitionKey}" (required by ${file})`,
      );
    }
    if (componentDefinition.content) {
      console.warn(
        `[bq:content:generate] Skipping ${file}: definitionKey "${content.definitionKey}" already declares content on its *.definition.ts`,
      );
      continue;
    }

    const saiHandle = primarySaiHandle(
      content.definitionKey,
      resolveComponentContentVersions(content),
    );
    console.log(`[bq:content:generate] ${saiHandle} … emitting`);
    const tBefore = getTranslationRunStats();
    const applyStarted = Date.now();
    const stats = await applyComponentContent(content, componentDefinition);
    const emitMs = Date.now() - applyStarted;
    const tAfter = getTranslationRunStats();
    totalStats = mergeWriteStats(totalStats, stats);
    emitted += 1;
    const pathLabel = `${content.location.root}/${content.location.folder?.join("/") ?? ""}`;
    const cultures = content.cultures?.length
      ? ` +[${content.cultures.join(",")}]`
      : "";
    const hits = tAfter.cacheHits - tBefore.cacheHits;
    const ai = tAfter.cacheMissAi - tBefore.cacheMissAi;
    console.log(
      `[bq:content:generate] ${saiHandle} → ${formatWriteStats(stats)} [${pathLabel}]${cultures}; translate: cacheHits=${hits} ai=${ai}; emit ${emitMs}ms`,
    );
  }

  const tStats = getTranslationRunStats();
  console.log(
    `[bq:content:generate] Done. ${emitted}/${files.length} content file(s), ${formatWriteStats(totalStats)}. ` +
      `translate cache: hits=${tStats.cacheHits} ai=${tStats.cacheMissAi}` +
      (shouldForce(forceKinds, "translations") ? " (force:translations)" : ""),
  );
  logPhaseDone();
}

main().catch((error) => {
  console.error("[bq:content:generate] Failed:", error);
  process.exitCode = 1;
});
