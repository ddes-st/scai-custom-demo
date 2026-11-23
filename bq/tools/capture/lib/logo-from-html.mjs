/**
 * Extract a public raster logo URL from HTML (shared by capture + brandkit).
 */

/**
 * @param {string} href
 * @param {string} baseUrl
 */
export function absolutizeUrl(href, baseUrl) {
  const raw = String(href || '').trim();
  if (!raw || raw.startsWith('data:')) return null;
  try {
    const abs = new URL(raw, baseUrl).href;
    if (!/^https?:\/\//i.test(abs)) return null;
    return abs;
  } catch {
    return null;
  }
}

/**
 * Prefer PNG/JPEG for Stream logo field.
 * @param {string} url
 */
export function isLikelyRasterLogoUrl(url) {
  const u = String(url || '').toLowerCase();
  if (/\.svg(\?|#|$)/.test(u)) return false;
  if (/\.ico(\?|#|$)/.test(u)) return false;
  return true;
}

/**
 * Score candidate logo URLs (higher = better).
 * @param {string} url
 * @param {string} context
 */
function scoreCandidate(url, context) {
  let score = 0;
  const c = `${context} ${url}`.toLowerCase();
  if (/logo/.test(c)) score += 50;
  if (/brand/.test(c)) score += 20;
  if (/header|nav|masthead/.test(c)) score += 10;
  if (/\.png(\?|#|$)/.test(c)) score += 15;
  if (/\.jpe?g(\?|#|$)|webp/.test(c)) score += 8;
  if (/apple-touch-icon/.test(c)) score += 25;
  if (/rel=["']icon["']|rel=icon/.test(c)) score += 12;
  if (/og:image/.test(c)) score += 5;
  if (/favicon/.test(c)) score += 3;
  return score;
}

/**
 * Extract best logo URL from HTML string.
 * @param {string} html
 * @param {string} baseUrl
 * @returns {string|null}
 */
export function extractLogoUrlFromHtml(html, baseUrl) {
  const text = String(html || '');
  /** @type {{ url: string, score: number }[]} */
  const candidates = [];

  const push = (href, context) => {
    const abs = absolutizeUrl(href, baseUrl);
    if (!abs || !isLikelyRasterLogoUrl(abs)) return;
    candidates.push({ url: abs, score: scoreCandidate(abs, context) });
  };

  const imgRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(text))) {
    const tag = m[0];
    const src =
      tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    const ctx = tag;
    if (/logo|brand|header|nav|site-title/i.test(ctx) || /logo/i.test(src)) {
      push(src, ctx);
    }
  }

  const linkRe = /<link\b[^>]*>/gi;
  while ((m = linkRe.exec(text))) {
    const tag = m[0];
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] || '';
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    if (
      /apple-touch-icon/i.test(rel) ||
      /^icon$/i.test(rel.trim()) ||
      /icon/i.test(rel)
    ) {
      push(href, `rel=${rel} ${tag}`);
    }
  }

  const metaRe = /<meta\b[^>]*>/gi;
  while ((m = metaRe.exec(text))) {
    const tag = m[0];
    const prop =
      tag.match(/\bproperty=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\bname=["']([^"']+)["']/i)?.[1] ||
      '';
    if (!/og:image/i.test(prop)) continue;
    const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
    if (content) push(content, `og:image ${tag}`);
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.url.length - b.url.length);
  return candidates[0].url;
}

/**
 * Map Content-Type / URL to a logo file extension.
 * @param {string} [contentType]
 * @param {string} [url]
 */
export function logoExtensionFromResponse(contentType, url) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('png')) return '.png';
  const u = String(url || '').toLowerCase();
  if (/\.jpe?g(\?|#|$)/.test(u)) return '.jpg';
  if (/\.webp(\?|#|$)/.test(u)) return '.webp';
  return '.png';
}
