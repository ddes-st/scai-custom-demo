/**
 * Shared console enhancer for BQ CLI tools.
 * - Prefixes elapsed time from BQ_RUN_T0 ([00:00] …)
 * - Colors leading [tag] prefixes (never red for tags)
 * - Indents nested `[bq:emit…]` sub-step lines
 * - Failures → red; prune / emit / codegen fixups → yellow/orange
 * Respects NO_COLOR / FORCE_COLOR.
 */

const RUN_T0_ENV = 'BQ_RUN_T0';
const ELAPSED_RE = /^\[\d{1,2}:\d{2}(?::\d{2})?\]\s/;
const TAG_RE = /^(\s*)\[([^\]]+)\](\s*)/;

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  brightRed: '\u001b[91m',
  yellow: '\u001b[33m',
  brightYellow: '\u001b[93m',
  orange: '\u001b[38;5;208m',
  cyan: '\u001b[36m',
  brightCyan: '\u001b[96m',
  blue: '\u001b[34m',
  brightBlue: '\u001b[94m',
  green: '\u001b[32m',
  magenta: '\u001b[35m',
  white: '\u001b[37m',
};

/** @type {Record<string, keyof typeof ANSI | (keyof typeof ANSI)[]>} */
const TAG_COLORS = {
  'bq:definitions:generate': 'brightBlue',
  'bq:content:generate': 'green',
  'bq:create:sectioncomponents': 'yellow',
  'bq:emit:sites-api': 'cyan',
  'bq:emit:media': 'magenta',
  'bq:emit': 'brightCyan',
  'bq:emit:content': 'green',
  'bq:emit:data': 'green',
  'bq:emit:site-presentation': 'brightCyan',
  'bq:emit:site-thumbnail': 'blue',
  'bq:emit:link-page': 'blue',
  'bq:ensure:host-components': 'blue',
};

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
 * @param {string} text
 * @param {keyof typeof ANSI | (keyof typeof ANSI)[]} codes
 */
function paint(text, codes) {
  if (!useColor()) return text;
  const list = Array.isArray(codes) ? codes : [codes];
  const open = list.map((c) => ANSI[c] || '').join('');
  return `${open}${text}${ANSI.reset}`;
}

/**
 * @param {number} ms
 * @returns {string}
 */
export function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * @returns {string}
 */
function elapsedPrefix() {
  const t0 = Number(process.env[RUN_T0_ENV]);
  const start = Number.isFinite(t0) && t0 > 0 ? t0 : Date.now();
  return `[${formatElapsed(Date.now() - start)}]`;
}

/**
 * Process-wide nest indent when BQ_PHASE_NEST is set (child under create).
 * Emit tags no longer get a special extra indent — use `>` for CLI subprocess lines.
 * @param {string} [_tag]
 * @returns {string}
 */
export function nestPrefixForTag(_tag) {
  return '';
}

/**
 * @returns {string}
 */
export function phaseNestConsoleIndent() {
  const raw = (process.env.BQ_PHASE_NEST || '').trim();
  return raw ? '  ' : '';
}

/**
 * @param {string} tag
 * @returns {keyof typeof ANSI | (keyof typeof ANSI)[]}
 */
function colorForTag(tag) {
  const key = String(tag || '').trim();
  if (TAG_COLORS[key]) return TAG_COLORS[key];
  if (/^bq:create:/i.test(key)) return 'yellow';
  if (/^bq:ensure:/i.test(key)) return 'blue';
  if (/^bq:emit:/i.test(key)) return 'brightCyan';
  if (/^bq:definitions:/i.test(key)) return 'brightBlue';
  if (/^bq:content:/i.test(key)) return 'green';
  return 'dim';
}

/**
 * True when the message reports a real failure — not a stats counter like `failed=0`.
 * @param {string} body
 * @param {string} afterTag
 */
function looksLikeFailureMessage(body, afterTag) {
  // Strip `failed=<n>` counters (AI merge pairs, Done stats, etc.) before matching.
  const withoutCounters = String(body || '').replace(/\bfailed\s*=\s*\d+/gi, '');
  const afterWithoutCounters = String(afterTag || '').replace(
    /\bfailed\s*=\s*\d+/gi,
    '',
  );
  return (
    /\bFailed\b/i.test(withoutCounters) ||
    /^Failed\b/i.test(afterWithoutCounters.trim()) ||
    /\bfailed to\b/i.test(body)
  );
}

/**
 * @param {'log'|'warn'|'error'} level
 * @param {string} message
 * @returns {'red'|'orange'|'yellow'|null}
 */
export function detectSeverity(level, message) {
  if (level === 'error') return 'red';
  const body = String(message || '');
  // Authoring API CM delete before generic "failed" → red (word "failed" appears in delete outcome lines)
  if (/CM delete via Authoring API/i.test(body)) {
    // Failed GraphQL delete keeps warn (yellow); success / retry notice stays orange
    if (/\bfailed for\b/i.test(body) || /⚠/.test(body)) {
      return 'yellow';
    }
    return 'orange';
  }
  // After optional [tag], look for failure markers
  const afterTag = body.replace(TAG_RE, '');
  if (looksLikeFailureMessage(body, afterTag)) {
    return 'red';
  }
  if (
    /prune obsolete/i.test(body) ||
    /orphan prune/i.test(body) ||
    /\bBQ orphan\b/i.test(body) ||
    /Codegen fixup/i.test(body) ||
    /RSC fixup/i.test(body) ||
    /⚠/.test(body) ||
    (/\[bq:emit\]/i.test(body) && /\bprune\b/i.test(body))
  ) {
    return 'yellow';
  }
  return null;
}

/**
 * @param {'log'|'warn'|'error'} level
 * @param {string} message
 * @returns {string}
 */
export function colorizeTaggedMessage(level, message) {
  const raw = String(message ?? '');
  if (!raw) return raw;

  const severity = detectSeverity(level, raw);
  if (severity === 'red') {
    return paint(raw, ['bold', 'brightRed']);
  }
  // Explicit orange (API CM delete) — between red error and yellow warn
  if (severity === 'orange') {
    return paint(raw, ['bold', 'orange']);
  }
  if (severity === 'yellow') {
    return paint(raw, ['bold', 'yellow']);
  }

  const m = raw.match(TAG_RE);
  if (!m) return raw;
  const [, lead, tag, gap] = m;
  const rest = raw.slice(m[0].length);
  const coloredTag = paint(`[${tag}]`, colorForTag(tag));
  return `${lead}${coloredTag}${gap}${rest}`;
}

/**
 * @param {'log'|'warn'|'error'} level
 * @param {unknown[]} args
 * @returns {unknown[]}
 */
function enhanceArgs(level, args) {
  const elapsed = paint(elapsedPrefix(), 'dim');
  if (!args.length) return [elapsed];

  const first = args[0];
  if (typeof first !== 'string') {
    return [elapsed, ...args];
  }

  let msg = first;
  // Avoid double-prefixing elapsed
  if (ELAPSED_RE.test(msg)) {
    return [colorizeTaggedMessage(level, msg), ...args.slice(1)];
  }

  // Keep leading newlines before the time stamp (phase lines often start with '')
  const leadNl = msg.match(/^\r?\n*/)?.[0] || '';
  const rest = msg.slice(leadNl.length);
  const nest = phaseNestConsoleIndent();
  // phase-log already embeds nest spaces on its own lines — avoid double-indent
  const alreadyNested = nest && /^\s/.test(rest);
  const nestBit = alreadyNested ? '' : nest;
  const colored = colorizeTaggedMessage(level, rest);
  return [`${leadNl}${elapsed} ${nestBit}${colored}`, ...args.slice(1)];
}

/**
 * Install once per process. Sets BQ_RUN_T0 when missing so child spawns share the clock.
 */
export function ensureBqConsole() {
  const g = globalThis;
  if (g.__bqConsoleInstalled) return;
  g.__bqConsoleInstalled = true;

  if (!process.env[RUN_T0_ENV]) {
    process.env[RUN_T0_ENV] = String(Date.now());
  }

  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...args) => original.log(...enhanceArgs('log', args));
  console.warn = (...args) => original.warn(...enhanceArgs('warn', args));
  console.error = (...args) => original.error(...enhanceArgs('error', args));
}

export { RUN_T0_ENV as BQ_RUN_T0_ENV, useColor as bqConsoleUsesColor };
