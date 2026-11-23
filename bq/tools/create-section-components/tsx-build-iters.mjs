/**
 * TSX build gate after codegen write — contracts + tsc (Next-breakers tsc misses).
 *
 * Always-on like format repair: check staged sources; on failure AI re-emit once
 * (default). Respects BQ_TSX_VALIDATE_MAX_ITERS: 0 = skip gate; 1–3 = repair budget.
 */
import { BQ_TSX_VALIDATE_MAX_ITERS } from './tsx-validate-iters.mjs';

/** Default AI build-repair retry count when validate iters unset path uses always-on. */
export const TSX_BUILD_AI_RETRIES_DEFAULT = 1;

/**
 * How many AI build-repair retries after the first failing check.
 * Uses BQ_TSX_VALIDATE_MAX_ITERS when set (0 = disable gate); otherwise 1.
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} [env]
 * @returns {number} 0 = skip build gate; 1–3 = max AI repairs after a failed check
 */
export function resolveTsxBuildMaxRetries(env = process.env) {
  const raw = env[BQ_TSX_VALIDATE_MAX_ITERS];
  if (raw === undefined || String(raw).trim() === '') {
    return TSX_BUILD_AI_RETRIES_DEFAULT;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return TSX_BUILD_AI_RETRIES_DEFAULT;
  return Math.max(0, Math.min(3, Math.trunc(n)));
}

/**
 * Whether a write/validate error should trigger build AI re-emit.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isTsxBuildFailure(err) {
  const msg = String(err?.message || err || '');
  if (!msg) return false;
  return (
    /map-entry imports .*\.client. but clientTsx is missing/i.test(msg) ||
    /TSX build validate failed/i.test(msg) ||
    /Server Actions must be async/i.test(msg) ||
    /refusing to write broken package/i.test(msg) ||
    /\bCONTRACT:/i.test(msg) ||
    /\bTSC:/i.test(msg)
  );
}

/** Lead-in for build-repair LLM re-emit. */
export const TSX_BUILD_FIX_HEADER =
  "TSX BUILD FIX (hard): contracts and/or tsc rejected this package (would break Next build). Return complete corrected sources. Rules: (1) NEVER emit 'use server' on map-entry or client — RSC has no directive; companions start with 'use client'. (2) If map-entry imports './….client', you MUST emit a complete companion (=== clientTsx ===) with 'use client' + export default. (3) Keep Sitecore field wiring; do not invent new fields. (4) AppPlaceholder + component-map only on server map-entry.";
