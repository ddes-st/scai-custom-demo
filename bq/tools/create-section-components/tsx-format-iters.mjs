/**
 * TSX format repair after Prettier refuse-to-write.
 *
 * Always-on (no env gate): deterministic salvage runs in normalize + write;
 * AI re-emit retries once by default — same spirit as definition parse repair
 * (always fix, then one retry), independent of BQ_TSX_VALIDATE_MAX_ITERS.
 */

/** Default AI format-repair retry count (always on). */
export const TSX_FORMAT_AI_RETRIES_DEFAULT = 1;

/**
 * @returns {number} Integer in 0..3 (retry count)
 */
export function resolveTsxFormatMaxIters() {
  return TSX_FORMAT_AI_RETRIES_DEFAULT;
}

/**
 * Whether an error from writeComponentPackage / formatGeneratedSource is a format refusal.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isTsxFormatFailure(err) {
  const msg = String(err?.message || err || '');
  if (!msg) return false;
  return (
    /prettier failed/i.test(msg) ||
    /refusing to write invalid\/unformatted source/i.test(msg) ||
    /still a single-line dump after Prettier/i.test(msg)
  );
}

/** Lead-in for TSX format repair LLM re-emit. */
export const TSX_FORMAT_FIX_HEADER =
  'TSX FORMAT FIX (hard): Prettier/parser rejected this file. Return complete corrected tsx (and clientTsx if provided) only — valid JSX/TS, no markdown fences, no commentary. Common fixes: glued attributes (`<divclassName=` → `<div className=`), missing spaces between tag and attrs or between attrs (`type="button"aria-expanded=` → `type="button" aria-expanded=`), `inputname=` → `input name=`, broken className quoting, unbalanced JSX braces/tags. Keep component structure and Sitecore field usage; do not invent new fields.';
