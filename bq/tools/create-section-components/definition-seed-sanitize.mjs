/**
 * Deterministic definition.ts seed sanitize + integrity (C0 / quote / CSS bleed).
 * Prefer this over LLM when possible — $0 and matches script-quality cleanup.
 */
import { transformSync } from 'esbuild';

/** C0 controls forbidden in seeds (allow TAB + LF only). */
const C0_FORBIDDEN_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/**
 * Strip non-printable C0 controls from seed text (keep \\n and \\t).
 * @param {string} s
 */
export function stripC0FromSeedText(s) {
  return String(s || '').replace(C0_FORBIDDEN_RE, '');
}

/**
 * Remove CSS-bleed residue left after form-feed + font-family splice
 * (\\f + "ont-family" → "ont-family"; also bare "font-family" mid-prose).
 * Trailing ASCII quote after font-family is CSS-closer junk (restore U+2019 when
 * a curly opener is already present).
 * @param {string} s
 */
export function stripCssBleedResidueFromSeedText(s) {
  let t = String(s || '');
  // \\f + font-family' (or leftover ont-family') — common sitecoreize bleed
  t = t.replace(/\u000c?ont-family'/gi, '\u2019');
  t = t.replace(/\bfont-family'/gi, '\u2019');
  t = t.replace(/\u000c?ont-family\b/gi, '');
  t = t.replace(/\bfont-family\b/gi, '');
  return t;
}

/**
 * Full seed-text cleanup before JSON.stringify re-emit.
 * @param {string} s
 */
export function cleanDefinitionSeedText(s) {
  return stripCssBleedResidueFromSeedText(stripC0FromSeedText(s));
}

/**
 * @param {string} source
 * @returns {{ ok: boolean, error?: string }}
 */
export function tryParseDefinitionTs(source) {
  try {
    transformSync(String(source || ''), {
      loader: 'ts',
      format: 'esm',
      target: 'esnext',
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * True when a string contains forbidden C0 controls (except \\n / \\t).
 * Also fails on literal escaped form-feed sequences left mid-prose after
 * "parse-only" LLM repairs (\\u000c).
 * @param {string} s
 */
export function seedTextHasForbiddenControls(s) {
  const t = String(s || '');
  C0_FORBIDDEN_RE.lastIndex = 0;
  if (C0_FORBIDDEN_RE.test(t)) {
    C0_FORBIDDEN_RE.lastIndex = 0;
    return true;
  }
  C0_FORBIDDEN_RE.lastIndex = 0;
  // Literal escape residue left by parse-only LLM repairs (not decoded C0).
  if (/\\u000[cC](?![0-9a-fA-F])/.test(t) || /\\x0[cC](?![0-9a-fA-F])/.test(t) || /\\f(?![a-zA-Z])/.test(t)) {
    return true;
  }
  return false;
}

/**
 * Extract string literal contents from a TS/JS quoted span starting after the quote.
 * Handles escapes; returns null if unterminated.
 * @param {string} text
 * @param {number} start — index of first char inside the quotes
 * @param {string} quote — "'" or '"'
 */
function readQuotedLiteral(text, start, quote) {
  let i = start;
  let out = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      if (i + 1 >= text.length) return null;
      const n = text[i + 1];
      if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'r') out += '\r';
      else if (n === 'f') out += '\f';
      else if (n === 'b') out += '\b';
      else if (n === '0') out += '\0';
      else if (n === 'u' && /^[0-9a-fA-F]{4}/.test(text.slice(i + 2, i + 6))) {
        out += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      } else out += n;
      i += 2;
      continue;
    }
    if (c === quote) {
      return { value: out, end: i + 1 };
    }
    out += c;
    i += 1;
  }
  return null;
}

/** Next-field lookahead after a closing quote (content.items fields). */
const NEXT_FIELD_AFTER_QUOTE =
  /^\s*,\s*(?:['"][^'"]+['"]|[A-Za-z_][\w]*)\s*:/;
const END_FIELDS_AFTER_QUOTE = /^\s*\}/;

/**
 * Span a (possibly broken) single-quoted value to the real next field / end.
 * Uses lookahead so a premature ' mid-HTML does not truncate.
 * @param {string} text
 * @param {number} valueStart — index after opening quote
 * @returns {{ raw: string, end: number }|null}
 */
function spanBrokenSingleQuotedValue(text, valueStart) {
  // Walk for candidate closing quotes; accept only when followed by next field or }
  for (let i = valueStart; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') {
      i += 1;
      continue;
    }
    if (c !== "'") continue;
    const after = text.slice(i + 1);
    if (NEXT_FIELD_AFTER_QUOTE.test(after) || END_FIELDS_AFTER_QUOTE.test(after)) {
      return { raw: text.slice(valueStart, i), end: i + 1 };
    }
  }
  return null;
}

/**
 * Span a (possibly broken) double-quoted value similarly.
 * @param {string} text
 * @param {number} valueStart
 */
function spanBrokenDoubleQuotedValue(text, valueStart) {
  for (let i = valueStart; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') {
      i += 1;
      continue;
    }
    if (c !== '"') continue;
    const after = text.slice(i + 1);
    if (NEXT_FIELD_AFTER_QUOTE.test(after) || END_FIELDS_AFTER_QUOTE.test(after)) {
      return { raw: text.slice(valueStart, i), end: i + 1 };
    }
  }
  return null;
}

/**
 * After a successful readQuotedLiteral, true if leftover looks like continued
 * prose (premature close) rather than valid next-token TS.
 * @param {string} text
 * @param {number} end
 */
function looksLikePrematureStringClose(text, end) {
  const after = text.slice(end);
  if (NEXT_FIELD_AFTER_QUOTE.test(after) || END_FIELDS_AFTER_QUOTE.test(after)) {
    return false;
  }
  // Valid: comma then object, or end — but ) mid-prose / letters after close = broken
  if (/^\s*[,}]/.test(after)) return false;
  if (/^\s*$/.test(after)) return false;
  // e.g. `) in de Geestelijke…` left outside the string
  if (/^[)\w\s<]/.test(after)) return true;
  return false;
}

/** @param {string} s @param {number} [max] */
export function truncateSanitizeSample(s, max = 500) {
  const t = String(s ?? '');
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * @param {string} keyPrefix — e.g. `'Ceiling Body': ` or `Heading: `
 */
function keyHintFromPrefix(keyPrefix) {
  const m = String(keyPrefix || '').match(/(?:['"]([^'"]+)['"]|([A-Za-z_][\w]*))\s*:/);
  return (m && (m[1] || m[2])) || null;
}

/**
 * Rewrite parseable content field string seeds: clean C0/CSS bleed + JSON.stringify.
 * @param {string} source
 * @returns {{ text: string, changed: number, changes: object[] }}
 */
function rewriteParseableFieldStringSeeds(source) {
  const text = String(source || '');
  const re = /((?:['"][^'"]+['"]|[A-Za-z_][\w]*)\s*:\s*)(['"])/g;
  let out = '';
  let last = 0;
  let m;
  let changed = 0;
  /** @type {object[]} */
  const changes = [];
  while ((m = re.exec(text))) {
    const quote = m[2];
    const valueStart = m.index + m[0].length;
    const lit = readQuotedLiteral(text, valueStart, quote);
    if (!lit) continue;
    // Skip short non-prose (type names, keys, paths) unless they have C0
    const needsClean =
      seedTextHasForbiddenControls(lit.value) ||
      /ont-family|font-family/i.test(lit.value) ||
      (lit.value.length > 40 && /[<>]/.test(lit.value));
    if (!needsClean) {
      re.lastIndex = lit.end;
      continue;
    }
    const cleaned = cleanDefinitionSeedText(lit.value);
    if (cleaned === lit.value && quote === '"' && !seedTextHasForbiddenControls(lit.value)) {
      re.lastIndex = lit.end;
      continue;
    }
    changes.push({
      kind: 'field-seed',
      keyHint: keyHintFromPrefix(m[1]),
      before: truncateSanitizeSample(lit.value),
      after: truncateSanitizeSample(cleaned),
    });
    out += text.slice(last, m.index) + m[1] + JSON.stringify(cleaned);
    last = lit.end;
    re.lastIndex = lit.end;
    changed += 1;
  }
  return { text: out + text.slice(last), changed, changes };
}

/**
 * When parse fails: recover broken quoted field seeds by spanning to the next
 * field key (lookahead), clean, JSON.stringify.
 * @param {string} source
 * @param {"'"|'"'} quote
 * @returns {{ text: string, changed: number, changes: object[] }}
 */
function rewriteBrokenQuotedFieldSeeds(source, quote) {
  let text = String(source || '');
  const keyStartRe =
    quote === "'"
      ? /((?:['"][^'"]+['"]|[A-Za-z_][\w]*)\s*:\s*)'/g
      : /((?:['"][^'"]+['"]|[A-Za-z_][\w]*)\s*:\s*)"/g;
  let out = '';
  let last = 0;
  let m;
  let changed = 0;
  /** @type {object[]} */
  const changes = [];
  while ((m = keyStartRe.exec(text))) {
    const valueStart = m.index + m[0].length;
    const lit = readQuotedLiteral(text, valueStart, quote);
    let raw;
    let end;
    const premature = lit && looksLikePrematureStringClose(text, lit.end);
    if (lit && !premature) {
      // Well-formed literal — only rewrite if cleanup needed
      if (
        !seedTextHasForbiddenControls(lit.value) &&
        !/ont-family|font-family/i.test(lit.value)
      ) {
        keyStartRe.lastIndex = lit.end;
        continue;
      }
      raw = lit.value;
      end = lit.end;
    } else {
      const spanned =
        quote === "'"
          ? spanBrokenSingleQuotedValue(text, valueStart)
          : spanBrokenDoubleQuotedValue(text, valueStart);
      if (!spanned) continue;
      raw = spanned.raw;
      end = spanned.end;
    }
    // Decode common escape sequences in the spanned raw (not a real TS parse)
    const decoded = raw
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    const cleaned = cleanDefinitionSeedText(decoded);
    changes.push({
      kind: 'field-seed',
      keyHint: keyHintFromPrefix(m[1]),
      before: truncateSanitizeSample(decoded),
      after: truncateSanitizeSample(cleaned),
    });
    out += text.slice(last, m.index) + m[1] + JSON.stringify(cleaned);
    last = end;
    keyStartRe.lastIndex = end;
    changed += 1;
  }
  return { text: out + text.slice(last), changed, changes };
}

/**
 * Deterministic sanitize with before/after change records (for ai-debug dumps).
 * @param {string} source
 * @returns {{ text: string, changed: number, changes: object[] }}
 */
export function sanitizeDefinitionStringSeedsDetailed(source) {
  let text = String(source || '');
  /** @type {object[]} */
  const changes = [];
  if (!text.trim()) return { text, changed: 0, changes };

  const parsed = tryParseDefinitionTs(text);
  if (parsed.ok) {
    const polished = rewriteParseableFieldStringSeeds(text);
    if (polished.changed > 0) {
      console.warn(
        `  ⚠ Definition seed sanitize: cleaned ${polished.changed} parseable string seed(s)`,
      );
    }
    return {
      text: polished.text,
      changed: polished.changed,
      changes: polished.changes,
    };
  }

  const before = text;
  // Strip raw C0 from the whole file first (safe for TS structure)
  text = text.replace(C0_FORBIDDEN_RE, '');
  C0_FORBIDDEN_RE.lastIndex = 0;
  if (text !== before) {
    changes.push({
      kind: 'c0-strip',
      keyHint: null,
      before: truncateSanitizeSample(before),
      after: truncateSanitizeSample(text),
    });
  }

  const brokenSingle = rewriteBrokenQuotedFieldSeeds(text, "'");
  text = brokenSingle.text;
  changes.push(...brokenSingle.changes);
  const brokenDouble = rewriteBrokenQuotedFieldSeeds(text, '"');
  text = brokenDouble.text;
  changes.push(...brokenDouble.changes);

  let polishChanged = 0;
  if (tryParseDefinitionTs(text).ok) {
    const polished = rewriteParseableFieldStringSeeds(text);
    text = polished.text;
    polishChanged = polished.changed;
    changes.push(...polished.changes);
    console.warn(
      `  ⚠ Definition seed sanitize: repaired unparseable seeds ` +
        `(single=${brokenSingle.changed}, double=${brokenDouble.changed}, polish=${polishChanged})`,
    );
  } else if (
    brokenSingle.changed > 0 ||
    brokenDouble.changed > 0 ||
    text !== before
  ) {
    console.warn(
      `  ⚠ Definition seed sanitize: partial repair (still unparseable; ` +
        `single=${brokenSingle.changed}, double=${brokenDouble.changed})`,
    );
  }

  return {
    text,
    changed: changes.length,
    changes,
  };
}

/**
 * Deterministic sanitize of definition.ts string seeds.
 * @param {string} source
 * @returns {string}
 */
export function sanitizeDefinitionStringSeeds(source) {
  return sanitizeDefinitionStringSeedsDetailed(source).text;
}

/**
 * Assert content string seeds have no forbidden C0 / escaped form-feed junk.
 * @param {string} source
 * @param {string} [label]
 */
export function assertDefinitionSeedIntegrity(
  source,
  label = 'definition.ts',
) {
  const text = String(source || '');
  const parse = tryParseDefinitionTs(text);
  if (!parse.ok) {
    throw new Error(
      `[codegen] ${label} DEFINITION SEED INTEGRITY: not parseable\n${parse.error || ''}`,
    );
  }

  const re = /(['"])/g;
  let m;
  const offenders = [];
  while ((m = re.exec(text))) {
    const quote = m[1];
    const lit = readQuotedLiteral(text, m.index + 1, quote);
    if (!lit) break;
    re.lastIndex = lit.end;
    if (!seedTextHasForbiddenControls(lit.value)) continue;
    if (lit.value.length < 8 && !/[<>]/.test(lit.value)) continue;
    offenders.push(lit.value.slice(0, 80));
    if (offenders.length >= 5) break;
  }

  if (offenders.length) {
    throw new Error(
      `[codegen] ${label} DEFINITION SEED INTEGRITY: forbidden C0/control residue in string seed(s) — ` +
        `delete controls (do not \\u-escape them). Sample: ${JSON.stringify(offenders[0])}`,
    );
  }
  return text;
}

/**
 * Integrity failure for retry loops.
 * @param {unknown} err
 */
export function isDefinitionSeedIntegrityFailure(err) {
  return /DEFINITION SEED INTEGRITY/i.test(String(err?.message || err || ''));
}
