/**
 * Pure helpers for the authored-CSS paint-url gate.
 *
 * Rules with paint `url(...)` are kept only when that URL is already present in
 * the section subtree's live computed styles (before the filter stylesheet is
 * injected). Prevents selector-only leaks from generic classes (e.g. .container)
 * used by off-section sheets (CMP, chrome, siblings).
 *
 * Keep algorithms in sync with the inlined copy inside
 * `filterAuthoredCssToSectionInBrowser` in save-section-styled-html.mjs
 * (page.evaluate must stay self-contained).
 */

/** CSS properties that can introduce paint urls we gate on. */
export const PAINT_URL_PROPS = Object.freeze([
  'background-image',
  'background',
  'list-style-image',
  'content',
  'mask-image',
  '-webkit-mask-image',
  'border-image-source',
]);

/**
 * Normalize a CSS url token for set membership (strip quotes / css-url wrap / whitespace).
 * @param {string} raw
 * @returns {string}
 */
export function normalizeCssUrlToken(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  const wrap = /^url\(\s*(.*?)\s*\)$/i.exec(s);
  if (wrap) s = wrap[1].trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  // Browsers often resolve to absolute; compare case-sensitively on path, host lowercased.
  try {
    const u = new URL(s);
    u.hash = '';
    return u.href;
  } catch {
    return s;
  }
}

/**
 * Extract raw url(...) payloads from a CSS value (background-image, content, etc.).
 * @param {string} value
 * @returns {string[]}
 */
export function extractCssUrls(value) {
  const t = String(value || '');
  if (!t || !/url\s*\(/i.test(t)) return [];
  /** @type {string[]} */
  const out = [];
  for (const m of t.matchAll(/url\s*\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) {
    const inner = String(m[2] || '').trim();
    if (inner) out.push(inner);
  }
  return out;
}

/**
 * Collect paint urls declared on a style rule's cssText / declaration block.
 * @param {string} styleCssText
 * @returns {string[]} normalized urls
 */
export function extractPaintUrlsFromStyleCssText(styleCssText) {
  const t = String(styleCssText || '');
  if (!t || !/url\s*\(/i.test(t)) return [];
  /** @type {Set<string>} */
  const urls = new Set();
  // Prefer property-scoped extraction when declarations are present.
  for (const prop of PAINT_URL_PROPS) {
    const re = new RegExp(
      `(?:^|;|\\s)${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;{}]+)`,
      'gi',
    );
    for (const m of t.matchAll(re)) {
      for (const u of extractCssUrls(m[1] || '')) {
        const n = normalizeCssUrlToken(u);
        if (n) urls.add(n);
      }
    }
  }
  // Fallback: any url() in the block (shorthand fragments / odd serialization)
  if (!urls.size) {
    for (const u of extractCssUrls(t)) {
      const n = normalizeCssUrlToken(u);
      if (n) urls.add(n);
    }
  }
  return [...urls];
}

/**
 * True when a computed property value contains the candidate url.
 * @param {string} computedValue
 * @param {string} candidateUrl normalized or raw
 */
export function computedValueContainsUrl(computedValue, candidateUrl) {
  const want = normalizeCssUrlToken(candidateUrl);
  if (!want) return false;
  for (const u of extractCssUrls(computedValue)) {
    if (normalizeCssUrlToken(u) === want) return true;
  }
  // Some engines omit url() in serialization edge cases — substring check on normalized forms
  const hay = normalizeCssUrlToken(String(computedValue || ''));
  return Boolean(hay && (hay === want || hay.includes(want) || want.includes(hay)));
}

/**
 * Keep rule when it has no paint urls, or at least one paint url is evidenced.
 * @param {string[]} rulePaintUrls normalized
 * @param {Set<string>|Iterable<string>} evidencedUrls
 */
export function shouldKeepPaintUrlRule(rulePaintUrls, evidencedUrls) {
  const list = Array.isArray(rulePaintUrls) ? rulePaintUrls : [];
  if (!list.length) return true;
  const set =
    evidencedUrls instanceof Set
      ? evidencedUrls
      : new Set(
          [...(evidencedUrls || [])].map((u) => normalizeCssUrlToken(u)).filter(Boolean),
        );
  return list.some((u) => set.has(normalizeCssUrlToken(u)));
}
