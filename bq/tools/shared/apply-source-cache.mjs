/**
 * Skip scoped authoring:generate when *.definition.ts / *.content.ts are unchanged.
 *
 * Cache: .bq/definitions/cache/apply-source.json
 * (falls back to legacy emit-source.json on read)
 *
 * Per-site lastSuccessful.yamlsAt / lastSuccessful.componentsAt watermarks
 * (never embedded in definition sources). Apply can skip packages whose
 * definition/content mtime is not newer than yamlsAt.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  shouldForceApply,
} from './authoring-force-kinds.mjs';

/** Bump when apply / generate semantics change so skips invalidate. */
export const APPLY_SOURCE_PIPELINE_VERSION = 'apply-source/v2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BQ_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(BQ_ROOT, '..');
const COMPONENTS_ROOT = path.join(BQ_ROOT, 'src', 'components');
const CACHE_DIR = path.join(REPO_ROOT, '.bq', 'definitions', 'cache');
const CACHE_PATH = path.join(CACHE_DIR, 'apply-source.json');
const LEGACY_CACHE_PATH = path.join(CACHE_DIR, 'emit-source.json');

/**
 * @param {string} text
 */
function sha256Hex(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

/**
 * @param {string} dir
 * @param {string[]} suffixes
 * @param {string[]} out
 */
async function walkSuffixFiles(dir, suffixes, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkSuffixFiles(full, suffixes, out);
      continue;
    }
    if (entry.isFile() && suffixes.some((s) => entry.name.endsWith(s))) {
      out.push(full);
    }
  }
}

/**
 * @returns {Promise<string[]>} absolute paths, sorted
 */
export async function listApplySourceFiles() {
  /** @type {string[]} */
  const files = [];
  await walkSuffixFiles(COMPONENTS_ROOT, ['.definition.ts', '.content.ts'], files);
  return files.sort();
}

/**
 * @param {{
 *   collectionSystem?: string | null,
 *   siteSystem?: string | null,
 * }} scope
 */
export function applySourceScopeKey(scope) {
  const coll = String(scope?.collectionSystem || '')
    .trim()
    .toLowerCase();
  const site = String(scope?.siteSystem || '')
    .trim()
    .toLowerCase();
  return `${coll}::${site}`;
}

/**
 * @param {{
 *   collectionSystem?: string | null,
 *   siteSystem?: string | null,
 * }} [scope]
 */
export async function computeApplySourceHash(scope = {}) {
  const files = await listApplySourceFiles();
  /** @type {string[]} */
  const parts = [APPLY_SOURCE_PIPELINE_VERSION, applySourceScopeKey(scope)];
  for (const abs of files) {
    const rel = path.relative(COMPONENTS_ROOT, abs).replace(/\\/g, '/');
    let body = '';
    try {
      body = await readFile(abs, 'utf8');
    } catch {
      body = '';
    }
    parts.push(`${rel}\0${sha256Hex(body)}`);
  }
  return sha256Hex(parts.join('\n'));
}

/**
 * @returns {Promise<Record<string, any>>}
 */
export async function readApplySourceCacheFile() {
  for (const file of [CACHE_PATH, LEGACY_CACHE_PATH]) {
    try {
      const raw = await readFile(file, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return /** @type {Record<string, any>} */ (parsed);
      }
    } catch {
      /* missing or invalid — try next */
    }
  }
  return {};
}

/**
 * @param {Record<string, unknown>} data
 */
async function writeCacheFile(data) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  try {
    await unlink(LEGACY_CACHE_PATH);
  } catch {
    /* no legacy file */
  }
}

/**
 * @param {unknown} entry
 * @returns {{ yamlsAt: string | null, componentsAt: string | null }}
 */
export function getLastSuccessfulFromEntry(entry) {
  const ls = entry && typeof entry === 'object' ? entry.lastSuccessful : null;
  if (!ls || typeof ls !== 'object') {
    // Legacy single watermark (pre-v2 naming)
    const legacy =
      entry && typeof entry === 'object' && typeof entry.lastSuccessfulApplyAt === 'string'
        ? entry.lastSuccessfulApplyAt
        : null;
    return { yamlsAt: legacy, componentsAt: null };
  }
  return {
    yamlsAt: typeof ls.yamlsAt === 'string' ? ls.yamlsAt : null,
    componentsAt: typeof ls.componentsAt === 'string' ? ls.componentsAt : null,
  };
}

/**
 * Absolute paths for a definition package: the .definition.ts file + sibling .content.ts.
 * @param {string} definitionFileAbs
 * @returns {Promise<string[]>}
 */
export async function getDefinitionSourcePaths(definitionFileAbs) {
  const abs = path.resolve(definitionFileAbs);
  /** @type {string[]} */
  const out = [abs];
  if (abs.endsWith('.definition.ts')) {
    const contentAbs = abs.replace(/\.definition\.ts$/i, '.content.ts');
    try {
      await stat(contentAbs);
      out.push(contentAbs);
    } catch {
      /* no sibling content */
    }
  }
  return out;
}

/**
 * @param {string[]} absPaths
 * @returns {Promise<number>} max mtimeMs, or 0 if none
 */
export async function maxSourceMtimeMs(absPaths) {
  let max = 0;
  for (const p of absPaths || []) {
    try {
      const st = await stat(p);
      if (st.mtimeMs > max) max = st.mtimeMs;
    } catch {
      /* missing */
    }
  }
  return max;
}

/**
 * @param {{
 *   definitionFile: string,
 *   yamlsAt?: string | null,
 *   forceKinds?: Set<string> | null,
 *   scopeActive?: boolean,
 * }} opts
 * @returns {Promise<{ dirty: boolean, reason: string, maxMtimeMs: number }>}
 */
export async function isDefinitionApplyDirty(opts) {
  if (opts.scopeActive === false) {
    return { dirty: true, reason: 'scope inactive', maxMtimeMs: 0 };
  }
  if (shouldForceApply(opts.forceKinds)) {
    return { dirty: true, reason: 'force apply/translations', maxMtimeMs: 0 };
  }
  const yamlsAt = opts.yamlsAt;
  if (!yamlsAt) {
    return { dirty: true, reason: 'no lastSuccessful.yamlsAt', maxMtimeMs: 0 };
  }
  const watermarkMs = Date.parse(yamlsAt);
  if (!Number.isFinite(watermarkMs)) {
    return { dirty: true, reason: 'invalid lastSuccessful.yamlsAt', maxMtimeMs: 0 };
  }
  const paths = await getDefinitionSourcePaths(opts.definitionFile);
  const maxMtimeMs = await maxSourceMtimeMs(paths);
  if (maxMtimeMs <= 0) {
    return { dirty: true, reason: 'missing definition source', maxMtimeMs: 0 };
  }
  if (maxMtimeMs > watermarkMs) {
    return { dirty: true, reason: 'definition source newer than yamlsAt', maxMtimeMs };
  }
  return {
    dirty: false,
    reason: 'definition source not newer than lastSuccessful.yamlsAt',
    maxMtimeMs,
  };
}

/**
 * @param {{
 *   collectionSystem?: string | null,
 *   siteSystem?: string | null,
 *   forceKinds?: Set<string> | null,
 *   hash?: string,
 * }} opts
 * @returns {Promise<{ skip: boolean, reason: string, hash: string, scopeKey: string, yamlsAt: string | null, componentsAt: string | null }>}
 */
export async function canSkipApplyFromSourceCache(opts) {
  const scopeKey = applySourceScopeKey(opts);
  const hash =
    opts.hash ||
    (await computeApplySourceHash({
      collectionSystem: opts.collectionSystem,
      siteSystem: opts.siteSystem,
    }));

  if (!opts.collectionSystem && !opts.siteSystem) {
    return {
      skip: false,
      reason: 'scope inactive',
      hash,
      scopeKey,
      yamlsAt: null,
      componentsAt: null,
    };
  }

  if (shouldForceApply(opts.forceKinds)) {
    return {
      skip: false,
      reason: 'force apply/translations',
      hash,
      scopeKey,
      yamlsAt: null,
      componentsAt: null,
    };
  }

  const cache = await readApplySourceCacheFile();
  const entry = cache[scopeKey];
  const { yamlsAt, componentsAt } = getLastSuccessfulFromEntry(entry);
  if (!entry?.hash) {
    return {
      skip: false,
      reason: 'no prior apply-source cache',
      hash,
      scopeKey,
      yamlsAt,
      componentsAt,
    };
  }
  if (entry.pipelineVersion !== APPLY_SOURCE_PIPELINE_VERSION) {
    return {
      skip: false,
      reason: 'apply-source pipeline version mismatch',
      hash,
      scopeKey,
      yamlsAt,
      componentsAt,
    };
  }
  if (entry.hash !== hash) {
    return {
      skip: false,
      reason: 'apply-source hash changed',
      hash,
      scopeKey,
      yamlsAt,
      componentsAt,
    };
  }

  return {
    skip: true,
    reason: 'apply-source hash unchanged',
    hash,
    scopeKey,
    yamlsAt,
    componentsAt,
  };
}

/**
 * @param {{
 *   collectionSystem?: string | null,
 *   siteSystem?: string | null,
 * }} opts
 * @returns {Promise<{ yamlsAt: string | null, componentsAt: string | null, pipelineVersion: string | null }>}
 */
export async function readScopeLastSuccessful(opts) {
  const scopeKey = applySourceScopeKey(opts);
  const cache = await readApplySourceCacheFile();
  const entry = cache[scopeKey];
  const ls = getLastSuccessfulFromEntry(entry);
  return {
    ...ls,
    pipelineVersion:
      entry && typeof entry.pipelineVersion === 'string'
        ? entry.pipelineVersion
        : null,
  };
}

/** Cap samples so outliers do not dominate forever. */
const APPLY_TIMING_MAX_SAMPLES = 20;

/**
 * @param {unknown} entry
 * @returns {{ avgMs: number | null, samples: number }}
 */
export function getApplyTimingFromEntry(entry) {
  const t =
    entry && typeof entry === 'object'
      ? entry.applyTiming || entry.emitTiming || null
      : null;
  if (!t || typeof t !== 'object') return { avgMs: null, samples: 0 };
  const avgMs = typeof t.avgMs === 'number' && Number.isFinite(t.avgMs) ? t.avgMs : null;
  const samples =
    typeof t.samples === 'number' && Number.isFinite(t.samples) && t.samples > 0
      ? Math.floor(t.samples)
      : 0;
  if (avgMs == null || samples < 1) return { avgMs: null, samples: 0 };
  return { avgMs, samples };
}

/**
 * @param {{ avgMs: number | null, samples: number }} timing
 * @param {number} count packages that may apply
 * @returns {string | null} e.g. "~12m for 48 packages (avg 15s)"
 */
export function formatApplyEta(timing, count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (!timing?.avgMs || timing.samples < 1 || n < 1) return null;
  const etaMs = timing.avgMs * n;
  const avgSec = Math.max(1, Math.round(timing.avgMs / 1000));
  let etaLabel;
  if (etaMs >= 60_000) {
    const mins = Math.max(1, Math.round(etaMs / 60_000));
    etaLabel = `~${mins}m`;
  } else {
    etaLabel = `~${Math.max(1, Math.round(etaMs / 1000))}s`;
  }
  return `${etaLabel} for ${n} package${n === 1 ? '' : 's'} (avg ${avgSec}s)`;
}

/**
 * Persist a rolling mean of per-package apply duration for the scope.
 * @param {{
 *   collectionSystem?: string | null,
 *   siteSystem?: string | null,
 *   ms: number,
 * }} opts
 */
export async function recordApplyTimingSample(opts) {
  const scopeKey = applySourceScopeKey(opts);
  if (!opts.collectionSystem && !opts.siteSystem) return;
  const ms = Number(opts.ms);
  if (!Number.isFinite(ms) || ms < 0) return;

  const cache = await readApplySourceCacheFile();
  const prev = cache[scopeKey] || {};
  const prevTiming = getApplyTimingFromEntry(prev);
  const prevSamples = prevTiming.samples;
  const prevAvg = prevTiming.avgMs ?? ms;
  const nextSamples = Math.min(APPLY_TIMING_MAX_SAMPLES, prevSamples + 1);
  const nextAvg =
    prevSamples < 1
      ? ms
      : prevAvg + (ms - prevAvg) / Math.min(APPLY_TIMING_MAX_SAMPLES, prevSamples + 1);

  cache[scopeKey] = {
    ...prev,
    updatedAt: new Date().toISOString(),
    collectionSystem:
      String(opts.collectionSystem || '').trim() || prev.collectionSystem || null,
    siteSystem: String(opts.siteSystem || '').trim() || prev.siteSystem || null,
    applyTiming: {
      avgMs: Math.round(nextAvg),
      samples: nextSamples,
      lastMs: Math.round(ms),
      updatedAt: new Date().toISOString(),
    },
  };
  await writeCacheFile(cache);
}

/**
 * Read applyTiming for a scope (for phase-6 ETA).
 * @param {{
 *   collectionSystem?: string | null,
 *   siteSystem?: string | null,
 * }} opts
 */
export async function readScopeApplyTiming(opts) {
  const scopeKey = applySourceScopeKey(opts);
  const cache = await readApplySourceCacheFile();
  return getApplyTimingFromEntry(cache[scopeKey]);
}

/**
 * Record aggregate hash + stamp yamlsAt after successful definitions:generate.
 * Preserves existing componentsAt and applyTiming.
 * @param {{
 *   collectionSystem?: string | null,
 *   siteSystem?: string | null,
 *   hash: string,
 *   yamlsAt?: string,
 * }} opts
 */
export async function recordApplySourceCache(opts) {
  const scopeKey = applySourceScopeKey(opts);
  if (!opts.collectionSystem && !opts.siteSystem) return;
  if (!opts.hash) return;

  const cache = await readApplySourceCacheFile();
  const prev = cache[scopeKey] || {};
  const prevLs = getLastSuccessfulFromEntry(prev);
  const yamlsAt = opts.yamlsAt || new Date().toISOString();
  cache[scopeKey] = {
    ...prev,
    hash: opts.hash,
    pipelineVersion: APPLY_SOURCE_PIPELINE_VERSION,
    updatedAt: new Date().toISOString(),
    collectionSystem: String(opts.collectionSystem || '').trim() || null,
    siteSystem: String(opts.siteSystem || '').trim() || null,
    lastSuccessful: {
      yamlsAt,
      componentsAt: prevLs.componentsAt,
    },
  };
  await writeCacheFile(cache);
}

/**
 * Stamp componentsAt after successful create:sectioncomponents for a site.
 * Preserves yamlsAt and hash when present.
 * @param {{
 *   collectionSystem?: string | null,
 *   siteSystem?: string | null,
 *   componentsAt?: string,
 * }} opts
 */
export async function recordComponentsSuccessAt(opts) {
  const scopeKey = applySourceScopeKey(opts);
  if (!opts.collectionSystem && !opts.siteSystem) return;

  const cache = await readApplySourceCacheFile();
  const prev = cache[scopeKey] || {};
  const prevLs = getLastSuccessfulFromEntry(prev);
  const componentsAt = opts.componentsAt || new Date().toISOString();
  cache[scopeKey] = {
    ...prev,
    pipelineVersion: prev.pipelineVersion || APPLY_SOURCE_PIPELINE_VERSION,
    updatedAt: new Date().toISOString(),
    collectionSystem: String(opts.collectionSystem || '').trim() || null,
    siteSystem: String(opts.siteSystem || '').trim() || null,
    lastSuccessful: {
      yamlsAt: prevLs.yamlsAt,
      componentsAt,
    },
    // preserve applyTiming via ...prev
  };
  await writeCacheFile(cache);
}

/**
 * Lightweight existence check used by tests.
 * @param {string} absPath
 */
export async function pathExists(absPath) {
  try {
    await stat(absPath);
    return true;
  } catch {
    return false;
  }
}

export { CACHE_PATH as APPLY_SOURCE_CACHE_PATH, COMPONENTS_ROOT };
