/**
 * Build INLINE SVG INVENTORY for codegen task prompts (prompt-only completeness checklist).
 * Counts shape elements so models must match path counts — does not rewrite AI output.
 */

/** Match shape *tags* only — avoid counting CSS `clip-path` / id substrings. */
const SHAPE_TAG_RE = /<(?:path|circle|rect|polygon|polyline|ellipse|line)\b/gi;
const LOGO_CONTEXT_RE = /logo|brand|masthead|navbar-brand|site-title|wk-.*-logo/i;

/** Max SVG entries listed in a prompt (prefer largest / logo-context). */
export const INLINE_SVG_INVENTORY_MAX = 12;

/**
 * Count shape element tags in SVG inner markup.
 * Strips `<defs>…</defs>` first so clipPath/mask scaffolding does not inflate path counts.
 * @param {string} svgInner
 */
export function countSvgShapeElements(svgInner) {
  const text = String(svgInner || '').replace(
    /<defs\b[^>]*>[\s\S]*?<\/defs>/gi,
    '',
  );
  const matches = text.match(SHAPE_TAG_RE);
  return matches ? matches.length : 0;
}

/**
 * @param {string} svgOpenTag
 */
export function extractSvgViewBox(svgOpenTag) {
  const m = String(svgOpenTag || '').match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  return m ? m[1].trim() : '';
}

/**
 * Rough ancestor window before an SVG for logo-context detection.
 * @param {string} html
 * @param {number} svgIndex
 */
function ancestorSnippetBefore(html, svgIndex) {
  const start = Math.max(0, svgIndex - 400);
  return html.slice(start, svgIndex);
}

/**
 * Extract top-level inline SVG inventory entries from HTML.
 * @param {string} html
 * @param {{ max?: number }} [opts]
 * @returns {{ viewBox: string, paths: number, logoContext: boolean, length: number }[]}
 */
export function extractInlineSvgInventory(html, opts = {}) {
  const max = opts.max ?? INLINE_SVG_INVENTORY_MAX;
  const source = String(html || '');
  if (!source) return [];

  /** @type {{ viewBox: string, paths: number, logoContext: boolean, length: number }[]} */
  const found = [];
  const re = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi;
  let m;
  while ((m = re.exec(source))) {
    const openAttrs = m[1] || '';
    const inner = m[2] || '';
    const paths = countSvgShapeElements(inner);
    if (paths < 1 && !/\b(?:use|image)\b/i.test(inner)) continue;
    const viewBox = extractSvgViewBox(openAttrs) || extractSvgViewBox(m[0]);
    const before = ancestorSnippetBefore(source, m.index);
    const logoContext = LOGO_CONTEXT_RE.test(before) || LOGO_CONTEXT_RE.test(openAttrs);
    found.push({
      viewBox,
      paths: Math.max(paths, 0),
      logoContext,
      length: m[0].length,
    });
  }

  found.sort((a, b) => {
    if (a.logoContext !== b.logoContext) return a.logoContext ? -1 : 1;
    if (b.paths !== a.paths) return b.paths - a.paths;
    return b.length - a.length;
  });

  return found.slice(0, Math.max(0, max));
}

/**
 * Format inventory block for visual / sitecoreize / v2 task prompts.
 * @param {string} html
 * @param {{ max?: number }} [opts]
 * @returns {string} empty when no SVGs
 */
export function formatInlineSvgInventoryForPrompt(html, opts = {}) {
  const entries = extractInlineSvgInventory(html, opts);
  if (!entries.length) return '';

  const lines = [
    `INLINE SVG INVENTORY (${entries.length}) — copy EACH SVG COMPLETE into TSX / svgMarkup (path counts must match):`,
  ];
  entries.forEach((e, i) => {
    const vb = e.viewBox ? `viewBox="${e.viewBox}"` : 'viewBox=(none)';
    lines.push(
      `${i + 1}. ${vb} paths=${e.paths} logoContext=${e.logoContext ? 'true' : 'false'}`,
    );
  });
  lines.push(
    'HARD: for each inventory row, emitted <svg> / svgMarkup shape-element count must equal paths= — never drop paths for token budget.',
  );
  return lines.join('\n');
}
