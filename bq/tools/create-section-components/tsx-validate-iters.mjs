/**
 * BQ_TSX_VALIDATE_MAX_ITERS — AI validate loop (codegen contracts + tsc).
 * 0 = disabled; 1–3 = max attempts; unset = default 3.
 */

export const BQ_TSX_VALIDATE_MAX_ITERS = 'BQ_TSX_VALIDATE_MAX_ITERS';

/**
 * @param {string} [envName]
 * @param {number} [defaultWhenUnset=3]
 * @returns {number} Integer in 0..3
 */
export function resolveTsxValidateMaxIters(
  envName = BQ_TSX_VALIDATE_MAX_ITERS,
  defaultWhenUnset = 3,
) {
  const raw = process.env[envName];
  if (raw === undefined || String(raw).trim() === '') {
    return defaultWhenUnset;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return defaultWhenUnset;
  return Math.max(0, Math.min(3, Math.trunc(n)));
}

/**
 * Apply CLI `--tsx-validate-max-iters=N` (or space-separated) onto process.env.
 * @param {number|null|undefined} cliValue
 * @returns {number} Resolved max iters after apply
 */
export function applyTsxValidateMaxItersCli(cliValue) {
  if (cliValue != null && Number.isFinite(Number(cliValue))) {
    const n = Math.max(0, Math.min(3, Math.trunc(Number(cliValue))));
    process.env[BQ_TSX_VALIDATE_MAX_ITERS] = String(n);
  }
  // Logging lives in logCreateRunConfig (cli startup Run config block).
  return resolveTsxValidateMaxIters();
}
