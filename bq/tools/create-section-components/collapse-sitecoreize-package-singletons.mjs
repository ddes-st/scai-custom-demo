/**
 * Pre-parse salvage for sitecoreize JSON: collapse duplicate singleton keys
 * on each packages[] molecule so JSON.parse last-wins cannot wipe a good body.
 *
 * Prefer first non-null / non-empty string; otherwise keep a single null/empty.
 */
import { noteFixup } from './create-log.mjs';

/** @type {readonly string[]} */
export const SITECOREIZE_PACKAGE_SINGLETON_KEYS = Object.freeze([
  'clientTsx',
  'tsx',
  'definitionTs',
]);

/**
 * @param {string} text
 * @param {number} i string-open quote index
 * @returns {number} index after closing quote
 */
function skipJsonString(text, i) {
  const quote = text[i];
  let j = i + 1;
  while (j < text.length) {
    const ch = text[j];
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (ch === quote) return j + 1;
    j += 1;
  }
  return text.length;
}

/**
 * @param {string} text
 * @param {number} valueStart
 * @returns {number} index after the JSON value
 */
function skipJsonValue(text, valueStart) {
  let i = valueStart;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  if (i >= text.length) return i;

  const ch = text[i];
  if (ch === '"' || ch === "'") return skipJsonString(text, i);
  if (ch === '{') {
    let depth = 0;
    for (; i < text.length; i += 1) {
      const c = text[i];
      if (c === '"' || c === "'") {
        i = skipJsonString(text, i) - 1;
        continue;
      }
      if (c === '{') depth += 1;
      else if (c === '}') {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
    }
    return text.length;
  }
  if (ch === '[') {
    let depth = 0;
    for (; i < text.length; i += 1) {
      const c = text[i];
      if (c === '"' || c === "'") {
        i = skipJsonString(text, i) - 1;
        continue;
      }
      if (c === '[') depth += 1;
      else if (c === ']') {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
    }
    return text.length;
  }

  // null / true / false / number
  while (i < text.length && /[^\s,}\]]/.test(text[i])) i += 1;
  return i;
}

/**
 * @param {string} text
 * @param {number} openBracket index of `[` after packages
 * @returns {{ start: number, end: number }[]} object spans [start, end) including braces
 */
function findPackageObjectSpans(text, openBracket) {
  /** @type {{ start: number, end: number }[]} */
  const spans = [];
  let i = openBracket + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i += 1;
    if (i >= text.length || text[i] === ']') break;
    if (text[i] !== '{') {
      i += 1;
      continue;
    }
    const start = i;
    const end = skipJsonValue(text, start);
    spans.push({ start, end });
    i = end;
  }
  return spans;
}

/**
 * Locate `"packages"` array open bracket in sitecoreize JSON.
 * @param {string} text
 * @returns {number} index of `[` or -1
 */
export function findPackagesArrayOpen(text) {
  const src = String(text || '');
  const keyRe = /"packages"\s*:/g;
  let m;
  while ((m = keyRe.exec(src))) {
    let j = m.index + m[0].length;
    while (j < src.length && /\s/.test(src[j])) j += 1;
    if (src[j] === '[') return j;
  }
  return -1;
}

/**
 * @param {string} valueSlice
 * @returns {{ kind: 'string'|'null'|'empty'|'other', score: number }}
 */
function classifyJsonValue(valueSlice) {
  const v = String(valueSlice || '').trim();
  if (v === 'null') return { kind: 'null', score: 0 };
  if (v === '""' || v === "''") return { kind: 'empty', score: 0 };
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    try {
      const parsed = JSON.parse(v.startsWith("'") ? `"${v.slice(1, -1)}"` : v);
      if (typeof parsed === 'string' && parsed.trim()) {
        return { kind: 'string', score: 2 };
      }
      return { kind: 'empty', score: 0 };
    } catch {
      // Unparsed long string — still prefer over null if non-trivial length.
      if (v.length > 4) return { kind: 'string', score: 2 };
      return { kind: 'other', score: 1 };
    }
  }
  return { kind: 'other', score: 1 };
}

/**
 * Find top-level `"key": value` hits inside an object body (excluding outer braces).
 * @param {string} objectText full `{...}`
 * @param {string} key
 * @returns {{ keyStart: number, valueStart: number, valueEnd: number, entryStart: number, entryEnd: number }[]}
 */
function findSingletonKeyHits(objectText, key) {
  /** @type {{ keyStart: number, valueStart: number, valueEnd: number, entryStart: number, entryEnd: number }[]} */
  const hits = [];
  const body = objectText;
  const needle = `"${key}"`;
  let i = 1; // skip opening `{`
  let depth = 0;
  let inString = null;
  let escape = false;

  while (i < body.length - 1) {
    const ch = body[i];
    if (inString) {
      if (escape) {
        escape = false;
        i += 1;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        i += 1;
        continue;
      }
      if (ch === inString) inString = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (depth === 0 && body.startsWith(needle, i)) {
        const keyStart = i;
        let j = i + needle.length;
        while (j < body.length && /\s/.test(body[j])) j += 1;
        if (body[j] !== ':') {
          inString = ch;
          i += 1;
          continue;
        }
        j += 1;
        const valueStart = j;
        const valueEnd = skipJsonValue(body, valueStart);
        // Eat exactly one comma (prefer trailing) so neighbors stay valid JSON.
        let entryStart = keyStart;
        let entryEnd = valueEnd;
        while (entryEnd < body.length && /\s/.test(body[entryEnd])) entryEnd += 1;
        if (body[entryEnd] === ',') {
          entryEnd += 1;
        } else {
          let k = keyStart - 1;
          while (k > 0 && /\s/.test(body[k])) k -= 1;
          if (body[k] === ',') entryStart = k;
        }
        hits.push({ keyStart, valueStart, valueEnd, entryStart, entryEnd });
        i = valueEnd;
        continue;
      }
      inString = ch;
      i += 1;
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }
    i += 1;
  }
  return hits;
}

/**
 * Collapse duplicate singleton keys inside one package object text.
 * @param {string} objectText
 * @param {readonly string[]} keys
 * @returns {{ text: string, collapsed: number }}
 */
export function collapseSingletonKeysInObject(
  objectText,
  keys = SITECOREIZE_PACKAGE_SINGLETON_KEYS,
) {
  let text = String(objectText || '');
  let collapsed = 0;
  if (!text.startsWith('{')) return { text, collapsed };

  for (const key of keys) {
    // One removal per pass + re-scan so indices stay valid.
    for (;;) {
      const hits = findSingletonKeyHits(text, key);
      if (hits.length < 2) break;

      let bestIdx = 0;
      let bestScore = -1;
      for (let hi = 0; hi < hits.length; hi += 1) {
        const slice = text.slice(hits[hi].valueStart, hits[hi].valueEnd);
        const { score } = classifyJsonValue(slice);
        // Prefer first among equal scores.
        if (score > bestScore) {
          bestScore = score;
          bestIdx = hi;
        }
      }

      // Drop the rightmost non-winner first.
      let dropIdx = -1;
      for (let hi = hits.length - 1; hi >= 0; hi -= 1) {
        if (hi !== bestIdx) {
          dropIdx = hi;
          break;
        }
      }
      if (dropIdx < 0) break;
      const hit = hits[dropIdx];
      text = text.slice(0, hit.entryStart) + text.slice(hit.entryEnd);
      collapsed += 1;
      text = text.replace(/,\s*,/g, ',').replace(/,\s*}/g, '}');
    }
  }

  return { text, collapsed };
}

/**
 * Collapse duplicate clientTsx / tsx / definitionTs on each packages[] molecule.
 * @param {string} content raw sitecoreize JSON (maybe fenced)
 * @param {{ warn?: boolean }} [options]
 * @returns {string}
 */
export function collapseSitecoreizePackageSingletons(content, options = {}) {
  let text = String(content || '').trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  if (!text) return text;

  const open = findPackagesArrayOpen(text);
  if (open < 0) return text;

  const spans = findPackageObjectSpans(text, open);
  if (!spans.length) return text;

  let totalCollapsed = 0;
  // Rewrite from end → start so earlier offsets stay valid.
  for (let si = spans.length - 1; si >= 0; si -= 1) {
    const { start, end } = spans[si];
    const objectText = text.slice(start, end);
    const { text: next, collapsed } = collapseSingletonKeysInObject(objectText);
    if (collapsed > 0) {
      totalCollapsed += collapsed;
      text = text.slice(0, start) + next + text.slice(end);
    }
  }

  if (totalCollapsed > 0 && options.warn !== false) {
    noteFixup(
      process.env.BQ_CREATE_SECTION || '_run',
      `Sitecoreize JSON: collapsed ${totalCollapsed} duplicate package singleton key(s) (kept first non-null body)`,
    );
  }

  return text;
}

/**
 * Parse sitecoreize JSON after singleton collapse.
 * @param {string} content
 * @returns {any}
 */
export function parseSitecoreizeJsonContent(content) {
  const salvaged = collapseSitecoreizePackageSingletons(content);
  return JSON.parse(salvaged);
}
