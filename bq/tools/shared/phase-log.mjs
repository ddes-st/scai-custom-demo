/**
 * Timed phase start/done lines for definitions:generate / create:sectioncomponents.
 * Nesting via env BQ_PHASE_NEST (JSON) so child processes inherit parent context.
 *
 * Markers (ASCII): -> start | ok done | skip | > shell
 * Colors: cyan / blue / green / dim / yellow (never red). Respects NO_COLOR.
 */

import fs from 'node:fs';
import path from 'node:path';
import { formatElapsed } from './bq-console.mjs';

const NEST_ENV = 'BQ_PHASE_NEST';
const OPEN_KEY = '__bqOpenPhase';
const HISTORY_KEY = '__bqPhaseHistory';
const HISTORY_STACK_KEY = '__bqPhaseHistoryStack';
const SUMMARY_HISTORY_KEY = '__bqPhaseSummaryHistory';
const SCOPE_DEPTH_KEY = '__bqPhaseScopeDepth';
const SER_OPS_KEY = '__bqSerOps';
/** Child processes append JSONL here when set (create → authoring:generate). */
export const BQ_SER_OPS_LOG_ENV = 'BQ_SER_OPS_LOG';

/**
 * @typedef {{ tool: string, phase: number, total: number, title: string, detail?: string[] }} PhaseNest
 * @typedef {{
 *   tool: string,
 *   phase: number,
 *   total: number,
 *   title: string,
 *   startedAt: number,
 *   tokens?: { promptTokens?: number, completionTokens?: number, totalTokens?: number, costEstimateUsd?: number, callCount?: number } | null,
 * }} OpenPhase
 * @typedef {{
 *   tool: string,
 *   phase: number,
 *   total: number,
 *   title: string,
 *   ms: number,
 *   skipped?: boolean,
 *   skipReason?: string,
 *   tokens?: OpenPhase['tokens'],
 * }} PhaseHistoryEntry
 * @typedef {{
 *   action: 'pull' | 'push' | 'validate',
 *   reason?: string,
 *   ms: number,
 *   ok: boolean,
 *   phase?: number,
 *   phaseTitle?: string,
 * }} SerOpEntry
 */
/**
 * @returns {boolean}
 */
function useColor() {
  if (process.env.NO_COLOR != null && process.env.NO_COLOR !== '') return false;
  if (process.env.FORCE_COLOR === '0') return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout?.isTTY);
}

/**
 * Kept for callers that still import it; detail is no longer printed.
 * @param {string|string[]|undefined|null} detail
 * @returns {string[]}
 */
export function normalizePhaseDetail(detail) {
  if (detail == null) return [];
  const lines = Array.isArray(detail)
    ? detail.map((l) => String(l || '').trim())
    : String(detail)
        .split(/\r?\n/)
        .map((l) => l.trim());
  return lines.filter(Boolean).slice(0, 3);
}

/** @deprecated No longer printed; empty stub for import compatibility. */
export const PHASE_DETAILS = {};

/**
 * @param {string} _tool
 * @param {number} _phase
 * @param {string} [_title]
 * @returns {string[]}
 */
export function defaultPhaseDetail(_tool, _phase, _title = '') {
  return [];
}

/**
 * @returns {PhaseNest | null}
 */
export function readPhaseNest() {
  const raw = (process.env[NEST_ENV] || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.tool === 'string' &&
      typeof parsed.phase === 'number' &&
      typeof parsed.total === 'number' &&
      typeof parsed.title === 'string'
    ) {
      return {
        tool: parsed.tool,
        phase: parsed.phase,
        total: parsed.total,
        title: parsed.title,
        detail: normalizePhaseDetail(parsed.detail),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {PhaseNest | null | undefined} nest
 */
export function setPhaseNest(nest) {
  if (!nest) {
    delete process.env[NEST_ENV];
    return;
  }
  process.env[NEST_ENV] = JSON.stringify({
    tool: nest.tool,
    phase: nest.phase,
    total: nest.total,
    title: nest.title,
    detail: normalizePhaseDetail(nest.detail),
  });
}

export function clearPhaseNest() {
  delete process.env[NEST_ENV];
}

/**
 * @param {PhaseNest} nest
 * @param {() => Promise<T> | T} fn
 * @returns {Promise<T>}
 * @template T
 */
export async function withPhaseNest(nest, fn) {
  const prev = process.env[NEST_ENV];
  setPhaseNest(nest);
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env[NEST_ENV];
    else process.env[NEST_ENV] = prev;
  }
}

/**
 * Nest indent: child processes under create get two spaces.
 * @returns {string}
 */
export function phaseNestIndent() {
  return readPhaseNest() ? '  ' : '';
}

/**
 * Live -> / ok duration (may use ms for sub-second).
 * @param {number} ms
 * @returns {string}
 */
export function formatPhaseDuration(ms) {
  const n = Math.max(0, Number(ms) || 0);
  if (n < 1000) return `${Math.round(n)}ms`;
  const sec = n / 1000;
  if (sec < 60) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`;
  const mins = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${mins}m${String(rem).padStart(2, '0')}s`;
}

/**
 * Run summary duration: `MM:SS,cc` (minutes:seconds,centiseconds).
 * @param {number} ms
 * @returns {string}
 */
export function formatSummaryDuration(ms) {
  const n = Math.max(0, Math.round(Number(ms) || 0));
  const mins = Math.floor(n / 60000);
  const secs = Math.floor((n % 60000) / 1000);
  const centis = Math.floor((n % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(centis).padStart(2, '0')}`;
}

/**
 * @param {OpenPhase['tokens']} tokens
 * @returns {string}
 */
function formatTokensSuffix(tokens) {
  if (!tokens) return '';
  const inT = tokens.promptTokens ?? 0;
  const outT = tokens.completionTokens ?? 0;
  const total = tokens.totalTokens ?? inT + outT;
  const calls = tokens.callCount ?? 0;
  if (!calls && !total && !(tokens.costEstimateUsd > 0)) return '';
  const cost =
    typeof tokens.costEstimateUsd === 'number' && tokens.costEstimateUsd > 0
      ? ` ~$${tokens.costEstimateUsd.toFixed(4)}`
      : '';
  const callBit = calls ? `calls=${calls} ` : '';
  return ` · ${callBit}tokens in=${inT} out=${outT} total=${total}${cost}`;
}

/**
 * @returns {OpenPhase | null}
 */
function getOpenPhase() {
  return globalThis[OPEN_KEY] || null;
}

/**
 * @param {OpenPhase | null} open
 */
function setOpenPhase(open) {
  if (!open) delete globalThis[OPEN_KEY];
  else globalThis[OPEN_KEY] = open;
}

/**
 * @returns {PhaseHistoryEntry[]}
 */
export function getPhaseHistory() {
  if (!globalThis[HISTORY_KEY]) globalThis[HISTORY_KEY] = [];
  return globalThis[HISTORY_KEY];
}

export function clearPhaseHistory() {
  globalThis[HISTORY_KEY] = [];
}

/**
 * Append-only history for Run summary (scopes do not wipe prior rows).
 * @returns {PhaseHistoryEntry[]}
 */
export function getSummaryHistory() {
  if (!globalThis[SUMMARY_HISTORY_KEY]) globalThis[SUMMARY_HISTORY_KEY] = [];
  return globalThis[SUMMARY_HISTORY_KEY];
}

export function clearSummaryHistory() {
  globalThis[SUMMARY_HISTORY_KEY] = [];
}

/**
 * @returns {number}
 */
function getScopeDepth() {
  return Number(globalThis[SCOPE_DEPTH_KEY]) || 0;
}

/**
 * @param {number} depth
 */
function setScopeDepth(depth) {
  globalThis[SCOPE_DEPTH_KEY] = Math.max(0, Number(depth) || 0);
}

/**
 * @param {PhaseHistoryEntry} entry
 */
function recordPhaseEntry(entry) {
  getPhaseHistory().push(entry);
  if (getScopeDepth() === 0) {
    getSummaryHistory().push(entry);
  }
}

/**
 * Snapshot current phase history and start a fresh list (nested create / page loop).
 * Live -> / ok lines still print; nested entries are discarded on pop.
 * Summary history keeps outer rows (gated by scopeDepth).
 */
export function pushPhaseHistoryScope() {
  logPhaseDone();
  setScopeDepth(getScopeDepth() + 1);
  if (!globalThis[HISTORY_STACK_KEY]) globalThis[HISTORY_STACK_KEY] = [];
  globalThis[HISTORY_STACK_KEY].push(getPhaseHistory().slice());
  globalThis[HISTORY_KEY] = [];
}

/**
 * Restore the outer phase history; drop nested entries.
 */
export function popPhaseHistoryScope() {
  logPhaseDone();
  setScopeDepth(getScopeDepth() - 1);
  const stack = globalThis[HISTORY_STACK_KEY];
  if (!Array.isArray(stack) || stack.length === 0) {
    return;
  }
  globalThis[HISTORY_KEY] = stack.pop();
}

/**
 * @param {() => Promise<T> | T} fn
 * @returns {Promise<T>}
 * @template T
 */
export async function withPhaseHistoryScope(fn) {
  pushPhaseHistoryScope();
  try {
    return await fn();
  } finally {
    popPhaseHistoryScope();
  }
}

/**
 * @returns {SerOpEntry[]}
 */
export function getSerOps() {
  if (!globalThis[SER_OPS_KEY]) globalThis[SER_OPS_KEY] = [];
  return globalThis[SER_OPS_KEY];
}

export function clearSerOps() {
  globalThis[SER_OPS_KEY] = [];
}

/**
 * Prefer create nest phase, else in-process open phase (definitions:generate).
 * @returns {{ phase?: number, phaseTitle?: string }}
 */
function serOpPhaseContext() {
  const nest = readPhaseNest();
  if (nest && nest.phase > 0) {
    return { phase: nest.phase, phaseTitle: nest.title };
  }
  const open = getOpenPhase();
  if (open && open.phase > 0) {
    return { phase: open.phase, phaseTitle: open.title };
  }
  return {};
}

/**
 * Record a timed ser pull/push/validate (same process + optional JSONL for parent).
 * @param {SerOpEntry} op
 */
export function recordSerOp(op) {
  const ctx = serOpPhaseContext();
  const phase =
    op.phase != null && Number(op.phase) > 0
      ? Number(op.phase)
      : ctx.phase;
  const phaseTitle =
    op.phaseTitle != null
      ? String(op.phaseTitle)
      : ctx.phaseTitle;
  const entry = {
    action: op.action,
    reason: op.reason ? String(op.reason) : undefined,
    ms: Math.max(0, Number(op.ms) || 0),
    ok: Boolean(op.ok),
    ...(phase != null ? { phase } : {}),
    ...(phaseTitle ? { phaseTitle } : {}),
  };
  getSerOps().push(entry);
  const logPath = (process.env[BQ_SER_OPS_LOG_ENV] || '').trim();
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    /* best-effort IPC */
  }
}

/**
 * Merge JSONL ser ops written by a child process into the in-process list.
 * @param {string} logPath
 */
export function mergeSerOpsFromLogFile(logPath) {
  const p = String(logPath || '').trim();
  if (!p) return;
  try {
    if (!fs.existsSync(p)) return;
    const text = fs.readFileSync(p, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (
          parsed &&
          (parsed.action === 'pull' ||
            parsed.action === 'push' ||
            parsed.action === 'validate')
        ) {
          const phase =
            parsed.phase != null && Number(parsed.phase) > 0
              ? Number(parsed.phase)
              : undefined;
          getSerOps().push({
            action: parsed.action,
            reason: parsed.reason ? String(parsed.reason) : undefined,
            ms: Math.max(0, Number(parsed.ms) || 0),
            ok: Boolean(parsed.ok),
            ...(phase != null ? { phase } : {}),
            ...(parsed.phaseTitle
              ? { phaseTitle: String(parsed.phaseTitle) }
              : {}),
          });
        }
      } catch {
        /* skip bad line */
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * @param {{
 *   tool: string,
 *   phase?: number,
 *   total?: number,
 *   title: string,
 *   marker?: '->' | 'ok' | 'skip',
 *   extra?: string,
 *   blankBefore?: boolean,
 * }} opts
 */
function printPhaseLine(opts) {
  const tool = String(opts.tool || 'tool').trim() || 'tool';
  const title = String(opts.title || '').trim() || '(untitled)';
  const marker = opts.marker || '->';
  const indent = phaseNestIndent();
  const phase = opts.phase;
  const total = opts.total;
  const hasNm =
    phase != null &&
    total != null &&
    Number.isFinite(Number(phase)) &&
    Number.isFinite(Number(total)) &&
    Number(phase) > 0 &&
    Number(total) > 0;

  const nm = hasNm ? `${Number(phase)}/${Number(total)} ` : '';
  const extraRaw = opts.extra != null ? String(opts.extra).trim() : '';
  const extra = extraRaw ? ` · ${extraRaw}` : '';
  const line = `${indent}[${tool}] ${marker} ${nm}${title}${extra}`;

  if (opts.blankBefore !== false && (marker === '->' || marker === 'skip')) {
    console.log('');
  }
  // Plain text — bq-console adds elapsed + colors [tag]
  console.log(line);
}

/**
 * Close any open phase (same process) before starting another.
 * @param {{ tokens?: OpenPhase['tokens'], extra?: string, skipped?: boolean }} [opts]
 */
export function logPhaseDone(opts = {}) {
  const open = getOpenPhase();
  if (!open) return null;

  const ms = Date.now() - open.startedAt;
  const tokens = opts.tokens ?? open.tokens ?? null;
  const skipped = Boolean(opts.skipped);
  const marker = skipped ? 'skip' : 'ok';
  const parts = [formatPhaseDuration(ms)];
  if (opts.extra) parts.push(String(opts.extra));
  const tok = formatTokensSuffix(tokens).replace(/^ · /, '');
  if (tok) parts.push(tok);

  printPhaseLine({
    tool: open.tool,
    phase: open.phase,
    total: open.total,
    title: open.title,
    marker,
    extra: parts.join(' · '),
    blankBefore: false,
  });

  const entry = {
    tool: open.tool,
    phase: open.phase,
    total: open.total,
    title: open.title,
    ms,
    skipped,
    tokens,
  };
  recordPhaseEntry(entry);
  setOpenPhase(null);
  return entry;
}

/**
 * @param {{
 *   tool: string,
 *   phase: number,
 *   total: number,
 *   title: string,
 *   detail?: string|string[],
 * }} opts
 */
export function logPhaseStart(opts) {
  logPhaseDone();
  const tool = String(opts.tool || 'tool').trim() || 'tool';
  const phase = Number(opts.phase) || 0;
  const total = Number(opts.total) || 0;
  const title = String(opts.title || '').trim() || '(untitled)';

  setOpenPhase({
    tool,
    phase,
    total,
    title,
    startedAt: Date.now(),
    tokens: null,
  });

  printPhaseLine({
    tool,
    phase,
    total,
    title,
    marker: '->',
    blankBefore: true,
  });
}

/**
 * Normalize a skip reason so logs always read as intentional + why.
 * @param {string|undefined|null} reason
 * @returns {string}
 */
export function formatIntentionalSkipReason(reason) {
  let r = String(reason ?? '').trim();
  if (!r || /^skipped$/i.test(r)) r = 'not needed for this run';
  r = r.replace(/^intentional\s*[—:\-]\s*/i, '');
  /** @type {Record<string, string>} */
  const known = {
    '--skipPull':
      '--skipPull (create/final emit or CLI requested no ser pull)',
    '--skipSites': '--skipSites (Sites API emit not requested)',
    '--skip-merge': '--skip-merge',
    '--wire-only': '--wire-only (shared codegen not requested)',
    '--codegen-only': '--codegen-only (page wiring not requested)',
    'dry-run': 'dry-run (no Sitecore writes)',
    'skip-generate': '--skip-generate',
    'API ensure first; pull after site':
      'API ensure first; pull after site (Sites API GET/create, then one ser pull)',
  };
  if (known[r]) r = known[r];
  return `intentional — ${r}`;
}

/**
 * Parse `Title — skipped (reason)` / `Title — skipped` into clean title + why.
 * @param {string} title
 * @returns {{ title: string, reason: string }}
 */
export function parseSkippedPhaseTitle(title) {
  const raw = String(title || '').trim();
  const m = raw.match(/^(.*?)\s*[—-]\s*skipped(?:\s*\(([^)]*)\))?\s*$/i);
  if (!m) {
    return { title: raw || '(untitled)', reason: 'not needed for this run' };
  }
  const clean = (m[1] || '').trim() || raw;
  const reason = (m[2] || '').trim() || 'not needed for this run';
  return { title: clean, reason };
}

/**
 * Start and immediately skip (e.g. --all unused phases).
 * Always prints `intentional — <why>` so skips read as deliberate.
 * @param {{
 *   tool: string,
 *   phase: number,
 *   total: number,
 *   title: string,
 *   reason?: string,
 * }} opts
 */
export function logPhaseSkip(opts) {
  logPhaseDone();
  const tool = String(opts.tool || 'tool').trim() || 'tool';
  const phase = Number(opts.phase) || 0;
  const total = Number(opts.total) || 0;
  const title = String(opts.title || '').trim() || '(untitled)';
  const skipReason = formatIntentionalSkipReason(opts.reason);

  printPhaseLine({
    tool,
    phase,
    total,
    title,
    marker: 'skip',
    extra: skipReason,
    blankBefore: true,
  });

  recordPhaseEntry({
    tool,
    phase,
    total,
    title,
    ms: 0,
    skipped: true,
    skipReason,
    tokens: null,
  });
}

/**
 * Untimed labeled step (e.g. Phase A without N/M).
 * @param {{ tool: string, title: string }} opts
 */
export function logStepStart(opts) {
  logPhaseDone();
  const tool = String(opts.tool || 'tool').trim() || 'tool';
  const title = String(opts.title || '').trim() || '(untitled)';
  setOpenPhase({
    tool,
    phase: 0,
    total: 0,
    title,
    startedAt: Date.now(),
    tokens: null,
  });
  printPhaseLine({
    tool,
    title,
    marker: '->',
    blankBefore: true,
  });
}

/**
 * Shell / CLI child line under current nest.
 * @param {string} command
 */
export function logShellCommand(command) {
  const indent = phaseNestIndent() + '  ';
  const cmd = String(command || '').trim();
  console.log(`${indent}> ${cmd}`);
}

/**
 * Run start line.
 * @param {{ tool: string, extra?: string }} opts
 */
export function logRunStart(opts) {
  clearPhaseHistory();
  clearSummaryHistory();
  clearSerOps();
  globalThis[HISTORY_STACK_KEY] = [];
  setScopeDepth(0);
  setOpenPhase(null);
  const tool = String(opts.tool || 'tool').trim() || 'tool';
  const extra = opts.extra ? ` · ${opts.extra}` : '';
  console.log('');
  console.log(`[${tool}] start${extra}`);
}

/**
 * @param {string} title
 * @param {number} max
 */
function truncateSummaryTitle(title, max = 48) {
  const t = String(title || '').trim() || '(untitled)';
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * @param {SerOpEntry} op
 * @param {string} indent
 */
function printSummarySerLine(op, indent) {
  const reason = truncateSummaryTitle(op.reason || op.action, 40);
  const status = op.ok
    ? formatSummaryDuration(op.ms)
    : `fail ${formatSummaryDuration(op.ms)}`;
  const label = `ser  ${op.action.padEnd(8)} ${reason}`;
  console.log(`${indent}${label.padEnd(54)} ${String(status).padStart(8)}`);
}

/**
 * End-of-run summary from phase history + optional AI / ser bits.
 * @param {{
 *   tool: string,
 *   ai?: { promptTokens?: number, completionTokens?: number, totalTokens?: number, costEstimateUsd?: number, callCount?: number } | null,
 *   ser?: { validate?: string, push?: string } | null,
 * }} opts
 */
export function logRunSummary(opts) {
  logPhaseDone();
  const tool = String(opts.tool || 'tool').trim() || 'tool';
  const history = getSummaryHistory();
  const t0 = Number(process.env.BQ_RUN_T0);
  const totalMs =
    Number.isFinite(t0) && t0 > 0
      ? Date.now() - t0
      : history.reduce((s, h) => s + h.ms, 0);

  console.log('');
  console.log(`[${tool}] -- Run summary --`);
  console.log(`        total ${formatElapsed(totalMs)}`);

  const serOps = getSerOps();
  /** @type {Set<number>} */
  const printedSer = new Set();

  for (const h of history) {
    const nm =
      h.total > 0 && h.phase > 0 ? `${h.phase}/${h.total}` : '';
    const title = truncateSummaryTitle(h.title);
    const dur = h.skipped
      ? h.skipReason
        ? `skip · ${h.skipReason}`
        : 'skip'
      : formatSummaryDuration(h.ms);
    const tok = formatTokensSuffix(h.tokens).replace(/^ · /, '');
    const label = nm ? `${nm}  ${title}` : title;
    const bits = [
      h.skipped
        ? `        ${label.padEnd(56)} ${dur}`
        : `        ${label.padEnd(56)} ${String(dur).padStart(8)}`,
    ];
    if (tok) bits.push(tok);
    console.log(bits.join('  '));

    if (h.phase > 0) {
      serOps.forEach((op, idx) => {
        if (op.phase === h.phase) {
          printSummarySerLine(op, '          ');
          printedSer.add(idx);
        }
      });
    }
  }

  const orphans = serOps.filter((_, idx) => !printedSer.has(idx));
  if (orphans.length) {
    console.log(`        ser`);
    for (const op of orphans) {
      printSummarySerLine(op, '          ');
    }
  }

  if (opts.ai && (opts.ai.callCount || opts.ai.totalTokens)) {
    const a = opts.ai;
    const cost =
      typeof a.costEstimateUsd === 'number' && a.costEstimateUsd > 0
        ? ` ~$${a.costEstimateUsd.toFixed(4)}`
        : '';
    console.log(
      `        AI   calls=${a.callCount ?? 0} in=${a.promptTokens ?? 0} out=${a.completionTokens ?? 0} total=${a.totalTokens ?? 0}${cost}`,
    );
  }

  if (opts.ser && serOps.length === 0) {
    const v = opts.ser.validate || 'n/a';
    const p = opts.ser.push || 'n/a';
    console.log(`        ser  validate=${v}  push=${p}`);
  }
}

/**
 * Back-compat: start a phase (auto-closes previous). Detail ignored.
 * @param {{
 *   tool: string,
 *   phase: number,
 *   total: number,
 *   title: string,
 *   detail?: string|string[],
 * }} opts
 */
export function logPhase(opts) {
  const title = String(opts.title || '');
  if (/\bskipped\b/i.test(title)) {
    const parsed = parseSkippedPhaseTitle(title);
    logPhaseSkip({
      tool: opts.tool,
      phase: opts.phase,
      total: opts.total,
      title: parsed.title,
      reason: parsed.reason,
    });
    return;
  }
  logPhaseStart(opts);
}

export {
  NEST_ENV as BQ_PHASE_NEST_ENV,
  useColor as phaseLogUsesColor,
};
