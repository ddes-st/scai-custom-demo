/**
 * Normalize AI-emitted source that used literal \\n / \\t instead of real escapes.
 * Safe for already-correct multiline strings (leaves them unchanged).
 */
export function unescapeLiteralNewlines(source) {
  const text = String(source || '');
  if (!text) return text;

  const realNewlines = (text.match(/\n/g) || []).length;
  const literalNewlines = (text.match(/\\n/g) || []).length;

  // Only rewrite when the payload looks double-escaped (many \\n, almost no real breaks).
  if (literalNewlines < 2 || realNewlines > literalNewlines / 4) {
    return text;
  }

  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

/**
 * Strip markdown fences and accidental whole-file quote wrapping from AI payloads.
 */
export function sanitizeAiSource(source) {
  let text = String(source || '').trim();
  if (!text) return text;

  if (text.startsWith('```')) {
    text = text
      .replace(/^```(?:tsx|ts|typescript|javascript|jsx|json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  // Whole payload wrapped in matching quotes (AI sometimes double-stringifies).
  if (
    text.length >= 2 &&
    ((text.startsWith("'") && text.endsWith("'")) ||
      (text.startsWith('"') && text.endsWith('"')))
  ) {
    const inner = text.slice(1, -1);
    // Only unwrap when it looks like source, not a short string literal.
    if (
      inner.includes('\n') ||
      /^\s*(?:'use client'|"use client"|import\s)/.test(inner)
    ) {
      text = inner;
    }
  }

  return text;
}

/** Unescape literal newlines then sanitize fences / wrapping quotes. */
export function normalizeAiSource(source) {
  return sanitizeAiSource(unescapeLiteralNewlines(source));
}

export function ensureNewline(s) {
  const t = String(s || '');
  return t.endsWith('\n') ? t : `${t}\n`;
}
