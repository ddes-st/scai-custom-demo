/**
 * Shared max-iteration / enable / min-score resolution for source / visual fidelity.
 * Max iters: clamp 0–3 (default 3) = max score→fix→re-score rounds
 * (1 = check once and try to fix once). Explicit 0 force-skips that mode even when
 * CLI/enable env is set.
 */

/**
 * @param {string} envName e.g. BQ_SOURCE_FIDELITY_MAX_ITERS
 * @param {number} [defaultWhenUnset=3]
 * @returns {number} Integer in 0..3
 */
export function resolveFidelityMaxIters(envName, defaultWhenUnset = 3) {
  const raw = process.env[envName];
  if (raw === undefined || String(raw).trim() === '') {
    return defaultWhenUnset;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return defaultWhenUnset;
  return Math.max(0, Math.min(3, Math.trunc(n)));
}

/**
 * @param {'source' | 'visual'} mode
 * @returns {number}
 */
export function fidelityMaxItersForMode(mode) {
  if (mode === 'visual') {
    return resolveFidelityMaxIters('BQ_VISUAL_FIDELITY_MAX_ITERS');
  }
  return resolveFidelityMaxIters('BQ_SOURCE_FIDELITY_MAX_ITERS');
}

/**
 * @param {number|null|undefined} n
 * @returns {number} 1–100
 */
export function clampFidelityScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 90;
  return Math.max(1, Math.min(100, Math.trunc(v)));
}

/**
 * CLI override wins; else env; else mode default (source 90 / visual 95).
 *
 * @param {'source' | 'visual'} mode
 * @param {number|null|undefined} [cliOverride]
 * @returns {number}
 */
export function fidelityMinScoreForMode(mode, cliOverride = null) {
  if (cliOverride != null && Number.isFinite(Number(cliOverride))) {
    return clampFidelityScore(cliOverride);
  }
  const envName =
    mode === 'visual' ? 'BQ_VISUAL_FIDELITY_MIN_SCORE' : 'BQ_SOURCE_FIDELITY_MIN_SCORE';
  const raw = process.env[envName];
  if (raw !== undefined && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return clampFidelityScore(n);
  }
  return mode === 'visual' ? 95 : 90;
}

/**
 * Enable gate: maxIters must be resolved first; 0 always disables.
 *
 * @param {{
 *   maxIters: number,
 *   cliOrEnvEnable?: boolean,
 *   skip?: boolean,
 * }} opts
 * @returns {boolean}
 */
export function isFidelityModeEnabled(opts) {
  const maxIters = Number(opts?.maxIters);
  if (!Number.isFinite(maxIters) || maxIters <= 0) return false;
  if (opts?.skip) return false;
  return Boolean(opts?.cliOrEnvEnable);
}

/**
 * @param {'source' | 'visual'} mode
 * @returns {string}
 */
export function fidelityMaxItersSkipMessage(mode) {
  if (mode === 'visual') {
    return 'Visual fidelity: skipped (BQ_VISUAL_FIDELITY_MAX_ITERS=0)';
  }
  return 'Source fidelity: skipped (BQ_SOURCE_FIDELITY_MAX_ITERS=0)';
}

/**
 * Parse boolean-ish env values for BQ_SOURCE_FIDELITY / BQ_VISUAL_FIDELITY.
 * Accepts: true/false, 1/0, yes/no (case-insensitive).
 *
 * @param {string | undefined} value
 * @returns {boolean | null} true / false, or null when unset/empty/unrecognized
 */
export function parseEnvBool(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim().toLowerCase();
  if (v === '') return null;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return null;
}

/**
 * @param {string | undefined} value
 * @returns {boolean} true only for true/1/yes
 */
export function envFlagOn(value) {
  return parseEnvBool(value) === true;
}

/**
 * Source fidelity enable: BQ_SOURCE_FIDELITY.
 * @returns {boolean}
 */
export function isSourceFidelityEnvEnabled() {
  return envFlagOn(process.env.BQ_SOURCE_FIDELITY);
}

/**
 * Visual fidelity enable from env.
 * @returns {boolean}
 */
export function isVisualFidelityEnvEnabled() {
  return envFlagOn(process.env.BQ_VISUAL_FIDELITY);
}

/**
 * Capture-only rendered TSX screenshots (no AI score) when visual fidelity is off.
 * Default **on** when unset; explicit false/0/no disables.
 * Full visual fidelity (`BQ_VISUAL_FIDELITY`) still owns capture when enabled.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string|undefined>} [env]
 * @returns {boolean}
 */
export function isVisualCaptureOnlyEnvEnabled(env = process.env) {
  const parsed = parseEnvBool(env?.BQ_VISUAL_CAPTURE_ONLY);
  if (parsed === false) return false;
  return true;
}
