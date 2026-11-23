/**
 * Track Azure OpenAI usage for terminal + conversion JSON files.
 * Hierarchy: per call → per component → per section → per run.
 * Fidelity calls use purpose prefixes source-fidelity-* / visual-fidelity-*.
 * Score history (before → after-1 → …) is stored separately for terminal + JSON.
 */

import {
  formatFidelityHistoryTrail,
  formatFidelityPercent,
} from './fidelity-history.mjs';
import { isCreateVerbose, logVerbose } from './create-log.mjs';

/**
 * Always flush create AI usage (success or failure). On failure, print a clear
 * banner first so the error is obvious, then the same page totals / run summary.
 *
 * @param {{
 *   ledger: { printPageTotals: () => void, totals: () => object },
 *   failed?: boolean,
 *   error?: unknown,
 *   tool?: string,
 *   logRunSummary?: ((opts: { tool: string, ai: object }) => void) | null,
 * }} opts
 */
export function flushCreateAiUsageSummary(opts = {}) {
  const tool = String(opts.tool || 'create:sectioncomponents').trim();
  const ledger = opts.ledger;
  if (opts.failed) {
    const msg = String(
      opts.error instanceof Error ? opts.error.message : opts.error || 'unknown',
    )
      .split('\n')[0]
      .trim();
    console.error(`\n✗ ${tool} failed — AI usage recorded before failure:`);
    if (msg) console.error(`  ${msg}`);
  }
  if (ledger && typeof ledger.printPageTotals === 'function') {
    ledger.printPageTotals();
  }
  if (typeof opts.logRunSummary === 'function' && ledger) {
    opts.logRunSummary({ tool, ai: ledger.totals() });
  }
}

const FIDELITY_PURPOSES = {
  source: ['source-fidelity-score', 'source-fidelity-patch'],
  visual: [
    'visual-fidelity-score',
    'visual-fidelity-codegen',
    'visual-fidelity-repair',
    'visual-fidelity-regenerate',
  ],
};

/**
 * @param {string|null|undefined} purpose
 * @param {'source'|'visual'|null} [mode]
 * @returns {boolean}
 */
export function isFidelityPurpose(purpose, mode = null) {
  const p = String(purpose || '');
  if (mode === 'source') return p.startsWith('source-fidelity');
  if (mode === 'visual') return p.startsWith('visual-fidelity');
  return p.startsWith('source-fidelity') || p.startsWith('visual-fidelity');
}

/**
 * Format a single AI usage line for the terminal.
 * @param {object} row
 * @returns {string}
 */
export function formatAiUsageLine(row) {
  const tag = [row.section, row.purpose].filter(Boolean).join('/');
  const iter =
    row.iteration != null && Number.isFinite(row.iteration) ? ` i${row.iteration}` : '';
  if (!row.ok) {
    return `  AI usage [${tag}${iter}]: FAILED — ${row.skipReason || 'unknown'}`;
  }
  if (row.skipReason && !row.usage) {
    return `  AI usage [${tag}${iter}]: skipped — ${row.skipReason}`;
  }
  if (!row.usage) {
    return `  AI usage [${tag}${iter}]: model=${row.model || '?'} usage: unavailable`;
  }
  const u = row.usage;
  const cost =
    row.costEstimateUsd != null ? ` ~$${Number(row.costEstimateUsd).toFixed(4)} (estimate)` : '';
  const cached = u.cachedTokens != null ? ` cached=${u.cachedTokens}` : '';
  return `  AI usage [${tag}${iter}]: model=${row.model || '?'} in=${u.promptTokens ?? 0} out=${u.completionTokens ?? 0} total=${u.totalTokens ?? 0}${cached}${cost}`;
}

export function createAiLedger() {
  /** @type {object[]} */
  const calls = [];
  /** @type {object[]} */
  const fidelityScores = [];

  function record(entry) {
    const purpose = entry.purpose || 'unknown';
    const fidelityMode =
      entry.fidelityMode ||
      (purpose.startsWith('source-fidelity')
        ? 'source'
        : purpose.startsWith('visual-fidelity')
          ? 'visual'
          : null);
    const row = {
      at: new Date().toISOString(),
      purpose,
      fidelityMode,
      iteration: entry.iteration != null ? Number(entry.iteration) : null,
      section: entry.section || null,
      componentName: entry.componentName || null,
      model: entry.model || null,
      usage: entry.usage || null,
      costEstimateUsd: entry.costEstimate?.totalUsd ?? entry.costEstimateUsd ?? null,
      rateSource: entry.costEstimate?.rateSource ?? entry.rateSource ?? null,
      ok: entry.ok !== false,
      skipReason: entry.skipReason || null,
    };
    calls.push(row);
    logTerminal(row);
    return row;
  }

  function logTerminal(row) {
    const line = formatAiUsageLine(row);
    // Fidelity + codegen + brandkit calls always print; other successful lines stay verbose-only.
    const purpose = String(row.purpose || '');
    const isFidelity = isFidelityPurpose(purpose) || row.fidelityMode === 'source' || row.fidelityMode === 'visual';
    const isSectionCodegen = /^codegen-(visual|sitecoreize)/.test(purpose);
    const isBrandkit = /^brandkit-/.test(purpose);
    if (!row.ok || (row.skipReason && !row.usage)) {
      console.log(line);
      return;
    }
    if (isFidelity || isSectionCodegen || isBrandkit) {
      console.log(line);
      return;
    }
    if (!isCreateVerbose()) return;
    logVerbose(line);
  }

  /**
   * Skipped ledger rows (hash reuse, wire-only, etc.) are not AI calls.
   * @param {object} c
   */
  function isActualAiCall(c) {
    if (c?.skipReason) return false;
    return true;
  }

  function totals(filterFn = null) {
    const subset = filterFn ? calls.filter(filterFn) : calls;
    const aiCalls = subset.filter(isActualAiCall);
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let costEstimateUsd = 0;
    for (const c of aiCalls) {
      if (!c.usage && typeof c.costEstimateUsd !== 'number') continue;
      promptTokens += c.usage?.promptTokens || 0;
      completionTokens += c.usage?.completionTokens || 0;
      totalTokens += c.usage?.totalTokens || 0;
      if (typeof c.costEstimateUsd === 'number') costEstimateUsd += c.costEstimateUsd;
    }
    return {
      promptTokens,
      completionTokens,
      totalTokens,
      costEstimateUsd: Math.round(costEstimateUsd * 1e6) / 1e6,
      callCount: aiCalls.length,
    };
  }

  function fidelityFilter(opts = {}) {
    return (c) => {
      const modeMatch = opts.mode
        ? c.fidelityMode === opts.mode || isFidelityPurpose(c.purpose, opts.mode)
        : isFidelityPurpose(c.purpose) || c.fidelityMode === 'source' || c.fidelityMode === 'visual';
      if (!modeMatch) return false;
      if (opts.section && c.section !== opts.section) return false;
      if (opts.componentName && c.componentName !== opts.componentName) return false;
      return true;
    };
  }

  function nonFidelityFilter(opts = {}) {
    return (c) => {
      if (isFidelityPurpose(c.purpose) || c.fidelityMode === 'source' || c.fidelityMode === 'visual') {
        return false;
      }
      if (opts.section && c.section !== opts.section) return false;
      if (opts.componentName && c.componentName !== opts.componentName) return false;
      return true;
    };
  }

  /**
   * @param {'source'|'visual'|null} [mode]
   * @param {{ section?: string, componentName?: string }} [opts]
   */
  function totalsFidelity(mode = null, opts = {}) {
    return totals(fidelityFilter({ mode, ...opts }));
  }

  /**
   * Base create/codegen spend excluding source/visual fidelity calls.
   * @param {{ section?: string, componentName?: string }} [opts]
   */
  function totalsNonFidelity(opts = {}) {
    return totals(nonFidelityFilter(opts));
  }

  /**
   * Record one scored fidelity attempt (before / after-N).
   * @param {object} entry
   */
  function recordFidelityScore(entry) {
    const row = {
      at: entry.at || new Date().toISOString(),
      mode: entry.mode || null,
      section: entry.section || null,
      componentName: entry.componentName || null,
      label: entry.label || null,
      index: entry.index != null ? Number(entry.index) : null,
      score: entry.score != null ? Number(entry.score) : null,
      percent: entry.percent || formatFidelityPercent(entry.score),
      pass: Boolean(entry.pass),
      generation: entry.generation != null ? Number(entry.generation) : null,
      minScore: entry.minScore != null ? Number(entry.minScore) : null,
      notes: entry.notes || '',
      error: entry.error || null,
    };
    fidelityScores.push(row);
    return row;
  }

  /**
   * @param {{ mode?: 'source'|'visual', section?: string, componentName?: string }} [opts]
   * @returns {object[]}
   */
  function fidelityScoreHistory(opts = {}) {
    return fidelityScores.filter((s) => {
      if (opts.mode && s.mode !== opts.mode) return false;
      if (opts.section && s.section !== opts.section) return false;
      if (opts.componentName && s.componentName !== opts.componentName) return false;
      return true;
    });
  }

  function fidelityCostSnapshot(opts = {}) {
    const subset = calls.filter(fidelityFilter(opts));
    /** @type {Record<number, object[]>} */
    const byIter = {};
    for (const c of subset) {
      const k = c.iteration != null && Number.isFinite(c.iteration) ? c.iteration : 0;
      if (!byIter[k]) byIter[k] = [];
      byIter[k].push(c);
    }
    const byIteration = Object.keys(byIter)
      .map(Number)
      .sort((a, b) => a - b)
      .map((iteration) => ({
        iteration,
        ...totals((c) => byIter[iteration].includes(c)),
      }));
    const scoreHistory = fidelityScoreHistory(opts);
    return {
      ...totals((c) => subset.includes(c)),
      byIteration,
      calls: subset,
      scoreHistory,
      scoreTrail: formatFidelityHistoryTrail(scoreHistory),
    };
  }

  function formatTotalsLine(label, t) {
    return `${label}: calls=${t.callCount} in=${t.promptTokens} out=${t.completionTokens} total=${t.totalTokens} ~$${t.costEstimateUsd.toFixed(4)} (estimate)`;
  }

  /**
   * @param {{
   *   mode?: 'source'|'visual',
   *   section?: string,
   *   componentName?: string,
   *   scoreHistory?: object[],
   *   minScore?: number,
   *   force?: boolean,
   * }} [opts]
   */
  function printFidelityTotals(opts = {}) {
    const mode = opts.mode || null;
    const t = totalsFidelity(mode, opts);
    const history =
      Array.isArray(opts.scoreHistory) && opts.scoreHistory.length
        ? opts.scoreHistory
        : fidelityScoreHistory(opts);
    if (t.callCount === 0 && !history.length && !opts.force) return;
    const parts = [];
    if (mode) parts.push(mode);
    if (opts.section) parts.push(opts.section);
    if (opts.componentName) parts.push(opts.componentName);
    const label =
      parts.length > 0 ? `AI fidelity [${parts.join('/')}]` : 'AI fidelity totals';
    const trail = formatFidelityHistoryTrail(history);
    const need =
      opts.minScore != null && Number.isFinite(Number(opts.minScore))
        ? ` need≥${formatFidelityPercent(opts.minScore)}`
        : '';
    const histSuffix = trail ? ` | scores: ${trail}${need ? ` ${need}` : ''}` : '';
    console.log(`  ${formatTotalsLine(label, t)}${histSuffix}`);
  }

  function printFidelityRunTotals() {
    const source = totalsFidelity('source');
    const visual = totalsFidelity('visual');
    const combined = totalsFidelity(null);
    if (combined.callCount === 0) return;
    console.log(
      `  ${formatTotalsLine('AI fidelity run totals', combined)} (source=~$${source.costEstimateUsd.toFixed(4)} visual=~$${visual.costEstimateUsd.toFixed(4)})`,
    );
  }

  function printSectionTotals(sectionFolder) {
    if (!sectionFolder) return;
    const without = totalsNonFidelity({ section: sectionFolder });
    const withFid = totals((c) => c.section === sectionFolder);
    const fid = totalsFidelity(null, { section: sectionFolder });
    console.log(
      `  ${formatTotalsLine(`AI section [${sectionFolder}] without fidelity`, without)}`,
    );
    // Only print fidelity / combined lines when fidelity actually ran.
    if (fid.callCount > 0) {
      printFidelityTotals({ section: sectionFolder });
      console.log(
        `  ${formatTotalsLine(`AI section [${sectionFolder}] with fidelity`, withFid)}`,
      );
    }
  }

  function printPageTotals() {
    const without = totalsNonFidelity();
    const withFid = totals();
    const fid = totalsFidelity(null);
    console.log(`  ${formatTotalsLine('AI page without fidelity', without)}`);
    if (fid.callCount > 0) {
      printFidelityRunTotals();
      console.log(`  ${formatTotalsLine('AI page with fidelity', withFid)}`);
    }
  }

  /**
   * Group calls by componentName for conversion JSON.
   * @returns {Record<string, { calls: object[], totals: object }>}
   */
  function byComponent(filterFn = null) {
    const subset = filterFn ? calls.filter(filterFn) : calls;
    /** @type {Record<string, object[]>} */
    const map = {};
    for (const c of subset) {
      const key = c.componentName || '(no-component)';
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    /** @type {Record<string, { calls: object[], totals: ReturnType<typeof totals> }>} */
    const out = {};
    for (const [name, rows] of Object.entries(map)) {
      out[name] = {
        calls: rows,
        totals: totals((c) =>
          name === '(no-component)'
            ? !c.componentName
            : c.componentName === name,
        ),
      };
    }
    return out;
  }

  function forSection(sectionFolder) {
    const sectionCalls = calls.filter((c) => c.section === sectionFolder);
    return {
      calls: sectionCalls,
      totals: totals((c) => c.section === sectionFolder),
      totalsWithoutFidelity: totalsNonFidelity({ section: sectionFolder }),
      byComponent: byComponent((c) => c.section === sectionFolder),
      fidelity: fidelityCostSnapshot({ section: sectionFolder }),
      fidelityScores: fidelityScoreHistory({ section: sectionFolder }),
    };
  }

  function snapshot() {
    return {
      calls,
      totals: totals(),
      totalsWithoutFidelity: totalsNonFidelity(),
      byComponent: byComponent(),
      fidelity: fidelityCostSnapshot(),
      fidelitySource: fidelityCostSnapshot({ mode: 'source' }),
      fidelityVisual: fidelityCostSnapshot({ mode: 'visual' }),
      fidelityScores: [...fidelityScores],
    };
  }

  return {
    record,
    recordFidelityScore,
    fidelityScoreHistory,
    get calls() {
      return calls;
    },
    get fidelityScores() {
      return fidelityScores;
    },
    totals,
    totalsFidelity,
    totalsNonFidelity,
    fidelityCostSnapshot,
    byComponent,
    printSectionTotals,
    printPageTotals,
    printFidelityTotals,
    printFidelityRunTotals,
    forSection,
    snapshot,
    FIDELITY_PURPOSES,
  };
}
