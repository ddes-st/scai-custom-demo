/**
 * Orchestrate create:sectioncomponents for one URL, or all host pages with --all.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { bqDotDir, bqRoot, repoRoot } from '../capture/paths.mjs';
import { createAiLedger, flushCreateAiUsageSummary } from './ai-ledger.mjs';
import {
  getTranslationRunStats,
  resetTranslationRunStats,
  setTranslationAiLedger,
} from '../shared/translate-core.mjs';
import {
  screenshotConversionModel,
  loadPreferredSectionHtml,
  loadSectionEvidenceBundle,
} from './ai-codegen.mjs';
import { codegenSection } from './section-codegen.mjs';
import { clearComponentShotFolders } from './clear-component-shot-folders.mjs';

import { loadLocalEnvFiles } from '../capture/lib/design-system/load-env.mjs';
import {
  canSkipSectionConversion,
  computeConversionSourceHash,
} from './conversion-cache.mjs';
import { ensureCollectionAndSite } from './ensure-collection-site.mjs';
import { ensureBrandKitForHost } from '../brandkit/ensure.mjs';
import { resolveCreateBrandkit } from '../brandkit/resolve-flag.mjs';
import { shouldForceConversion } from '../shared/authoring-force-kinds.mjs';
import { printNextStepsEpilogue } from './epilogue.mjs';
import {
  componentCodePrefixFromHostSlug,
  componentCodePrefixFromUrl,
  ensureDistinctCompositeChildren,
  hostToHostSlugFolder,
  toBasePlaceholderKey,
  normalizeCaptureMetaChild,
  toDefinitionKey,
  toKebabCase,
} from './naming.mjs';
import { inferEnrichPageRole } from './enrich-structure-fingerprint.mjs';
import {
  alignChildPlaceholderToParent,
  ensureCompositePresentationChildren,
  extractPlaceholderKeysFromDefinition,
  inferFooterChildPlaceholder,
  isSiteChromeDefinitionKey,
  mergeFooterPartialEntries,
  mergeHeaderPartialEntries,
  resolveChildrenFromSketchOrPackages,
  resolveChromePartialRootFromSketch,
  thumbnailFromCaptureRel,
  pageRenderingFingerprint,
  pageRouteFromCaptureUrl,
  parseSectionIndex,
  preferSingleChildFamily,
  resolveSectionDesktopThumbnailRel,
  writeSitePresentationDefinition,
} from './presentation.mjs';
import { presentationChildrenFromLayoutSketch } from './html-multi-band-contract.mjs';
import {
  buildChromeEvidence,
  catalogueToProvisionalRole,
  mapChromeBandRoles,
  normalizeChromeCatalogue,
} from './chrome-bands.mjs';
import { parentDefinitionKeyFromConversion } from './presentation-coverage.mjs';
import {
  extractPlaceholderBasesFromTsx,
  replacePlaceholdersArray,
} from './sync-definition-from-tsx.mjs';
import {
  assertHomeConversionLogsComplete,
  assertPresentationCoverage,
  buildDetectedDefinitionKeyOrder,
  isBodyMarketingDefinitionKey,
  sortHomeRenderingsByDetectedOrder,
  throwIfCoverageFailed,
  warnPresentationDatasourceContentMismatches,
} from './presentation-coverage.mjs';
import {
  resolveCookieBannerPlacement,
  shouldSkipCookieBannerLayoutPlacement,
} from './cookie-banner-placement.mjs';
import { contentItemsWithVariantsFromDefinition } from './presentation-variant.mjs';
import { extractContentItemNames } from './page-defs.mjs';
import { hydrateSiblingConversionComponents } from './content-item-names-hydrate.mjs';
import { resolveWireComponentResults } from './resolve-wire-component-results.mjs';
import { extractSectionRootId } from './root-html-id.mjs';
import {
  diffSnapshots,
  filterInventory,
  readSectionConversion,
  snapshotFiles,
  writePageConversion,
  writeSectionConversion,
} from './provenance.mjs';
import {
  assertNestedPresentationPlaceholderParity,
  assertPresentationReadyForGenerate,
  buildPageConversionPayload,
  readExistingPageConversion,
} from './presentation-gate.mjs';
import {
  captureOwnsSiteChrome,
  listHostCapturePages,
  listSectionFolders,
  resolveCapturePageDir,
} from './resolve-capture.mjs';
import { resolveOnlyTargets } from './resolve-only-targets.mjs';
import { ensureSiteContentTree, writeStubPageDefinitions } from './stub-pages.mjs';
import {
  componentDir,
  lookupSectionNameIndexEntry,
  qualifySectionDir,
  readCaptureMeta,
  resolveComponentName,
} from './write-component.mjs';
import {
  listTakenComponentNames,
  normalizeIndexChildren,
  pruneRenderingsMissingDefinitionKeys,
  readDefinitionKeyFromPackage,
  upsertSectionNameLock,
} from './early-naming.mjs';
import { maybeRetireForceRenamed } from './force-rename-retire.mjs';
import { runPostWriteFidelity } from './post-write-fidelity.mjs';
import { normalizeDefinitionTs } from './ai-source-fixup.mjs';
import { ensureSectionSitecoreIcon } from './sitecore-icon.mjs';
import { finalizeDefinitionWithParseRetries } from './definition-parse-repair.mjs';
import { writeComponentPackageWithBuildRetries } from './tsx-build-repair.mjs';

/**
 * Role signals for resolveComponentName semantic fallbacks (no Preferred2).
 * @param {object|null|undefined} info
 * @param {object|null|undefined} plan
 */
function resolveNameRoleOpts(info, plan) {
  return {
    presentationRole:
      plan?.role || info?.pageWiring?.role || info?.role || null,
    chromeKind: info?.chromeKind || null,
    track: info?.track || null,
    purpose: info?.purpose || info?.description || null,
  };
}
import { recordComponentsSuccessAt } from '../shared/apply-source-cache.mjs';
import { ensurePartialDesignDynamicPlaceholder } from '../shared/ensure-partial-design-dynamic-placeholder.mjs';
import {
  ensureDefinitionCultures,
  ensureDefinitionSourceCulture,
  ensurePageCaptureSourceCulture,
  inferPageLanguageFromUrl,
  inferSitecoreCultureFromUrl,
  resolveCreateSectionCultures,
  toSitecoreCulture,
} from '../shared/cultures.mjs';
import { ensureSiteSupportedLanguages } from '../shared/ensure-languages.ts';
import { writeStubPageDefinitionsFromLinks } from './stub-pages.mjs';
import { runHostSharedSectionsMerge } from '../capture/merge-page-sections.mjs';
import { getRegistrySection, SECTION_REGISTRY_DIR } from '../capture/lib/section-registry-paths.mjs';
import { loadGlobalManifest } from '../capture/lib/merge-domain-sections.mjs';
import {
  canSkipViaSharedSection,
  listRegistryComponentFolders,
  listRegistryFoldersReferencedByPage,
  markSharedSectionCreated,
  resolveCanonicalInstance,
  resolveEvidenceSectionDir,
} from './shared-section-bridge.mjs';
import {
  resolveAiDebugOutDir,
  clearAiDebugDumpDir,
  clearSectionRegistryAiDebugTrees,
  registryChildFolderStem,
} from './ai-debug-dump.mjs';
import { collapsePlanChildrenToCanonical } from './enrich-structure-fingerprint.mjs';
import {
  ensureRequiredPlaceholdersFromResults,
  explicitChildParentPlaceholder,
  inferPlanChildPlaceholderKey,
  placeholderKeyForHeterogeneousChild,
  resolvePartialFooterRequiredPlaceholders,
  resolvePlanPlaceholderContract,
} from './placeholder-contract.mjs';
import {
  applyOwnerFamilyMergeToDefinition,
  ensureFamilyOwnerPackage,
  maybeThinFamilyDefinition,
} from './content-family-apply.mjs';
import { alignTsxToFieldTypes } from './content-family-merge.mjs';
import { ensureBqConsole } from '../shared/bq-console.mjs';
import {
  BQ_SER_OPS_LOG_ENV,
  logPhase,
  logPhaseDone,
  logPhaseSkip,
  logRunStart,
  logRunSummary,
  logStepStart,
  mergeSerOpsFromLogFile,
  withPhaseHistoryScope,
  withPhaseNest,
} from '../shared/phase-log.mjs';
import {
  flushFixupsMeta,
  logVerbose,
  noteFixup,
  resetFixupLog,
  takeFixupCount,
} from './create-log.mjs';

ensureBqConsole();

const CREATE_TOOL = 'bq:create:sectioncomponents';
const CREATE_PHASE_TOTAL = 7;

/**
 * Authoring apply ensures templates/renderings Project/{collection} roots via
 * GraphQL — local SCS YAML is not required. Used only to warn when collection
 * system is missing before final generate.
 * @param {string} collectionSystem
 */
async function collectionProjectRootsPresent(collectionSystem) {
  return Boolean(String(collectionSystem || '').trim());
}

/**
 * @param {number} phase
 * @param {string} title
 * @param {string|string[]} [_detail]
 */
function createPhase(phase, title, _detail) {
  logPhase({
    tool: CREATE_TOOL,
    phase,
    total: CREATE_PHASE_TOTAL,
    title,
  });
}

/**
 * @param {number} phase
 * @param {string} title
 * @param {string} [reason]
 */
function createPhaseSkip(phase, title, reason) {
  logPhaseSkip({
    tool: CREATE_TOOL,
    phase,
    total: CREATE_PHASE_TOTAL,
    title,
    reason,
  });
}

/**
 * @param {{
 *   siteSystem?: string,
 *   collectionSystem?: string,
 *   capturePageDir?: string,
 *   skipSites?: boolean,
 *   bootstrapSitesOnly?: boolean,
 *   forceTranslations?: boolean,
 *   forceKinds?: Set<string>,
 *   nestPhase?: number,
 *   nestTitle?: string,
 *   definitionKeys?: string[]|Set<string>|null,
 *   useDefinitionKeyAllowlist?: boolean,
 * }} [options]
 * When `useDefinitionKeyAllowlist` is true, passes `--definitionKeys=…` so generate
 * only emits those packages (+ always-required collection/site/presentation/infra).
 * Empty keys → infra only (used for initial generate under --only).
 */
/**
 * Once per create:sectioncomponents process: ensure env languages + PATCH site
 * supportedLanguages for cultures needed by this run (existing sites).
 * @param {{
 *   args: object,
 *   siteSystem?: string,
 *   cultures?: string[],
 * }} opts
 */
async function syncSupportedLanguagesOnce({ args, siteSystem, cultures }) {
  if (args?._supportedLanguagesSynced) return;
  if (args?.dryRun || args?.skipGenerate) {
    args._supportedLanguagesSynced = true;
    return;
  }
  const site = String(siteSystem || args?.site || '').trim();
  const list = [
    ...new Set(
      [...(Array.isArray(cultures) ? cultures : [])]
        .map((c) => String(c || '').trim())
        .filter(Boolean),
    ),
  ];
  if (!site) {
    console.warn(
      '  ⚠ supportedLanguages sync skipped (siteSystem unknown)',
    );
    args._supportedLanguagesSynced = true;
    return;
  }
  try {
    const result = await ensureSiteSupportedLanguages({
      siteSystem: site,
      cultures: list,
    });
    console.log(`  · site supportedLanguages: ${result}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠ site supportedLanguages sync failed (continuing): ${msg}`);
  }
  args._supportedLanguagesSynced = true;
}

async function runAuthoringGenerate(options) {
  const nestPhase = options?.nestPhase ?? 0;
  const nestTitle = options?.nestTitle || 'Authoring generate';
  if (nestPhase > 0) {
    createPhase(nestPhase, nestTitle);
  } else {
    console.log('\n▶ npm run authoring:generate');
  }

  const siteSystem = String(options?.siteSystem || '').trim();
  const collectionSystem = String(options?.collectionSystem || '').trim();
  if (!siteSystem || !collectionSystem) {
    throw new Error(
      '[bq:create:sectioncomponents] authoring:generate requires siteSystem and collectionSystem ' +
        '(create must always be site-scoped; do not run unscoped generate from create).',
    );
  }

  const { formatForceArgForGenerate } = await import(
    '../shared/authoring-force-kinds.mjs'
  );
  const { formatDefinitionKeysCliArg } = await import(
    './apply-definition-allowlist.mjs'
  );

  /** @type {Set<string>} */
  const forceKinds = options?.forceKinds instanceof Set
    ? options.forceKinds
    : new Set();
  if (options?.forceTranslations) forceKinds.add('translations');

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const scopeArgs = [
    `--site=${siteSystem}`,
    `--collection=${collectionSystem}`,
  ];
  if (options?.skipSites) scopeArgs.push('--skipSites');
  if (options?.bootstrapSitesOnly) scopeArgs.push('--bootstrapSitesOnly');
  const forceArg = formatForceArgForGenerate(forceKinds);
  if (forceArg) scopeArgs.push(forceArg);
  if (options?.useDefinitionKeyAllowlist) {
    const keysArg = formatDefinitionKeysCliArg(options.definitionKeys ?? []);
    if (keysArg) scopeArgs.push(keysArg);
  }
  const cmd = `${npm} run authoring:generate -- ${scopeArgs.join(' ')}`;

  const prevCapture = process.env.BQ_CAPTURE_PAGE_DIR;
  const prevKeys = process.env.BQ_GENERATE_DEFINITION_KEYS;
  const prevSerOpsLog = process.env[BQ_SER_OPS_LOG_ENV];
  const serOpsLogPath = path.join(
    bqDotDir,
    'ser-ops',
    `create-${process.pid}-${Date.now()}.jsonl`,
  );
  if (options?.capturePageDir) {
    process.env.BQ_CAPTURE_PAGE_DIR = options.capturePageDir;
  } else {
    delete process.env.BQ_CAPTURE_PAGE_DIR;
  }
  if (options?.useDefinitionKeyAllowlist) {
    const list = [...(options.definitionKeys ?? [])]
      .map((k) => String(k || '').trim())
      .filter(Boolean);
    process.env.BQ_GENERATE_DEFINITION_KEYS = list.join(',');
  }
  mkdirSync(path.dirname(serOpsLogPath), { recursive: true });
  process.env[BQ_SER_OPS_LOG_ENV] = serOpsLogPath;

  const runChild = () =>
    new Promise((resolve, reject) => {
      // Avoid spawn(cmd, args, { shell: true }) — Node DEP0190. On Windows, .cmd
      // also requires a shell (shell:false → EINVAL), so use one shell command string.
      const child = spawn(cmd, {
        cwd: bqRoot,
        stdio: 'inherit',
        shell: true,
        env: process.env,
      });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`authoring:generate exited ${code}`));
      });
    });

  try {
    if (nestPhase > 0) {
      await withPhaseNest(
        {
          tool: CREATE_TOOL,
          phase: nestPhase,
          total: CREATE_PHASE_TOTAL,
          title: nestTitle,
        },
        runChild,
      );
    } else {
      await runChild();
    }
  } finally {
    mergeSerOpsFromLogFile(serOpsLogPath);
    try {
      unlinkSync(serOpsLogPath);
    } catch {
      /* best-effort cleanup */
    }
    if (prevCapture === undefined) delete process.env.BQ_CAPTURE_PAGE_DIR;
    else process.env.BQ_CAPTURE_PAGE_DIR = prevCapture;
    if (prevKeys === undefined) delete process.env.BQ_GENERATE_DEFINITION_KEYS;
    else process.env.BQ_GENERATE_DEFINITION_KEYS = prevKeys;
    if (prevSerOpsLog === undefined) delete process.env[BQ_SER_OPS_LOG_ENV];
    else process.env[BQ_SER_OPS_LOG_ENV] = prevSerOpsLog;
  }
}

/**
 * Register section/parent components into page presentation wiring arrays.
 * @param {{
 *   role: string,
 *   componentResults: object[],
 *   allComponentsForPresentation: object[],
 *   homeRenderings: object[],
 *   partials: object[],
 * }} opts
 */
/**
 * Resolve presentation role for a section (never default chrome to page).
 * @param {string|null|undefined} priorRole
 * @param {object|null|undefined} info
 * @param {string|null|undefined} definitionKey
 */
function resolveSectionWiringRole(priorRole, info, definitionKey) {
  // Visual chrome catalogue wins (no cookie partial).
  const catalogue = normalizeChromeCatalogue(
    info?.chromeCatalogue || info?.chromeBandCatalogue || '',
  );
  if (info?.chromeCatalogue || info?.chromeBandCatalogue) {
    return catalogueToProvisionalRole(catalogue);
  }
  let prior = String(priorRole || '').trim();
  if (prior === 'partial-cookie') prior = 'page';
  // Marketing body bands (hero / media / callout) stay on headless-main even if AI said partial-*.
  if (definitionKey && isBodyMarketingDefinitionKey(definitionKey)) {
    return 'page';
  }
  if (prior && prior !== 'page') return prior;
  // Position / layout enrich (not cmsName) — strip stored AI role so we get signals only.
  const hintInfo = info ? { ...info } : null;
  if (hintInfo) {
    delete hintInfo.role;
    delete hintInfo.pageWiring;
  }
  const enrich = inferEnrichPageRole(hintInfo);
  if (enrich === 'partial-cookie') return 'page';
  if (enrich && enrich !== 'page') return enrich;
  // Last resort: legacy stubs with no prior role and no enrich signal.
  if (!prior && definitionKey && isSiteChromeDefinitionKey(definitionKey)) {
    const k = String(definitionKey).toLowerCase();
    if (/consent|cookie|privacy-consent/.test(k)) return 'page';
    if (
      /footer/.test(k) &&
      !/footer-legal|footer-navigation|footer-signpost|footer-social|footer-branding|footer-link/.test(
        k,
      )
    ) {
      return 'partial-footer';
    }
    return 'partial-header';
  }
  return prior || 'page';
}

async function registerSectionWiring(opts) {
  const {
    role,
    componentResults,
    allComponentsForPresentation,
    homeRenderings,
    partials,
    sectionHtml = '',
    sectionInfo = null,
    /** Sitecoreize layoutSketch — preferred source for nested page/partial children. */
    layoutSketch = null,
    /** When false (secondary pages), only wire body bands — never overwrite Partial Designs. */
    allowPartialWiring = true,
    /** @type {'place'|'none'} */
    cookieBannerPlacement = 'none',
  } = opts;
  const parent =
    componentResults.find((c) => c.role === 'section') || componentResults[0];
  if (!parent) return;

  const sectionRootId = sectionHtml
    ? extractSectionRootId(sectionHtml)
    : undefined;

  let effectiveRole = resolveSectionWiringRole(
    role,
    sectionInfo,
    parent.definitionKey,
  );
  // Do not remap explicit `page` via definitionKey names (mid-page "Footer CTA" stays page).
  // Last resort only when role was empty and enrich missed — resolveSectionWiringRole already did that.

  if (
    !allowPartialWiring &&
    (effectiveRole === 'partial-header' || effectiveRole === 'partial-footer')
  ) {
    allComponentsForPresentation.push({
      definitionKey: parent.definitionKey,
      role: effectiveRole,
      availableGroup: 'Navigation',
    });
    console.warn(
      `  ⚠ Presentation: skipped partial wiring for "${parent.definitionKey}" on secondary page (home owns chrome)`,
    );
    return;
  }

  for (const c of componentResults) {
    if (c.role === 'child') {
      allComponentsForPresentation.push({
        definitionKey: c.definitionKey,
        role: effectiveRole,
        availableGroup: effectiveRole.startsWith('partial') ? 'Navigation' : 'Page Content',
      });
    }
  }

  allComponentsForPresentation.push({
    definitionKey: parent.definitionKey,
    role: effectiveRole,
    availableGroup:
      effectiveRole === 'partial-header' || effectiveRole === 'partial-footer'
        ? 'Navigation'
        : 'Page Content',
  });

  // Opt-out: still list in availableRenderings; do not place on page/partial.
  if (
    shouldSkipCookieBannerLayoutPlacement(
      cookieBannerPlacement,
      sectionInfo,
      parent.definitionKey,
    )
  ) {
    console.warn(
      `  ⚠ Presentation: skipped cookie banner layout placement for "${parent.definitionKey}" (cookiebanner-placement=none)`,
    );
    return;
  }

  if (effectiveRole === 'page') {
    // Prefer layoutSketch nesting; drop self-nested host keys; else package seeds.
    // pageRole only chooses placement (headless-main) — same composite rules as partials.
    let children = resolveChildrenFromSketchOrPackages({
      layoutSketch,
      componentResults,
      parentDefinitionKey: parent.definitionKey,
      mapSketch: presentationChildrenFromLayoutSketch,
      buildFallback: () => buildNestedHomeChildren(componentResults),
    });
    let pageDatasourceItem = null;
    try {
      const { extractContentItemNames, soleSeedDatasourceName } = await import(
        './page-defs.mjs'
      );
      const defRel =
        parent.sources?.definition ||
        componentResults.find((c) => c.role === 'section' || c.role === 'parent')
          ?.sources?.definition;
      if (defRel) {
        const defAbs = path.isAbsolute(defRel)
          ? defRel
          : path.join(process.cwd(), defRel);
        let defSrc = '';
        try {
          defSrc = readFileSync(defAbs, 'utf8');
        } catch {
          defSrc = '';
        }
        // Sole content.items seed only — ignore componentName / prior labels.
        pageDatasourceItem = soleSeedDatasourceName(
          extractContentItemNames(defSrc),
        );
      }
    } catch {
      pageDatasourceItem = null;
    }
    let entry = {
      definitionKey: parent.definitionKey,
      placeholder: 'headless-main',
      role: 'page',
      ...(pageDatasourceItem ? { datasourceItem: pageDatasourceItem } : {}),
      ...(sectionRootId && !children.length
        ? { renderingIdentifier: sectionRootId }
        : {}),
      ...(children.length ? { children } : {}),
    };
    entry = ensureCompositePresentationChildren(entry, componentResults);
    if (entry.children?.length && sectionRootId && !entry.renderingIdentifier) {
      // keep dyn-id path; drop renderingIdentifier when children exist
      delete entry.renderingIdentifier;
    }
    const fp = pageRenderingFingerprint(entry);
    const dup = homeRenderings.some((r) => pageRenderingFingerprint(r) === fp);
    if (dup) {
      console.warn(
        `  ⚠ Presentation: skipped duplicate page rendering "${parent.definitionKey}"`,
      );
    } else {
      homeRenderings.push(entry);
    }
  } else if (effectiveRole === 'partial-header') {
    // Nest child renderings under the header parent; earlier bands → siblingsBefore.
    // Root comes from layoutSketch (authority) + section package — not name heuristics.
    const sketchRoot = resolveChromePartialRootFromSketch({
      layoutSketch,
      componentResults,
      fallbackDefinitionKey: parent.definitionKey,
    });
    const rootKey =
      String(sketchRoot?.definitionKey || parent.definitionKey || '').trim() ||
      parent.definitionKey;
    const rootPackage =
      componentResults.find((c) => c.definitionKey === rootKey) || parent;
    const parentPhKeys = extractPlaceholderKeysFromDefinition(
      rootPackage?.sources?.definition || parent?.sources?.definition,
    );
    const canHost = parentPhKeys.length > 0;
    let children = resolveChildrenFromSketchOrPackages({
      layoutSketch,
      componentResults,
      parentDefinitionKey: rootKey,
      mapSketch: presentationChildrenFromLayoutSketch,
      buildFallback: () =>
        buildNestedHomeChildren(componentResults, {
          role: 'partial-header',
        }),
    });
    // Parent definition PH keys only (AI decides single vs composite) —
    // do not invent enrich header-navigation requirements after a flat sitecoreize.
    children = ensureRequiredPlaceholdersFromResults({
      children,
      componentResults,
      requiredPlaceholders: parentPhKeys,
      parentKey: String(rootKey || ''),
    });
    if (parentPhKeys.length) {
      children = children.map((c) => {
        const aligned = alignChildPlaceholderToParent(
          c.placeholder ||
            inferPlanChildPlaceholderKey({
              definitionKey: c.definitionKey,
              componentName: c.definitionKey,
            }) ||
            undefined,
          parentPhKeys,
        );
        return aligned ? { ...c, placeholder: aligned } : c;
      });
    }
    const sectionIndex = parseSectionIndex(sectionInfo?.index);
    const thumbnail = thumbnailFromCaptureRel(
      resolveSectionDesktopThumbnailRel(
        sectionInfo,
        sectionInfo?.folderName,
      ),
    );
    const sketchDs = String(sketchRoot?.datasourceItem || '').trim();
    const entry = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: rootKey,
      // In-memory: this band's sketch/conversion root — merge prefers it over stuck disk leaves.
      sketchRoot: true,
      canHostChildren: canHost,
      ...(sectionIndex !== undefined ? { sectionIndex } : {}),
      ...(sketchDs ? { datasourceItem: sketchDs } : {}),
      ...(sectionRootId && !children.length
        ? { renderingIdentifier: sectionRootId }
        : {}),
      ...(thumbnail ? { thumbnail } : {}),
      ...(children.length ? { children } : {}),
    };
    const existingIdx = partials.findIndex((p) => p.signature === 'header');
    if (existingIdx >= 0) {
      // Host capability from stamped canHostChildren (disk map at write).
      partials[existingIdx] = mergeHeaderPartialEntries(
        partials[existingIdx],
        entry,
      );
    } else {
      partials.push(entry);
    }
  } else if (effectiveRole === 'partial-footer') {
    const parentPhKeys = extractPlaceholderKeysFromDefinition(
      parent?.sources?.definition,
    );
    // Follow AI codegen — parent def keys (e.g. footer-columns) or child packages; never the legacy four-band checklist.
    const footerKeys = resolvePartialFooterRequiredPlaceholders({
      parentPlaceholderKeys: parentPhKeys,
      componentResults,
      extractPlaceholderKeysFromDefinition,
      extractPlaceholderBasesFromTsx,
    });
    // Same composite rules as page body — pageRole only selects partial-footer placement.
    let children = resolveChildrenFromSketchOrPackages({
      layoutSketch,
      componentResults,
      parentDefinitionKey: parent.definitionKey,
      mapSketch: presentationChildrenFromLayoutSketch,
      buildFallback: () =>
        buildNestedHomeChildren(componentResults, { role: 'partial-footer' }),
    });
    // Placeholder-keyed backstop: wire/warn by required placeholder coverage, never by package-name regex.
    // Only uses real componentResults packages — never invents ghost definitionKeys.
    children = ensureRequiredPlaceholdersFromResults({
      children,
      componentResults,
      requiredPlaceholders: footerKeys,
      parentKey: String(parent.definitionKey || ''),
    });
    children = children.map((c) => {
      const aligned = alignChildPlaceholderToParent(
        c.placeholder ||
          inferFooterChildPlaceholder(c.definitionKey, c.datasourceItem) ||
          undefined,
        footerKeys,
      );
      return aligned ? { ...c, placeholder: aligned } : c;
    });
    // Dedupe identical column seeds (Our Offer spam).
    const seenSeed = new Set();
    children = children.filter((c) => {
      const soft = [
        String(c.definitionKey || ''),
        String(c.placeholder || ''),
        String(c.datasourceItem || ''),
      ].join('::');
      if (seenSeed.has(soft)) return false;
      seenSeed.add(soft);
      return true;
    });
    const thumbnail = thumbnailFromCaptureRel(
      resolveSectionDesktopThumbnailRel(
        sectionInfo,
        sectionInfo?.folderName,
      ),
    );
    const sectionIndex = parseSectionIndex(sectionInfo?.index);
    const entry = {
      signature: 'footer',
      placeholder: 'headless-footer',
      definitionKey: parent.definitionKey,
      canHostChildren: true,
      ...(sectionIndex !== undefined ? { sectionIndex } : {}),
      ...(sectionRootId && !children.length
        ? { renderingIdentifier: sectionRootId }
        : {}),
      ...(thumbnail ? { thumbnail } : {}),
      ...(children.length ? { children } : {}),
    };
    // One footer Partial Design — peer host bands merge via siblingsBefore;
    // same/preferred shell still unions children (see mergeFooterPartialEntries).
    const existingIdx = partials.findIndex((p) => p.signature === 'footer');
    if (existingIdx >= 0) {
      const merged = mergeFooterPartialEntries(partials[existingIdx], entry);
      partials[existingIdx] = {
        ...merged,
        children: preferSingleChildFamily(merged.children || []),
      };
    } else {
      partials.push({
        ...entry,
        children: preferSingleChildFamily(entry.children || []),
      });
    }
  }
  // partial-cookie retired — catalogue "other" / consent lands on page (or header band via cuts).
}

/**
 * Map footer child renderings to the correct parent placeholder key.
 * Re-exported from presentation.mjs for callers that historically imported here.
 * @param {string} definitionKey
 * @param {string} datasourceItem
 * @param {string} [variant]
 * @returns {string | undefined}
 */
export { inferFooterChildPlaceholder };

/**
 * For Placeholder composites: one home layout child per content seed item,
 * each bound via datasourceItem to the matching Data YAML.
 * Infers non-Default `variant` from content seeds (Promo / Teaser / …).
 * Passes through optional `renderingIdentifier` from content seeds (capture root id).
 * @param {object[]} componentResults
 * @param {{ role?: string }} [opts]
 * @returns {Array<{ definitionKey: string, datasourceItem: string, variant?: string, placeholder?: string, renderingIdentifier?: string }>}
 */
function buildNestedHomeChildren(componentResults, opts = {}) {
  const isFooter = opts.role === 'partial-footer';
  const parent =
    componentResults.find((c) => c.role === 'section') || componentResults[0];
  const parentKey = String(parent?.definitionKey || '');
  const parentPlaceholderKeys = extractPlaceholderKeysFromDefinition(
    parent?.sources?.definition,
  );
  const alignKeys = isFooter
    ? resolvePartialFooterRequiredPlaceholders({
        parentPlaceholderKeys,
        componentResults,
        extractPlaceholderKeysFromDefinition,
        extractPlaceholderBasesFromTsx,
      })
    : parentPlaceholderKeys.length > 0
      ? parentPlaceholderKeys
      : [];

  const childPackages = componentResults.filter((c) => c.role === 'child');

  /** @returns {string[]} */
  const placeholderKeysForPackage = (pkg) => {
    const fromDef = extractPlaceholderKeysFromDefinition(pkg?.sources?.definition);
    if (fromDef.length) return fromDef;
    return extractPlaceholderBasesFromTsx(pkg?.sources?.tsx || '');
  };

  /** Keys that are themselves composites (own AppPlaceholders). */
  const compositeChildKeys = new Set(
    childPackages
      .filter((c) => placeholderKeysForPackage(c).length > 0)
      .map((c) => String(c.definitionKey || '')),
  );

  /** allowedControls union for a composite child package. */
  const allowedUnderComposite = (pkg) => {
    const src = String(pkg?.sources?.definition || '');
    /** @type {Set<string>} */
    const ctrls = new Set();
    const re = /allowedControls\s*:\s*\[([^\]]*)\]/g;
    let m;
    while ((m = re.exec(src))) {
      for (const hit of m[1].matchAll(/["']([^"']+)["']/g)) {
        ctrls.add(hit[1]);
      }
    }
    return ctrls;
  };

  /**
   * Match allowedControls entry to a package definitionKey or short name
   * (e.g. "footer-link-column" vs "sitecore-footer-link-column").
   * @param {Set<string>} allowed
   * @param {string} oKey
   */
  const allowedMatchesKey = (allowed, oKey) => {
    if (!oKey || !allowed.size) return false;
    if (allowed.has(oKey)) return true;
    const short = oKey.includes('-')
      ? oKey.split('-').slice(1).join('-')
      : oKey;
    if (short && allowed.has(short)) return true;
    for (const a of allowed) {
      if (oKey === a || oKey.endsWith(`-${a}`) || a.endsWith(`-${oKey}`)) {
        return true;
      }
      if (short && (a === short || a.endsWith(`-${short}`))) return true;
    }
    return false;
  };

  /** Child packages that should nest under a given composite key (not siblings of parent). */
  const nestUnder = new Map();
  for (const composite of childPackages) {
    const cKey = String(composite.definitionKey || '');
    if (!compositeChildKeys.has(cKey)) continue;
    const allowed = allowedUnderComposite(composite);
    if (!allowed.size) continue;
    for (const other of childPackages) {
      const oKey = String(other.definitionKey || '');
      if (!oKey || oKey === cKey || oKey === parentKey) continue;
      if (allowedMatchesKey(allowed, oKey)) {
        if (!nestUnder.has(cKey)) nestUnder.set(cKey, []);
        nestUnder.get(cKey).push(other);
      }
    }
  }
  const nestedAway = new Set(
    [...nestUnder.values()].flat().map((c) => String(c.definitionKey || '')),
  );

  /**
   * Prefer sitecoreize parentPlaceholder / placeholderKey before footer name heuristics.
   * @param {object} child
   * @param {{ name?: string, variant?: string }} [item]
   */
  const resolveNestingPlaceholder = (child, item = {}) => {
    let placeholder =
      explicitChildParentPlaceholder(child) ||
      (isFooter
        ? inferFooterChildPlaceholder(
            child.definitionKey,
            item.name,
            item.variant,
          )
        : undefined) ||
      inferPlanChildPlaceholderKey({
        definitionKey: child.definitionKey,
        componentName: child.componentName,
        placeholder: child.placeholder,
        placeholderKey: child.placeholderKey,
        parentPlaceholder: child.parentPlaceholder,
      }) ||
      (alignKeys.length > 1
        ? placeholderKeyForHeterogeneousChild(child, child.definitionKey)
        : undefined);
    if (placeholder && alignKeys.length) {
      placeholder = alignChildPlaceholderToParent(placeholder, alignKeys);
    }
    return placeholder || undefined;
  };

  /** Build seed placements for one child package (no grandchildren). */
  const seedPlacements = (child) => {
    /** @type {Array<{ definitionKey: string, datasourceItem: string, variant?: string, placeholder?: string, renderingIdentifier?: string, children?: object[] }>} */
    const placements = [];
    const withVariants = contentItemsWithVariantsFromChild(child);
    if (withVariants.length) {
      for (const item of withVariants) {
        const placeholder = resolveNestingPlaceholder(child, item);
        placements.push({
          definitionKey: child.definitionKey,
          datasourceItem: item.name,
          ...(item.variant ? { variant: item.variant } : {}),
          ...(placeholder ? { placeholder } : {}),
          ...(item.renderingIdentifier
            ? { renderingIdentifier: item.renderingIdentifier }
            : {}),
        });
      }
      return placements;
    }
    const names = contentItemNamesFromDefinitionSource(
      child.sources?.definition,
      child.contentItemNames,
    );
    for (const name of names) {
      const placeholder = resolveNestingPlaceholder(child, { name });
      placements.push({
        definitionKey: child.definitionKey,
        datasourceItem: name,
        ...(placeholder ? { placeholder } : {}),
      });
    }
    return placements;
  };

  /** @type {Array<{ definitionKey: string, datasourceItem: string, variant?: string, placeholder?: string, renderingIdentifier?: string, children?: object[] }>} */
  const out = [];
  for (const child of childPackages) {
    const childKey = String(child.definitionKey || '');
    if (parentKey && childKey === parentKey) {
      console.warn(
        `  ⚠ Presentation: skipped self-nested child "${parentKey}" (distinct child definitionKey required)`,
      );
      continue;
    }
    // Nested under another composite child — skip as parent sibling.
    if (nestedAway.has(childKey) && !compositeChildKeys.has(childKey)) {
      continue;
    }

    const placements = seedPlacements(child);
    const grandchildrenPkgs = nestUnder.get(childKey) || [];
    if (grandchildrenPkgs.length) {
      /** @type {object[]} */
      const grandchildren = [];
      for (const g of grandchildrenPkgs) {
        grandchildren.push(...seedPlacements(g));
      }
      for (const p of placements) {
        out.push({
          ...p,
          ...(grandchildren.length ? { children: grandchildren } : {}),
        });
      }
      if (grandchildren.length) {
        console.warn(
          `  ⚠ Presentation: nested ${grandchildren.length} grandchild placement(s) under composite "${childKey}"`,
        );
      }
      continue;
    }
    out.push(...placements);
  }
  return preferSingleChildFamily(out);
}

/**
 * When AI decompose is skipped, prior conversion may list only the parent.
 * Reload child packages listed in capture-meta so presentation can wire seeds.
 * @param {object[]} componentResults
 * @param {string} hostSlug
 */
async function hydrateCompositeChildrenFromCaptureMeta(componentResults, hostSlug) {
  const list = Array.isArray(componentResults) ? [...componentResults] : [];
  if (list.some((c) => c?.role === 'child')) return list;
  const parent =
    list.find((c) => c?.role === 'section' || c?.role === 'page') || list[0];
  if (!parent?.componentName) return list;

  let meta = null;
  try {
    meta = await readCaptureMeta(hostSlug, parent.componentName);
  } catch {
    meta = null;
  }
  const childEntries = Array.isArray(meta?.children) ? meta.children : [];
  if (!childEntries.length) return list;

  // Parent role on reuse stubs is often "page" — treat as section for wiring.
  if (parent.role === 'page') parent.role = 'section';

  let hydrated = 0;
  for (const entry of childEntries) {
    const normalized = normalizeCaptureMetaChild(entry);
    if (!normalized) continue;
    const { componentName: name, definitionKey } = normalized;
    const kebab = toKebabCase(name);
    const dir = componentDir(hostSlug, name);
    const defRel = relRepo(path.join(dir, `${kebab}.definition.ts`));
    let contentItemNames = [];
    try {
      const text = readFileSync(path.join(dir, `${kebab}.definition.ts`), 'utf8');
      contentItemNames = extractContentItemNames(text);
    } catch {
      contentItemNames = [];
    }
    list.push({
      role: 'child',
      componentName: name,
      definitionKey,
      contentItemNames,
      sources: {
        tsx: relRepo(path.join(dir, `${kebab}.tsx`)),
        definition: defRel,
        captureMeta: relRepo(path.join(dir, `${kebab}.capture-meta.json`)),
      },
      emitted: [],
    });
    hydrated += 1;
  }
  if (hydrated) {
    console.warn(
      `  ⚠ Reuse hydrate: loaded ${hydrated} child package(s) from ${parent.componentName} capture-meta for presentation wiring`,
    );
  }
  return list;
}

/**
 * @param {{ sources?: { definition?: string }, contentItemNames?: string[] }} child
 * @returns {Array<{ name: string, variant?: string }>}
 */
function contentItemsWithVariantsFromChild(child) {
  const definitionRelPath = child?.sources?.definition;
  if (!definitionRelPath) return [];
  try {
    const abs = path.isAbsolute(definitionRelPath)
      ? definitionRelPath
      : path.join(repoRoot, definitionRelPath);
    const text = readFileSync(abs, 'utf8');
    return contentItemsWithVariantsFromDefinition(text);
  } catch {
    return [];
  }
}

/**
 * @param {string | undefined} definitionRelPath repo-relative path to *.definition.ts
 * @param {string[] | undefined} precomputed
 * @returns {string[]}
 */
function contentItemNamesFromDefinitionSource(definitionRelPath, precomputed) {
  if (Array.isArray(precomputed) && precomputed.length) {
    return precomputed;
  }
  if (!definitionRelPath) return [];
  try {
    const abs = path.isAbsolute(definitionRelPath)
      ? definitionRelPath
      : path.join(repoRoot, definitionRelPath);
    const text = readFileSync(abs, 'utf8');
    // Use page-defs extractor (apostrophe-safe; ignores JSON.stringify([...]) noise).
    return extractContentItemNames(text);
  } catch {
    return [];
  }
}

function pageWiringForRole(role) {
  return {
    role: role === 'page' ? 'page' : 'partial',
    placeholder:
      role === 'partial-header'
        ? 'headless-header'
        : role === 'partial-footer'
          ? 'headless-footer'
          : 'headless-main',
  };
}

/**
 * Phase A: AI decompose/codegen once per section-registry folder (canonical evidence).
 * Groups work by canonical page and invokes create with --only those section folders.
 *
 * @param {{
 *   args: object,
 *   projectRoot: string,
 *   pages: Array<{ url: string, pageSlug: string, pageDir: string }>,
 *   folderFilter?: string[]|null,
 *   mergeResult?: object|null,
 *   sharedBuiltThisRun: Map<string, object>,
 *   familyOwnerEmitted: Map<string, object>,
 *   ledger: object,
 * }} opts
 */
export async function codegenFromRegistry(opts) {
  const {
    args,
    projectRoot,
    pages,
    folderFilter = null,
    mergeResult = null,
    sharedBuiltThisRun,
    familyOwnerEmitted,
    ledger,
  } = opts;

  const {
    loadComponentInventory,
    listInventoryFoldersNeedingCodegen,
  } = await import('./component-inventory.mjs');
  const inventory = await loadComponentInventory(projectRoot);
  const inventoryNeed = listInventoryFoldersNeedingCodegen(inventory);

  const allFolders = await listRegistryComponentFolders(projectRoot, {
    manifest: mergeResult?.globalManifest || null,
  });
  let folders = folderFilter?.length
    ? allFolders.filter((f) => folderFilter.includes(f))
    : allFolders;
  // Prefer inventory needs-codegen when no explicit folder filter (force rebuilds all).
  if (!folderFilter?.length && inventoryNeed?.length && !args.force) {
    const needSet = new Set(inventoryNeed);
    const filtered = folders.filter((f) => needSet.has(f));
    if (filtered.length) folders = filtered;
  }

  if (!folders.length) {
    console.log('  · Phase A: no registry component folders to codegen');
    return { folders: [], byPage: new Map() };
  }

  /** @type {Map<string, { url: string, pageDir: string, pageSlug: string, sectionFolders: string[] }>} */
  const byPage = new Map();
  const pageBySlug = new Map(pages.map((p) => [p.pageSlug, p]));

  for (const componentFolder of folders) {
    const entry =
      mergeResult?.globalManifest?.components &&
      (Object.values(mergeResult.globalManifest.components).find(
        (e) => e.folderName === componentFolder,
      ) ||
        null);
    const canon = await resolveCanonicalInstance(
      projectRoot,
      componentFolder,
      entry,
    );
    if (!canon) {
      console.warn(
        `  ⚠ Phase A: skip ${componentFolder} — no canonical instance`,
      );
      continue;
    }

    let page = pageBySlug.get(canon.pageSlug);
    if (!page) {
      let url = '';
      try {
        url = String(
          await readFile(path.join(canon.pageDir, 'source-url.txt'), 'utf8'),
        ).trim();
      } catch {
        /* none */
      }
      if (!url) {
        console.warn(
          `  ⚠ Phase A: skip ${componentFolder} — no URL for ${canon.pageSlug}`,
        );
        continue;
      }
      page = {
        url,
        pageSlug: canon.pageSlug,
        pageDir: canon.pageDir,
        projectRoot,
      };
      pageBySlug.set(canon.pageSlug, page);
    }

    let group = byPage.get(canon.pageSlug);
    if (!group) {
      group = {
        url: page.url,
        pageDir: page.pageDir,
        pageSlug: canon.pageSlug,
        sectionFolders: [],
      };
      byPage.set(canon.pageSlug, group);
    }
    if (!group.sectionFolders.includes(canon.sectionFolder)) {
      group.sectionFolders.push(canon.sectionFolder);
    }
    console.log(
      `  · registry:${componentFolder} ← ${canon.pageSlug}/${canon.sectionFolder}`,
    );
  }

  console.log(
    `\n▶ Codegen shared components from registry: ${folders.length} folder(s), ${byPage.size} canonical page(s)`,
  );

  let pageIndex = 0;
  for (const group of byPage.values()) {
    pageIndex += 1;
    const only = group.sectionFolders.slice().sort().join(',');
    console.log(
      `\n════ Shared codegen ${pageIndex}/${byPage.size}: ${group.pageSlug} (--only ${only}) ════`,
    );
    await withPhaseHistoryScope(() =>
      runCreateSectionComponents({
        ...args,
        url: group.url,
        only,
        all: false,
        wireOnly: false,
        codegenOnly: true,
        skipMerge: true,
        skipGenerate: true,
        _hostPageLoop: true,
        _registryPhaseDone: true,
        _sharedBuiltThisRun: sharedBuiltThisRun,
        _familyOwnerEmitted: familyOwnerEmitted,
        _mergeResult: mergeResult,
        _ledger: ledger,
        _skipInitialGenerate: pageIndex > 1 || Boolean(args.skipGenerate),
        _skipFinalGenerate: true,
        _skipEpilogue: true,
        _keepTranslationStats: pageIndex > 1,
      }),
    );
  }

  return { folders, byPage };
}

/**
 * Host-wide: merge once, codegen from registry, wire every page, generate once.
 * @param {object} args
 */
export async function runCreateSectionComponentsAll(args) {
  loadLocalEnvFiles({ root: bqRoot });
  resetFixupLog();
  const seed = await resolveCapturePageDir(args.url, undefined, {
    hostWide: true,
  });
  const pages = await listHostCapturePages(args.url);
  if (!pages.length) {
    throw new Error(`--all: no captured pages under ${seed.projectRoot}`);
  }
  logRunStart({
    tool: CREATE_TOOL,
    extra: `site=${seed.hostSlug} · --all · ${pages.length} page(s)`,
  });
  for (const p of pages) {
    console.log(`  · ${p.pageSlug}  ${p.url}`);
  }

  /** @type {Map<string, object>} */
  const sharedBuiltThisRun = new Map();
  /** @type {Map<string, object>} */
  const familyOwnerEmitted = new Map();
  const ledger = createAiLedger();
  /** @type {{ aiStats?: object, globalManifest?: object }|null} */
  let mergeResult = args._mergeResult || null;
  /** @type {unknown} */
  let fatal = null;
  let aiFlushed = false;
  const flushAi = (failed, error) => {
    if (aiFlushed) return;
    aiFlushed = true;
    flushCreateAiUsageSummary({
      ledger,
      failed: Boolean(failed),
      error,
      tool: CREATE_TOOL,
      logRunSummary,
    });
  };

  try {
  if (!args.skipMerge) {
    createPhase(1, 'Merge section registry (once for --all)');
    const mergeStarted = Date.now();
    mergeResult = await runHostSharedSectionsMerge({
      url: seed.url,
      ai: Boolean(args.mergeAi),
      useAi: false,
      skipWebsiteDesign: true,
    });
    const ms = Date.now() - mergeStarted;
    const aiStats = mergeResult?.aiStats;
    if (aiStats && (aiStats.called || aiStats.totalTokens)) {
      const cost =
        aiStats.costUsd > 0 ? `~$${Math.round(aiStats.costUsd * 1e6) / 1e6}` : 'cost n/a';
      console.log(
        `  AI merge phase totals: called=${aiStats.called} in=${aiStats.promptTokens} out=${aiStats.completionTokens} total=${aiStats.totalTokens} ${cost} (${ms}ms)`,
      );
    } else {
      console.log(`  Merge phase: no AI pair calls (${ms}ms)`);
    }
    const stats = mergeResult?.globalManifest?.stats;
    if (stats) {
      console.log(
        `  Registry: ${stats.uniqueComponents} unique components from ${stats.slotsListed} listed slots`,
      );
    }
  } else {
    createPhase(1, 'Merge section registry — skipped (--skip-merge)');
    try {
      mergeResult = {
        globalManifest: await loadGlobalManifest(
          path.join(seed.projectRoot, SECTION_REGISTRY_DIR),
        ),
      };
    } catch {
      mergeResult = null;
    }
  }

  if (!args.wireOnly) {
    createPhase(2, 'Codegen shared components (HTML/PNG → TSX + defs)');
    await codegenFromRegistry({
      args,
      projectRoot: seed.projectRoot,
      pages,
      mergeResult,
      sharedBuiltThisRun,
      familyOwnerEmitted,
      ledger,
    });
  } else {
    createPhase(2, 'Codegen shared components (HTML/PNG → TSX + defs) — skipped (--wire-only)');
  }

  if (!args.codegenOnly) {
    // Host-level once: collection/site defs, Sites API bootstrap, brandkit.
    // Page wiring never owns these (brand kit is site/domain scoped).
    const evidencePage =
      pages.find((p) => /--home$/i.test(String(p.pageSlug || ''))) ||
      pages[0] ||
      seed;
    const hostSlugFolder = hostToHostSlugFolder(seed.hostSlug);

    // Cultures once for --all (site api.languages + supportedLanguages sync).
    const hostCultures = resolveCreateSectionCultures({
      cliCultures: args.cultures != null ? String(args.cultures) : null,
    });
    let hostPageCulture = '';
    try {
      const evidenceMeta = JSON.parse(
        await readFile(path.join(evidencePage.pageDir, 'page-meta.json'), 'utf8'),
      );
      const evidenceUrl =
        evidencePage.url || seed.url || args.url || evidenceMeta?.url || '';
      const pageLanguage =
        evidenceMeta?.pageLanguage ||
        (evidenceUrl ? inferPageLanguageFromUrl(evidenceUrl) : '') ||
        'en';
      hostPageCulture =
        evidenceMeta?.culture ||
        (evidenceUrl
          ? inferSitecoreCultureFromUrl(evidenceUrl, hostCultures)
          : toSitecoreCulture(pageLanguage, hostCultures)) ||
        '';
    } catch {
      /* optional */
    }
    args._cultures = hostCultures;
    args._pageCulture = hostPageCulture || args._pageCulture;

    createPhase(3, 'Ensure collection & site + Sites API bootstrap (host)');
    let designMd = '';
    try {
      designMd = await readFile(
        path.join(evidencePage.pageDir, 'ai-derived-design.md'),
        'utf8',
      );
    } catch {
      /* optional */
    }
    const collSite = await ensureCollectionAndSite({
      url: evidencePage.url || seed.url || args.url,
      hostSlug: seed.hostSlug,
      collectionSystem: args.collection,
      siteSystem: args.site,
      dryRun: args.dryRun,
      designMd,
      ledger,
      languages: [
        ...(args._cultures || []),
        ...(hostPageCulture ? [hostPageCulture] : []),
      ],
    });

    if (!args.dryRun && !args.skipGenerate) {
      try {
        await runAuthoringGenerate({
          siteSystem: collSite.siteSystem,
          collectionSystem: collSite.collectionSystem,
          capturePageDir: evidencePage.pageDir,
          forceKinds: args.forceKinds,
          forceTranslations: Boolean(args.forceTranslations),
          nestPhase: 0,
          nestTitle: 'Ensure collection & site (Sites API)',
          bootstrapSitesOnly: true,
          useDefinitionKeyAllowlist: false,
          definitionKeys: [],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `  ✖ host Sites API bootstrap failed — must succeed before page wire.\n` +
            `    ${msg}`,
        );
        throw err;
      }
      await syncSupportedLanguagesOnce({
        args,
        siteSystem: collSite.siteSystem,
        cultures: [
          'en',
          ...(args._cultures || []),
          ...(hostPageCulture ? [hostPageCulture] : []),
        ],
      });
    } else {
      console.log(
        `  · Sites API bootstrap skipped (${args.dryRun ? 'dry-run' : 'skip-generate'})`,
      );
    }

    if (resolveCreateBrandkit({ brandkit: args.brandkit })) {
      console.log('\n▶ Stream brand kit (once per host/site)');
      try {
        const brandkitResult = await ensureBrandKitForHost({
          enabled: true,
          url: evidencePage.url || seed.url || args.url,
          hostProjectRoot: seed.projectRoot,
          pageDir: evidencePage.pageDir,
          siteSystem: collSite.siteSystem,
          siteDefinitionPath: collSite.siteFile,
          force: shouldForceConversion(args.forceKinds),
          dryRun: Boolean(args.dryRun),
          ledger,
          args: { brandkit: args.brandkit },
        });
        if (brandkitResult?.brandkitId) {
          console.log(
            `  brandkit: id=${brandkitResult.brandkitId} action=${brandkitResult.action || 'ok'}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  ⚠ brandkit ensure failed (continuing create): ${msg}`);
      }
    }

    const n = pages.length;
    console.log(`\n▶ Wire page presentation (${n} page(s))`);
    for (let i = 0; i < n; i++) {
      const page = pages[i];
      console.log(`\n════ Wire page ${i + 1}/${n}: ${page.pageSlug} ════`);
      await withPhaseHistoryScope(() =>
        runCreateSectionComponents({
          ...args,
          url: page.url,
          all: false,
          wireOnly: true,
          codegenOnly: false,
          skipMerge: true,
          skipGenerate: Boolean(args.skipGenerate),
          _hostPageLoop: true,
          _registryPhaseDone: true,
          _sharedBuiltThisRun: sharedBuiltThisRun,
          _familyOwnerEmitted: familyOwnerEmitted,
          _mergeResult: mergeResult,
          _ledger: ledger,
          // Host already bootstrapped collection/site (+ brandkit).
          _skipInitialGenerate: true,
          _skipFinalGenerate: true,
          _skipEpilogue: true,
          _keepTranslationStats: i > 0,
          _brandkitDone: true,
          collection: collSite.collectionSystem || args.collection,
          site: collSite.siteSystem || args.site || hostSlugFolder,
        }),
      );
    }
  } else {
    createPhase(3, 'Wire page presentation — skipped (--codegen-only)');
  }

  // --all: phases 3–6 — emit skip lines so 7/7 stays honest
  if (!args.codegenOnly) {
    createPhaseSkip(
      3,
      'Ensure collection & site (Sites API)',
      '--all: already ran as host-level phase before page wire',
    );
    createPhaseSkip(
      4,
      'Build page & stub content tree',
      '--all: stub tree is built per page during wire',
    );
    createPhaseSkip(
      5,
      'Codegen page sections (HTML/PNG → TSX + defs)',
      '--all: page sections convert during shared codegen / per-page wire',
    );
    createPhaseSkip(
      6,
      'Wire page presentation',
      '--all: presentation is written per page during wire',
    );
  }

  if (!args.dryRun && !args.skipGenerate && !args.codegenOnly) {
    let siteSystem = args.site;
    let collectionSystem = args.collection;
    try {
      const pageConv = JSON.parse(
        await readFile(path.join(pages[0].pageDir, 'page-conversion.json'), 'utf8'),
      );
      siteSystem = siteSystem || pageConv.site;
      collectionSystem = collectionSystem || pageConv.collection;
    } catch {
      /* use CLI */
    }
    if (siteSystem && collectionSystem) {
      const rootsOk = await collectionProjectRootsPresent(collectionSystem);
      if (!rootsOk) {
        console.warn(
          `  ⚠ collection Project roots missing for "${collectionSystem}" — final generate will ensure sites via Sites API`,
        );
      }
      // Fail closed: Phase A codegenOnly must not lead to push without presentation.
      await assertPresentationReadyForGenerate({
        hostSlug: hostToHostSlugFolder(seed.hostSlug),
        siteSystem,
        requireWhenNoSections: true,
      });
      await runAuthoringGenerate({
        siteSystem,
        collectionSystem,
        // Always emit collection/site (Sites API) so Data/Home exist for content apply.
        forceKinds: args.forceKinds,
        forceTranslations: Boolean(args.forceTranslations),
        nestPhase: 7,
        nestTitle: 'Apply definitions to SitecoreAI (--all)',
      });
    } else {
      console.warn(
        '  ⚠ --all: skip final generate (site/collection unknown; pass --site and --collection)',
      );
      createPhaseSkip(
        7,
        'Apply definitions to SitecoreAI',
        'site/collection unknown (pass --site and --collection)',
      );
    }
  } else if (args.skipGenerate || args.dryRun) {
    createPhaseSkip(
      7,
      'Apply definitions to SitecoreAI',
      args.dryRun ? 'dry-run' : 'skip-generate',
    );
  }

  logPhaseDone();
  flushAi(false);
  if (!args.dryRun) {
    const metaPath = await flushFixupsMeta(seed.projectRoot, {
      tool: 'create:sectioncomponents',
    });
    if (metaPath) {
      console.log(`\n✓ Wrote ${relRepo(metaPath)}`);
    }
  } else {
    resetFixupLog();
  }
  printNextStepsEpilogue();
  } catch (err) {
    fatal = err;
    throw err;
  } finally {
    flushAi(Boolean(fatal), fatal);
  }
}

export async function runCreateSectionComponents(args) {
  if (args.all && !args._hostPageLoop) {
    return runCreateSectionComponentsAll(args);
  }

  loadLocalEnvFiles({ root: bqRoot });
  if (!args._hostPageLoop) {
    resetFixupLog();
  }
  const conversionModel = screenshotConversionModel();

  const capture = await resolveCapturePageDir(args.url);
  const hostSlug = hostToHostSlugFolder(capture.hostSlug);
  const codePrefix =
    componentCodePrefixFromUrl(capture.url) ||
    componentCodePrefixFromHostSlug(capture.hostSlug || hostSlug);
  if (!args._hostPageLoop) {
    logRunStart({
      tool: CREATE_TOOL,
      extra: `site=${hostSlug}`,
    });
  }
  console.log(
    `Screenshot conversion model: ${conversionModel || '(unset — set AZURE_OPENAI_SCREENSHOT_CONVERSION_MODEL or AZURE_OPENAI_DEFAULT_MODEL)'}`,
  );
  console.log(`Project: ${capture.projectRoot}`);
  console.log(`Page:    ${capture.pageDir}`);
  console.log(`FE folder: bq/src/components/${hostSlug}/`);
  console.log(`Component code prefix: ${codePrefix}`);

  /** @type {Map<string, { componentFolder: string, componentName: string, definitionKey: string, components?: object[] }>} */
  const sharedBuiltThisRun = args._sharedBuiltThisRun || new Map();
  /** Per-run: contentFamilyId → owner ensure result (template+items once). */
  /** @type {Map<string, object>} */
  const familyOwnerEmitted = args._familyOwnerEmitted || new Map();
  /** @type {{ aiStats?: object }|null} */
  let mergeResult = args._mergeResult || null;
  const ledger = args._ledger || createAiLedger();
  setTranslationAiLedger(ledger);
  if (!args._keepTranslationStats) {
    resetTranslationRunStats();
  }
  /** @type {unknown} */
  let fatal = null;
  let aiFlushed = false;
  const flushAi = (failed, error) => {
    if (aiFlushed) return;
    aiFlushed = true;
    flushCreateAiUsageSummary({
      ledger,
      failed: Boolean(failed),
      error,
      tool: CREATE_TOOL,
      logRunSummary:
        !args._hostPageLoop && !args._skipEpilogue ? logRunSummary : null,
    });
  };

  if (!args.skipMerge) {
    createPhase(1, 'Merge section registry');
    const mergeStarted = Date.now();
    mergeResult = await runHostSharedSectionsMerge({
      url: capture.url,
      ai: Boolean(args.mergeAi),
      useAi: false,
      skipWebsiteDesign: true,
    });
    const ms = Date.now() - mergeStarted;
    const aiStats = mergeResult?.aiStats;
    if (aiStats && (aiStats.called || aiStats.totalTokens)) {
      const cost =
        aiStats.costUsd > 0 ? `~$${Math.round(aiStats.costUsd * 1e6) / 1e6}` : 'cost n/a';
      console.log(
        `  AI merge phase totals: called=${aiStats.called} in=${aiStats.promptTokens} out=${aiStats.completionTokens} total=${aiStats.totalTokens} ${cost} (${ms}ms)`,
      );
    } else {
      console.log(`  Merge phase: no AI pair calls (${ms}ms)`);
    }
    const stats = mergeResult?.globalManifest?.stats;
    if (stats) {
      console.log(
        `  Registry: ${stats.uniqueComponents} unique components from ${stats.slotsListed} listed slots`,
      );
    }
  } else if (!args._hostPageLoop) {
    createPhase(1, 'Merge section registry — skipped (--skip-merge)');
  }

  // Single-URL: Phase A for registry keys this page references (canonical evidence),
  // then continue into Phase B-style page wiring (AI skips via sharedBuiltThisRun).
  if (
    !args._hostPageLoop &&
    !args._registryPhaseDone &&
    !args.wireOnly
  ) {
    let pageSectionFolders = await listSectionFolders(capture.sectionsDir, null);
    // Honor --only so Phase A does not expand to every registry key on the page.
    if (args.only) {
      const onlyForPhaseA = await resolveOnlyTargets({
        only: args.only,
        sectionsDir: capture.sectionsDir,
        hostComponentsDir: path.join(bqRoot, 'src', 'components', hostSlug),
      });
      if (onlyForPhaseA.sectionFolders.length) {
        const allow = new Set(onlyForPhaseA.sectionFolders);
        pageSectionFolders = pageSectionFolders.filter((f) => allow.has(f));
      }
    }
    const referenced = await listRegistryFoldersReferencedByPage(
      capture.pageDir,
      pageSectionFolders,
    );
    const hostPages = await listHostCapturePages(args.url);
    if (args.codegenOnly) {
      createPhase(
        2,
        `Codegen shared components (HTML/PNG → TSX + defs) only (${referenced.length || 'all'} key(s))`,
      );
      await codegenFromRegistry({
        args,
        projectRoot: capture.projectRoot,
        pages: hostPages,
        folderFilter: referenced.length ? referenced : null,
        mergeResult,
        sharedBuiltThisRun,
        familyOwnerEmitted,
        ledger,
      });
      ledger.printPageTotals();
      if (!args._skipEpilogue) printNextStepsEpilogue();
      return;
    }
    if (referenced.length) {
      logStepStart({
        tool: CREATE_TOOL,
        title: `Codegen shared components (HTML/PNG → TSX + defs) (${referenced.length} key(s) for this page)`,
      });
      await codegenFromRegistry({
        args: { ...args, skipGenerate: true },
        projectRoot: capture.projectRoot,
        pages: hostPages,
        folderFilter: referenced,
        mergeResult,
        sharedBuiltThisRun,
        familyOwnerEmitted,
        ledger,
      });
      logPhaseDone();
    }
  }

  // Extra cultures: CLI > BQ_CULTURES only (page-meta carries source culture, not extras)
  let pageMeta = null;
  try {
    pageMeta = JSON.parse(
      await readFile(path.join(capture.pageDir, 'page-meta.json'), 'utf8'),
    );
  } catch {
    /* optional */
  }
  const cultures = resolveCreateSectionCultures({
    cliCultures: args.cultures != null ? String(args.cultures) : null,
  });
  const pageUrl = args.url || capture.url || pageMeta?.url || '';
  const pageLanguage =
    pageMeta?.pageLanguage ||
    (pageUrl ? inferPageLanguageFromUrl(pageUrl) : '') ||
    'en';
  const inferredCulture = pageUrl
    ? inferSitecoreCultureFromUrl(pageUrl, cultures)
    : toSitecoreCulture(pageLanguage, cultures);
  const captureCulture = await ensurePageCaptureSourceCulture(capture.pageDir, {
    cultures,
    pageLanguage,
    culture: pageMeta?.culture || inferredCulture || null,
    url: pageUrl || null,
  });
  const pageCulture = captureCulture.culture;
  console.log(
    `Cultures: ${cultures.length ? cultures.join(', ') : '(none)'} | page language: ${pageLanguage} | culture: ${pageCulture}` +
      (captureCulture.sectionsUpdated || captureCulture.pageMetaUpdated
        ? ` (backfilled ${captureCulture.sectionsUpdated} section(s)` +
          (captureCulture.pageMetaUpdated ? ', page-meta' : '') +
          ')'
        : ''),
  );

  // Stash for definition post-write
  args._cultures = cultures;
  args._pageLanguage = pageLanguage;
  args._pageCulture = pageCulture;

  const pddp = ensurePartialDesignDynamicPlaceholder();
  const pddpRel = path.relative(bqRoot, pddp.path);
  if (pddp.created) {
    console.log(`Host component: created ${pddpRel}`);
  } else if (pddp.updated) {
    console.log(`Host component: updated ${pddpRel}`);
  }

  try {
    const designMdPath = path.join(capture.pageDir, 'ai-derived-design.md');
  let designMd = '';
  try {
    designMd = await readFile(designMdPath, 'utf8');
  } catch {
    console.warn('  ⚠ ai-derived-design.md missing');
  }

  createPhase(2, 'Ensure collection & site definitions');
  const collSite = await ensureCollectionAndSite({
    url: capture.url,
    hostSlug: capture.hostSlug,
    collectionSystem: args.collection,
    siteSystem: args.site,
    dryRun: args.dryRun,
    designMd,
    ledger,
    languages: [
      ...(args._cultures || []),
      ...(pageCulture ? [pageCulture] : []),
    ],
  });
  let detected = null;
  try {
    detected = JSON.parse(
      await readFile(path.join(capture.pageDir, 'detected-sections.json'), 'utf8'),
    );
  } catch {
    console.warn('  ⚠ detected-sections.json missing');
  }

  const hostComponentsDir = path.join(bqRoot, 'src', 'components', hostSlug);
  /** @type {Awaited<ReturnType<typeof resolveOnlyTargets>>|null} */
  let onlyResolved = null;
  if (args.only) {
    onlyResolved = await resolveOnlyTargets({
      only: args.only,
      sectionsDir: capture.sectionsDir,
      hostComponentsDir,
    });
    if (onlyResolved.unresolved.length) {
      throw new Error(
        `--only could not resolve: ${onlyResolved.unresolved.join(', ')} ` +
          `(expected section-NN, definitionKey, or package folder under ${hostComponentsDir})`,
      );
    }
    console.log(
      `  ✓ --only: ${onlyResolved.tokens.length} token(s) → ` +
        `${onlyResolved.sectionFolders.length} section(s), ` +
        `${onlyResolved.definitionKeys.length} definitionKey(s)`,
    );
  }

  if (!args.dryRun && !args.skipGenerate && !args._skipInitialGenerate) {
    try {
      await runAuthoringGenerate({
        siteSystem: collSite.siteSystem,
        collectionSystem: collSite.collectionSystem,
        capturePageDir: capture.pageDir,
        forceKinds: args.forceKinds,
        forceTranslations: Boolean(args.forceTranslations),
        nestPhase: 3,
        nestTitle: 'Ensure collection & site (Sites API)',
        // Sites API only — do not emit stale page/component YAML before phases 5–6 rewrite them.
        bootstrapSitesOnly: true,
        // --only: do not force-emit every site component on the warm-up generate
        useDefinitionKeyAllowlist: Boolean(args.only),
        definitionKeys: onlyResolved?.definitionKeys ?? [],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `  ✖ initial generate failed — collection/site Sites API bootstrap must succeed before later phases.\n` +
          `    ${msg}`,
      );
      throw err;
    }
    await syncSupportedLanguagesOnce({
      args,
      siteSystem: collSite.siteSystem,
      cultures: [
        'en',
        ...(args._cultures || []),
        ...(pageCulture ? [pageCulture] : []),
      ],
    });
  } else {
    const bootstrapSkipReason = args.dryRun
      ? 'dry-run'
      : args.skipGenerate
        ? 'skip-generate'
        : args._skipInitialGenerate
          ? 'already bootstrapped earlier in this run (--all / follow-up page)'
          : 'not needed for this run';
    createPhaseSkip(
      3,
      'Ensure collection & site (Sites API)',
      bootstrapSkipReason,
    );
  }

  // Stream brand kit (optional): site/domain scoped — host --all owns this;
  // standalone single-page runs still ensure once after bootstrap.
  if (
    !args._hostPageLoop &&
    !args.codegenOnly &&
    !args._brandkitDone &&
    resolveCreateBrandkit({ brandkit: args.brandkit })
  ) {
    try {
      const brandkitResult = await ensureBrandKitForHost({
        enabled: true,
        url: capture.url || args.url,
        hostProjectRoot: capture.projectRoot,
        pageDir: capture.pageDir,
        siteSystem: collSite.siteSystem,
        siteDefinitionPath: collSite.siteFile,
        force: shouldForceConversion(args.forceKinds),
        dryRun: Boolean(args.dryRun),
        ledger,
        args: { brandkit: args.brandkit },
      });
      args._brandkitDone = true;
      if (brandkitResult?.brandkitId) {
        console.log(
          `  brandkit: id=${brandkitResult.brandkitId} action=${brandkitResult.action || 'ok'}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ⚠ brandkit ensure failed (continuing create): ${msg}`);
      args._brandkitDone = true;
    }
  }

  createPhase(4, 'Build page & stub content tree');
  const { stubs } = await ensureSiteContentTree(capture.projectRoot);
  const stubFiles = await writeStubPageDefinitions({
    stubs,
    siteSystem: collSite.siteSystem,
    collectionSystem: collSite.collectionSystem,
    hostSlug,
    culture: args._pageCulture || 'en',
    cultures: args._cultures || [],
    dryRun: args.dryRun,
  });

  // Key/package-only: skip AI conversion when no sections to convert (e.g. --force:apply on a package).
  let sectionFolders = onlyResolved
    ? onlyResolved.sectionFolders.length
      ? onlyResolved.sectionFolders
      : []
    : await listSectionFolders(capture.sectionsDir, null);

  const authoringRoot = path.join(repoRoot, 'authoring', 'items', 'bq-demo', 'sai');
  const beforeSnap = await snapshotFiles(authoringRoot);
  const pageRouteEarly = pageRouteFromCaptureUrl(capture.url || args.url || '');
  // Locale-only hosts (e.g. /nl/particulieren with no --home) must still own Partial Designs.
  const allowPartialWiring = await captureOwnsSiteChrome(capture, pageRouteEarly);

  /** @type {object[]} */
  const pageSections = [];
  /** @type {object[]} */
  const allComponentsForPresentation = [];
  /** @type {object[]} */
  const homeRenderings = [];
  /** @type {object[]} */
  const partials = [];
  /** @type {string[]} */
  const allPageFiles = [...stubFiles.map((f) => path.relative(repoRoot, f).replace(/\\/g, '/'))];
  args._cookieBannerPlacement =
    args._cookieBannerPlacement ||
    resolveCookieBannerPlacement(args.cookieBannerPlacement);
  const cookieBannerPlacement = args._cookieBannerPlacement;

  // --only must not wipe site presentation: seed wiring from sibling section-conversion.json first.
  // Home needs a log per sibling. Missing siblings (cold start / after reset) are pulled into
  // this convert set instead of fail-closed — registry reuse still skips AI when packages exist.
  if (args.only) {
    const allFolders = await listSectionFolders(capture.sectionsDir, null);
    if (pageRouteEarly.isHome) {
      const siblingLogs = await assertHomeConversionLogsComplete({
        allFolders,
        sectionsDir: capture.sectionsDir,
        onlyFolders: sectionFolders,
      });
      if (!siblingLogs.ok) {
        const missing = siblingLogs.missingFolders || [];
        if (!missing.length) {
          throwIfCoverageFailed(
            siblingLogs,
            'Home --only incomplete sibling conversion logs',
          );
        }
        const before = sectionFolders.length;
        sectionFolders = [...new Set([...sectionFolders, ...missing])].sort();
        console.log(
          `  ✓ --only: home cold-start — expanded convert set ${before} → ${sectionFolders.length} (missing sibling conversion log(s): ${missing.join(', ')})`,
        );
      }
    }
    const onlySet = new Set(sectionFolders);
    let merged = 0;
    for (const folder of allFolders) {
      if (onlySet.has(folder)) continue;
      const sectionAbs = path.join(capture.sectionsDir, folder);
      const prior = await readSectionConversion(sectionAbs);
      if (!prior?.components?.length) continue;
      const componentResults = hydrateSiblingConversionComponents(
        prior.components || [],
      );
      let sectionHtml = '';
      let siblingInfo = null;
      try {
        siblingInfo = JSON.parse(
          await readFile(path.join(sectionAbs, 'section-information.json'), 'utf8'),
        );
        const preferred = await loadPreferredSectionHtml(
          capture.pageDir,
          folder,
          siblingInfo,
        );
        sectionHtml = preferred.html || '';
      } catch {
        /* optional root id */
      }
      const parentKey =
        componentResults.find((c) => c.role === 'section')?.definitionKey ||
        componentResults[0]?.definitionKey;
      await registerSectionWiring({
        role: resolveSectionWiringRole(prior.role, siblingInfo, parentKey),
        componentResults,
        allComponentsForPresentation,
        homeRenderings,
        partials,
        sectionHtml,
        sectionInfo: siblingInfo,
        layoutSketch: prior.layoutSketch || null,
        allowPartialWiring,
        cookieBannerPlacement,
      });
      merged += 1;
    }
    console.log(
      `  ✓ --only: merged presentation wiring from ${merged} sibling section conversion log(s)`,
    );
  }

  createPhase(5, 'Codegen page sections (HTML/PNG → TSX + defs)');

  /** In-flight FE names claimed earlier in this run (before disk write). */
  /** @type {string[]} */
  const inFlightNames = [];

  for (const folder of sectionFolders) {
    const sectionAbs = path.join(capture.sectionsDir, folder);
    const infoPath = path.join(sectionAbs, 'section-information.json');
    let info;
    try {
      info = JSON.parse(await readFile(infoPath, 'utf8'));
    } catch {
      console.warn(`  ⚠ skip ${folder}: no section-information.json`);
      continue;
    }
    info.folderName = info.folderName || folder;
    info.sectionHtml = info.sectionHtml || `sections/${folder}/section.html`;

    await ensureSectionSitecoreIcon(info, {
      sectionAbs,
      componentName: info.cmsName,
      persist: !args.dryRun,
    });
    const registryBacklink = getRegistrySection(info);
    const sharedLabel = registryBacklink?.componentFolder
      ? ` → registry:${registryBacklink.componentFolder}`
      : '';
    process.env.BQ_CREATE_SECTION = folder;
    if (capture.pageSlug) {
      process.env.BQ_CREATE_PAGE_SLUG = capture.pageSlug;
    }
    console.log(
      `\n── ${folder} (${info.cmsName || '?'})${sharedLabel}`,
    );

    const evidenceAbs = resolveEvidenceSectionDir(
      capture.projectRoot,
      capture.pageDir,
      folder,
      info,
      null,
    );
    const sectionDirWithinPage =
      path.relative(capture.pageDir, evidenceAbs).replace(/\\/g, '/') ||
      `sections/${folder}`;
    // Page-qualify so home/platform `sections/section-NN` never share a reuse key
    const sectionDirRel = qualifySectionDir(
      capture.pageSlug,
      sectionDirWithinPage,
    );
    const contentHash = info.contentHash || '';
    const conversionSourceHash = await computeConversionSourceHash({
      info,
      designMdPath,
      collectionSystem: collSite.collectionSystem,
      pageDir: capture.pageDir,
      sectionFolder: folder,
      sharedDesignPrefix: '',
    });
    const prior = await readSectionConversion(sectionAbs);
    const registryEntry =
      mergeResult?.globalManifest?.components &&
      (Object.values(mergeResult.globalManifest.components).find(
        (e) => e.folderName === registryBacklink?.componentFolder,
      ) ||
        null);
    const sharedSkip = await canSkipViaSharedSection({
      force: args.wireOnly ? false : args.force,
      info,
      hostSlug,
      codePrefix,
      sharedBuiltThisRun,
      registryEntry,
      projectRoot: capture.projectRoot,
    });
    const skipCheck = args.wireOnly
      ? {
          skip: true,
          reason: sharedSkip.skip
            ? `wire-only (${sharedSkip.reason})`
            : 'wire-only (reuse package or prior conversion)',
          sharedReuse: sharedSkip.reuse || null,
        }
      : await canSkipSectionConversion({
          force: args.force,
          prior,
          conversionSourceHash,
          contentHash,
          sharedSkip,
        });

    if (skipCheck.skip && (prior || skipCheck.sharedReuse || args.wireOnly)) {
      console.log(`  ✓ skip AI (${skipCheck.reason})`);
      const resolvedWire = resolveWireComponentResults({
        priorComponents: prior?.components || [],
        sharedBuiltThisRun,
        registryFolder: registryBacklink?.componentFolder || null,
        sharedReuse: skipCheck.sharedReuse || null,
        stubFromReuse: (reuse) => {
          const kebab = toKebabCase(reuse.componentName);
          const dir = componentDir(hostSlug, reuse.componentName);
          return [
            {
              role: 'section',
              componentName: reuse.componentName,
              definitionKey: reuse.definitionKey,
              sources: {
                tsx: relRepo(path.join(dir, `${kebab}.tsx`)),
                definition: relRepo(path.join(dir, `${kebab}.definition.ts`)),
                captureMeta: relRepo(
                  path.join(dir, `${kebab}.capture-meta.json`),
                ),
              },
              emitted: [],
            },
          ];
        },
      });
      let componentResults = resolvedWire.componentResults;
      if (!componentResults.length && args.wireOnly) {
        console.warn(
          `  ⚠ wire-only: no package/prior conversion for ${folder} — skip wiring`,
        );
        continue;
      }
      // conversionSourceHash / shared reuse: do not rewrite definition/TSX on disk
      // (preserves mtimes for lastSuccessful.yamlsAt skip). Use --force to recreate.
      ledger.record({
        purpose: 'decompose',
        section: folder,
        componentName: null,
        ok: true,
        skipReason: skipCheck.reason,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        costEstimateUsd: 0,
      });

      const parentDefKey =
        componentResults.find((c) => c.role === 'section')?.definitionKey ||
        componentResults[0]?.definitionKey;
      const role = resolveSectionWiringRole(prior?.role, info, parentDefKey);
      const mode = prior?.mode || 'single';

      const preferredHtmlSkip = await loadPreferredSectionHtml(
        capture.pageDir,
        folder,
        info,
      );
      // Reuse must still hydrate child packages from capture-meta (enrich repeats → presentation).
      componentResults = await hydrateCompositeChildrenFromCaptureMeta(
        componentResults,
        hostSlug,
      );
      // Drop retired ghost keys again after meta hydrate; persist cleaned log.
      componentResults = hydrateSiblingConversionComponents(componentResults);

      const layoutSketchForWire =
        resolvedWire.layoutSketch || prior?.layoutSketch || null;

      await registerSectionWiring({
        role,
        componentResults,
        allComponentsForPresentation,
        homeRenderings,
        partials,
        sectionHtml: preferredHtmlSkip.html || '',
        sectionInfo: info,
        layoutSketch: layoutSketchForWire,
        allowPartialWiring,
        cookieBannerPlacement,
      });

      if (!args.dryRun && componentResults[0]?.definitionKey) {
        await markSharedSectionCreated({
          projectRoot: capture.projectRoot,
          pageDir: capture.pageDir,
          sectionFolder: folder,
          info,
          componentName: componentResults[0].componentName,
          definitionKey: componentResults[0].definitionKey,
          status: 'reused',
        });
      }

      const previousCalls = prior?.ai?.calls || [];
      const sectionAi = ledger.forSection(folder);
      ledger.printSectionTotals(folder);
      {
        const fixups = takeFixupCount(folder);
        if (fixups > 0) logVerbose(`  fixups ${fixups} applied`);
        delete process.env.BQ_CREATE_SECTION;
      }
      const sectionPayload = {
        generatedAt: new Date().toISOString(),
        url: capture.url,
        pageSlug: capture.pageSlug,
        sectionDir: sectionDirRel,
        contentHash,
        conversionSourceHash,
        mode,
        role,
        chromeCatalogue:
          prior?.chromeCatalogue ||
          info?.chromeCatalogue ||
          normalizeChromeCatalogue(role || 'other'),
        reason: prior?.reason || skipCheck.reason || '',
        components: componentResults,
        layoutSketch: layoutSketchForWire,
        pageWiring: prior?.pageWiring || pageWiringForRole(role),
        sharedSection: getRegistrySection(info) || null,
        registrySection: getRegistrySection(info) || null,
        ai: {
          previousCalls,
          calls: sectionAi.calls,
          totals: sectionAi.totals,
          byComponent: sectionAi.byComponent,
          skipped: true,
          skipReason: skipCheck.reason,
        },
        allFiles: componentResults.flatMap((c) => Object.values(c.sources || {})),
      };

      if (!args.dryRun) {
        await writeSectionConversion(sectionAbs, sectionPayload);
      }

      pageSections.push({
        folderName: folder,
        conversionLog: `sections/${folder}/section-conversion.json`,
        mode,
        role,
        components: componentResults.map((c) => c.componentName),
        definitionKeys: componentResults.map((c) => c.definitionKey),
        skipped: true,
        sharedSection: getRegistrySection(info)?.componentFolder || null,
        registrySection: getRegistrySection(info)?.componentFolder || null,
      });
      allPageFiles.push(...sectionPayload.allFiles);
      continue;
    }

    // Load multimodal evidence once — reuse for decompose + all codegen calls (prompt cache).
    const evidenceBundle = await loadSectionEvidenceBundle(
      capture.pageDir,
      folder,
      info,
    );
    const {
      sectionEvidenceMessage,
      aiEvidence,
      evidenceAttachments,
      evidenceImageRelsInOrder,
    } = evidenceBundle;

    const registryComponentFolder =
      getRegistrySection(info)?.componentFolder ||
      registryBacklink?.componentFolder ||
      null;
    const pageSectionAbs = sectionAbs;
    // Parent section dumps beside the page section; children nest under ai-debug/<child>/.
    const aiDebugRoot = resolveAiDebugOutDir({
      pageSectionDir: pageSectionAbs,
    });
    if (!args.dryRun) {
      const priorNames = (prior?.components || [])
        .map((c) => c?.componentName)
        .filter(Boolean);
      await clearComponentShotFolders({
        pageDir: capture.pageDir,
        sectionFolder: folder,
        componentNames: [...priorNames, info.cmsName].filter(Boolean),
      });
    }
    if (aiDebugRoot && !args.dryRun) {
      await clearAiDebugDumpDir(aiDebugRoot, { force: true });
    }

    // ——— Codegen: visual-first → Sitecoreize ———
    const preferredHtmlV3 = await loadPreferredSectionHtml(
      capture.pageDir,
      folder,
      info,
    );
    const sectionHtmlV3 = preferredHtmlV3.html || aiEvidence?.html || '';
    console.log(`  plan: visual→sitecoreize (${folder})`);
    const indexEntryEarly = await lookupSectionNameIndexEntry(
      hostSlug,
      sectionDirRel,
      capture.pageSlug,
    );
    // --force clears all name locks (including chrome) so new names are allowed.
    const lockedSectionName = args.force
      ? null
      : String(indexEntryEarly?.componentName || '').trim() || null;
    const lockedSectionKey = args.force
      ? null
      : String(indexEntryEarly?.definitionKey || '').trim() || null;
    const lockedChildrenEarly = args.force
      ? []
      : normalizeIndexChildren(indexEntryEarly?.children);
    /** @type {string[]} */
    const allowNamesForSection = [];
    if (lockedSectionName) allowNamesForSection.push(lockedSectionName);
    if (lockedSectionKey) allowNamesForSection.push(lockedSectionKey);
    for (const c of lockedChildrenEarly) {
      if (c.componentName) allowNamesForSection.push(c.componentName);
      if (c.definitionKey) allowNamesForSection.push(c.definitionKey);
    }
    // Packages already on disk for this sectionDir are ours — not collisions.
    try {
      const { findPackagesBySectionDir } = await import(
        './write-component.mjs'
      );
      const owned = await findPackagesBySectionDir(
        hostSlug,
        sectionDirRel,
        capture.pageSlug,
      );
      for (const p of owned) {
        if (p.componentName) allowNamesForSection.push(p.componentName);
        const dk = String(p.meta?.definitionKey || '').trim();
        if (dk) allowNamesForSection.push(dk);
      }
    } catch {
      /* best-effort */
    }
    const taken = await listTakenComponentNames({
      collectionSystem: collSite.collectionSystem,
      hostSlug,
      extraNames: inFlightNames,
      allowNames: allowNamesForSection,
    });

    const sectionFoldersForPage = listSectionFolders(capture.sectionsDir);
    const sectionCount = sectionFoldersForPage.length || Number(info?.index) || 1;
    const sectionIndex = Number(info?.index) || parseSectionIndex(folder) || 1;
    const reg = getRegistrySection(info);
    let instancePages = [];
    let pageCount = 1;
    try {
      if (reg?.componentFolder && capture.projectRoot) {
        const instPath = path.join(
          capture.projectRoot,
          SECTION_REGISTRY_DIR,
          reg.componentFolder,
          'instances.json',
        );
        const inst = JSON.parse(await readFile(instPath, 'utf8'));
        instancePages = Array.isArray(inst?.instances)
          ? inst.instances
          : Array.isArray(inst)
            ? inst
            : [];
        pageCount = instancePages.length || 1;
      }
    } catch {
      pageCount = 1;
    }
    const chromeEvidence = buildChromeEvidence({
      sharedAcrossPages: pageCount >= 2,
      pageCount,
      instancePages,
      sectionIndex,
      sectionCount,
    });

    const generated = await codegenSection({
      pageDir: capture.pageDir,
      sectionFolder: folder,
      info,
      ledger,
      collectionSystem: collSite.collectionSystem,
      hostSlug,
      siteUrl: capture.url || '',
      sectionEvidenceMessage,
      evidenceAttachments,
      evidenceImageRelsInOrder,
      aiDebugRoot,
      projectRoot: capture.projectRoot,
      registryComponentFolder,
      sectionHtml: sectionHtmlV3,
      codePrefix,
      takenNames: [...taken.componentNames, ...taken.definitionKeys],
      lockedName: lockedSectionName,
      lockedDefinitionKey: lockedSectionKey,
      lockedChildren: lockedChildrenEarly,
      chromeEvidence,
      beforeSitecoreize: async ({ componentName, definitionKey }) => {
        inFlightNames.push(componentName, definitionKey);
        if (args.dryRun) return;
        await upsertSectionNameLock({
          hostSlug,
          pageSlug: capture.pageSlug,
          sectionDir: sectionDirRel,
          componentName,
          definitionKey,
          children: lockedChildrenEarly.length
            ? lockedChildrenEarly
            : undefined,
          force: Boolean(args.force),
          dryRun: args.dryRun,
        });
        console.log(
          `  · locked section name before sitecoreize: ${componentName}`,
        );
      },
    });
    const plan = generated.plan;
    console.log(
      `  plan: ${plan.mode} → ${plan.section.componentName} (${plan.role}) ${plan.reason}`,
    );

    if (!args.dryRun && generated.layoutSketch) {
      await writeFile(
        path.join(sectionAbs, 'layout-sketch.json'),
        `${JSON.stringify(generated.layoutSketch, null, 2)}\n`,
        'utf8',
      );
    }

    /** @type {object[]} */
    const componentResults = [];
    const sectionPkg =
      generated.packages.find((p) => p.role === 'section') || generated.packages[0];
    const {
      isGhostEmptyBandChildPackage,
      stripDroppedChildrenFromSectionDefinition,
    } = await import('./section-codegen.mjs');
    /** @type {string[]} */
    const droppedGhostKeys = [];
    const childPkgs = generated.packages.filter((p) => {
      if (p === sectionPkg) return false;
      if (isGhostEmptyBandChildPackage(p, generated.layoutSketch)) {
        const key = String(p.definitionKey || p.kebab || p.componentName || '').trim();
        if (key) droppedGhostKeys.push(key);
        noteFixup(
          sectionDirRel || '_run',
          `dropped ghost empty-band child ${p.componentName || key} (items=[] / empty layout PH)`,
        );
        return false;
      }
      return true;
    });
    if (droppedGhostKeys.length && sectionPkg?.definitionTs) {
      sectionPkg.definitionTs = stripDroppedChildrenFromSectionDefinition(
        sectionPkg.definitionTs,
        droppedGhostKeys,
      );
    }

    const claimedChildNames = new Set();
    for (let childIndex = 0; childIndex < childPkgs.length; childIndex++) {
      const child = childPkgs[childIndex];
      const aiPreferredChild = child.componentName;
      // Unique name already enforced in sitecoreize vs takenNames (+ repair).
      const resolved = await resolveComponentName({
        preferred: aiPreferredChild,
        alternatives: [],
        hostSlug,
        codePrefix,
        sectionDir: sectionDirRel,
        contentHash,
        force: args.force,
        role: 'child',
        stickyName: null,
        childIndex,
        excludeNames: claimedChildNames,
        pageSlug: capture.pageSlug,
        registryFolder:
          info?.registrySection?.componentFolder ||
          info?.registrySection?.folder ||
          null,
        enrichChildRole: child.componentName,
        ...resolveNameRoleOpts(info, plan),
      });
      await maybeRetireForceRenamed(resolved, {
        hostSlug,
        dryRun: args.dryRun,
        collectionSystem: collSite.collectionSystem,
        siteSystem: collSite.siteSystem,
      });
      claimedChildNames.add(resolved.componentName);
      inFlightNames.push(resolved.componentName, resolved.definitionKey);
      child.componentName = resolved.componentName;
      child.definitionKey = resolved.definitionKey;
      child.kebab = toKebabCase(resolved.componentName);

      const {
        warnIfContentItemCountBelowHint,
        assertContentItemsMatchPeerCount,
        countSketchPeersForComponent,
        sanitizeDefinitionTsImport,
      } = await import('./section-codegen.mjs');
      const seedBase =
        resolved.componentName.replace(/^Crelan/, '') || 'Item';
      const sketchPeers = countSketchPeersForComponent(
        generated.layoutSketch,
        resolved.componentName,
      );
      const wantHint = Math.max(child.repeatHint || 1, sketchPeers || 1);
      // Keep repeatHint so finalize assertDefinitionTsRepeatHint can hard-fail
      // under-seed vs layoutSketch peers (never clone seeds).
      const planChild = (plan.children || []).find(
        (c) =>
          String(c.componentName || '').toLowerCase() ===
            String(child.componentName || '').toLowerCase() ||
          String(resolved.componentName || '')
            .toLowerCase()
            .endsWith(String(c.componentName || '').toLowerCase()),
      );
      if (planChild) {
        planChild.componentName = resolved.componentName;
        planChild.definitionKey = resolved.definitionKey;
        planChild.repeatHint = wantHint;
      }
      child.definitionTs = sanitizeDefinitionTsImport(child.definitionTs);
      const childFinalizeCtx = {
        collectionSystem: collSite.collectionSystem,
        siteSystem: collSite.siteSystem,
        plan,
        role: 'child',
        definitionKey: resolved.definitionKey,
        componentName: resolved.componentName,
        codePrefix,
        cultures: args._cultures,
        pageLanguage: args._pageLanguage,
        culture: info.culture || args._pageCulture,
        sectionInfo: info,
        sectionHtml: sectionHtmlV3,
        aiDebugRoot: resolveAiDebugOutDir({
          pageSectionDir: pageSectionAbs,
          childFolder: registryChildFolderStem(resolved.componentName),
        }),
      };
      let definitionTs = (
        await finalizeDefinitionWithParseRetries(
          child.definitionTs,
          (def) => finalizeDefinitionTs(def, childFinalizeCtx),
          {
            componentName: resolved.componentName,
            ledger,
          },
        )
      ).definitionTs;
      definitionTs = warnIfContentItemCountBelowHint(
        definitionTs,
        wantHint,
        seedBase,
      ).definitionTs;
      assertContentItemsMatchPeerCount(
        definitionTs,
        Math.max(wantHint, sketchPeers),
        resolved.componentName || seedBase,
      );

      const paths = await writeComponentPackageWithBuildRetries(
        {
          hostSlug,
          componentName: resolved.componentName,
          kebab: child.kebab,
          tsx: child.tsx,
          clientTsx: child.clientTsx,
          definitionTs,
          definitionKey: resolved.definitionKey,
          codePrefix,
          sectionInfo: info,
          sectionHtml: sectionHtmlV3,
          planMode: 'single',
          plan,
          role: 'child',
          packageKind: child.packageKind,
          dryRun: args.dryRun,
          forceRenamedFrom: resolved.forceRenamedFrom || null,
          previousDefinitionKey: resolved.previousDefinitionKey || null,
          captureMeta: {
            url: capture.url,
            pageSlug: capture.pageSlug,
            sectionDir: sectionDirRel,
            contentHash,
            conversionSourceHash,
            role: 'child',
            mode: 'single',
            packageKind: child.packageKind,
            placeholderKey: child.parentPlaceholder,
            definitionKey: resolved.definitionKey,
            codegenVersion: 'section',
            generatedAt: new Date().toISOString(),
            ...(resolved.forceRenamedFrom
              ? {
                  forceRenamedFrom: resolved.forceRenamedFrom,
                  ...(resolved.previousDefinitionKey
                    ? { previousDefinitionKey: resolved.previousDefinitionKey }
                    : {}),
                }
              : {}),
          },
        },
        { ledger },
      );
      const diskChildKey = args.dryRun
        ? resolved.definitionKey
        : await readDefinitionKeyFromPackage(
            hostSlug,
            resolved.componentName,
          );
      child.definitionKey = diskChildKey;
      const childPh = String(child.parentPlaceholder || '').trim() || null;
      componentResults.push({
        role: 'child',
        componentName: resolved.componentName,
        definitionKey: diskChildKey,
        planMode: 'single',
        placeholderKey: childPh,
        placeholder: childPh,
        parentPlaceholder: childPh,
        sources: {
          tsx: relRepo(paths.tsx),
          ...(paths.clientTsx ? { clientTsx: relRepo(paths.clientTsx) } : {}),
          definition: relRepo(paths.definition),
          captureMeta: relRepo(paths.captureMeta),
        },
        emitted: [],
      });
    }

    const aiPreferredParent =
      generated.lockedSectionName || sectionPkg.componentName;
    const resolvedParent = await resolveComponentName({
      preferred: aiPreferredParent,
      alternatives: [],
      hostSlug,
      codePrefix,
      sectionDir: sectionDirRel,
      contentHash,
      force: args.force,
      role: 'section',
      stickyName: generated.lockedSectionName || null,
      pageSlug: capture.pageSlug,
      registryFolder: registryComponentFolder || null,
      ...resolveNameRoleOpts(info, plan),
    });
    await maybeRetireForceRenamed(resolvedParent, {
      hostSlug,
      dryRun: args.dryRun,
      collectionSystem: collSite.collectionSystem,
      siteSystem: collSite.siteSystem,
    });
    plan.section.componentName = resolvedParent.componentName;
    sectionPkg.componentName = resolvedParent.componentName;
    sectionPkg.definitionKey = resolvedParent.definitionKey;
    sectionPkg.kebab = toKebabCase(resolvedParent.componentName);

    {
      const {
        warnIfContentItemCountBelowHint,
        sanitizeDefinitionTsImport,
      } = await import('./section-codegen.mjs');
      sectionPkg.definitionTs = sanitizeDefinitionTsImport(
        sectionPkg.definitionTs,
      );
      sectionPkg.definitionTs = warnIfContentItemCountBelowHint(
        sectionPkg.definitionTs,
        1,
        resolvedParent.componentName.replace(/^Crelan/, '') || 'Section',
      ).definitionTs;
    }
    const parentFinalizeCtx = {
      collectionSystem: collSite.collectionSystem,
      siteSystem: collSite.siteSystem,
      plan,
      role: 'section',
      definitionKey: resolvedParent.definitionKey,
      componentName: resolvedParent.componentName,
      codePrefix,
      cultures: args._cultures,
      pageLanguage: args._pageLanguage,
      culture: info.culture || args._pageCulture,
      aiDebugRoot,
    };
    let parentDefinitionTs = (
      await finalizeDefinitionWithParseRetries(
        sectionPkg.definitionTs,
        (def) => finalizeDefinitionTs(def, parentFinalizeCtx),
        {
          componentName: resolvedParent.componentName,
          ledger,
        },
      )
    ).definitionTs;

    const richChildren = componentResults
      .filter((c) => c.role === 'child')
      .map((c) => ({
        componentName: c.componentName,
        definitionKey: c.definitionKey,
        placeholderKey: c.placeholderKey || null,
      }));
    const parentPaths = await writeComponentPackageWithBuildRetries(
      {
      hostSlug,
      componentName: resolvedParent.componentName,
      kebab: sectionPkg.kebab,
      tsx: sectionPkg.tsx,
      clientTsx: sectionPkg.clientTsx,
      definitionTs: parentDefinitionTs,
      definitionKey: resolvedParent.definitionKey,
      codePrefix,
      sectionInfo: info,
      sectionHtml: sectionHtmlV3,
      layoutSketch: generated.layoutSketch || null,
      planMode: plan.mode,
      plan,
      role: 'section',
      packageKind: sectionPkg.packageKind,
      childPackages: componentResults.filter((c) => c.role === 'child'),
      dryRun: args.dryRun,
      forceRenamedFrom: resolvedParent.forceRenamedFrom || null,
      previousDefinitionKey: resolvedParent.previousDefinitionKey || null,
      captureMeta: {
        url: capture.url,
        pageSlug: capture.pageSlug,
        sectionDir: sectionDirRel,
        contentHash,
        conversionSourceHash,
        role: 'section',
        mode: plan.mode,
        packageKind: sectionPkg.packageKind,
        placeholderKey: plan.section.placeholderKey,
        children: richChildren,
        definitionKey: resolvedParent.definitionKey,
        codegenVersion: 'section',
        generatedAt: new Date().toISOString(),
        ...(resolvedParent.forceRenamedFrom
          ? {
              forceRenamedFrom: resolvedParent.forceRenamedFrom,
              ...(resolvedParent.previousDefinitionKey
                ? {
                    previousDefinitionKey:
                      resolvedParent.previousDefinitionKey,
                  }
                : {}),
            }
          : {}),
      },
      },
      { ledger },
    );
    const diskParentKey = args.dryRun
      ? resolvedParent.definitionKey
      : await readDefinitionKeyFromPackage(
          hostSlug,
          resolvedParent.componentName,
        );
    resolvedParent.definitionKey = diskParentKey;
    plan.section.definitionKey = diskParentKey;
    sectionPkg.definitionKey = diskParentKey;
    if (!args.dryRun) {
      await upsertSectionNameLock({
        hostSlug,
        pageSlug: capture.pageSlug,
        sectionDir: sectionDirRel,
        componentName: resolvedParent.componentName,
        definitionKey: diskParentKey,
        children: richChildren,
        force: Boolean(args.force),
        dryRun: args.dryRun,
      });
    }

    /** @type {object|null} */
    let parentFidelity = null;
    if (!args.dryRun) {
      parentFidelity = await runPostWriteFidelity({
        pageDir: capture.pageDir,
        sectionFolder: folder,
        info,
        sectionHtml: sectionHtmlV3,
        hostSlug,
        componentName: resolvedParent.componentName,
        definitionKey: resolvedParent.definitionKey,
        tsxPath: parentPaths.tsx,
        clientTsxPath: parentPaths.clientTsx,
        definitionPath: parentPaths.definition,
        childComponentNames: componentResults
          .filter((c) => c.role === 'child')
          .map((c) => c.componentName),
        layoutSketch: generated.layoutSketch || null,
        placeholderKey: plan.section.placeholderKey,
        plan,
        role: 'section',
        parent: null,
        collectionSystem: collSite.collectionSystem,
        siteSystem: collSite.siteSystem,
        designMd: '',
        sharedDesignPrefix: '',
        ledger,
        dryRun: args.dryRun,
        sourceMinScore: args._sourceFidelityMinScore,
        visualMinScore: args._visualFidelityMinScore,
        visualFidelityHandled: Boolean(generated.visualFidelityHandled),
        visualTsx: generated.visualTsx || '',
        packages: Array.isArray(generated.packages) ? generated.packages : [],
        kebab: sectionPkg.kebab,
        imageInventory: null,
        captureMeta: {
          url: capture.url,
          pageSlug: capture.pageSlug,
          sectionDir: sectionDirRel,
          contentHash,
          conversionSourceHash,
          role: 'section',
          mode: plan.mode,
          placeholderKey: plan.section.placeholderKey,
          registryFolder: registryComponentFolder || null,
          codegenVersion: 'section',
        },
        finalizeDefinition: async (g) =>
          (
            await finalizeDefinitionWithParseRetries(
              g.definitionTs,
              (def) =>
                finalizeDefinitionTs(def, {
                  collectionSystem: collSite.collectionSystem,
                  siteSystem: collSite.siteSystem,
                  plan,
                  role: 'section',
                  definitionKey: resolvedParent.definitionKey,
                  componentName: resolvedParent.componentName,
                  codePrefix,
                  cultures: args._cultures,
                  pageLanguage: args._pageLanguage,
                  culture: info.culture || args._pageCulture,
                  aiDebugRoot,
                }),
              {
                componentName: resolvedParent.componentName,
                ledger,
              },
            )
          ).definitionTs,
      });
    }

    componentResults.unshift({
      role: 'section',
      componentName: resolvedParent.componentName,
      definitionKey: diskParentKey,
      planMode: plan.mode,
      placeholderKey: plan.section.placeholderKey,
      ...(parentFidelity
        ? {
            fidelity: {
              score: parentFidelity.score ?? null,
              percent: parentFidelity.percent ?? null,
              pass: parentFidelity.pass ?? null,
              minScore: parentFidelity.minScore ?? null,
              applied: parentFidelity.applied ?? false,
              iterations: parentFidelity.iterations ?? 0,
              scoreHistory: parentFidelity.scoreHistory || [],
              notes: parentFidelity.notes || '',
            },
          }
        : {}),
      sources: {
        tsx: relRepo(parentPaths.tsx),
        ...(parentPaths.clientTsx
          ? { clientTsx: relRepo(parentPaths.clientTsx) }
          : {}),
        definition: relRepo(parentPaths.definition),
        captureMeta: relRepo(parentPaths.captureMeta),
      },
      emitted: [],
    });

    if (!args.dryRun) {
      await markSharedSectionCreated({
        projectRoot: capture.projectRoot,
        pageDir: capture.pageDir,
        sectionFolder: folder,
        info,
        componentName: resolvedParent.componentName,
        definitionKey: diskParentKey,
        status: 'created',
        plan,
      });
      const regFolder = getRegistrySection(info)?.componentFolder;
      if (regFolder) {
        sharedBuiltThisRun.set(regFolder, {
          componentFolder: regFolder,
          componentName: resolvedParent.componentName,
          definitionKey: diskParentKey,
          components: componentResults,
          layoutSketch: generated.layoutSketch || null,
        });
      }
    }

    await registerSectionWiring({
      role: plan.role,
      componentResults,
      allComponentsForPresentation,
      homeRenderings,
      partials,
      sectionHtml: sectionHtmlV3,
      sectionInfo: info,
      layoutSketch: generated.layoutSketch || null,
      allowPartialWiring,
      cookieBannerPlacement,
    });

    const sectionAi = ledger.forSection(folder);
    ledger.printSectionTotals(folder);
    {
      const fixups = takeFixupCount(folder);
      if (fixups > 0) logVerbose(`  fixups ${fixups} applied`);
      delete process.env.BQ_CREATE_SECTION;
    }
    const sectionPayload = {
      generatedAt: new Date().toISOString(),
      url: capture.url,
      pageSlug: capture.pageSlug,
      sectionDir: sectionDirRel,
      contentHash,
      conversionSourceHash,
      mode: plan.mode,
      role: plan.role,
      chromeCatalogue:
        plan.chromeCatalogue ||
        info?.chromeCatalogue ||
        normalizeChromeCatalogue('other'),
      reason: plan.reason || 'codegen',
      codegenVersion: 'section',
      layoutSketch: generated.layoutSketch || null,
      components: componentResults,
      pageWiring: pageWiringForRole(plan.role),
      sharedSection: getRegistrySection(info) || null,
      registrySection: getRegistrySection(info) || null,
      ai: {
        calls: sectionAi.calls,
        totals: sectionAi.totals,
        byComponent: sectionAi.byComponent,
      },
      allFiles: componentResults.flatMap((c) =>
        Object.values(c.sources || {}),
      ),
    };
    if (!args.dryRun) {
      await writeSectionConversion(sectionAbs, sectionPayload);
    }
    pageSections.push({
      folderName: folder,
      conversionLog: `sections/${folder}/section-conversion.json`,
      mode: plan.mode,
      role: plan.role,
      components: componentResults.map((c) => c.componentName),
      definitionKeys: componentResults.map((c) => c.definitionKey),
      skipped: false,
      sharedSection: getRegistrySection(info)?.componentFolder || null,
      registrySection: getRegistrySection(info)?.componentFolder || null,
      codegenVersion: 'section',
    });
    allPageFiles.push(...sectionPayload.allFiles);
    continue;
  }

  // Expand chrome bands from visual catalogues (header|breadcrumb cut + footer cut).
  if (detected?.sections?.length && allowPartialWiring) {
    /** @type {Array<{ index: number, chromeCatalogue: string, definitionKey: string, folderName: string }>} */
    const bandInputs = [];
    for (const s of detected.sections) {
      const folderName = s.folderName;
      if (!folderName) continue;
      const conversion = await readSectionConversion(
        path.join(capture.sectionsDir, folderName),
      );
      const definitionKey = parentDefinitionKeyFromConversion(conversion);
      if (!definitionKey) continue;
      const idx =
        Number(s.index) ||
        parseSectionIndex(folderName) ||
        bandInputs.length + 1;
      bandInputs.push({
        index: idx,
        chromeCatalogue: normalizeChromeCatalogue(
          conversion?.chromeCatalogue || conversion?.role || 'other',
        ),
        definitionKey,
        folderName,
      });
    }
    const thumbnailRelForBandKey = (definitionKey) => {
      const band = bandInputs.find((b) => b.definitionKey === definitionKey);
      if (!band?.folderName) return undefined;
      return resolveSectionDesktopThumbnailRel(
        { folderName: band.folderName },
        band.folderName,
      );
    };
    const { cuts, byDefinitionKey } = mapChromeBandRoles(bandInputs);
    console.log(
      `  · chrome bands: headerCut=${cuts.headerCut ?? 'none'} footerCut=${cuts.footerCut ?? 'none'} (${bandInputs.length} section(s))`,
    );

    // Move mis-placed page renderings into header/footer partials by band role.
    const stayOnHome = [];
    for (const r of homeRenderings) {
      const key = String(r?.definitionKey || '').trim();
      // Opt-out: drop cookie banners from home and do not promote into header partial.
      if (
        shouldSkipCookieBannerLayoutPlacement(cookieBannerPlacement, null, key)
      ) {
        console.warn(
          `  ⚠ Presentation: dropped cookie banner "${key}" from layout (cookiebanner-placement=none)`,
        );
        continue;
      }
      const band = byDefinitionKey.get(key) || 'page';
      if (band === 'page') {
        stayOnHome.push(r);
        continue;
      }
      if (band === 'partial-header') {
        const existingIdx = partials.findIndex((p) => p.signature === 'header');
        const asSibling = {
          definitionKey: key,
          placeholder: 'headless-header',
          ...(r.children ? { children: r.children } : {}),
          ...(r.datasourceItem ? { datasourceItem: r.datasourceItem } : {}),
        };
        if (existingIdx >= 0) {
          const prev = partials[existingIdx];
          const siblings = [...(prev.siblingsBefore || [])];
          if (
            prev.definitionKey !== key &&
            !siblings.some((s) => s.definitionKey === key)
          ) {
            // Earlier indices → siblingsBefore; later becomes new host if needed.
            const thisIdx = bandInputs.find((b) => b.definitionKey === key)?.index;
            const hostIdx = bandInputs.find(
              (b) => b.definitionKey === prev.definitionKey,
            )?.index;
            if (
              thisIdx != null &&
              hostIdx != null &&
              thisIdx > hostIdx
            ) {
              siblings.push({
                definitionKey: prev.definitionKey,
                ...(prev.children ? { children: prev.children } : {}),
              });
              const thumbnail = thumbnailFromCaptureRel(
                thumbnailRelForBandKey(key),
              );
              const upgraded = {
                ...prev,
                definitionKey: key,
                children: r.children || prev.children,
                siblingsBefore: siblings.filter(
                  (s) => s.definitionKey !== key,
                ),
              };
              delete upgraded.thumbnailCaptureRel;
              if (thumbnail) {
                upgraded.thumbnail = thumbnail;
              } else {
                delete upgraded.thumbnail;
              }
              partials[existingIdx] = upgraded;
            } else {
              siblings.push(asSibling);
              partials[existingIdx] = {
                ...prev,
                siblingsBefore: siblings,
              };
            }
          }
        } else {
          const thumbnail = thumbnailFromCaptureRel(
            thumbnailRelForBandKey(key),
          );
          partials.push({
            signature: 'header',
            placeholder: 'headless-header',
            definitionKey: key,
            ...(r.children ? { children: r.children } : {}),
            ...(thumbnail ? { thumbnail } : {}),
          });
        }
      } else if (band === 'partial-footer') {
        const existingIdx = partials.findIndex((p) => p.signature === 'footer');
        if (existingIdx >= 0) {
          const prev = partials[existingIdx];
          if (prev.definitionKey !== key) {
            const siblings = [...(prev.siblingsBefore || [])];
            if (!siblings.some((s) => s.definitionKey === key)) {
              // Prefer earliest footer as host; later join as siblings.
              const thisIdx = bandInputs.find((b) => b.definitionKey === key)?.index;
              const hostIdx = bandInputs.find(
                (b) => b.definitionKey === prev.definitionKey,
              )?.index;
              if (
                thisIdx != null &&
                hostIdx != null &&
                thisIdx < hostIdx
              ) {
                siblings.push({
                  definitionKey: prev.definitionKey,
                  ...(prev.children ? { children: prev.children } : {}),
                });
                const thumbnail = thumbnailFromCaptureRel(
                  thumbnailRelForBandKey(key),
                );
                const upgraded = {
                  ...prev,
                  definitionKey: key,
                  children: r.children || prev.children,
                  siblingsBefore: siblings.filter(
                    (s) => s.definitionKey !== key,
                  ),
                };
                delete upgraded.thumbnailCaptureRel;
                if (thumbnail) {
                  upgraded.thumbnail = thumbnail;
                } else {
                  delete upgraded.thumbnail;
                }
                partials[existingIdx] = upgraded;
              } else {
                siblings.push({
                  definitionKey: key,
                  ...(r.children ? { children: r.children } : {}),
                });
                partials[existingIdx] = { ...prev, siblingsBefore: siblings };
              }
            }
          }
        } else {
          const thumbnail = thumbnailFromCaptureRel(
            thumbnailRelForBandKey(key),
          );
          partials.push({
            signature: 'footer',
            placeholder: 'headless-footer',
            definitionKey: key,
            canHostChildren: true,
            ...(r.children ? { children: r.children } : {}),
            ...(thumbnail ? { thumbnail } : {}),
          });
        }
      }
    }
    homeRenderings.length = 0;
    homeRenderings.push(...stayOnHome);

    // Drop any leftover cookie partial signatures.
    for (let i = partials.length - 1; i >= 0; i--) {
      if (partials[i]?.signature === 'cookie') partials.splice(i, 1);
    }
  }

  // Order home renderings by detected-sections.json (definitionKey via conversion logs).
  if (detected?.sections?.length && pageRouteEarly.isHome) {
    const orderedKeys = await buildDetectedDefinitionKeyOrder(capture, detected);
    sortHomeRenderingsByDetectedOrder(homeRenderings, orderedKeys);
    console.log(
      `  · home order: ${orderedKeys.length} detected page/chrome keys → ${homeRenderings.length} headless-main rendering(s)`,
    );
  }

  // Page/partial wiring keys must exist on disk (written *.definition.ts),
  // including nested children (force-rename ghosts).
  {
    const before = homeRenderings.length;
    const pruned = await pruneRenderingsMissingDefinitionKeys(
      homeRenderings,
      hostSlug,
    );
    homeRenderings.length = 0;
    homeRenderings.push(...pruned);
    if (before !== homeRenderings.length) {
      console.log(
        `  · pruned ${before - homeRenderings.length} page rendering(s) with missing definitionKey packages`,
      );
    }
    for (const partial of partials) {
      if (!partial || typeof partial !== 'object') continue;
      for (const field of ['children', 'siblingsBefore', 'siblingsAfter']) {
        if (!Array.isArray(partial[field]) || !partial[field].length) continue;
        partial[field] = await pruneRenderingsMissingDefinitionKeys(
          partial[field],
          hostSlug,
        );
      }
    }
  }

  /** @type {{ file: string, pageKey?: string }|null} */
  let presentation = null;
  const pageRoute = pageRouteEarly;

  if (args.codegenOnly) {
    createPhase(6, 'Wire page presentation — skipped (--codegen-only)');
  } else {
    createPhase(6, 'Wire page presentation');
    if (!pageRoute.isHome) {
      console.log(
        `  · secondary page: ${pageRoute.pageKey} (${pageRoute.routePath}) — merging; home preserved`,
      );
    }

    if (pageRoute.isHome && detected?.sections?.length) {
      const coverage = await assertPresentationCoverage({
        detected,
        sectionsDir: capture.sectionsDir,
        homeRenderings,
        partials,
        cookieBannerPlacement,
      });
      if (!coverage.ok) {
        for (const err of coverage.errors) {
          console.error(`  ✗ ${err}`);
        }
        throwIfCoverageFailed(coverage, 'Presentation coverage');
      }
      console.log(
        `  ✓ presentation coverage: ${detected.sections.length} detected section(s) wired`,
      );
    }

    presentation = await writeSitePresentationDefinition({
      siteSystem: collSite.siteSystem,
      collectionSystem: collSite.collectionSystem,
      hostSlug,
      components: allComponentsForPresentation,
      homeRenderings,
      partials,
      cultures: args._cultures || [],
      pageKey: pageRoute.pageKey,
      routePath: pageRoute.routePath,
      navigationTitle: pageRoute.navigationTitle,
      isHome: pageRoute.isHome,
      dryRun: args.dryRun,
    });
    // Fail closed: nested children must target parent PH keys with non-empty allowedControls
    // (use post-write relocated partials / page renderings).
    await assertNestedPresentationPlaceholderParity({
      hostSlug,
      pages: {
        [presentation.pageKey]: {
          renderings: presentation.renderings || homeRenderings,
        },
      },
      partials: presentation.partials || partials,
    });
    allPageFiles.push(relRepo(presentation.file));
    if (presentation.pageFile) {
      allPageFiles.push(relRepo(presentation.pageFile));
    }
    console.log(`  + ${relRepo(presentation.file)} [${presentation.pageKey}]`);

    warnPresentationDatasourceContentMismatches(
      [...homeRenderings, ...(Array.isArray(partials) ? partials : [])],
      allComponentsForPresentation,
      {
        readDefinition: (relPath) => {
          try {
            const abs = path.isAbsolute(relPath)
              ? relPath
              : path.join(repoRoot, relPath);
            return readFileSync(abs, 'utf8');
          } catch {
            return null;
          }
        },
      },
    );
  }

  if (
    !args.dryRun &&
    !args.skipGenerate &&
    !args._skipFinalGenerate &&
    !args.codegenOnly
  ) {
    /** @type {string[]|null} */
    let onlyDefinitionKeys = null;
    if (args.only) {
      const { collectDefinitionKeysFromSectionConversions } = await import(
        './apply-definition-allowlist.mjs'
      );
      const {
        collectDefinitionKeysFromDefinitionFiles,
      } = await import('./apply-definition-allowlist.mjs');
      const fromConv = await collectDefinitionKeysFromSectionConversions(
        capture.sectionsDir,
        sectionFolders,
      );
      const fromPage = pageSections.flatMap((s) => s.definitionKeys || []);
      const fromStubs = allPageFiles
        .map((rel) => {
          const m = String(rel || '')
            .replace(/\\/g, '/')
            .match(/(?:pages|_page-stubs)\/([^/]+)\.definition\.ts$/);
          return m ? m[1] : null;
        })
        .filter(Boolean);
      const fromOnly = onlyResolved?.definitionKeys || [];
      // Also load keys already wired on page/presentation so sibling renderings
      // (e.g. section-04) stay resolvable when --only regenerated one section.
      const wiredFiles = [
        path.join(
          bqRoot,
          'src',
          'components',
          hostSlug,
          `${collSite.siteSystem}-presentation.definition.ts`,
        ),
        ...allPageFiles.map((rel) =>
          path.isAbsolute(rel) ? rel : path.join(repoRoot, rel),
        ),
      ];
      const fromWired = await collectDefinitionKeysFromDefinitionFiles(
        wiredFiles,
      );
      onlyDefinitionKeys = [
        ...new Set(
          [
            ...fromConv,
            ...fromPage,
            ...fromStubs,
            ...fromOnly,
            ...fromWired,
          ].filter(Boolean),
        ),
      ];
      console.log(
        `  ✓ --only emit allowlist: ${onlyDefinitionKeys.length} component/stub key(s) ` +
          `(+ collection/site/presentation/validators/enums/dictionaries)`,
      );
    }
    const rootsOk = await collectionProjectRootsPresent(collSite.collectionSystem);
    if (!rootsOk) {
      console.warn(
        `  ⚠ collection Project roots missing for "${collSite.collectionSystem}" — final generate will ensure sites via Sites API`,
      );
    }
    await assertPresentationReadyForGenerate({
      hostSlug,
      siteSystem: collSite.siteSystem,
      pageSections,
    });
    await runAuthoringGenerate({
      siteSystem: collSite.siteSystem,
      collectionSystem: collSite.collectionSystem,
      // Always emit collection/site (Sites API) so Data/Home exist for content apply.
      forceKinds: args.forceKinds,
      forceTranslations: Boolean(args.forceTranslations),
      nestPhase: 7,
      nestTitle: 'Apply definitions to SitecoreAI',
      useDefinitionKeyAllowlist: Boolean(args.only),
      definitionKeys: onlyDefinitionKeys ?? [],
      capturePageDir: capture.pageDir,
    });
  } else {
    const finalSkipReason = args.dryRun
      ? 'dry-run'
      : args.skipGenerate
        ? 'skip-generate'
        : args.codegenOnly
          ? '--codegen-only (Authoring apply not requested)'
          : args._skipFinalGenerate
            ? 'deferred to host-level final generate (--all)'
            : 'not needed for this run';
    createPhaseSkip(
      7,
      'Apply definitions to SitecoreAI',
      finalSkipReason,
    );
  }

  const afterSnap = await snapshotFiles(authoringRoot);
  const addedYaml = diffSnapshots(beforeSnap, afterSnap);

  // Attribute emitted YAML back onto section conversion logs
  if (!args.dryRun) {
    for (const sec of pageSections) {
      const keys = sec.definitionKeys || [];
      const emitted = filterInventory(addedYaml, keys);
      const sectionAbs = path.join(capture.sectionsDir, sec.folderName);
      try {
        const prev = JSON.parse(
          await readFile(path.join(sectionAbs, 'section-conversion.json'), 'utf8'),
        );
        for (const c of prev.components || []) {
          c.emitted = filterInventory(emitted, [c.definitionKey]);
        }
        prev.allFiles = [
          ...new Set([
            ...(prev.allFiles || []),
            ...emitted,
          ]),
        ];
        await writeSectionConversion(sectionAbs, prev);
      } catch {
        /* ignore */
      }
    }
  }

  logPhaseDone();
  const tStats = getTranslationRunStats();
  if (
    tStats.cacheHits ||
    tStats.cacheMissAi ||
    tStats.skippedSameCulture ||
    tStats.skippedNonTranslatable
  ) {
    console.log(
      `  Translation cache (create process): hits=${tStats.cacheHits} aiMisses=${tStats.cacheMissAi} sameCulture=${tStats.skippedSameCulture} nonTranslatable=${tStats.skippedNonTranslatable}` +
        (args.forceTranslations ? ' (force:translations)' : ''),
    );
  }
  console.log(
    '  YAML translation cache hits/misses are on each [bq:definitions:generate] / [bq:content:generate] line (those run in a child process).',
  );
  if (mergeResult?.aiStats) {
    const m = mergeResult.aiStats;
    const cost = m.costUsd > 0 ? `~$${Math.round(m.costUsd * 1e6) / 1e6}` : 'cost n/a';
    console.log(
      `  Merge AI phase (included above only if ledger-recorded): called=${m.called} totalTokens=${m.totalTokens} ${cost}`,
    );
  }
  flushAi(false);

  const pageAi = ledger.snapshot();
  const existingPageConversion = args.dryRun
    ? null
    : await readExistingPageConversion(capture.pageDir);
  const pagePayload = buildPageConversionPayload(
    {
      generatedAt: new Date().toISOString(),
      url: capture.url,
      pageDir: relRepo(capture.pageDir),
      collection: collSite.collectionSystem,
      site: collSite.siteSystem,
      hostSlug,
      sections: pageSections,
      presentationDefinition: presentation ? relRepo(presentation.file) : null,
      ai: {
        calls: pageAi.calls,
        totals: pageAi.totals,
        byComponent: pageAi.byComponent,
      },
      allFiles: [...new Set([...allPageFiles, ...addedYaml])],
    },
    {
      codegenOnly: Boolean(args.codegenOnly),
      existing: existingPageConversion,
    },
  );

  if (!args.dryRun) {
    await writePageConversion(capture.pageDir, pagePayload);
    console.log(`\n✓ Wrote ${relRepo(path.join(capture.pageDir, 'page-conversion.json'))}`);
    // Phase A codegenOnly is not a successful "components done" stamp — presentation still pending.
    if (!args.codegenOnly) {
      await recordComponentsSuccessAt({
        collectionSystem: collSite.collectionSystem,
        siteSystem: collSite.siteSystem,
      });
      console.log(
        `  ✓ lastSuccessful.componentsAt stamped for ${collSite.collectionSystem}::${collSite.siteSystem}`,
      );
    } else {
      console.log(
        `  · codegen-only: skipped lastSuccessful.componentsAt (presentation wire still required)`,
      );
    }
    if (!args._hostPageLoop) {
      const metaPath = await flushFixupsMeta(capture.pageDir, {
        tool: 'create:sectioncomponents',
      });
      if (metaPath) {
        console.log(`✓ Wrote ${relRepo(metaPath)}`);
      }
    }
  } else if (!args._hostPageLoop) {
    resetFixupLog();
  }

  if (!args._skipEpilogue) {
    printNextStepsEpilogue();
  }
  } catch (err) {
    fatal = err;
    throw err;
  } finally {
    flushAi(Boolean(fatal), fatal);
    delete process.env.BQ_CREATE_PAGE_SLUG;
    if (!args._ledger) {
      setTranslationAiLedger(null);
    }
  }
}

function relRepo(abs) {
  return path.relative(repoRoot, abs).replace(/\\/g, '/');
}

/**
 * Sync collection/site + composite placeholders, then normalizeDefinitionTs.
 * Placeholders rewrite uses balanced-bracket replacePlaceholdersArray — never the
 * naive `/placeholders:\s*\[[\s\S]*?\],/` regex (that truncates at allowedControls).
 *
 * @param {string} definitionTs
 * @param {string} collectionSystem
 * @param {string} siteSystem
 * @param {object|null|undefined} plan
 * @param {string|null|undefined} role
 * @param {string|null|undefined} definitionKey
 * @param {string|null|undefined} componentName
 * @param {string|null|undefined} codePrefix
 * @param {string|null|undefined} [aiDebugRoot]
 */
function patchDefinitionCollection(
  definitionTs,
  collectionSystem,
  siteSystem,
  plan,
  role,
  definitionKey,
  componentName,
  codePrefix,
  aiDebugRoot,
) {
  let text = String(definitionTs || '');
  if (!/collectionSystem\s*:/.test(text)) {
    text = text.replace(
      /kind:\s*["']component["']\s*,/,
      `kind: "component",\n  collectionSystem: "${collectionSystem}",\n  siteSystem: "${siteSystem}",`,
    );
  } else {
    text = text.replace(
      /collectionSystem:\s*["'][^"']*["']/,
      `collectionSystem: "${collectionSystem}"`,
    );
  }
  if (!/siteSystem\s*:/.test(text)) {
    text = text.replace(
      /collectionSystem:\s*["'][^"']*["']/,
      (m) => `${m},\n  siteSystem: "${siteSystem}"`,
    );
  } else {
    text = text.replace(
      /siteSystem:\s*["'][^"']*["']/,
      `siteSystem: "${siteSystem}"`,
    );
  }
  // Placeholders come from TSX sync + child packages only — never rewrite from plan.
  return normalizeDefinitionTs(text, {
    definitionKey,
    componentName,
    codePrefix,
    planMode: plan?.mode,
    aiDebugRoot: aiDebugRoot || undefined,
  });
}

/**
 * Inject cultures + source culture. Seeds stay in capture language (do not force EN).
 * Prefer section-information.culture → page culture → pageLanguage map.
 * @param {string} definitionTs
 * @param {{ cultures?: string[], pageLanguage?: string, culture?: string, pageUrl?: string, definitionKey?: string, componentName?: string, codePrefix?: string, collectionSystem?: string, siteSystem?: string, plan?: object, role?: string, aiDebugRoot?: string }} ctx
 */
async function finalizeDefinitionTs(definitionTs, ctx) {
  let text = patchDefinitionCollection(
    definitionTs,
    ctx.collectionSystem,
    ctx.siteSystem,
    ctx.plan,
    ctx.role,
    ctx.definitionKey,
    ctx.componentName,
    ctx.codePrefix,
    ctx.aiDebugRoot,
  );
  // Always apply: empty list strips AI-baked cultures (BQ_CULTURES= → no extras).
  text = ensureDefinitionCultures(text, ctx.cultures || []);
  const sourceCulture =
    (ctx.culture && String(ctx.culture).trim()) ||
    (ctx.pageUrl
      ? inferSitecoreCultureFromUrl(ctx.pageUrl, ctx.cultures || [])
      : toSitecoreCulture(ctx.pageLanguage, ctx.cultures || []));
  if (sourceCulture) {
    text = ensureDefinitionSourceCulture(text, sourceCulture);
  }
  text = normalizeDefinitionTs(text, {
    definitionKey: ctx.definitionKey,
    componentName: ctx.componentName,
    codePrefix: ctx.codePrefix,
    planMode: ctx.plan?.mode,
    sectionInfo: ctx.sectionInfo || null,
    sectionHtml: ctx.sectionHtml || null,
    // Default off: seed salvage is detect→AI retry, not silent rewrite.
    allowSeedSalvage: ctx.allowSeedSalvage === true,
    aiDebugRoot: ctx.aiDebugRoot || undefined,
  });

  // Child packages: refuse over-seed vs plan repeatHint (ProximityFeature 20→1).
  if (String(ctx.role || '') === 'child' && ctx.plan) {
    const { assertDefinitionTsRepeatHint } = await import('./ai-source-fixup.mjs');
    const wantKey = String(ctx.definitionKey || '').trim();
    const wantName = String(ctx.componentName || '').trim().toLowerCase();
    const kids = Array.isArray(ctx.plan.children) ? ctx.plan.children : [];
    const match = kids.find((c) => {
      const dk = String(c?.definitionKey || '').trim();
      const cn = String(c?.componentName || '').trim().toLowerCase();
      if (wantKey && dk && dk === wantKey) return true;
      if (wantName && cn && cn === wantName) return true;
      if (wantName && cn && wantName.endsWith(cn)) return true;
      return false;
    });
    const hint = match?.repeatHint;
    if (hint != null) {
      assertDefinitionTsRepeatHint(
        text,
        hint,
        `${ctx.definitionKey || ctx.componentName || 'child'}.definition.ts`,
      );
    }
  }
  return text;
}
