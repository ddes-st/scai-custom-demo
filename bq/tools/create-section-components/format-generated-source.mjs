/**
 * Pretty-print generated TSX / client TSX before write.
 * Uses Prettier when available; otherwise returns source unchanged.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** @type {typeof import('prettier') | null} */
let prettierMod = null;
try {
  prettierMod = require('prettier');
} catch {
  prettierMod = null;
}

const PRETTIER_OPTS = {
  parser: 'typescript',
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
  bracketSpacing: true,
  endOfLine: 'lf',
};

/**
 * Collapse whitespace between adjacent JSX tags (`>   <` → `>\n<`) so Prettier
 * does not treat those spaces as significant and invent `{' '}`.
 * Skips string literals, template literals, and comments (best-effort scan).
 * @param {string} source
 * @returns {string}
 */
export function collapseJsxTagWhitespace(source) {
  const text = String(source || '');
  if (!text.includes('>')) return text;

  let out = '';
  let i = 0;
  /** @type {'code' | 'sq' | 'dq' | 'tmpl' | 'line' | 'block'} */
  let mode = 'code';

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (mode === 'line') {
      out += ch;
      if (ch === '\n') mode = 'code';
      i += 1;
      continue;
    }
    if (mode === 'block') {
      out += ch;
      if (ch === '*' && next === '/') {
        out += '/';
        i += 2;
        mode = 'code';
        continue;
      }
      i += 1;
      continue;
    }
    if (mode === 'sq' || mode === 'dq') {
      out += ch;
      if (ch === '\\') {
        if (i + 1 < text.length) {
          out += text[i + 1];
          i += 2;
          continue;
        }
      } else if ((mode === 'sq' && ch === "'") || (mode === 'dq' && ch === '"')) {
        mode = 'code';
      }
      i += 1;
      continue;
    }
    if (mode === 'tmpl') {
      out += ch;
      if (ch === '\\') {
        if (i + 1 < text.length) {
          out += text[i + 1];
          i += 2;
          continue;
        }
      } else if (ch === '`') {
        mode = 'code';
      }
      i += 1;
      continue;
    }

    // mode === 'code'
    if (ch === '/' && next === '/') {
      out += '//';
      i += 2;
      mode = 'line';
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '/*';
      i += 2;
      mode = 'block';
      continue;
    }
    if (ch === "'") {
      out += ch;
      i += 1;
      mode = 'sq';
      continue;
    }
    if (ch === '"') {
      out += ch;
      i += 1;
      mode = 'dq';
      continue;
    }
    if (ch === '`') {
      out += ch;
      i += 1;
      mode = 'tmpl';
      continue;
    }

    if (ch === '>') {
      let j = i + 1;
      while (j < text.length && /[ \t\r\n]/.test(text[j])) j += 1;
      if (j > i + 1 && j < text.length && text[j] === '<') {
        out += '>\n';
        i = j;
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  return out;
}

const JSX_SPACE_EXPR_RE = /\{[ \t]*['"][ \t]['"][ \t]*\}/g;

/**
 * True when `ch` is a JSX tag boundary that makes an adjacent `{' '}` unnecessary.
 * @param {string} ch
 * @returns {boolean}
 */
function isJsxTagBoundaryChar(ch) {
  return ch === '<' || ch === '>';
}

/**
 * Nearest non-whitespace character at or before `index` (exclusive of index).
 * @param {string} text
 * @param {number} index
 * @returns {string|null}
 */
function prevSignificantChar(text, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') continue;
    return ch;
  }
  return null;
}

/**
 * Nearest non-whitespace character at or after `index`.
 * @param {string} text
 * @param {number} index
 * @returns {string|null}
 */
function nextSignificantChar(text, index) {
  for (let i = index; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') continue;
    return ch;
  }
  return null;
}

/**
 * Whether the match spanning [start, end) is the only non-whitespace on its line.
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @returns {boolean}
 */
function isAloneOnLine(text, start, end) {
  let lineStart = start;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart -= 1;
  let lineEnd = end;
  while (lineEnd < text.length && text[lineEnd] !== '\n') lineEnd += 1;
  const before = text.slice(lineStart, start);
  const after = text.slice(end, lineEnd);
  return !/[^\s]/.test(before) && !/[^\s]/.test(after);
}

/**
 * Remove JSX `{' '}` / `{" "}` that sit between tag boundaries or alone on a line.
 * Keep only when both neighbors are non-tag content (text/expression joins), e.g.
 * `{a}{' '}{b}` or `Hello{' '}{name}`.
 * @param {string} source
 * @returns {string}
 */
export function stripUnnecessaryJsxSpaceExpressions(source) {
  const text = String(source || '');
  if (!text.includes('{')) return text;

  /** @type {{ start: number, end: number }[]} */
  const removals = [];
  JSX_SPACE_EXPR_RE.lastIndex = 0;
  let match;
  while ((match = JSX_SPACE_EXPR_RE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const alone = isAloneOnLine(text, start, end);
    const before = prevSignificantChar(text, start);
    const after = nextSignificantChar(text, end);
    const strip =
      alone ||
      (before != null && isJsxTagBoundaryChar(before)) ||
      (after != null && isJsxTagBoundaryChar(after));
    if (strip) removals.push({ start, end });
  }

  if (!removals.length) return text;

  let out = '';
  let cursor = 0;
  for (const { start, end } of removals) {
    out += text.slice(cursor, start);
    cursor = end;
  }
  out += text.slice(cursor);
  return out;
}

/**
 * @param {string} source
 * @param {{ filepath?: string }} [opts]
 * @returns {Promise<string>}
 */
async function prettierFormat(source, opts = {}) {
  if (!prettierMod?.format) {
    throw new Error(
      `format: prettier not installed — cannot write ${opts.filepath || 'generated.tsx'} (npm i -D prettier)`,
    );
  }
  try {
    return await prettierMod.format(source, {
      ...PRETTIER_OPTS,
      filepath: opts.filepath || 'generated.tsx',
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `format: prettier failed for ${opts.filepath || 'generated.tsx'} — refusing to write invalid/unformatted source (${detail})`,
    );
  }
}

/**
 * @param {string} filepath
 */
function expectsMultilineTsx(filepath) {
  const lower = String(filepath || '').toLowerCase();
  return lower.endsWith('.tsx') || lower.endsWith('.jsx');
}

/**
 * @param {string} source
 * @param {{ filepath?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function formatGeneratedSource(source, opts = {}) {
  let text = String(source || '');
  if (!text.trim()) return text;
  text = collapseJsxTagWhitespace(text);
  text = await prettierFormat(text, opts);
  text = stripUnnecessaryJsxSpaceExpressions(text);
  text = await prettierFormat(text, opts);
  if (
    expectsMultilineTsx(opts.filepath) &&
    text.trim().length > 120 &&
    !/\r?\n/.test(text.trim())
  ) {
    throw new Error(
      `format: ${opts.filepath || 'generated.tsx'} is still a single-line dump after Prettier — refusing to write`,
    );
  }
  return text;
}
