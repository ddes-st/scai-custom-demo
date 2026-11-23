/**
 * `npm run create:sectioncomponents` — capture page → Sitecore TSX + definitions.
 * Never writes YAML; invokes `authoring:generate` for serialization.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBqConsole } from '../shared/bq-console.mjs';
import {
  applyForceTranslations,
  consumeForceArg,
  forceHelpLine,
  shouldForce,
  shouldForceConversion,
} from '../shared/authoring-force-kinds.mjs';
import {
  applyFidelityCliFlags,
  consumeOptionalNumberFlag,
} from './fidelity-enable.mjs';

ensureBqConsole();

function printHelp() {
  console.log(`Usage: npm run create:sectioncomponents -- --url <https://…> [options]

Options:
  --url <url>           Host or page URL (required). Hostname selects the capture
                        project; default run converts every usable page under that
                        host (e.g. --url https://www.crelan.be/ seeds the host even
                        when no homepage capture exists). Exact page path optional.
  --page-only           Convert only the resolved page (not all host captures).
  --all                 Alias for default host-wide (merge once, Phase A codegen
                        once per unique component, Phase B wire every page,
                        authoring:generate once). Ignored when --only is set
                        (--only implies --page-only).
  --codegen-only        Phase A only (AI packages from section-registry).
                        With --all: all registry folders. Single --url: keys
                        referenced by that page. Skips page YAML wiring.
  --wire-only           Phase B (+ generate): wire presentation YAML from
                        existing packages; no AI codegen.
  --collection <name>   Override collection system name
  --site <name>         Override site system name
  --cultures <list>     Extra Sitecore cultures for definition seeds (e.g. fr-BE).
                        Default: BQ_CULTURES in bq/.env.local (page source culture is page-meta.culture)
  ${forceHelpLine()}
                        Default (no --force): do NOT re-run visualize/sitecoreize —
                        reuse prior AI codegen; wire + apply upsert/create and delete
                        CM items from a previous run that were not updated.
                        Bare --force: greenfield visualize+sitecoreize (new names OK;
                        old FE packages retired; unused SitecoreAI items deleted), then
                        components + definition + apply (not translations).
                        --force:all / --force:translations (alone) = everything including translations.
                        --force:apply = re-run Authoring/Sites API apply only (alias: --force:apply).
                        --force:components / --force:definition = re-run AI package.
                        Combine: --force:translations,apply,definition
  --dry-run             Plan only; do not write files or run generate
  --skip-generate       Skip authoring:generate
  --skip-fixups         Skip TSX/client warn-only post-pass (AI *.tsx already not rewritten).
                        Also: BQ_SKIP_AI_SOURCE_FIXUPS=1
  --v2-fixups           Restore mutating TSX + definition fixups (default is
                        prompt-first — no salvage/hoist rewrites).
                        Also: BQ_CODEGEN_V2_FIXUPS=1
  --tsx-validate-max-iters=N
                        Write-path build gate after codegen (contracts + tsc → AI repair).
                        0 = off (legacy write + format only). 1–3 = max AI repairs (default 1).
                        Catches Next breakers like 'use server' and missing ./….client.
                        Also: BQ_TSX_VALIDATE_MAX_ITERS
  --definition-validate-max-iters=N
                        Retries after definitionTs parse/assert failure (independent
                        of TSX validate). 0 = no retry; 1 = one retry (default 1).
                        Also: BQ_DEFINITION_VALIDATE_MAX_ITERS
  --source-fidelity[=N] Enable source fidelity (TSX text vs crops → focused JSON patch).
                        Optional min score N (default 90). Off by default.
                        Patched TSX must stay multi-line (not minified).
                        Skipped when BQ_SOURCE_FIDELITY_MAX_ITERS=0.
                        Composites: scores the parent package (children skipped alone).
  --visual-fidelity[=N] Enable visual fidelity (render → score → surgical repair → re-score).
                        Optional min score N (default 95). Off by default.
                        When both source and visual are on, visual wins for that component.
                        BQ_VISUAL_FIDELITY_MAX_ITERS = max repair rounds (1 = fix once).
                        Skipped when BQ_VISUAL_FIDELITY_MAX_ITERS=0.
                        Scores/repairs plain visual TSX BEFORE sitecoreize;
                        shots under sections/.../visual-fidelity/attempt-*.
                        After write, skips score/repair but still captures sitecoreized
                        packages under .../sitecoreize-proof/ when BQ_VISUAL_CAPTURE_ONLY
                        (default on) — visual proof only, no fidelity loop.
                        Composites: scores the assembled parent+children tree — never
                        scores a placeholder child alone against full-section crops.
                        When visual fidelity is off, rendered TSX screenshots still run
                        (BQ_VISUAL_CAPTURE_ONLY, default on) without AI compare —
                        set BQ_VISUAL_CAPTURE_ONLY=false to skip.
  --only <targets>      Scope conversion + authoring:generate. Comma-separated:
                          section-NN | definitionKey | PackageFolder
                        Examples: section-04 | sitecore-customer-story-slider |
                          SitecoreCustomerStorySlider | section-04,SitecoreSiteFooter
                        Implies --page-only (page-scoped run; host-wide disabled).
                        Scopes emit to those definitionKeys (+ collection/site/
                        presentation/validators/enums/dictionaries).
                        With --force:apply, only allowlisted component keys bypass
                        mtime skip — identical-content emit inventory still skips;
                        infra (collection/site/presentation) keeps normal skip.
  --skip-merge          Skip step 0 host section-registry/ merge
  --merge-ai            Pass --ai to merge (unsure-pair Azure judge)
  --brandkit            Create Stream brand kit + set site brandKitId when none
                        exists. If a kit already exists (state id or name match),
                        leave it alone unless --force is also passed.
                        (also: BQ_CREATE_BRANDKIT=true). Requires Stream AI API
                        keys + SITECORE_ORGANIZATION_ID.
  --no-brandkit         Disable brand kit even if BQ_CREATE_BRANDKIT=true
  --verbose             Verbose terminal logs (per-call AI usage, codegen fixups,
                        fidelity sub-steps, scaffold id resolve: cm/disk/cache/mint
                        with CM lookup ms). Default is quiet-relevant progress.
                        Also: BQ_CREATE_LOG=verbose
  --skip-ai-debug       Do not write page sections/.../ai-debug/ dumps
                        (or set BQ_AI_DEBUG_DUMP=0)
  --cookiebanner-placement place|none
                        When a cookie/consent banner is detected: none (default
                        when unset) still codegen’s the component
                        (availableRenderings) but does not add it to any page or
                        partial; place keeps today’s page/partial wiring.
                        Also: BQ_COOKIEBANNER_PLACEMENT=place|none
                        Precedence: CLI flag → env → none.
  --help                Show this help

Step 0 merges all host page sections into section-registry/ + writes host
component-inventory.json (dedupe + registrySection backlinks). Phase A runs AI
once per inventory component (canonical page evidence); debug dumps land under
the page sections/section-NN/ai-debug/ being codegenned. Phase B wires each
page's presentation YAML only.

Host-wide (default — every captured page under the host):
  npm run create:sectioncomponents -- --url https://www.crelan.be/
  npm run create:sectioncomponents -- --url https://www.crelan.be/nl/particulieren

Single page only:
  npm run create:sectioncomponents -- --url https://www.crelan.be/nl/particulieren --page-only

Registry codegen only / wire only:
  npm run create:sectioncomponents -- --url https://www.crelan.be/ --codegen-only
  npm run create:sectioncomponents -- --url https://www.crelan.be/ --wire-only

Without --force: skip visualize + sitecoreize; reuse prior conversion/packages
(prune retired ghost keys from conversion logs); wire presentation; apply upserts
and deletes unused CM items from the previous run.
With --force / --force:components / --force:definition: re-run visualize +
sitecoreize as greenfield for each unique registry key once per run (including
chrome; name locks cleared so new names are allowed) — still do not re-AI the
same registry folder twice in one --all run (sharedBuiltThisRun). Wire then
propagates this-run codegen into each page's section-conversion.json (not stale
priors). When AI picks a new name, the old FE package is retired and SitecoreAI
leftovers are deleted via CM remap + apply-inventory. Same preferred name still
overwrites in place. --force:apply alone does not rename.

Force one section (re-create TSX/definition via AI + scoped yaml emit):
  npm run create:sectioncomponents -- --url <https://…> --only section-04 --force

Force YAML for one section only (section packages + site infra; not all site components):
  npm run create:sectioncomponents -- --url <https://…> --only section-13 --force:apply

Force YAML for one package (no AI conversion required):
  npm run create:sectioncomponents -- --url <https://…> --only SitecoreSiteFooter --force:apply

Force YAML for the whole site (no --only):
  npm run create:sectioncomponents -- --url <https://…> --force:apply

Force everything including translation cache refresh:
  npm run create:sectioncomponents -- --url <https://…> --force:all

Env (screenshot → TSX): AZURE_OPENAI_SCREENSHOT_CONVERSION_MODEL
  (falls back to AZURE_OPENAI_DEFAULT_MODEL when extended).
Optional stronger model for fidelity scoring: AZURE_OPENAI_SOURCE_FIDELITY_MODEL
  (falls back to screenshot conversion model).
BQ_TSX_VALIDATE_MAX_ITERS (0–3, default 3):
  AI validate loop (codegen contracts + tsc → revision). 0 disables the loop.
BQ_DEFINITION_VALIDATE_MAX_ITERS (0–3, default 1):
  Retry count after definitionTs parse fail. 0 = abort on first parse error;
  1 = one AI repair retry (independent of BQ_TSX_VALIDATE_MAX_ITERS).
BQ_SOURCE_FIDELITY_MAX_ITERS / BQ_VISUAL_FIDELITY_MAX_ITERS (0–3, default 3):
  Max score→fix→re-score rounds (1 = check once and try to fix once).
  0 force-skips that fidelity mode even if --*-fidelity / enable env is set.
BQ_SOURCE_FIDELITY_MIN_SCORE / BQ_VISUAL_FIDELITY_MIN_SCORE — defaults when flag has no N.
BQ_VISUAL_CAPTURE_ONLY (default on): Playwright shots of rendered TSX after write when
  visual fidelity is off, and for codegen sitecoreize proof shots under
  visual-fidelity/sitecoreize-proof/ (capture-only, no AI compare).
  Set false/0/no to skip. Full --visual-fidelity still captures inside its score
  loop (does not double-capture).
BQ_AI_DEBUG_DUMP=0 (or --skip-ai-debug): skip writing pre-fixup AI dumps under
  page sections/section-NN/ai-debug/ (*.prompt.ai, *.attachments.md, *.sources.md, *.raw.ai.json, *.tsx.ai).
BQ_CODEGEN_EVIDENCE_MODE=html|png (default html):
  html — CSS-inlined section.html, no PNG attachments (lower cost)
  png  — original-section.html + viewport PNG attachments
  source/visual fidelity still loads PNGs when enabled.
BQ_CODEGEN_MAX_DEPTH (default 2): molecule nesting depth for sitecoreize packages.
BQ_CODEGEN_INFER_RESPONSIVE (default 1): when 1, may invent Tailwind
  breakpoints if evidence lacks usable multi-viewport treatment; 0 = mimic only.
BQ_LINK_LIST_AS_COMPOSITE=1|true (default off):
  Opt-in — model repeating link lists like other multi-item bands (parent with
  optional Title + AppPlaceholder + child link-item packages with dedicated
  itemTemplates). Supersedes platform Link/Icon/Image Link Lists folders and
  Multi-Line Text JSON { text, url }[] bags for those repeats. Emit/rendering
  skip platform list trees when the definition has placeholders.allowedControls.

Cost estimates: Retail Prices API (cached in .bq/azure-model-rates.json). Optional
negotiated rates when AZURE_BILLING_ACCOUNT_NAME + AZURE_BILLING_PROFILE_NAME are set.
Terminal always logs each fidelity scan/fixup cost, then section/page totals as
without-fidelity / fidelity-only / with-fidelity so the fidelity premium is visible.

authoring:generate is invoked with --site / --collection for this capture host so
other demo collections (e.g. showcasecatalog) are not regenerated.
When definition/content sources are unchanged, authoring:generate is skipped unless
--force / --force:apply / --force:translations / --force:all applies.

When Sites API creates the collection/site (remote missing) but local authoring YAML
for that collection/site still exists, generate may wipe those YAML roots + related
caches (same local cleanup half as delete:collection; definitions and FE packages
stay). Prefer npm run delete:collection for a full intentional wipe.
`);
}

export function parseArgs(argv) {
  const out = {
    url: null,
    collection: null,
    site: null,
    cultures: null,
    /** @type {Set<string>} */
    forceKinds: new Set(),
    /** AI/codegen force (compat boolean for run.mjs) */
    force: false,
    forceTranslations: false,
    dryRun: false,
    skipGenerate: false,
    skipFixups: false,
    /** Restore mutating TSX/definition fixups (prompt-first is default). */
    v2Fixups: false,
    /** @type {number|null} */
    tsxValidateMaxIters: null,
    /** @type {number|null} */
    definitionValidateMaxIters: null,
    enableSourceFidelity: false,
    enableVisualFidelity: false,
    /** @type {number|null} */
    sourceFidelityMinScore: null,
    /** @type {number|null} */
    visualFidelityMinScore: null,
    only: null,
    skipMerge: false,
    mergeAi: false,
    skipAiDebug: false,
    /** Host-wide by default; --page-only disables. */
    all: true,
    pageOnly: false,
    wireOnly: false,
    codegenOnly: false,
    verbose: false,
    /** @type {string|null} CLI raw; resolved later via resolveCookieBannerPlacement */
    cookieBannerPlacement: null,
    /**
     * null = follow BQ_CREATE_BRANDKIT env; true/false from --brandkit / --no-brandkit.
     * @type {boolean|null}
     */
    brandkit: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const forceConsumed = consumeForceArg(argv, i);
    if (forceConsumed) {
      out.forceKinds = forceConsumed.force;
      i = forceConsumed.nextIndex - 1;
      continue;
    }
    const validateItersFlag = consumeOptionalNumberFlag(
      argv,
      i,
      '--tsx-validate-max-iters',
    );
    if (validateItersFlag.hit) {
      out.tsxValidateMaxIters =
        validateItersFlag.value != null ? validateItersFlag.value : 3;
      i = validateItersFlag.nextIndex - 1;
      continue;
    }
    const defValidateItersFlag = consumeOptionalNumberFlag(
      argv,
      i,
      '--definition-validate-max-iters',
    );
    if (defValidateItersFlag.hit) {
      out.definitionValidateMaxIters =
        defValidateItersFlag.value != null ? defValidateItersFlag.value : 1;
      i = defValidateItersFlag.nextIndex - 1;
      continue;
    }
    const sourceFlag = consumeOptionalNumberFlag(argv, i, '--source-fidelity');
    if (sourceFlag.hit) {
      out.enableSourceFidelity = true;
      out.sourceFidelityMinScore = sourceFlag.value;
      i = sourceFlag.nextIndex - 1;
      continue;
    }
    const visualFlag = consumeOptionalNumberFlag(argv, i, '--visual-fidelity');
    if (visualFlag.hit) {
      out.enableVisualFidelity = true;
      out.visualFidelityMinScore = visualFlag.value;
      i = visualFlag.nextIndex - 1;
      continue;
    }
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--skip-generate') out.skipGenerate = true;
    else if (a === '--skip-fixups') out.skipFixups = true;
    else if (a === '--v2-fixups') out.v2Fixups = true;
    else if (a === '--skip-merge') out.skipMerge = true;
    else if (a === '--merge-ai') out.mergeAi = true;
    else if (a === '--brandkit') out.brandkit = true;
    else if (a === '--no-brandkit') out.brandkit = false;
    else if (a === '--skip-ai-debug') out.skipAiDebug = true;
    else if (a === '--all') out.all = true;
    else if (a === '--page-only') {
      out.pageOnly = true;
      out.all = false;
    }
    else if (a === '--wire-only') out.wireOnly = true;
    else if (a === '--codegen-only') out.codegenOnly = true;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a === '--url') out.url = argv[++i];
    else if (a.startsWith('--url=')) out.url = a.slice(6);
    else if (a === '--collection') out.collection = argv[++i];
    else if (a.startsWith('--collection=')) out.collection = a.slice(13);
    else if (a === '--site') out.site = argv[++i];
    else if (a.startsWith('--site=')) out.site = a.slice(7);
    else if (a === '--cultures') out.cultures = argv[++i];
    else if (a.startsWith('--cultures=')) out.cultures = a.slice(11);
    else if (a === '--only') out.only = argv[++i];
    else if (a.startsWith('--only=')) out.only = a.slice(7);
    else if (a === '--cookiebanner-placement')
      out.cookieBannerPlacement = argv[++i];
    else if (a.startsWith('--cookiebanner-placement='))
      out.cookieBannerPlacement = a.slice('--cookiebanner-placement='.length);
  }
  out.force = shouldForceConversion(out.forceKinds);
  out.forceTranslations = shouldForce(out.forceKinds, 'translations');
  // --only is page-scoped by definition; demote host-wide (wins over --all).
  if (out.only) {
    out.pageOnly = true;
    out.all = false;
  }
  return out;
}

async function main() {
  // Load bq/.env + .env.local before resolving/logging knobs (otherwise
  // BQ_TSX_VALIDATE_MAX_ITERS etc. still look like code defaults).
  const { loadLocalEnvFiles } = await import(
    '../capture/lib/design-system/load-env.mjs'
  );
  const { bqRoot } = await import('../capture/paths.mjs');
  loadLocalEnvFiles({ root: bqRoot });

  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.url) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  if (args.pageOnly && args.all) {
    // --page-only / --only win if both somehow set
    args.all = false;
  }

  if (args.pageOnly && args.codegenOnly && !args.only) {
    /* allowed: page-scoped Phase A for keys on that page */
  }

  if (args.wireOnly && args.codegenOnly) {
    console.error('Use either --wire-only or --codegen-only, not both.');
    process.exit(1);
  }

  if (args.forceKinds.size) {
    const kinds = [...args.forceKinds].join(',');
    console.log(`force: ${kinds}`);
  }

  if (args.forceTranslations) {
    applyForceTranslations(true);
    console.log('translations: force (cache bypass)');
  }

  if (args.skipFixups) {
    process.env.BQ_SKIP_AI_SOURCE_FIXUPS = '1';
    const { setSkipAiSourceFixups } = await import('./ai-source-fixup.mjs');
    setSkipAiSourceFixups(true);
    console.log('AI TSX/client warn-pass: skipped (--skip-fixups)');
  }

  if (args.v2Fixups) {
    process.env.BQ_CODEGEN_V2_FIXUPS = '1';
    const { setCodegenV2Fixups } = await import('./ai-source-fixup.mjs');
    setCodegenV2Fixups(true);
    console.log(
      'Mutating TSX + definition fixups restored (--v2-fixups)',
    );
  }

  if (args.skipAiDebug) {
    process.env.BQ_AI_DEBUG_DUMP = '0';
    const { setSkipAiDebugDump } = await import('./ai-debug-dump.mjs');
    setSkipAiDebugDump(true);
    console.log('AI debug dumps: skipped (--skip-ai-debug)');
  }

  applyFidelityCliFlags(args);

  const { configureCreateLog } = await import('./create-log.mjs');
  configureCreateLog({ verbose: Boolean(args.verbose) });
  if (args.verbose) {
    console.log('create log: verbose (BQ_CREATE_LOG=verbose)');
  }

  const { applyTsxValidateMaxItersCli } = await import('./tsx-validate-iters.mjs');
  args._tsxValidateMaxIters = applyTsxValidateMaxItersCli(args.tsxValidateMaxIters);

  const { applyDefinitionValidateMaxItersCli } = await import(
    './definition-validate-iters.mjs'
  );
  args._definitionValidateMaxIters = applyDefinitionValidateMaxItersCli(
    args.definitionValidateMaxIters,
  );

  // Pass CLI score overrides through for run.mjs
  args._sourceFidelityMinScore = args.sourceFidelityMinScore;
  args._visualFidelityMinScore = args.visualFidelityMinScore;

  const {
    resolveCookieBannerPlacement,
    normalizeCookieBannerPlacement,
  } = await import('./cookie-banner-placement.mjs');
  const cliCookiePlacement = normalizeCookieBannerPlacement(
    args.cookieBannerPlacement,
  );
  if (args.cookieBannerPlacement != null && !cliCookiePlacement) {
    console.error(
      `Invalid --cookiebanner-placement="${args.cookieBannerPlacement}" (use place|none).`,
    );
    process.exit(1);
  }
  args._cookieBannerPlacement = resolveCookieBannerPlacement(
    args.cookieBannerPlacement,
  );
  if (args._cookieBannerPlacement === 'place') {
    console.log(
      'cookie banner placement: place (wire onto page/partial when detected)',
    );
  }

  const { logCreateRunConfig } = await import('./log-run-config.mjs');
  logCreateRunConfig({
    culturesOverride: args.cultures != null ? args.cultures : null,
    brandkitCli: args.brandkit,
    cliHints: {
      tsxValidateMaxIters: args.tsxValidateMaxIters != null,
      definitionValidateMaxIters: args.definitionValidateMaxIters != null,
      skipFixups: Boolean(args.skipFixups),
      v2Fixups: Boolean(args.v2Fixups),
      skipAiDebug: Boolean(args.skipAiDebug),
      sourceFidelity: Boolean(args.enableSourceFidelity),
      visualFidelity: Boolean(args.enableVisualFidelity),
      cultures: args.cultures != null,
      cookieBannerPlacement: args.cookieBannerPlacement != null,
      brandkit: args.brandkit != null,
    },
  });

  const { runCreateSectionComponents } = await import('./run.mjs');
  await runCreateSectionComponents(args);
}

function isCliEntry() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return (
      path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
  });
}
