/**
 * Download key stylesheets and extract fonts / colors from a loaded Playwright page.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { shouldForce } from './force-kinds.mjs';
import {
  AI_DERIVED_DESIGN_MD,
  generateAiDesignGuide,
} from './design-system/ai/generate-ai-design-guide.mjs';

const BOOTSTRAP_DEFAULTS = new Set([
  '#007bff',
  '#0d6efd',
  '#6c757d',
  '#28a745',
  '#dc3545',
  '#ffc107',
  '#17a2b8',
  '#343a40',
  '#212529',
  '#0056b3',
  '#004085',
  '#0062cc',
  '#0069d9',
  '#006fe6',
  '#1e7e34',
  '#218838',
  '#bd2130',
  '#c82333',
  '#d39e00',
  '#e0a800',
  '#117a8b',
  '#138496',
  '#e10000',
  '#da1414',
  '#75b8ff',
  '#80bdff',
  '#ced4da',
  '#dae0e5',
  '#dee2e6',
  '#d32535',
]);

const SYSTEM_FONTS = new Set([
  '-apple-system',
  'system-ui',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
  'inherit',
]);
const CSS_SKIP_PATTERNS =
  /onetrust|cookie|notification|modal\.css|hotjar|gtag|analytics|segments-experiment|product-menu|personal-bar|search-bar/i;

const CSS_PRIORITY_PATTERNS = [
  { pattern: /liferayThemeCSS|lfr-css-file/i, score: 100 },
  { pattern: /theme.*\/css\/main\.css/i, score: 95 },
  { pattern: /clientlib-site/i, score: 92 },
  { pattern: /clientlib-base/i, score: 88 },
  { pattern: /clientlib-vendors/i, score: 84 },
  { pattern: /theme.*\/css\/clay\.css/i, score: 75 },
  { pattern: /layout-common-styles/i, score: 85 },
  { pattern: /\/css\/main\.css/i, score: 80 },
  { pattern: /variables|tokens|brand|theme/i, score: 70 },
  { pattern: /typography|fonts/i, score: 65 },
  { pattern: /base\.css|global\.css|app\.css/i, score: 60 },
  { pattern: /clientlib-/i, score: 35 },
  { pattern: /\.css(?:\?|$)/i, score: 15 },
];

const MAX_CSS_FILES = 8;

const FONT_FILE_EXT = /\.(woff2?|ttf|otf|eot|svg)(\?|#|$)/i;

function scoreStylesheet(href, meta = {}) {
  let score = 0;
  if (meta.isTheme) score += 100;
  if (meta.isMain) score += 50;
  if (meta.inHead) score += 20;
  for (const { pattern, score: s } of CSS_PRIORITY_PATTERNS) {
    if (pattern.test(href)) score += s;
  }
  if (CSS_SKIP_PATTERNS.test(href)) score -= 200;
  if (/combo\?.*css/i.test(href)) score -= 30;
  if (/d41d8cd98f00b204e9800998ecf8427e/i.test(href)) score -= 40;
  return score;
}

function sanitizeFilename(href) {
  try {
    const u = new URL(href);
    const base = path.basename(u.pathname) || 'stylesheet.css';
    if (base.includes('.css')) return base.replace(/[^\w.-]/g, '_');
    const slug = u.pathname.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(-60);
    return `${slug || 'stylesheet'}.css`;
  } catch {
    return 'stylesheet.css';
  }
}

function sanitizeFontFilename(href) {
  try {
    const u = new URL(href);
    const base = path.basename(u.pathname) || 'font.woff2';
    const cleaned = base.replace(/[^\w.-]/g, '_');
    if (FONT_FILE_EXT.test(cleaned)) return cleaned;
    const ext = (u.pathname.match(/\.(woff2?|ttf|otf|eot|svg)/i) || [])[1] || 'woff2';
    return `${cleaned || 'font'}.${ext}`;
  } catch {
    return 'font.woff2';
  }
}

function isFontFileUrl(url) {
  return FONT_FILE_EXT.test(url || '');
}

function isFontStylesheetUrl(url) {
  if (!url || isFontFileUrl(url)) return false;
  return (
    /\.css(\?|#|$)/i.test(url) ||
    /fonts\.googleapis\.com/i.test(url) ||
    /fonts\.gstatic\.com/i.test(url)
  );
}

function rgbToHex(color) {
  if (!color || color === 'transparent') return null;
  if (color.startsWith('#')) {
    const hex = color.length === 4 ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` : color;
    return hex.toLowerCase();
  }
  const m = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!m) return color;
  const r = Math.round(Number(m[1]));
  const g = Math.round(Number(m[2]));
  const b = Math.round(Number(m[3]));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hexToHsl(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { h: 0, s: 0, l: 0 };
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function isNeutralHex(hex) {
  const { s, l } = hexToHsl(hex);
  if (l >= 88 || l <= 12) return true;
  if (s < 12) return true;
  return false;
}

function isChromaticHex(hex) {
  const { s, l } = hexToHsl(hex);
  return s >= 18 && l >= 25 && l < 88;
}

function isDarkBrandHex(hex) {
  const { s, l } = hexToHsl(hex);
  return l <= 28 && s >= 18;
}

function normalizeFontFamily(family) {
  if (!family) return null;
  const first = family.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  if (!first || first === 'inherit' || first === 'initial') return null;
  return first;
}

function parseFontFacesFromCss(cssText) {
  const fonts = new Set();
  const re = /@font-face\s*{[^}]*font-family\s*:\s*([^;}+]+)/gi;
  let m;
  while ((m = re.exec(cssText))) {
    const name = normalizeFontFamily(m[1]);
    if (name) fonts.add(name);
  }
  return [...fonts];
}

function resolveCssUrl(rawUrl, baseHref) {
  const url = rawUrl?.trim();
  if (!url || url.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!baseHref) return url;
  try {
    return new URL(url, baseHref).href;
  } catch {
    return null;
  }
}

function preferFontUrls(urls) {
  const score = (url) => {
    if (/\.woff2(\?|#|$)/i.test(url)) return 5;
    if (/\.woff(\?|#|$)/i.test(url)) return 4;
    if (/\.ttf(\?|#|$)/i.test(url)) return 3;
    if (/\.otf(\?|#|$)/i.test(url)) return 2;
    if (/\.eot(\?|#|$)/i.test(url)) return 1;
    return 0;
  };
  return [...urls].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
}

/** @returns {Map<string, Set<string>>} */
function parseFontFaceSourcesFromCss(cssText, baseHref) {
  const map = new Map();
  const blockRe = /@font-face\s*{([^}]*)}/gi;
  let block;
  while ((block = blockRe.exec(cssText))) {
    const body = block[1];
    const family = normalizeFontFamily(body.match(/font-family\s*:\s*([^;}+]+)/i)?.[1]);
    if (!family) continue;
    const urls = map.get(family) ?? new Set();
    const srcRe = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    let src;
    while ((src = srcRe.exec(body))) {
      const resolved = resolveCssUrl(src[1], baseHref);
      if (resolved) urls.add(resolved);
    }
    map.set(family, urls);
  }
  return map;
}

function mergeFontSourceMaps(...maps) {
  const merged = new Map();
  for (const map of maps) {
    for (const [family, urls] of map) {
      const set = merged.get(family) ?? new Set();
      for (const url of urls) set.add(url);
      merged.set(family, set);
    }
  }
  return merged;
}

export function extractFontSourcesFromHtml(html, pageUrl) {
  const map = new Map();
  if (!html || typeof html !== 'string') return map;

  function add(family, url) {
    const resolved = resolveCssUrl(url, pageUrl);
    if (!family || !resolved) return;
    const set = map.get(family) ?? new Set();
    set.add(resolved);
    map.set(family, set);
  }

  for (const match of html.matchAll(/@font-face\s*{([^}]*)}/gi)) {
    const body = match[1];
    const family = normalizeFontFamily(body.match(/font-family\s*:\s*([^;}+]+)/i)?.[1]);
    if (!family) continue;
    const srcRe = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    let src;
    while ((src = srcRe.exec(body))) add(family, src[1]);
  }

  for (const match of html.matchAll(
    /<link\b[^>]*href=(["'])([^"']+)\1[^>]*>/gi
  )) {
    const tag = match[0];
    const href = match[2];
    if (/fonts\.googleapis\.com/i.test(href)) {
      const familyMatch = href.match(/family=([^&"']+)/i);
      if (familyMatch) {
        const family = decodeURIComponent(familyMatch[1].split(':')[0].replace(/\+/g, ' '));
        add(family, href);
      }
      continue;
    }
    if (/\bas=(["'])font\1/i.test(tag) || /type=(["'])font\//i.test(tag)) {
      const file = href.split('/').pop()?.replace(/\?.*$/, '') ?? '';
      const guess = file.replace(/^[a-f0-9-]+\./i, '').replace(/\.[^.]+$/, '');
      add(guess || 'preload-font', href);
    }
  }

  return map;
}

export async function collectFontSourcesFromPage(page) {
  const pageUrl = page.url();
  return page.evaluate((baseUrl) => {
    const sources = new Map();

    function add(family, url) {
      const name = family?.replace(/^['"]|['"]$/g, '').split(',')[0]?.trim();
      if (!name || !url || url.startsWith('data:')) return;
      let resolved = url;
      try {
        resolved = new URL(url, baseUrl).href;
      } catch {
        /* keep raw */
      }
      const set = sources.get(name) ?? new Set();
      set.add(resolved);
      sources.set(name, set);
    }

    for (const link of document.querySelectorAll('link[href*="fonts.googleapis.com"]')) {
      const href = link.href;
      const familyMatch = href.match(/family=([^&]+)/i);
      if (familyMatch) {
        const family = decodeURIComponent(familyMatch[1].split(':')[0].replace(/\+/g, ' '));
        add(family, href);
      }
    }

    for (const link of document.querySelectorAll('link[rel="preload"][as="font"][href]')) {
      add('preload-font', link.href);
    }

    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!rules) continue;
      const sheetHref = sheet.href || baseUrl;
      for (const rule of rules) {
        if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
        const family = rule.style.getPropertyValue('font-family');
        const urlRe = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
        let m;
        while ((m = urlRe.exec(rule.cssText))) {
          try {
            add(family, new URL(m[1], sheetHref).href);
          } catch {
            add(family, m[1]);
          }
        }
      }
    }

    return [...sources.entries()].map(([family, urls]) => ({
      family,
      sources: [...urls],
    }));
  }, pageUrl);
}

function parseCssVariablesFromCss(cssText) {
  const vars = {};
  const re = /(--[\w-]+)\s*:\s*([^;}{]+)/g;
  let m;
  while ((m = re.exec(cssText))) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

const BRAND_SELECTOR_HINT =
  /(?:hero|banner|cta|btn|button|primary|brand|accent|promo|explore|header|footer|nav|section|tile|signpost|content-promo|platform|sc-section|media-slider|asset-signpost)/i;

function colorsFromCssValue(value) {
  const colors = [];
  const hexRe = /#(?:[0-9a-fA-F]{3,8})\b/g;
  let m;
  while ((m = hexRe.exec(value))) colors.push(m[0]);
  const rgbRe = /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)/gi;
  while ((m = rgbRe.exec(value))) colors.push(m[0]);
  return colors;
}

function contextForCssProperty(prop, selector) {
  if (/background/i.test(prop)) {
    if (/btn|button|cta/i.test(selector)) return 'button';
    if (/header|nav/i.test(selector)) return 'headerBg';
    if (/footer/i.test(selector)) return 'footerBg';
    return 'sectionBg';
  }
  if (prop === 'color') {
    if (/btn|button|cta/i.test(selector)) return 'button';
    if (/h[1-3]|title|heading|hero/i.test(selector)) return 'heading';
    if (/link|anchor|\ba\b/i.test(selector)) return 'link';
    if (/nav|header/i.test(selector)) return 'navText';
    return 'body';
  }
  return null;
}

function selectorAppliesToPage(selector, pageHtml) {
  if (!pageHtml || typeof pageHtml !== 'string') return false;
  if (/:has\s*\(/i.test(selector)) {
    const hasId = selector.match(/:has\s*\(\s*#([A-Za-z0-9_-]+)/i);
    if (hasId && !pageHtml.includes(`id="${hasId[1]}"`) && !pageHtml.includes(`id='${hasId[1]}'`)) {
      return false;
    }
  }
  const classes = [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
  if (classes.length) {
    return classes.some((c) => c.length >= 6 && pageHtml.includes(c));
  }
  const ids = [...selector.matchAll(/#([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
  if (ids.length) {
    return ids.some((id) => pageHtml.includes(`id="${id}"`) || pageHtml.includes(`id='${id}'`));
  }
  return /\b(body|html|header|footer|nav|main|section|article|button|a|h[1-6])\b/i.test(selector);
}

export function extractBrandColorsFromCss(cssText, pageHtml = '') {
  /** @type {{ color: string, context: string, weight: number }[]} */
  const usage = [];
  if (!cssText || typeof cssText !== 'string') return usage;

  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    const selector = match[1].trim();
    const declarations = match[2];
    if (!selector || selector.startsWith('@')) continue;
    if (/^[\s*,.:]*\*[\s*,.:]*$/.test(selector)) continue;
    if (!BRAND_SELECTOR_HINT.test(selector)) continue;
    if (!selectorAppliesToPage(selector, pageHtml)) continue;

    const declRe = /(?:^|;)\s*(color|background(?:-color)?)\s*:\s*([^;!]+)/gi;
    let m;
    while ((m = declRe.exec(declarations))) {
      const prop = m[1].toLowerCase();
      const ctx = contextForCssProperty(prop, selector);
      if (!ctx) continue;
      const weight = ctx === 'sectionBg' || ctx === 'button' ? 8 : ctx === 'heading' ? 7 : 5;
      for (const color of colorsFromCssValue(m[2])) {
        usage.push({ color, context: ctx, weight });
      }
    }
  }
  return usage;
}

function isValidColorHex(hex) {
  return hex?.startsWith('#') && !BOOTSTRAP_DEFAULTS.has(hex) && !isNeutralHex(hex);
}

function isExcludedCssVarKey(key) {
  return /^--(osano|onetrust|cookie|tw-|bs-|bootstrap-|gpc-)/i.test(key);
}

const GENERIC_SEMANTIC_KEYS = {
  success: /^--(success|green)$/i,
  error: /^--(danger|error)$/i,
  warning: /^--(warning|yellow|orange|amber)$/i,
  info: /^--(info|cyan|sky)$/i,
};

/** Palette-relevant custom properties from any design system (not Sitecore-only). */
function mergePaletteCssVariables(vars) {
  return Object.fromEntries(
    Object.entries(vars ?? {}).filter(([key, value]) => {
      if (!key.startsWith('--') || isExcludedCssVarKey(key)) return false;
      const k = key.toLowerCase();
      const paletteKey =
        /^--sc-/.test(k) ||
        /^--(primary|secondary|accent|success|danger|warning|info|green|red|yellow|orange|cyan|brand|theme|neutral|gray|grey|slate|cta|action)/.test(k) ||
        /primary|secondary|accent|brand|theme|neutral|gray|grey|success|danger|warning|info|green|red|yellow|orange|cyan|sky|color|background|gradient|cta|action/.test(k);
      if (!paletteKey) return false;
      const text = String(value).trim();
      if (/gradient/i.test(text)) return true;
      const hex = rgbToHex(text);
      const isExplicitSemantic = Object.values(GENERIC_SEMANTIC_KEYS).some((p) => p.test(k));
      if (hex?.startsWith('#') && BOOTSTRAP_DEFAULTS.has(hex) && !isExplicitSemantic) return false;
      return hex?.startsWith('#');
    })
  );
}

function filterBrandCssVariables(vars) {
  return mergePaletteCssVariables(vars);
}

function emptyUsage() {
  return { heading: 0, body: 0, button: 0, link: 0, headerBg: 0, footerBg: 0, sectionBg: 0, navText: 0, total: 0 };
}

function roleScoresFromUsage(u, hex) {
  const chromatic = isChromaticHex(hex);
  const darkBrand = isDarkBrandHex(hex);
  return {
    primary: u.sectionBg * (chromatic ? 9 : 1) + u.heading * (chromatic ? 7 : 1) + u.navText * 2,
    secondary: u.headerBg * 6 + u.footerBg * 6 + u.sectionBg * (darkBrand ? 7 : chromatic ? 2 : 1),
    accent: u.button * 9 + u.link * (chromatic ? 6 : 1),
  };
}

const SC_ACCENT_TOKENS = /^--sc-main-cta-color$/i;
const SC_PRIMARY_TOKENS = /^--sc-(purple-500|purple-600|blue-500|violet-500)$/i;
const SC_SECONDARY_TOKENS = /^--sc-blue-(700|800)$/i;
const SC_NEUTRAL_TOKENS = /^--sc-(neutral|black|white)/i;

const GENERIC_PRIMARY_KEY =
  /^--(primary|brand-primary|brand-main|theme-color|liferay-primary-color)$/i;
const GENERIC_SECONDARY_KEY = /^--(secondary|brand-secondary)$/i;
const GENERIC_ACCENT_KEY = /^--(accent|cta|action|highlight)$/i;
const GENERIC_NEUTRAL_KEY = /^--(neutral|gray|grey|slate|black|white)(?:-|$)/i;

const PALETTE_LIMITS = {
  primary: 5,
  secondary: 2,
  accent: 1,
  neutrals: 10,
  primaryGradients: 2,
  secondaryGradients: 1,
  accentGradients: 1,
  neutralGradients: 2,
};

export function isHexValue(v) {
  return typeof v === 'string' && v.startsWith('#');
}

export function isGradientValue(v) {
  return typeof v === 'string' && /gradient/i.test(v);
}

/** Accept legacy flat arrays or `{ hex, gradients }` role buckets. */
export function normalizeColorRole(value) {
  if (!value) return { hex: [], gradients: [] };
  if (Array.isArray(value)) {
    return {
      hex: value.filter(isHexValue).map((h) => rgbToHex(h) ?? h).filter(Boolean),
      gradients: value.filter(isGradientValue),
    };
  }
  return {
    hex: (value.hex ?? []).filter(isHexValue).map((h) => rgbToHex(h) ?? h).filter(Boolean),
    gradients: (value.gradients ?? []).filter(isGradientValue),
  };
}

function finalizeColorRole(role, bucket) {
  const hexLimit = PALETTE_LIMITS[role];
  const gradientLimit = PALETTE_LIMITS[`${role}Gradients`] ?? 0;
  return {
    hex: [...new Set(bucket.hex)].sort().slice(0, hexLimit),
    gradients: [...new Set(bucket.gradients)].slice(0, gradientLimit),
  };
}

function classifySemanticFromHex(hex) {
  const { h, s } = hexToHsl(hex);
  if (s < 20) return null;
  if (h >= 85 && h <= 155) return 'success';
  if (h >= 355 || h <= 20) return 'error';
  if (h >= 21 && h <= 55) return 'warning';
  if (h >= 165 && h <= 230) return 'info';
  return null;
}

function isNeutralGradient(g) {
  return (
    /radial-gradient/i.test(g) &&
    (/#fff(?:fff)?(?:\b|$)|#f[0-9a-f]{5}\b/i.test(g) || /rgb\(25[0-5],\s*25[0-5],\s*25[0-5]\)/i.test(g)) &&
    !/#ff1f38/i.test(g)
  );
}

function classifyGradientRole(gradient) {
  const g = normalizeGradientString(gradient);
  if (!g) return null;
  if (isNeutralGradient(g)) return 'neutrals';
  if (g.includes('90deg') && g.includes('#ff1f38') && g.includes('#8629ff')) return 'primary';
  if (/oklch/i.test(g) && g.includes('90deg')) return 'primary';
  if (/#9333ea|#2563eb|#9633f3|#2060eb/i.test(g.replace(/\s/g, ''))) return 'secondary';
  if (/#f71c34|#ff009e|#e92386/i.test(g) && /linear-gradient/i.test(g)) return 'primary';
  if (/#8629ff|#4300ad|#170697|#5f25e7|#001070|#ff1f38/i.test(g)) return 'primary';
  if (/radial-gradient/i.test(g)) return 'neutrals';
  return 'primary';
}

function pickSemanticColors(cssVariables, allHex, claimed) {
  const semantic = { success: null, error: null, warning: null, info: null };
  const candidates = { success: [], error: [], warning: [], info: [] };

  for (const [key, value] of Object.entries(cssVariables ?? {})) {
    if (/^--(osano|onetrust|cookie|tw-|bs-|bootstrap|gpc-)/i.test(key)) continue;
    const hex = rgbToHex(String(value).trim());
    if (!hex?.startsWith('#')) continue;
    const k = key.toLowerCase();
    for (const [type, pattern] of Object.entries(GENERIC_SEMANTIC_KEYS)) {
      if (pattern.test(k)) candidates[type].push({ hex, w: 12 });
    }
    if (/green|success/i.test(k)) candidates.success.push({ hex, w: /-500$/.test(k) ? 10 : 6 });
    else if (/yellow|orange|amber|warning/i.test(k)) candidates.warning.push({ hex, w: 10 });
    else if (/sky|cyan|info/i.test(k)) candidates.info.push({ hex, w: /-500$/.test(k) ? 10 : 6 });
    else if (/red|danger|error|destructive/i.test(k)) {
      if (/-(800|900)$/.test(k)) candidates.error.push({ hex, w: 10 });
      else if (/-(500|600|700)$/.test(k)) candidates.warning.push({ hex, w: 8 });
    }
  }

  for (const type of Object.keys(semantic)) {
    const pick = candidates[type].sort((a, b) => b.w - a.w)[0];
    if (pick) {
      semantic[type] = pick.hex;
      claimed.add(pick.hex);
    }
  }

  for (const type of Object.keys(semantic)) {
    if (semantic[type]) continue;
    for (const hex of allHex) {
      if (claimed.has(hex)) continue;
      if (classifySemanticFromHex(hex) === type) {
        semantic[type] = hex;
        claimed.add(hex);
        break;
      }
    }
  }

  return semantic;
}

function extractGradientCalls(text) {
  if (!text || !/gradient/i.test(text)) return [];
  const results = [];
  for (const type of ['linear-gradient', 'radial-gradient', 'conic-gradient']) {
    let searchFrom = 0;
    const needle = `${type}(`;
    while (searchFrom < text.length) {
      const start = text.indexOf(needle, searchFrom);
      if (start === -1) break;
      let depth = 0;
      let end = start + type.length;
      for (; end < text.length; end++) {
        const ch = text[end];
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) {
            results.push(text.slice(start, end + 1));
            break;
          }
        }
      }
      searchFrom = end + 1;
    }
  }
  return results.length ? results : [text.trim()];
}

function normalizeGradientString(value) {
  if (!value || !/gradient/i.test(value)) return null;
  let s = value.trim().replace(/\s+/g, ' ');
  const open = (s.match(/\(/g) || []).length;
  const close = (s.match(/\)/g) || []).length;
  if (open !== close || open === 0) return null;
  s = s.replace(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/gi,
    (match, r, g, b, a) => {
      const hex = rgbToHex(`rgb(${r}, ${g}, ${b})`);
      if (!hex) return match;
      if (a !== undefined && Number(a) < 1) return `rgba(${r}, ${g}, ${b}, ${a})`;
      return hex;
    }
  );
  s = s.replace(/\s*,\s*/g, ', ');
  return s.toLowerCase();
}

function isBrandGradient(value) {
  if (!value || !/gradient/i.test(value)) return false;
  if (/linear-gradient/i.test(value)) return true;
  if (/#(?:ff1f38|8629ff|4300ad|5f25e7|170697|4e06c2|d7009b|fe0054)/i.test(value)) return true;
  return false;
}

function dedupeGradients(candidates) {
  const byKey = new Map();
  for (const raw of candidates ?? []) {
    for (const part of extractGradientCalls(raw)) {
      if (!isBrandGradient(part)) continue;
      const normalized = normalizeGradientString(part);
      if (!normalized) continue;
      let weight = /linear-gradient/i.test(normalized) ? 3 : 1;
      if (normalized.includes('90deg') && normalized.includes('#ff1f38') && normalized.includes('#8629ff')) {
        weight = 10;
      }
      const existing = byKey.get(normalized);
      if (!existing || weight > existing) byKey.set(normalized, weight);
    }
  }
  return [...byKey.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([gradient]) => gradient);
}

function collectAllHexFromSources(colorUsage, cssVariables) {
  const all = new Set();
  const add = (value) => {
    if (!value) return;
    const text = String(value).trim();
    const hex = rgbToHex(text);
    if (hex?.startsWith('#')) all.add(hex);
    for (const match of text.matchAll(/#(?:[0-9a-fA-F]{3,8})\b/g)) {
      const h = rgbToHex(match[0]);
      if (h?.startsWith('#')) all.add(h);
    }
  };
  for (const row of colorUsage ?? []) add(row.color);
  for (const [key, value] of Object.entries(cssVariables ?? {})) {
    if (/^--(osano|onetrust|cookie|tw-|bs-|bootstrap|gpc-)/i.test(key)) continue;
    add(value);
  }
  return all;
}

export function extractGradientsFromCss(cssText, pageHtml = '') {
  const gradients = [];
  if (!cssText || typeof cssText !== 'string') return gradients;

  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    const selector = match[1].trim();
    const declarations = match[2];
    if (!selector || selector.startsWith('@')) continue;
    if (!BRAND_SELECTOR_HINT.test(selector)) continue;
    if (!selectorAppliesToPage(selector, pageHtml)) continue;

    const declRe = /(?:^|;)\s*(background(?:-image)?|background)\s*:\s*([^;!]+)/gi;
    let m;
    while ((m = declRe.exec(declarations))) {
      const value = m[2].trim();
      if (/gradient/i.test(value)) gradients.push(value);
    }
  }
  return gradients;
}

export function classifyColorsFromTokens({ colorUsage, cssVariables, roleHints, gradientCandidates }) {
  const allHex = collectAllHexFromSources(colorUsage, cssVariables);
  const claimed = new Set();
  const emptyRole = () => ({ hex: [], gradients: [] });
  const buckets = {
    primary: emptyRole(),
    secondary: emptyRole(),
    accent: emptyRole(),
    neutrals: emptyRole(),
    semantic: { success: null, error: null, warning: null, info: null },
  };

  const usage = new Map();
  for (const row of colorUsage ?? []) {
    const hex = rgbToHex(row.color);
    if (!hex?.startsWith('#')) continue;
    const u = usage.get(hex) ?? emptyUsage();
    const ctx = row.context;
    if (ctx in u && ctx !== 'total') u[ctx] += row.weight;
    u.total += row.weight;
    usage.set(hex, u);
  }

  function countHex(role) {
    return buckets[role].hex.length;
  }

  function countGradients(role) {
    return buckets[role].gradients.length;
  }

  function claimHex(role, value) {
    const hex = rgbToHex(value);
    if (!hex?.startsWith('#') || claimed.has(hex)) return false;
    const limit = PALETTE_LIMITS[role];
    if (limit && countHex(role) >= limit) return false;
    claimed.add(hex);
    buckets[role].hex.push(hex);
    return true;
  }

  function claimGradient(role, value) {
    const g = normalizeGradientString(value);
    if (!g) return false;
    if (buckets[role].gradients.includes(g)) return false;
    const limitKey = `${role}Gradients`;
    const limit = PALETTE_LIMITS[limitKey] ?? PALETTE_LIMITS[role];
    if (limit && countGradients(role) >= limit) return false;
    buckets[role].gradients.push(g);
    return true;
  }

  buckets.semantic = pickSemanticColors(cssVariables, allHex, claimed);

  for (const [key, value] of Object.entries(cssVariables ?? {})) {
    const k = key.toLowerCase();
    if (SC_ACCENT_TOKENS.test(k) || GENERIC_ACCENT_KEY.test(k)) {
      claimHex('accent', value);
      break;
    }
  }
  if (countHex('accent') === 0 && roleHints?.accent) {
    const hex = rgbToHex(roleHints.accent);
    if (hex && isChromaticHex(hex)) claimHex('accent', hex);
  }

  const primaryCandidates = [];
  for (const [key, value] of Object.entries(cssVariables ?? {})) {
    const k = key.toLowerCase();
    if (SC_PRIMARY_TOKENS.test(k) || GENERIC_PRIMARY_KEY.test(k)) {
      const hex = rgbToHex(value);
      if (hex && !claimed.has(hex)) primaryCandidates.push({ hex, w: SC_PRIMARY_TOKENS.test(k) ? 50 : 42 });
    } else if (/brand|primary/i.test(k) && !/foreground|text|contrast/i.test(k)) {
      const hex = rgbToHex(value);
      if (hex && !claimed.has(hex) && isChromaticHex(hex)) primaryCandidates.push({ hex, w: 30 });
    }
  }
  for (const [hex, u] of usage) {
    if (claimed.has(hex) || !isChromaticHex(hex)) continue;
    const { h } = hexToHsl(hex);
    if (h >= 220 && h <= 310) primaryCandidates.push({ hex, w: u.total });
  }
  for (const hex of allHex) {
    if (claimed.has(hex) || !isChromaticHex(hex)) continue;
    const { h } = hexToHsl(hex);
    if (h >= 220 && h <= 310) primaryCandidates.push({ hex, w: 5 });
  }
  const seenPrimary = new Set();
  for (const { hex } of primaryCandidates.sort((a, b) => b.w - a.w)) {
    if (seenPrimary.has(hex) || countHex('primary') >= PALETTE_LIMITS.primary) continue;
    if (claimHex('primary', hex)) seenPrimary.add(hex);
  }

  const secondaryCandidates = [];
  if (roleHints?.secondary) {
    const hex = rgbToHex(roleHints.secondary);
    if (hex) secondaryCandidates.push({ hex, w: 60 });
  }
  for (const [key, value] of Object.entries(cssVariables ?? {})) {
    const k = key.toLowerCase();
    if (SC_SECONDARY_TOKENS.test(k) || GENERIC_SECONDARY_KEY.test(k)) {
      const hex = rgbToHex(value);
      if (hex && !claimed.has(hex)) secondaryCandidates.push({ hex, w: 45 });
    }
  }
  for (const [hex, u] of usage) {
    if (claimed.has(hex) || !isDarkBrandHex(hex)) continue;
    secondaryCandidates.push({ hex, w: u.total });
  }
  for (const hex of allHex) {
    if (claimed.has(hex) || !isDarkBrandHex(hex)) continue;
    secondaryCandidates.push({ hex, w: 10 });
  }
  const seenSecondary = new Set();
  for (const { hex } of secondaryCandidates.sort((a, b) => b.w - a.w)) {
    if (seenSecondary.has(hex) || countHex('secondary') >= PALETTE_LIMITS.secondary) continue;
    if (claimHex('secondary', hex)) seenSecondary.add(hex);
  }

  for (const g of dedupeGradients(gradientCandidates)) {
    const role = classifyGradientRole(g);
    if (role === 'primary') claimGradient('primary', g);
    else if (role === 'secondary') claimGradient('secondary', g);
    else if (role === 'neutrals') claimGradient('neutrals', g);
  }

  for (const [key, value] of Object.entries(cssVariables ?? {})) {
    const k = key.toLowerCase();
    if (!SC_NEUTRAL_TOKENS.test(k) && !GENERIC_NEUTRAL_KEY.test(k)) continue;
    const hex = rgbToHex(value);
    if (hex && !claimed.has(hex) && countHex('neutrals') < PALETTE_LIMITS.neutrals) {
      claimHex('neutrals', hex);
    }
  }
  for (const hex of [...allHex].sort((a, b) => hexToHsl(a).l - hexToHsl(b).l)) {
    if (claimed.has(hex) || countHex('neutrals') >= PALETTE_LIMITS.neutrals) continue;
    if (isNeutralHex(hex)) claimHex('neutrals', hex);
  }

  for (const role of ['primary', 'secondary', 'accent', 'neutrals']) {
    buckets[role] = finalizeColorRole(role, buckets[role]);
  }

  return buckets;
}

export async function collectStylesheetUrls(page) {
  return page.evaluate(() => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"][href]')].map((el) => ({
      href: el.href,
      isTheme: el.id === 'liferayThemeCSS' || el.classList.contains('lfr-css-file'),
      isMain: /main\.css/i.test(el.href),
      inHead: !!el.closest('head'),
    }));
    return links;
  });
}

/**
 * Stylesheet links and <style> tags in document order (cascade order).
 * @returns {Promise<({ kind: 'link', href: string, isTheme: boolean, isMain: boolean, inHead: boolean } | { kind: 'style', text: string })[]>}
 */
export async function collectCssNodesInDocumentOrder(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('link[rel~="stylesheet"][href], style')];
    return nodes.map((el) => {
      if (el.tagName === 'LINK') {
        return {
          kind: 'link',
          href: el.href,
          isTheme: el.id === 'liferayThemeCSS' || el.classList.contains('lfr-css-file'),
          isMain: /main\.css/i.test(el.href),
          inHead: !!el.closest('head'),
        };
      }
      return {
        kind: 'style',
        text: el.textContent || '',
      };
    });
  });
}

/**
 * Download linked CSS in document order, capture inline <style> into page-inline.css,
 * write page-root detected-css.json.
 * @returns {Promise<{ catalog: object, downloaded: { file: string, href: string, score: number }[], reused?: boolean }>}
 */
async function materializeDetectedCss(
  page,
  pageDir,
  { maxCssFiles = MAX_CSS_FILES, force = null } = {},
) {
  if (!shouldForce(force, 'css')) {
    const reused = await tryReuseDetectedCss(pageDir);
    if (reused) return reused;
  }

  const cssDir = path.join(pageDir, 'css');
  await mkdir(cssDir, { recursive: true });

  const nodes = await collectCssNodesInDocumentOrder(page);
  /** @type {object[]} */
  const catalogFiles = [];
  /** @type {{ file: string, href: string, score: number }[]} */
  const downloaded = [];
  const usedNames = new Set();
  let downloadCount = 0;
  /** @type {string[]} */
  const inlineParts = [];
  let inlineOrder = null;
  let inlineBlocks = 0;

  for (let order = 0; order < nodes.length; order++) {
    const node = nodes[order];
    if (node.kind === 'style') {
      const text = (node.text || '').trim();
      if (!text) continue;
      if (inlineOrder == null) inlineOrder = order;
      inlineBlocks += 1;
      inlineParts.push(`/* --- inline style block ${inlineBlocks} (dom order ${order}) --- */\n${text}\n`);
      continue;
    }

    const href = node.href;
    const score = scoreStylesheet(href, node);
    if (score <= 0) {
      catalogFiles.push({
        order,
        href,
        file: null,
        score,
        status: 'skipped',
        source: 'link',
        reason: 'skip-pattern-or-low-score',
      });
      continue;
    }

    if (downloadCount >= maxCssFiles) {
      catalogFiles.push({
        order,
        href,
        file: null,
        score,
        status: 'skipped',
        source: 'link',
        reason: 'download-cap',
      });
      continue;
    }

    let fileName = sanitizeFilename(href);
    if (usedNames.has(fileName)) {
      fileName = `${downloadCount + 1}-${fileName}`;
    }
    usedNames.add(fileName);
    const destPath = path.join(cssDir, fileName);
    const cssText = await downloadStylesheet(page, href, destPath);
    if (!cssText) {
      catalogFiles.push({
        order,
        href,
        file: null,
        score,
        status: 'failed',
        source: 'link',
        reason: 'download failed',
      });
      continue;
    }

    const rel = path.join('css', fileName).replace(/\\/g, '/');
    downloadCount += 1;
    downloaded.push({ file: rel, href, score });
    catalogFiles.push({
      order,
      href,
      file: rel,
      score,
      status: 'downloaded',
      source: 'link',
    });
  }

  if (inlineParts.length) {
    const inlineRel = 'css/page-inline.css';
    await writeFile(path.join(pageDir, inlineRel), inlineParts.join('\n'), 'utf8');
    catalogFiles.push({
      order: inlineOrder ?? catalogFiles.length,
      href: null,
      file: inlineRel,
      status: 'downloaded',
      source: 'inline',
      inlineBlocks,
    });
    catalogFiles.sort((a, b) => a.order - b.order);
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    directory: 'css',
    files: catalogFiles,
  };
  await writeFile(
    path.join(pageDir, 'detected-css.json'),
    `${JSON.stringify(catalog, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `    … css: ${downloaded.length} link file(s), ${inlineBlocks} inline block(s) → detected-css.json`,
  );
  return { catalog, downloaded, reused: false };
}

async function tryReuseDetectedCss(pageDir) {
  try {
    const catalog = JSON.parse(await readFile(path.join(pageDir, 'detected-css.json'), 'utf8'));
    const files = catalog.files || [];
    const downloaded = [];
    for (const f of files) {
      if (f.status !== 'downloaded' || !f.file) continue;
      try {
        await access(path.join(pageDir, f.file));
      } catch {
        return null;
      }
      downloaded.push({
        file: f.file.replace(/\\/g, '/'),
        href: f.href || '',
        score: f.score ?? 0,
      });
    }
    if (!downloaded.length) return null;
    const inlineBlocks = files.filter((f) => f.source === 'inline').length;
    console.log(
      `    … css: reused ${downloaded.length} file(s) from detected-css.json` +
        (inlineBlocks ? ` (${inlineBlocks} inline)` : ''),
    );
    return { catalog, downloaded, reused: true };
  } catch {
    return null;
  }
}

export async function extractDesignTokensFromPage(page) {
  return page.evaluate(() => {
    const fontCounts = new Map();
    const colorUsage = [];
    const gradientUsage = [];
    const roleHints = { primary: null, secondary: null, accent: null };
    const cssVariables = {};

    function isExcluded(el) {
      return el?.closest?.(
        '#onetrust-banner-sdk, #onetrust-consent-sdk, .osano-cm-window, .osano-cm-dialog, .osano-cm-info-dialog, [class*="osano"], [id*="onetrust"], [class*="cookie-banner"], [class*="CookieBanner"], [id*="cookie-banner"]'
      );
    }

    function isSampleable(el) {
      if (!el || isExcluded(el)) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return false;
      return true;
    }

    function areaWeight(el) {
      const rect = el.getBoundingClientRect();
      return Math.min(Math.max(rect.width * rect.height, 0) / 8000, 40);
    }

    function recordColor(value, context, weight) {
      if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return;
      colorUsage.push({ color: value, context, weight });
    }

    function recordGradient(value, weight) {
      if (!value || value === 'none' || !/gradient/i.test(value)) return;
      const parts = [];
      for (const type of ['linear-gradient', 'radial-gradient', 'conic-gradient']) {
        const needle = `${type}(`;
        let searchFrom = 0;
        while (searchFrom < value.length) {
          const start = value.indexOf(needle, searchFrom);
          if (start === -1) break;
          let depth = 0;
          let end = start + type.length;
          for (; end < value.length; end++) {
            const ch = value[end];
            if (ch === '(') depth++;
            else if (ch === ')') {
              depth--;
              if (depth === 0) {
                parts.push(value.slice(start, end + 1));
                break;
              }
            }
          }
          searchFrom = end + 1;
        }
      }
      const list = parts.length ? parts : [value.trim()];
      for (const part of list) gradientUsage.push({ gradient: part, weight });
    }

    function recordElementColors(el, context, textContext, bgContext) {
      if (!isSampleable(el)) return;
      const cs = getComputedStyle(el);
      const area = areaWeight(el);
      if (cs.color) recordColor(cs.color, textContext || context, context === 'heading' ? 10 : 3);
      const bg = cs.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)') {
        recordColor(bg, bgContext || context, Math.max(area, context === 'heading' ? 3 : 5));
      }
      if (cs.backgroundImage && /gradient/i.test(cs.backgroundImage)) {
        recordGradient(cs.backgroundImage, Math.max(area, 8));
      }
    }

    const rootStyle = getComputedStyle(document.documentElement);
    for (let i = 0; i < rootStyle.length; i++) {
      const prop = rootStyle[i];
      if (!prop.startsWith('--')) continue;
      if (/^--(osano|onetrust|cookie|tw-|bs-|bootstrap|gpc-)/i.test(prop)) continue;
      if (
        prop.startsWith('--sc-') ||
        /color|brand|primary|secondary|accent|theme|background/i.test(prop)
      ) {
        const val = rootStyle.getPropertyValue(prop).trim();
        cssVariables[prop] = val;
        if (/gradient/i.test(prop) || /linear-gradient|radial-gradient/i.test(val)) {
          recordGradient(val, prop === '--sc-gradient' ? 30 : 18);
        }
      }
    }

    for (const el of document.querySelectorAll('[style]')) {
      if (!isSampleable(el)) continue;
      const style = el.getAttribute('style') || '';
      const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;!]+)/i);
      const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;!]+)/i);
      if (colorMatch) recordColor(colorMatch[1].trim(), 'body', 4);
      if (bgMatch) recordColor(bgMatch[1].trim(), 'sectionBg', 5);
    }

    for (const el of document.querySelectorAll('[data-bgcolor], [data-color], [data-background-color], [bgcolor]')) {
      if (!isSampleable(el)) continue;
      for (const attr of ['data-bgcolor', 'data-color', 'data-background-color', 'bgcolor']) {
        const val = el.getAttribute(attr);
        if (val) recordColor(val.trim(), 'sectionBg', 6);
      }
    }

    const seen = new Set();
    const selectors = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'header',
      'footer',
      'nav',
      'main',
      'section',
      'article',
      'p',
      'a',
      'button',
      '[class*="btn"]',
      '[class*="button"]',
      '[class*="hero"]',
      '[class*="announcement"]',
      '[class*="title"]',
      '[class*="heading"]',
      '[class*="cta"]',
      '.sc-announcement-bar',
    ];

    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (seen.has(el)) continue;
        seen.add(el);
        const tag = el.tagName.toLowerCase();
        const className = el.className?.toString() ?? '';
        const cs = getComputedStyle(el);

        if (isSampleable(el)) {
          const family = cs.fontFamily?.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
          if (family && family !== 'inherit') {
            fontCounts.set(family, (fontCounts.get(family) || 0) + 1);
          }
        }

        if (/^h[1-3]$/.test(tag)) {
          recordElementColors(el, 'heading', 'heading', 'sectionBg');
        } else if (tag === 'header') {
          recordElementColors(el, 'headerBg', 'navText', 'headerBg');
          if (isSampleable(el) && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            roleHints.secondary = cs.backgroundColor;
          }
        } else if (tag === 'nav') {
          recordElementColors(el, 'navText', 'navText', 'headerBg');
        } else if (tag === 'footer') {
          recordElementColors(el, 'footerBg', 'body', 'footerBg');
          if (isSampleable(el) && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            roleHints.secondary = cs.backgroundColor;
          }
        } else if (tag === 'main' || tag === 'section' || tag === 'article' || className.match(/hero/i)) {
          recordElementColors(el, 'sectionBg', 'body', 'sectionBg');
        } else if (tag === 'button' || className.match(/btn|button|cta/i)) {
          recordElementColors(el, 'button', 'button', 'button');
          if (isSampleable(el)) {
            const accent =
              cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : cs.color;
            if (accent) roleHints.accent = accent;
          }
        } else if (tag === 'a' && !el.closest('nav, header')) {
          recordElementColors(el, 'link', 'link', 'link');
          if (isSampleable(el) && className.match(/announcement|promo|banner/i)) {
            const bg = cs.backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)') recordColor(bg, 'sectionBg', 12);
          }
        } else if (tag === 'p' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
          recordElementColors(el, 'body', 'body', 'sectionBg');
        }
      }
    }

    return {
      fontCounts: [...fontCounts.entries()],
      colorUsage,
      gradientUsage,
      cssVariables,
      roleHints,
    };
  });
}

export function extractInlineColorsFromHtml(html) {
  /** @type {{ color: string, context: string, weight: number }[]} */
  const usage = [];
  if (!html || typeof html !== 'string') return usage;

  for (const match of html.matchAll(/\sstyle=(["'])([\s\S]*?)\1/gi)) {
    const style = match[2];
    const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;!]+)/i);
    const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;!]+)/i);
    if (colorMatch) usage.push({ color: colorMatch[1].trim(), context: 'body', weight: 3 });
    if (bgMatch) usage.push({ color: bgMatch[1].trim(), context: 'sectionBg', weight: 4 });
  }

  for (const match of html.matchAll(/\sdata-(?:bg|background-)?color=(["'])([^"']+)\1/gi)) {
    usage.push({ color: match[2].trim(), context: 'sectionBg', weight: 5 });
  }
  for (const match of html.matchAll(/\sbgcolor=(["']?)([^"'>\s]+)\1/gi)) {
    usage.push({ color: match[2].trim(), context: 'sectionBg', weight: 5 });
  }

  return usage;
}

async function downloadStylesheet(page, href, destPath) {
  try {
    const text = await page.evaluate(async (url) => {
      const response = await fetch(url);
      if (!response.ok) return null;
      return response.text();
    }, href);
    if (!text) return null;
    await writeFile(destPath, text, 'utf8');
    return text;
  } catch {
    return null;
  }
}

async function downloadBinary(page, href, destPath) {
  try {
    const payload = await page.evaluate(async (url) => {
      const response = await fetch(url);
      if (!response.ok) return null;
      const buf = await response.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    }, href);
    if (!payload) return false;
    await writeFile(destPath, Buffer.from(payload, 'base64'));
    return true;
  } catch {
    return false;
  }
}

async function fetchText(page, href) {
  try {
    return await page.evaluate(async (url) => {
      const response = await fetch(url);
      if (!response.ok) return null;
      return response.text();
    }, href);
  } catch {
    return null;
  }
}

/**
 * Download font binaries into `{pageDir}/fonts/` and write page-root `detected-fonts.json`.
 * @param {import('playwright').Page} page
 * @param {string} pageDir
 * @param {{ family: string, count: number, sources: string[] }[]} fontEntries
 * @param {{ force?: Set<string> | null }} [opts]
 */
async function materializeDetectedFonts(page, pageDir, fontEntries, { force = null } = {}) {
  if (!shouldForce(force, 'fonts')) {
    const reused = await tryReuseDetectedFonts(pageDir);
    if (reused) return reused;
  }

  const fontsDir = path.join(pageDir, 'fonts');
  await mkdir(fontsDir, { recursive: true });

  /** @type {Map<string, { href: string, file: string | null, format: string, status: string }>} */
  const byHref = new Map();
  /** @type {{ href: string, reason: string }[]} */
  const failed = [];
  const usedNames = new Set();
  let downloadedCount = 0;

  async function ensureFontFile(href) {
    if (byHref.has(href)) return byHref.get(href);
    if (!isFontFileUrl(href)) return null;

    let fileName = sanitizeFontFilename(href);
    if (usedNames.has(fileName)) {
      fileName = `${usedNames.size + 1}-${fileName}`;
    }
    usedNames.add(fileName);
    const destPath = path.join(fontsDir, fileName);
    const format = (href.match(/\.(woff2?|ttf|otf|eot|svg)/i) || [])[1]?.toLowerCase() || 'unknown';
    const ok = await downloadBinary(page, href, destPath);
    const entry = ok
      ? { href, file: path.join('fonts', fileName).replace(/\\/g, '/'), format, status: 'downloaded' }
      : { href, file: null, format, status: 'failed' };
    if (ok) downloadedCount += 1;
    else failed.push({ href, reason: 'download failed' });
    byHref.set(href, entry);
    return entry;
  }

  async function expandStylesheet(sheetHref) {
    const text = await fetchText(page, sheetHref);
    if (!text) {
      failed.push({ href: sheetHref, reason: 'stylesheet fetch failed' });
      return [];
    }
    const map = parseFontFaceSourcesFromCss(text, sheetHref);
    const fileUrls = [];
    for (const urls of map.values()) {
      for (const u of urls) {
        if (isFontFileUrl(u)) fileUrls.push(u);
      }
    }
    return fileUrls;
  }

  const catalogFonts = [];
  for (const { family, count, sources } of fontEntries) {
    /** @type {string[]} */
    const stylesheets = [];
    /** @type {Set<string>} */
    const fileHrefs = new Set();

    for (const src of sources || []) {
      if (isFontFileUrl(src)) {
        fileHrefs.add(src);
      } else if (isFontStylesheetUrl(src)) {
        stylesheets.push(src);
        for (const u of await expandStylesheet(src)) fileHrefs.add(u);
      } else if (src) {
        stylesheets.push(src);
      }
    }

    const files = [];
    for (const href of preferFontUrls([...fileHrefs])) {
      const entry = await ensureFontFile(href);
      if (!entry) continue;
      files.push(
        entry.status === 'downloaded'
          ? { href: entry.href, file: entry.file, format: entry.format, status: 'downloaded' }
          : { href: entry.href, format: entry.format, status: 'failed' },
      );
    }

    catalogFonts.push({
      family,
      count,
      files,
      stylesheets: [...new Set(stylesheets)],
    });
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    directory: 'fonts',
    fonts: catalogFonts,
    failed,
  };
  await writeFile(
    path.join(pageDir, 'detected-fonts.json'),
    `${JSON.stringify(catalog, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `    … fonts: ${downloadedCount} file(s), ${catalogFonts.length} families → detected-fonts.json`,
  );
  return catalog;
}

async function tryReuseDetectedFonts(pageDir) {
  try {
    const catalog = JSON.parse(await readFile(path.join(pageDir, 'detected-fonts.json'), 'utf8'));
    const fonts = catalog.fonts || [];
    if (!fonts.length) return null;
    for (const font of fonts) {
      for (const f of font.files || []) {
        if (f.status !== 'downloaded' || !f.file) continue;
        try {
          await access(path.join(pageDir, f.file));
        } catch {
          return null;
        }
      }
    }
    const fileCount = fonts.reduce(
      (n, font) => n + (font.files || []).filter((f) => f.status === 'downloaded' && f.file).length,
      0,
    );
    console.log(
      `    … fonts: reused ${fileCount} file(s), ${fonts.length} families from detected-fonts.json`,
    );
    return { ...catalog, reused: true };
  } catch {
    return null;
  }
}

/**
 * Materialize CSS/fonts (with --force reuse) and always run Azure ai-derived-design.md.
 * @param {import('playwright').Page | null} page — required when css/fonts need download
 * @param {string} pageDir
 * @param {{ force?: Set<string> | null, url?: string, maxCssFiles?: number }} [opts]
 */
export async function extractPageDesign(page, pageDir, opts = {}) {
  const { force = null, url = null, maxCssFiles = Number.MAX_SAFE_INTEGER } = opts;

  let picked;
  if (!page && !shouldForce(force, 'css')) {
    const reused = await tryReuseDetectedCss(pageDir);
    if (!reused) {
      throw new Error('CSS catalog incomplete and no Playwright page to download');
    }
    picked = reused.downloaded;
  } else if (!page) {
    throw new Error('Playwright page required to refresh CSS');
  } else {
    const { downloaded } = await materializeDetectedCss(page, pageDir, {
      maxCssFiles,
      force,
    });
    picked = downloaded;
  }

  const fontsReused =
    !shouldForce(force, 'fonts') ? await tryReuseDetectedFonts(pageDir) : null;

  if (!fontsReused) {
    if (!page) {
      throw new Error('Fonts catalog incomplete and no Playwright page to download');
    }

    const rawTokens = await extractDesignTokensFromPage(page);
    const fontCounts = new Map(rawTokens.fontCounts);
    const fontSourceMaps = [];

    try {
      const liveSources = await collectFontSourcesFromPage(page);
      fontSourceMaps.push(
        new Map(liveSources.map(({ family, sources }) => [family, new Set(sources)])),
      );
    } catch {
      /* optional */
    }

    let pageUrl = null;
    let pageHtml = null;
    try {
      const { resolveExistingPageHtml } = await import('./page-layout.mjs');
      const htmlPath = await resolveExistingPageHtml(pageDir);
      if (htmlPath) {
        pageHtml = await readFile(htmlPath, 'utf8');
        try {
          pageUrl = (await readFile(path.join(pageDir, 'source-url.txt'), 'utf8')).trim();
        } catch {
          pageUrl = page.url();
        }
        fontSourceMaps.push(extractFontSourcesFromHtml(pageHtml, pageUrl));
      } else {
        pageUrl = page.url();
      }
    } catch {
      pageUrl = page.url();
    }

    for (const file of picked) {
      try {
        const cssText = await readFile(path.join(pageDir, file.file), 'utf8');
        for (const font of parseFontFacesFromCss(cssText)) {
          fontCounts.set(font, (fontCounts.get(font) || 0) + 3);
        }
        fontSourceMaps.push(parseFontFaceSourcesFromCss(cssText, file.href));
      } catch {
        /* optional */
      }
    }

    try {
      const inlinePath = path.join(pageDir, 'css', 'page-inline.css');
      const inlineText = await readFile(inlinePath, 'utf8');
      for (const font of parseFontFacesFromCss(inlineText)) {
        fontCounts.set(font, (fontCounts.get(font) || 0) + 3);
      }
      fontSourceMaps.push(parseFontFaceSourcesFromCss(inlineText, pageUrl || page.url()));
    } catch {
      /* no page-inline.css */
    }

    const fontSources = mergeFontSourceMaps(...fontSourceMaps);

    const fonts = [...fontCounts.entries()]
      .filter(([family]) => !SYSTEM_FONTS.has(family))
      .sort((a, b) => b[1] - a[1])
      .map(([family, count]) => {
        const urls = fontSources.get(family) ?? new Set();
        const fileUrls = preferFontUrls([...urls].filter((u) => FONT_FILE_EXT.test(u)));
        const stylesheetUrls = [...urls].filter((u) => !FONT_FILE_EXT.test(u)).sort();
        const sources = [...fileUrls, ...stylesheetUrls];
        return { family, count, sources };
      })
      .slice(0, 20);

    await materializeDetectedFonts(page, pageDir, fonts, { force });
  }

  let pageUrlForAi = url;
  if (!pageUrlForAi) {
    try {
      pageUrlForAi = (await readFile(path.join(pageDir, 'source-url.txt'), 'utf8')).trim();
    } catch {
      pageUrlForAi = page?.url?.() || null;
    }
  }

  const aiResult = await generateAiDesignGuide(pageDir, {
    url: pageUrlForAi || undefined,
    force,
  });

  return {
    meta: {
      url: pageUrlForAi,
      generatedAt: new Date().toISOString(),
      purpose: 'ai-derived-design',
      aiUsed: Boolean(aiResult.ok),
      aiReused: Boolean(aiResult.reused),
      aiSkipReason: aiResult.skipReason || null,
      aiUsage: aiResult.usage || null,
      aiCostEstimate: aiResult.costEstimate || null,
      contentLanguage: aiResult.contentLanguage || null,
      aiOutputs: aiResult.ok ? { designMd: AI_DERIVED_DESIGN_MD } : null,
    },
    ai: aiResult,
  };
}

export { rgbToHex, isNeutralHex, normalizeFontFamily, dedupeGradients, normalizeGradientString };
