/**
 * Startup dump of resolved BQ_* knobs for create:sectioncomponents.
 * Shows effective values and whether they came from env, CLI, or code defaults.
 */
import { resolveScreenshotDevices } from '../capture/lib/viewports.mjs';
import { BQ_TSX_VALIDATE_MAX_ITERS } from './tsx-validate-iters.mjs';
import {
  BQ_DEFINITION_VALIDATE_MAX_ITERS,
  resolveDefinitionValidateMaxIters,
} from './definition-validate-iters.mjs';
import { envFlagOn, clampFidelityScore } from './fidelity-iters.mjs';
import { resolveBrandLabelCase } from './naming.mjs';
import {
  BQ_CODEGEN_EVIDENCE_MODE,
  resolveCodegenEvidenceMode,
  resolveCodegenAttachScreenshots,
  resolveUiIconLibrary,
} from './ai-codegen.mjs';
import {
  BQ_CODEGEN_V2_FIXUPS,
  isCodegenV2FixupsForced,
  shouldSkipMutatingDefinitionFixups,
} from './ai-source-fixup.mjs';
import {
  BQ_LINK_LIST_AS_COMPOSITE,
  isLinkListAsCompositeEnabled,
} from '../shared/bq-env.mjs';
import { resolveCreateBrandkit } from '../brandkit/resolve-flag.mjs';

/**
 * @typedef {'env'|'default'|'cli'} ConfigSource
 * @typedef {{ key: string, value: string, source: ConfigSource }} ConfigEntry
 */

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} name
 */
function envKeyPresent(env, name) {
  return Object.prototype.hasOwnProperty.call(env, name);
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} name
 */
function envNonEmpty(env, name) {
  return envKeyPresent(env, name) && String(env[name] ?? '').trim() !== '';
}

/**
 * Clamp 0–3 max-iters style env (same as resolveTsxValidateMaxIters / resolveFidelityMaxIters).
 * @param {NodeJS.ProcessEnv} env
 * @param {string} name
 * @param {number} [defaultWhenUnset=3]
 */
function resolveMaxIters(env, name, defaultWhenUnset = 3) {
  const raw = env[name];
  if (raw === undefined || String(raw).trim() === '') return defaultWhenUnset;
  const n = Number(raw);
  if (!Number.isFinite(n)) return defaultWhenUnset;
  return Math.max(0, Math.min(3, Math.trunc(n)));
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {'source'|'visual'} mode
 */
function resolveMinScore(env, mode) {
  const envName =
    mode === 'visual' ? 'BQ_VISUAL_FIDELITY_MIN_SCORE' : 'BQ_SOURCE_FIDELITY_MIN_SCORE';
  const raw = env[envName];
  if (raw !== undefined && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return clampFidelityScore(n);
  }
  return mode === 'visual' ? 95 : 90;
}

/**
 * @param {string|undefined} raw
 */
function parseCulturesDisplay(raw) {
  const list = String(raw ?? '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list.join(',') : '(empty)';
}

/**
 * Collect resolved create:sectioncomponents knobs.
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   culturesOverride?: string|null,
 *   cliHints?: {
 *     tsxValidateMaxIters?: boolean,
 *     definitionValidateMaxIters?: boolean,
 *     skipFixups?: boolean,
 *     v2Fixups?: boolean,
 *     skipAiDebug?: boolean,
 *     sourceFidelity?: boolean,
 *     visualFidelity?: boolean,
 *     cultures?: boolean,
 *     brandkit?: boolean,
 *   },
 *   brandkitCli?: boolean|null,
 * }} [opts]
 * @returns {ConfigEntry[]}
 */
export function collectCreateRunConfig(opts = {}) {
  const env = opts.env || process.env;
  const hints = opts.cliHints || {};
  const culturesOverride =
    opts.culturesOverride !== undefined ? opts.culturesOverride : null;

  /** @type {ConfigEntry[]} */
  const entries = [];

  {
    const value = String(resolveMaxIters(env, BQ_TSX_VALIDATE_MAX_ITERS));
    let source = /** @type {ConfigSource} */ ('default');
    if (hints.tsxValidateMaxIters) source = 'cli';
    else if (envNonEmpty(env, BQ_TSX_VALIDATE_MAX_ITERS)) source = 'env';
    entries.push({ key: BQ_TSX_VALIDATE_MAX_ITERS, value, source });
  }

  {
    const retries = resolveDefinitionValidateMaxIters(env);
    const value = `${retries}  (retries after definition parse fail)`;
    let source = /** @type {ConfigSource} */ ('default');
    if (hints.definitionValidateMaxIters) source = 'cli';
    else if (envNonEmpty(env, BQ_DEFINITION_VALIDATE_MAX_ITERS)) source = 'env';
    entries.push({ key: BQ_DEFINITION_VALIDATE_MAX_ITERS, value, source });
  }

  {
    const devices = resolveScreenshotDevices({ env });
    const value = devices.join(',');
    let source = /** @type {ConfigSource} */ ('default');
    if (envNonEmpty(env, 'BQ_SCREENSHOT_VIEWPORTS')) source = 'env';
    entries.push({ key: 'BQ_SCREENSHOT_VIEWPORTS', value, source });
  }

  {
    const mode = resolveCodegenEvidenceMode(env);
    const attach = resolveCodegenAttachScreenshots(env);
    let source = /** @type {ConfigSource} */ ('default');
    if (envNonEmpty(env, BQ_CODEGEN_EVIDENCE_MODE)) source = 'env';
    entries.push({
      key: BQ_CODEGEN_EVIDENCE_MODE,
      value: `${mode}  attachScreenshots=${attach ? 'on' : 'off'}`,
      source,
    });
  }

  {
    const promptFirst = shouldSkipMutatingDefinitionFixups(env);
    const forced = isCodegenV2FixupsForced(env);
    const value = promptFirst
      ? 'off  (prompt-first: definition+tsx mutate skipped)'
      : forced
        ? 'on  (mutating TSX+definition fixups restored)'
        : 'on  (mutating fixups)';
    let source = /** @type {ConfigSource} */ ('default');
    if (hints.v2Fixups) source = 'cli';
    else if (envNonEmpty(env, BQ_CODEGEN_V2_FIXUPS)) source = 'env';
    entries.push({
      key: BQ_CODEGEN_V2_FIXUPS,
      value,
      source,
    });
  }

  {
    const on = envFlagOn(env.BQ_SOURCE_FIDELITY);
    const maxIters = resolveMaxIters(env, 'BQ_SOURCE_FIDELITY_MAX_ITERS');
    const minScore = resolveMinScore(env, 'source');
    const value = `${on ? 'on' : 'off'}  maxIters=${maxIters}  minScore=${minScore}`;
    let source = /** @type {ConfigSource} */ ('default');
    if (hints.sourceFidelity) source = 'cli';
    else if (
      envNonEmpty(env, 'BQ_SOURCE_FIDELITY') ||
      envNonEmpty(env, 'BQ_SOURCE_FIDELITY_MAX_ITERS') ||
      envNonEmpty(env, 'BQ_SOURCE_FIDELITY_MIN_SCORE')
    ) {
      source = 'env';
    }
    entries.push({ key: 'BQ_SOURCE_FIDELITY', value, source });
  }

  {
    const on = envFlagOn(env.BQ_VISUAL_FIDELITY);
    const maxIters = resolveMaxIters(env, 'BQ_VISUAL_FIDELITY_MAX_ITERS');
    const minScore = resolveMinScore(env, 'visual');
    const value = `${on ? 'on' : 'off'}  maxIters=${maxIters}  minScore=${minScore}`;
    let source = /** @type {ConfigSource} */ ('default');
    if (hints.visualFidelity) source = 'cli';
    else if (
      envNonEmpty(env, 'BQ_VISUAL_FIDELITY') ||
      envNonEmpty(env, 'BQ_VISUAL_FIDELITY_MAX_ITERS') ||
      envNonEmpty(env, 'BQ_VISUAL_FIDELITY_MIN_SCORE')
    ) {
      source = 'env';
    }
    entries.push({ key: 'BQ_VISUAL_FIDELITY', value, source });
  }

  {
    // Default on when unset; explicit false/0/no disables (see isVisualCaptureOnlyEnvEnabled).
    const raw = String(env.BQ_VISUAL_CAPTURE_ONLY ?? '')
      .trim()
      .toLowerCase();
    const off = raw === '0' || raw === 'false' || raw === 'no';
    const on = !off;
    let source = /** @type {ConfigSource} */ ('default');
    if (envNonEmpty(env, 'BQ_VISUAL_CAPTURE_ONLY')) source = 'env';
    entries.push({
      key: 'BQ_VISUAL_CAPTURE_ONLY',
      value: on
        ? 'on (shots without AI when fidelity off)'
        : 'off',
      source,
    });
  }

  {
    const raw = String(env.BQ_SKIP_AI_SOURCE_FIXUPS || '')
      .trim()
      .toLowerCase();
    const on = raw === '1' || raw === 'true' || raw === 'yes';
    let source = /** @type {ConfigSource} */ ('default');
    if (hints.skipFixups) source = 'cli';
    else if (envNonEmpty(env, 'BQ_SKIP_AI_SOURCE_FIXUPS')) source = 'env';
    entries.push({
      key: 'BQ_SKIP_AI_SOURCE_FIXUPS',
      value: on ? 'on' : 'off',
      source,
    });
  }

  {
    const dumpRaw = String(env.BQ_AI_DEBUG_DUMP || '')
      .trim()
      .toLowerCase();
    const skipDebug = String(env.BQ_SKIP_AI_DEBUG || '').trim() === '1';
    const off =
      dumpRaw === '0' ||
      dumpRaw === 'false' ||
      dumpRaw === 'off' ||
      dumpRaw === 'no' ||
      skipDebug;
    let source = /** @type {ConfigSource} */ ('default');
    if (hints.skipAiDebug) source = 'cli';
    else if (
      envNonEmpty(env, 'BQ_AI_DEBUG_DUMP') ||
      envNonEmpty(env, 'BQ_SKIP_AI_DEBUG')
    ) {
      source = 'env';
    }
    entries.push({
      key: 'BQ_AI_DEBUG_DUMP',
      value: off ? 'off' : 'on',
      source,
    });
  }

  {
    const raw = String(env.BQ_ALLOW_SEED_SALVAGE || '')
      .trim()
      .toLowerCase();
    const on = raw === '1' || raw === 'true';
    let source = /** @type {ConfigSource} */ ('default');
    if (envNonEmpty(env, 'BQ_ALLOW_SEED_SALVAGE')) source = 'env';
    entries.push({
      key: 'BQ_ALLOW_SEED_SALVAGE',
      value: on ? 'on' : 'off',
      source,
    });
  }

  {
    const on = isLinkListAsCompositeEnabled(env);
    let source = /** @type {ConfigSource} */ ('default');
    if (envNonEmpty(env, BQ_LINK_LIST_AS_COMPOSITE)) source = 'env';
    entries.push({
      key: BQ_LINK_LIST_AS_COMPOSITE,
      value: on
        ? 'on  (repeating links → PH + link-item children; JSON bags forbidden)'
        : 'off  (flat links → AppPlaceholder + LinkList package under Data/Link Lists)',
      source,
    });
  }

  {
    const value = resolveUiIconLibrary(env);
    let source = /** @type {ConfigSource} */ ('default');
    if (envNonEmpty(env, 'BQ_UI_ICON_LIBRARY')) source = 'env';
    entries.push({ key: 'BQ_UI_ICON_LIBRARY', value, source });
  }

  {
    const value = resolveBrandLabelCase(env);
    let source = /** @type {ConfigSource} */ ('default');
    if (envNonEmpty(env, 'BQ_BRAND_LABEL_CASE')) source = 'env';
    entries.push({ key: 'BQ_BRAND_LABEL_CASE', value, source });
  }

  {
    let value;
    let source = /** @type {ConfigSource} */ ('default');
    if (hints.cultures || culturesOverride != null) {
      source = 'cli';
      value = parseCulturesDisplay(
        culturesOverride != null ? culturesOverride : env.BQ_CULTURES,
      );
    } else if (!envKeyPresent(env, 'BQ_CULTURES')) {
      value = '(unset → none / CLI later)';
      source = 'default';
    } else {
      source = 'env';
      value = parseCulturesDisplay(env.BQ_CULTURES);
    }
    entries.push({ key: 'BQ_CULTURES', value, source });
  }

  {
    const brandkitCli =
      opts.brandkitCli !== undefined ? opts.brandkitCli : null;
    const on = resolveCreateBrandkit(
      { brandkit: brandkitCli },
      env,
    );
    let source = /** @type {ConfigSource} */ ('default');
    if (hints.brandkit || brandkitCli != null) source = 'cli';
    else if (envNonEmpty(env, 'BQ_CREATE_BRANDKIT')) source = 'env';
    entries.push({
      key: 'BQ_CREATE_BRANDKIT',
      value: on
        ? 'on  (create Stream brand kit if missing; --force to overwrite existing)'
        : 'off',
      source,
    });
  }

  return entries;
}

/**
 * @param {ConfigEntry[]} entries
 * @returns {string}
 */
export function formatCreateRunConfig(entries) {
  const lines = ['Run config (resolved):'];
  for (const e of entries) {
    lines.push(`  ${e.key}=${e.value} (${e.source})`);
  }
  lines.push(
    '  (BQ_SCREENSHOT_VIEWPORTS: which crops capture; BQ_CODEGEN_EVIDENCE_MODE=html|png: html=styled HTML no PNGs, png=original HTML + PNGs)',
  );
  return lines.join('\n');
}

/**
 * @param {Parameters<typeof collectCreateRunConfig>[0]} [opts]
 */
export function logCreateRunConfig(opts = {}) {
  const entries = collectCreateRunConfig(opts);
  console.log(formatCreateRunConfig(entries));
  return entries;
}
