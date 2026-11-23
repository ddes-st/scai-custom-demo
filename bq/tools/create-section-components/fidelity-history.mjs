/**
 * Fidelity score history: before → after-1 → after-2 …
 * Percentages are always formatted with a % suffix for terminal + JSON.
 */

/**
 * @param {unknown} score
 * @returns {number|null} Integer 0–100, or null when unknown
 */
export function normalizeFidelityScore(score) {
  if (score === null || score === undefined || score === '') return null;
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * @param {unknown} score
 * @returns {string} e.g. "72%" or "n/a"
 */
export function formatFidelityPercent(score) {
  const n = normalizeFidelityScore(score);
  return n == null ? 'n/a' : `${n}%`;
}

/**
 * Label for history index: before, after-1, after-2, …
 * @param {number} index zero-based
 * @returns {string}
 */
export function fidelityHistoryLabel(index) {
  const i = Math.trunc(Number(index));
  if (!Number.isFinite(i) || i <= 0) return 'before';
  return `after-${i}`;
}

/**
 * Append a scored attempt to history.
 *
 * @param {object[]} history
 * @param {{
 *   score: unknown,
 *   pass?: boolean,
 *   generation?: number|null,
 *   notes?: string,
 *   error?: string,
 * }} entry
 * @returns {object} the pushed row
 */
export function pushFidelityHistory(history, entry) {
  const index = history.length;
  const score = normalizeFidelityScore(entry.score);
  const row = {
    index,
    label: fidelityHistoryLabel(index),
    score,
    percent: formatFidelityPercent(score),
    pass: Boolean(entry.pass),
    generation: entry.generation != null ? Number(entry.generation) : index + 1,
    notes: entry.notes || '',
    error: entry.error || null,
    at: new Date().toISOString(),
  };
  history.push(row);
  return row;
}

/**
 * Compact trail: before=72% → after-1=88% → after-2=96%
 * @param {object[]} history
 * @returns {string}
 */
export function formatFidelityHistoryTrail(history) {
  if (!Array.isArray(history) || !history.length) return '';
  return history.map((h) => `${h.label}=${h.percent || formatFidelityPercent(h.score)}`).join(' → ');
}

/**
 * Terminal summary line (always includes percentages when scores exist).
 *
 * @param {{
 *   mode: 'source'|'visual',
 *   componentName?: string,
 *   minScore?: number,
 *   history: object[],
 *   pass?: boolean,
 * }} opts
 * @returns {string}
 */
export function formatFidelityHistoryLine(opts) {
  const mode = opts.mode || 'fidelity';
  const name = opts.componentName ? ` ${opts.componentName}` : '';
  const trail = formatFidelityHistoryTrail(opts.history);
  const need =
    opts.minScore != null && Number.isFinite(Number(opts.minScore))
      ? ` (need ≥${formatFidelityPercent(opts.minScore)})`
      : '';
  const pass =
    opts.pass === true ? ' PASS' : opts.pass === false && trail ? '' : '';
  if (!trail) {
    return `  · ${mode} fidelity${name}: history=n/a${need}`;
  }
  return `  · ${mode} fidelity history${name}: ${trail}${need}${pass}`;
}

/**
 * Log one attempt with percentage + history label.
 *
 * @param {{
 *   mode: 'source'|'visual',
 *   componentName: string,
 *   score: unknown,
 *   minScore: number,
 *   label: string,
 *   generation?: number,
 *   maxIters?: number,
 *   pass?: boolean,
 *   extra?: string,
 * }} opts
 */
export function logFidelityAttempt(opts) {
  const pct = formatFidelityPercent(opts.score);
  const need = formatFidelityPercent(opts.minScore);
  const gen =
    opts.generation != null && opts.maxIters != null
      ? ` gen=${opts.generation}/${opts.maxIters}`
      : opts.generation != null
        ? ` gen=${opts.generation}`
        : '';
  const pass = opts.pass ? ' PASS' : '';
  const extra = opts.extra ? ` — ${opts.extra}` : '';
  console.log(
    `  · ${opts.mode} fidelity ${opts.componentName}: ${pct} (need ≥${need}) [${opts.label}]${gen}${pass}${extra}`,
  );
}

/**
 * @param {Parameters<typeof formatFidelityHistoryLine>[0]} opts
 */
export function logFidelityHistory(opts) {
  console.log(formatFidelityHistoryLine(opts));
}
