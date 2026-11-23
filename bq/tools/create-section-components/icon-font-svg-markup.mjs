/**
 * Convert capture icon-font glyphs (ic-* + data-bq-glyph) into Image svgMarkup
 * for Sitecore seeds — works in preview and Edge after media ingest.
 */
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {string} p
 */
async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find a *-icons.svg font near a section HTML path.
 * @param {string} sectionHtmlPath
 * @returns {Promise<string|null>}
 */
export async function resolveIconFontSvgNearSection(sectionHtmlPath) {
  const htmlPath = String(sectionHtmlPath || '');
  if (!htmlPath) return null;
  const sectionDir = path.dirname(htmlPath);
  const pageDir = path.dirname(path.dirname(sectionDir)); // …/sections → page
  /** @type {string[]} */
  const candidates = [];
  // Prefer brand icon fonts (menzis-icons) over generic general-icons.
  candidates.push(
    path.join(pageDir, 'fonts', 'menzis-icons.svg'),
    path.join(pageDir, 'assets', 'fonts', 'menzis-icons.svg'),
  );
  try {
    const fontsDir = path.join(pageDir, 'fonts');
    if (await exists(fontsDir)) {
      for (const name of await readdir(fontsDir)) {
        if (/-icons\.svg$/i.test(name) || /^icons\.svg$/i.test(name)) {
          const full = path.join(fontsDir, name);
          if (!candidates.includes(full)) candidates.push(full);
        }
      }
    }
  } catch {
    /* ignore */
  }
  candidates.push(path.join(pageDir, 'fonts', 'icons.svg'));
  for (const c of candidates) {
    if (await exists(c)) return c;
  }
  return null;
}

/**
 * @param {string} fontSvg
 * @param {string} unicodeChar
 * @returns {{ d: string, glyphName: string, horizAdvX: number }|null}
 */
export function findGlyphInIconFont(fontSvg, unicodeChar) {
  const ch = String(unicodeChar || '');
  if (!ch || !fontSvg) return null;
  const cp = ch.codePointAt(0);
  if (cp == null) return null;
  const hex = cp.toString(16);
  const patterns = [
    new RegExp(`<glyph([^>]*unicode="&#x${hex};"[^>]*)\\/?>`, 'i'),
    new RegExp(`<glyph([^>]*unicode="&#${cp};"[^>]*)\\/?>`, 'i'),
  ];
  for (const re of patterns) {
    const m = fontSvg.match(re);
    if (!m) continue;
    const attrs = m[1] || '';
    const d = attrs.match(/\bd="([^"]*)"/)?.[1] || '';
    if (!d.trim()) continue;
    const glyphName = attrs.match(/\bglyph-name="([^"]*)"/)?.[1] || '';
    const horizAdvX = Number(attrs.match(/\bhoriz-adv-x="([^"]*)"/)?.[1]) || 1024;
    return { d, glyphName, horizAdvX };
  }
  return null;
}

/**
 * Dual-tone icon: layer1 (primary/blue) + layer2 (accent/gold).
 * @param {{ d: string, horizAdvX?: number }|null} layer1
 * @param {{ d: string, horizAdvX?: number }|null} layer2
 * @param {{ primary?: string, accent?: string }} [colors]
 */
export function dualGlyphPathsToSvgMarkup(layer1, layer2, colors = {}) {
  const primary = colors.primary || '#043572';
  const accent = colors.accent || '#fcb53c';
  const adv = Math.max(layer1?.horizAdvX || 1024, layer2?.horizAdvX || 1024, 1024);
  const paths = [];
  // Paint accent (::before / *-l2) under primary (::after / *-l1) to match dual-tone fonts
  if (layer1?.d) {
    paths.push(`<path fill="${accent}" d="${layer1.d}"/>`);
  }
  if (layer2?.d) {
    paths.push(`<path fill="${primary}" d="${layer2.d}"/>`);
  }
  if (!paths.length) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${adv} ${adv}" width="48" height="48"><g transform="scale(1,-1) translate(0,-${adv})">${paths.join('')}</g></svg>`;
}

/**
 * @param {string} titleHtml
 */
function normalizeCardTitle(titleHtml) {
  return String(titleHtml || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse `.ic-foo::before { content: "…" }` / `::after` rules from section HTML.
 * @param {string} sectionHtml
 * @returns {Map<string, { before: string, after: string }>}
 */
export function parseIconClassGlyphCss(sectionHtml) {
  const html = String(sectionHtml || '');
  /** @type {Map<string, { before: string, after: string }>} */
  const out = new Map();
  const re =
    /\.(ic-[a-z0-9-]+)::(before|after)\s*\{\s*content:\s*["']([^"']*)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const cls = String(m[1] || '').toLowerCase();
    const pseudo = String(m[2] || '').toLowerCase();
    const glyph = String(m[3] || '');
    if (!cls || !glyph) continue;
    const cur = out.get(cls) || { before: '', after: '' };
    if (pseudo === 'before') cur.before = glyph;
    else cur.after = glyph;
    out.set(cls, cur);
  }
  return out;
}

/**
 * Parse card icons from section HTML: title → { className, before, after }.
 * @param {string} sectionHtml
 * @returns {Map<string, { className: string, before: string, after: string }>}
 */
export function parseCardIconGlyphsFromHtml(sectionHtml) {
  const html = String(sectionHtml || '');
  /** @type {Map<string, { className: string, before: string, after: string }>} */
  const out = new Map();
  if (!html.trim()) return out;
  const cssMap = parseIconClassGlyphCss(html);

  // Prefer icon tiles: .card with leading .icon > .ic-* then h3 (feature bands).
  // Avoid matching class tokens like card-body / card-header (\bcard\b is too loose).
  const cardRe =
    /<div[^>]*class="([^"]*)"[^>]*>\s*(?:<span[^>]*class="[^"]*\bicon\b[^"]*"[^>]*>\s*)?<i[^>]*class="([^"]*\bic-[^"]*)"[^>]*>[\s\S]*?(?:data-bq-glyph="([^"]*)")?[\s\S]*?(?:data-bq-glyph="([^"]*)")?[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let m;
  while ((m = cardRe.exec(html))) {
    const divClass = String(m[1] || '');
    // Require a real `.card` token, not card-body / card-header / card-footer.
    if (!/(?:^|\s)card(?:\s|$)/.test(divClass)) continue;
    const classAttr = String(m[2] || '');
    const icMatch = classAttr.match(/\bic-[a-z0-9-]+/i);
    const className = icMatch ? icMatch[0].toLowerCase() : '';
    // Skip generic link chrome icons (external-link, chevron, …)
    if (/^ic-g-/.test(className)) continue;
    let before = String(m[3] || '');
    let after = String(m[4] || '');
    if ((!before || !after) && className && cssMap.has(className)) {
      const css = cssMap.get(className);
      before = before || css?.before || '';
      after = after || css?.after || '';
    }
    const title = normalizeCardTitle(m[5]);
    if (!title || !before) continue;
    const entry = { className, before, after };
    out.set(title.toLowerCase(), entry);
    const short = title.toLowerCase().slice(0, 24);
    if (!out.has(short)) out.set(short, entry);
  }
  return out;
}

/**
 * Build svgMarkup for a card title using section HTML + icon font file.
 * @param {{
 *   sectionHtml?: string|null,
 *   fontSvg?: string|null,
 *   title: string,
 * }} opts
 * @returns {string}
 */
export function svgMarkupForCardTitle(opts) {
  const title = normalizeCardTitle(opts.title);
  const html = String(opts.sectionHtml || '');
  const fontSvg = String(opts.fontSvg || '');
  if (!title || !html || !fontSvg) return '';
  const map = parseCardIconGlyphsFromHtml(html);
  const lower = title.toLowerCase();
  let hit = map.get(lower) || map.get(lower.slice(0, 24)) || null;
  if (!hit) {
    // Soft match only when one side is a clear prefix of the other (avoid
    // "welkom" link chrome colliding with "Iedereen is welkom").
    for (const [k, v] of map.entries()) {
      if (k.length < 8) continue;
      if (lower.startsWith(k) || k.startsWith(lower)) {
        hit = v;
        break;
      }
    }
  }
  if (!hit?.before) return '';
  const l1 = findGlyphInIconFont(fontSvg, hit.before);
  const l2 = hit.after ? findGlyphInIconFont(fontSvg, hit.after) : null;
  return dualGlyphPathsToSvgMarkup(l1, l2);
}

/**
 * @param {string} sectionHtmlPath
 * @returns {Promise<string>}
 */
export async function loadIconFontSvgForSection(sectionHtmlPath) {
  const fontPath = await resolveIconFontSvgNearSection(sectionHtmlPath);
  if (!fontPath) return '';
  try {
    return await readFile(fontPath, 'utf8');
  } catch {
    return '';
  }
}
