/**
 * Verbosity for create:sectioncomponents terminal noise.
 * Default = quiet-relevant; `--verbose` or BQ_CREATE_LOG=verbose restores chatter.
 */

import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ENV = 'BQ_CREATE_LOG';

/**
 * @returns {'default' | 'verbose'}
 */
export function createLogLevel() {
  const raw = String(process.env[ENV] || '')
    .trim()
    .toLowerCase();
  if (raw === 'verbose' || raw === 'debug' || raw === 'v') return 'verbose';
  return 'default';
}

/**
 * @returns {boolean}
 */
export function isCreateVerbose() {
  return createLogLevel() === 'verbose';
}

/**
 * Apply CLI / env. Call once from cli.mjs.
 * @param {{ verbose?: boolean }} [opts]
 */
export function configureCreateLog(opts = {}) {
  if (opts.verbose) {
    process.env[ENV] = 'verbose';
  } else if (!process.env[ENV]) {
    process.env[ENV] = 'default';
  }
}

/**
 * Always-on progress (section start/done, plan, errors path uses console.error).
 * @param {...unknown} args
 */
export function logInfo(...args) {
  console.log(...args);
}

/**
 * Gated chatter (fixups, per-call AI usage success, fidelity sub-steps).
 * @param {...unknown} args
 */
export function logVerbose(...args) {
  if (!isCreateVerbose()) return;
  console.log(...args);
}

/**
 * Warn-level chatter (Codegen fixup). Always show real failures via console.error.
 * @param {...unknown} args
 */
export function warnVerbose(...args) {
  if (!isCreateVerbose()) return;
  console.warn(...args);
}

/** @type {Map<string, number>} */
const fixupCounts = new Map();

/**
 * Run-scoped mutating fixup events (for fixups.meta.json).
 * @type {Array<{ at: string, section: string, pageSlug?: string, message: string }>}
 */
const fixupEvents = [];

/**
 * Count a fixup for section-end summary; print only when verbose.
 * Also appends a run-scoped event for fixups.meta.json.
 * @param {string} [sectionKey]
 * @param {string} message
 */
export function noteFixup(sectionKey, message) {
  const key = sectionKey || '_run';
  fixupCounts.set(key, (fixupCounts.get(key) || 0) + 1);
  const pageSlug = String(process.env.BQ_CREATE_PAGE_SLUG || '').trim();
  /** @type {{ at: string, section: string, pageSlug?: string, message: string }} */
  const event = {
    at: new Date().toISOString(),
    section: key,
    message: String(message ?? ''),
  };
  if (pageSlug) event.pageSlug = pageSlug;
  fixupEvents.push(event);
  warnVerbose(message);
}

/**
 * @param {string} [sectionKey]
 * @returns {number}
 */
export function takeFixupCount(sectionKey) {
  const key = sectionKey || '_run';
  const n = fixupCounts.get(key) || 0;
  fixupCounts.delete(key);
  return n;
}

/**
 * @param {string} [sectionKey]
 */
export function resetFixupCount(sectionKey) {
  if (sectionKey) fixupCounts.delete(sectionKey);
  else fixupCounts.clear();
}

/**
 * Return and clear run-scoped fixup events (does not clear per-section counts).
 * @returns {Array<{ at: string, section: string, pageSlug?: string, message: string }>}
 */
export function drainFixupEvents() {
  const out = fixupEvents.slice();
  fixupEvents.length = 0;
  return out;
}

/**
 * Peek without clearing.
 * @returns {number}
 */
export function peekFixupEventCount() {
  return fixupEvents.length;
}

/**
 * Clear per-section counts and run-scoped events.
 */
export function resetFixupLog() {
  fixupCounts.clear();
  fixupEvents.length = 0;
}

/**
 * Write `{dirAbs}/fixups.meta.json` when mutating fixups were recorded;
 * delete a stale file when this run applied none.
 * @param {string} dirAbs
 * @param {{ tool?: string }} [opts]
 * @returns {Promise<string|null>} path written, or null when deleted/absent
 */
export async function flushFixupsMeta(dirAbs, opts = {}) {
  const tool = opts.tool || 'create:sectioncomponents';
  const events = drainFixupEvents();
  const out = path.join(dirAbs, 'fixups.meta.json');
  if (!events.length) {
    try {
      await unlink(out);
    } catch {
      /* no prior file */
    }
    return null;
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    tool,
    count: events.length,
    fixups: events,
  };
  await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return out;
}

export { ENV as BQ_CREATE_LOG_ENV };
