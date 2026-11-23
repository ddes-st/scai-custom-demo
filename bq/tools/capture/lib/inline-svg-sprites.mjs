/**
 * Inline external SVG sprite <use href="….svg#id"> refs into standalone <svg>
 * markup when writing styled section.html (host-agnostic).
 *
 * original-section.html stays raw; only styled snapshots should call this.
 */

/** @type {Map<string, string|null>} */
const sheetCache = new Map();

/** Clear fetch cache (tests). */
export function clearSvgSpriteSheetCache() {
  sheetCache.clear();
}

/**
 * @param {string} href
 * @param {string} [pageUrl]
 * @returns {{ sheetUrl: string, symbolId: string }|null}
 */
export function parseExternalSvgUseHref(href, pageUrl = '') {
  const raw = String(href || '').trim();
  if (!raw || raw.startsWith('data:')) return null;
  // Same-document only — leave for optional later pass.
  if (raw.startsWith('#')) return null;

  let absolute;
  try {
    absolute = new URL(raw, pageUrl || 'https://example.invalid/').href;
  } catch {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(absolute);
  } catch {
    return null;
  }

  const symbolId = String(parsed.hash || '').replace(/^#/, '').trim();
  if (!symbolId) return null;

  // Path or query must look like an SVG sheet (…foo.svg or …foo.svg?v=1).
  const pathOnly = parsed.pathname || '';
  if (!/\.svg$/i.test(pathOnly)) return null;

  parsed.hash = '';
  return { sheetUrl: parsed.href, symbolId };
}

/**
 * Find external sprite uses in HTML.
 * @param {string} html
 * @param {string} [pageUrl]
 * @returns {{ fullMatch: string, href: string, sheetUrl: string, symbolId: string, index: number }[]}
 */
export function findExternalSvgSpriteUses(html, pageUrl = '') {
  const text = String(html || '');
  /** @type {{ fullMatch: string, href: string, sheetUrl: string, symbolId: string, index: number }[]} */
  const hits = [];
  const re =
    /<use\b([^>]*?)(?:\/)?>(?:<\/use>)?/gi;
  let m;
  while ((m = re.exec(text))) {
    const attrs = m[1] || '';
    const hrefMatch =
      attrs.match(/\b(?:xlink:)?href\s*=\s*(["'])([^"']+)\1/i) ||
      attrs.match(/\b(?:xlink:)?href\s*=\s*([^\s>]+)/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[2] || hrefMatch[1];
    const parsed = parseExternalSvgUseHref(href, pageUrl);
    if (!parsed) continue;
    hits.push({
      fullMatch: m[0],
      href,
      sheetUrl: parsed.sheetUrl,
      symbolId: parsed.symbolId,
      index: m.index,
    });
  }
  return hits;
}

/**
 * @param {string} sheetXml
 * @param {string} symbolId
 * @returns {string|null} standalone svg markup
 */
export function extractSvgSymbolFromSheet(sheetXml, symbolId) {
  const xml = String(sheetXml || '');
  const id = String(symbolId || '').trim();
  if (!xml || !id) return null;

  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Prefer explicit svg/symbol with this id; fall back to any element with id.
  const patterns = [
    new RegExp(
      `<svg\\b([^>]*\\bid=["']${escaped}["'][^>]*)>([\\s\\S]*?)<\\/svg>`,
      'i',
    ),
    new RegExp(
      `<symbol\\b([^>]*\\bid=["']${escaped}["'][^>]*)>([\\s\\S]*?)<\\/symbol>`,
      'i',
    ),
    new RegExp(
      `<(g)\\b([^>]*\\bid=["']${escaped}["'][^>]*)>([\\s\\S]*?)<\\/\\1>`,
      'i',
    ),
  ];

  for (const re of patterns) {
    const m = xml.match(re);
    if (!m) continue;
    if (re.source.startsWith('<svg')) {
      return sanitizeStandaloneSvg(`<svg${m[1]}>${m[2]}</svg>`);
    }
    if (re.source.startsWith('<symbol')) {
      const attrs = m[1] || '';
      const viewBox = attrFromTagAttrs(attrs, 'viewBox') || '0 0 24 24';
      const inner = m[2] || '';
      return sanitizeStandaloneSvg(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${escapeAttr(viewBox)}">${inner}</svg>`,
      );
    }
    // <g id>
    const gAttrs = m[2] || '';
    const inner = m[3] || '';
    const viewBox = '0 0 24 24';
    return sanitizeStandaloneSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><g${gAttrs}>${inner}</g></svg>`,
    );
  }

  return null;
}

/**
 * @param {string} attrs
 * @param {string} name
 */
function attrFromTagAttrs(attrs, name) {
  const re = new RegExp(
    `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*(["'])([^"']*)\\1`,
    'i',
  );
  const m = String(attrs || '').match(re);
  return m ? m[2] : '';
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * Ensure xmlns + rewrite CSS vars in paint attributes to currentColor.
 * @param {string} svg
 */
export function sanitizeStandaloneSvg(svg) {
  let text = String(svg || '').trim();
  if (!text) return text;
  if (!/\sxmlns\s*=/.test(text.slice(0, 200))) {
    text = text.replace(
      /^<svg\b/i,
      '<svg xmlns="http://www.w3.org/2000/svg"',
    );
  }
  // stroke/fill/stop-color etc. using var(--*) → currentColor
  text = text.replace(
    /\b(fill|stroke|stop-color|flood-color|lighting-color|color)\s*=\s*(["'])var\(--[^)]+\)\2/gi,
    '$1=$2currentColor$2',
  );
  text = text.replace(
    /var\(--[^)]+\)/g,
    'currentColor',
  );
  // Drop sprite-local id collisions when inlining many icons into one HTML doc
  // Keep viewBox; strip the outer symbol id to avoid duplicate ids across icons.
  text = text.replace(/^(<svg\b[^>]*?)\s+id=(["'])[^"']*\2/i, '$1');
  return text;
}

/**
 * @param {string} sheetUrl
 * @param {(url: string) => Promise<string|null|undefined>} fetchText
 */
async function loadSheet(sheetUrl, fetchText) {
  if (sheetCache.has(sheetUrl)) return sheetCache.get(sheetUrl) ?? null;
  let text = null;
  try {
    text = (await fetchText(sheetUrl)) || null;
  } catch {
    text = null;
  }
  if (text && !/<svg[\s>]/i.test(text) && !/<symbol[\s>]/i.test(text)) {
    text = null;
  }
  sheetCache.set(sheetUrl, text);
  return text;
}

/**
 * Default fetch (Node 18+ / undici). Prefer page.request in capture.
 * @param {string} url
 */
export async function defaultFetchSvgSheet(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'image/svg+xml,text/plain,*/*' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Replace external sprite <use> with inline standalone SVGs.
 *
 * @param {string} html
 * @param {object} [options]
 * @param {string} [options.pageUrl]
 * @param {(url: string) => Promise<string|null|undefined>} [options.fetchText]
 * @param {boolean} [options.warn]
 * @returns {Promise<{ html: string, inlined: number, failed: number }>}
 */
export async function inlineSvgSpritesInHtml(html, options = {}) {
  const pageUrl = String(options.pageUrl || '').trim();
  const fetchText = options.fetchText || defaultFetchSvgSheet;
  const warn = options.warn !== false;
  const source = String(html || '');
  const hits = findExternalSvgSpriteUses(source, pageUrl);
  if (!hits.length) {
    return { html: source, inlined: 0, failed: 0 };
  }

  /** @type {Map<string, string|null>} */
  const extracted = new Map();
  let failed = 0;

  for (const hit of hits) {
    const key = `${hit.sheetUrl}#${hit.symbolId}`;
    if (extracted.has(key)) continue;
    const sheet = await loadSheet(hit.sheetUrl, fetchText);
    if (!sheet) {
      extracted.set(key, null);
      failed += 1;
      if (warn) {
        console.warn(
          `  ⚠ SVG sprite: failed to fetch ${hit.sheetUrl} (leave <use> as-is)`,
        );
      }
      continue;
    }
    const standalone = extractSvgSymbolFromSheet(sheet, hit.symbolId);
    if (!standalone) {
      extracted.set(key, null);
      failed += 1;
      if (warn) {
        console.warn(
          `  ⚠ SVG sprite: id "${hit.symbolId}" not found in ${hit.sheetUrl}`,
        );
      }
      continue;
    }
    extracted.set(key, standalone);
  }

  // Replace from end → start so indices stay valid. Prefer replacing a wrapping
  // <svg>…<use/></svg> when the svg only hosts that use.
  let out = source;
  const ordered = [...hits].sort((a, b) => b.index - a.index);
  let inlined = 0;

  for (const hit of ordered) {
    const key = `${hit.sheetUrl}#${hit.symbolId}`;
    const standalone = extracted.get(key);
    if (!standalone) continue;

    const start = hit.index;
    const useEnd = start + hit.fullMatch.length;
    const wrap = findWrappingIconSvg(out, start, useEnd);
    if (wrap) {
      const classes = wrap.classAttr
        ? ` class="${escapeAttr(wrap.classAttr)}"`
        : '';
      const aria = wrap.ariaHidden
        ? ` aria-hidden="${escapeAttr(wrap.ariaHidden)}"`
        : '';
      // Merge class/aria onto standalone root svg
      let injected = standalone.replace(
        /^<svg\b/i,
        `<svg${classes}${aria}`,
      );
      out = out.slice(0, wrap.start) + injected + out.slice(wrap.end);
      inlined += 1;
      continue;
    }

    out =
      out.slice(0, start) + standalone + out.slice(useEnd);
    inlined += 1;
  }

  return { html: out, inlined, failed };
}

/**
 * If <use> sits inside a simple parent <svg> that mainly hosts the use, return
 * that parent span so we can replace the whole icon node.
 * @param {string} html
 * @param {number} useStart
 * @param {number} useEnd
 */
function findWrappingIconSvg(html, useStart, useEnd) {
  const before = html.slice(Math.max(0, useStart - 400), useStart);
  const openMatch = before.match(/<svg\b[^>]*>\s*$/i);
  if (!openMatch) return null;
  const openStart = useStart - openMatch[0].length;
  const openTag = openMatch[0];
  // After use: optional whitespace + </svg>
  const after = html.slice(useEnd, useEnd + 80);
  const closeMatch = after.match(/^\s*<\/svg>/i);
  if (!closeMatch) return null;
  const end = useEnd + closeMatch[0].length;
  // Reject if parent svg has other significant children between open and use
  const between = html.slice(openStart + openTag.length, useStart).trim();
  if (between && !/^<!--[\s\S]*-->$/.test(between)) return null;

  return {
    start: openStart,
    end,
    classAttr: attrFromTagAttrs(openTag.slice(4, -1), 'class'),
    ariaHidden: attrFromTagAttrs(openTag.slice(4, -1), 'aria-hidden'),
  };
}

/**
 * Playwright-friendly fetch using page.request with in-page fallback.
 * @param {import('playwright').Page} page
 * @param {string} url
 */
export async function fetchSvgSheetViaPage(page, url) {
  if (!page?.request?.get) return defaultFetchSvgSheet(url);
  try {
    const res = await page.request.get(url, { timeout: 45000 });
    if (res.ok()) {
      const text = await res.text();
      if (text && text.trim()) return text;
    }
  } catch {
    /* fall through */
  }
  try {
    return await page.evaluate(async (href) => {
      const response = await fetch(href);
      if (!response.ok) return null;
      return response.text();
    }, url);
  } catch {
    return null;
  }
}
