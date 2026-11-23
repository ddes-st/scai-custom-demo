/**
 * Save self-contained styled HTML snapshots for a captured section:
 * - section.html — primary: authored page CSS (fetched sheets + inline) + fonts/shell
 *   + per-viewport computed [data-bq-id] overlay (paint/pseudos; layout omitted when
 *   authored CSS is present) inside @media bands
 *   + open Shadow DOM flattened + ::before/::after materialized
 * - section.authored.css — scoped authored CSS only (AI / tooling; no computed overlay)
 * - section.styled.html / section.styled-{desktop|tablet|mobile}.html — optional legacy
 *   siblings when writeLegacySiblings is true (--styled-html)
 *
 * Note: browser helpers passed to page.evaluate must be self-contained (no outer refs).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { VIEWPORTS, ensureOverlayScrollbars } from './viewports.mjs';
import {
  SECTION_HTML,
  SECTION_AUTHORED_CSS,
  BQ_COMPUTED_OVERLAY_MARKER,
} from './section-html-files.mjs';
import { syncOpenStateFromLivePage } from './sync-open-state-into-html.mjs';
import { normalizeSectionHtmlSnapshot } from './section-html-normalize.mjs';
import {
  fetchSvgSheetViaPage,
  inlineSvgSpritesInHtml,
} from './inline-svg-sprites.mjs';

/** Soft cap so one section.html stays openable offline. */
const AUTHORED_CSS_MAX_CHARS = 1_500_000;

/** Layout / visual props worth capturing into viewport CSS maps. */
const COMPUTED_PROPS = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'overflow',
  'overflow-x',
  'overflow-y',
  'flex',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'align-items',
  'align-content',
  'align-self',
  'order',
  'gap',
  'row-gap',
  'column-gap',
  'grid',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'float',
  'clear',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration',
  'text-transform',
  'text-overflow',
  'white-space',
  'word-break',
  'color',
  'background',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'border-collapse',
  'outline',
  'box-shadow',
  'opacity',
  'visibility',
  'transform',
  'transform-origin',
  'filter',
  'backdrop-filter',
  'object-fit',
  'object-position',
  'cursor',
  'pointer-events',
  'vertical-align',
  'list-style',
  'appearance',
  'clip-path',
  'aspect-ratio',
];

/** @media bands aligned to Sitecore AI / capture VIEWPORTS (mobile &lt;768, tablet 768–1023, desktop ≥1024). */
const VIEWPORT_MEDIA = {
  desktop: '(min-width: 1024px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  mobile: '(max-width: 767px)',
};

const PSEUDO_PROPS = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'overflow',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration',
  'text-transform',
  'white-space',
  'color',
  'background',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'border',
  'border-radius',
  'box-shadow',
  'opacity',
  'visibility',
  'transform',
  'transform-origin',
  'filter',
  'pointer-events',
  'vertical-align',
];

function escapeHtmlComment(text) {
  return String(text || '').replace(/--/g, '—');
}

/**
 * Browser: collect :root custom properties + html/body inherited tokens.
 */
function collectPageShellCssInBrowser() {
  const shellProps = [
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'line-height',
    'letter-spacing',
    'color',
    'background-color',
    'background',
    '-webkit-font-smoothing',
    'text-rendering',
  ];
  const decls = (el, props) => {
    if (!(el instanceof Element)) return [];
    const cs = getComputedStyle(el);
    const out = [];
    for (const p of props) {
      const v = cs.getPropertyValue(p)?.trim();
      if (v) out.push(`${p}: ${v}`);
    }
    return out;
  };

  const root = document.documentElement;
  const body = document.body;
  const custom = [];
  const seenVars = new Set();
  const pushVar = (name, value) => {
    if (!name || !String(name).startsWith('--')) return;
    if (seenVars.has(name)) return;
    const v = String(value || '').trim();
    if (!v) return;
    seenVars.add(name);
    custom.push(`${name}: ${v}`);
  };

  try {
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!rules) continue;
      const walk = (list) => {
        for (const rule of list) {
          try {
            if (rule.type === CSSRule.STYLE_RULE && rule.style) {
              for (let i = 0; i < rule.style.length; i++) {
                const name = rule.style.item(i);
                if (name?.startsWith('--')) {
                  pushVar(name, rule.style.getPropertyValue(name));
                }
              }
              const cssText = rule.style.cssText || '';
              const re = /(--[\w-]+)\s*:\s*([^;]+)/g;
              let m;
              while ((m = re.exec(cssText))) {
                pushVar(m[1], m[2]);
              }
            } else if (rule.cssRules) {
              walk(rule.cssRules);
            }
          } catch {
            /* skip */
          }
        }
      };
      walk(rules);
    }
  } catch {
    /* ignore */
  }

  try {
    const rootCs = getComputedStyle(root);
    for (const name of [...seenVars]) {
      const resolved = rootCs.getPropertyValue(name)?.trim();
      if (resolved) {
        const idx = custom.findIndex((d) => d.startsWith(`${name}:`));
        if (idx >= 0) custom[idx] = `${name}: ${resolved}`;
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const inline = root.getAttribute('style') || '';
    for (const part of inline.split(';')) {
      const m = part.match(/^\s*(--[\w-]+)\s*:\s*(.+)\s*$/);
      if (m) pushVar(m[1], m[2]);
    }
  } catch {
    /* ignore */
  }

  let customOut = custom;
  const maxVars = 400;
  if (custom.length > maxVars) {
    const preferred = custom.filter((d) =>
      /^--(sc-|color-|font-|space-|size-|radius-|shadow-|tw-)/i.test(d),
    );
    const rest = custom.filter((d) => !preferred.includes(d));
    customOut = [...preferred, ...rest].slice(0, maxVars);
  }

  const blocks = [];
  if (customOut.length) {
    blocks.push(`:root {\n  ${customOut.join(';\n  ')};\n}`);
  }
  const htmlDecls = decls(root, shellProps);
  blocks.push(
    `html {\n  margin: 0;\n${htmlDecls.length ? `  ${htmlDecls.join(';\n  ')};\n` : ''}}`,
  );
  const bodyDecls = decls(body, shellProps);
  blocks.push(
    `body {\n  margin: 0;\n${bodyDecls.length ? `  ${bodyDecls.join(';\n  ')};\n` : ''}}`,
  );
  return blocks.join('\n\n');
}

/**
 * @param {string} pageDir — capture page root (fonts/ + detected-fonts.json)
 * @param {string} sectionDir — directory that will contain section.html
 *   (sections/N/ or sections/N/states/slug/) so url() depth is correct
 */
async function buildFontFaceCss(pageDir, sectionDir) {
  /** @type {string[]} */
  const faces = [];
  try {
    const raw = await readFile(path.join(pageDir, 'detected-fonts.json'), 'utf8');
    const catalog = JSON.parse(raw);
    const fonts = Array.isArray(catalog?.fonts) ? catalog.fonts : [];
    const formatHint = (fmt, file) => {
      const f = String(fmt || '').toLowerCase() || (file.match(/\.(\w+)$/) || [])[1] || '';
      if (f === 'woff2') return 'woff2';
      if (f === 'woff') return 'woff';
      if (f === 'ttf' || f === 'truetype') return 'truetype';
      if (f === 'otf' || f === 'opentype') return 'opentype';
      return f || 'woff2';
    };
    const outDir = sectionDir || pageDir;
    for (const entry of fonts) {
      const family = String(entry?.family || '').trim();
      if (!family || /fallback/i.test(family)) continue;
      const files = Array.isArray(entry.files) ? entry.files : [];
      for (const file of files) {
        if (!file || file.status === 'failed' || !file.file) continue;
        const rel = String(file.file).replace(/\\/g, '/');
        const absFont = path.resolve(
          pageDir,
          rel.startsWith('fonts/') ? rel : path.join('fonts', path.basename(rel)),
        );
        // Works for sections/N/ (../../fonts) and sections/N/states/slug/ (../../../fonts)
        let url = path.relative(outDir, absFont).replace(/\\/g, '/');
        if (!url.startsWith('.') && !url.startsWith('/')) url = `./${url}`;
        const fmt = formatHint(file.format, rel);
        const fam = family.includes(' ') ? `"${family.replace(/"/g, '')}"` : family;
        faces.push(
          `@font-face {\n  font-family: ${fam};\n  src: url("${url}") format("${fmt}");\n  font-display: swap;\n}`,
        );
      }
    }
  } catch {
    /* no catalog */
  }
  return faces.join('\n\n');
}

function mergeStyleCss(...parts) {
  return parts
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Fetch CSS text via Playwright request API (bypasses CORS), fall back to in-page fetch.
 * @param {import('playwright').Page} page
 * @param {string} href
 */
async function fetchCssText(page, href) {
  if (!href) return null;
  try {
    const res = await page.request.get(href, { timeout: 45000 });
    if (res.ok()) {
      const text = await res.text();
      if (text && text.trim()) return text;
    }
  } catch {
    /* try in-page */
  }
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
 * Collect authored page CSS: disk css/ catalog + live link stylesheets + inline <style>.
 * @param {import('playwright').Page} page
 * @param {string} pageDir
 * @returns {Promise<{ css: string, sheetCount: number, inlineBlocks: number, fromDisk: number, bytes: number }>}
 */
async function collectAuthoredPageCss(page, pageDir) {
  /** @type {string[]} */
  const parts = [];
  let sheetCount = 0;
  let inlineBlocks = 0;
  let fromDisk = 0;
  /** @type {Set<string>} */
  const seenHref = new Set();

  // Catalog: prefer known download order + original href for url() resolution
  try {
    const raw = await readFile(path.join(pageDir, 'detected-css.json'), 'utf8');
    const catalog = JSON.parse(raw);
    const files = Array.isArray(catalog?.files) ? catalog.files : [];
    for (const entry of files) {
      if (entry?.status !== 'downloaded' || !entry.file) continue;
      const abs = path.join(pageDir, entry.file);
      try {
        const text = await readFile(abs, 'utf8');
        if (!text.trim()) continue;
        const base = entry.href || page.url();
        if (entry.href) {
          seenHref.add(entry.href);
        }
        parts.push(
          `/* authored: ${entry.file}${entry.href ? ` ← ${entry.href}` : ' (inline)'} */\n${absolutizeCssUrls(text, base)}`,
        );
        fromDisk += 1;
        if (entry.source === 'inline') inlineBlocks += entry.inlineBlocks || 1;
        else sheetCount += 1;
      } catch {
        /* missing file */
      }
    }
  } catch {
    /* no catalog — try listing css/ */
    try {
      const cssDir = path.join(pageDir, 'css');
      const names = (await readdir(cssDir)).filter((n) => n.endsWith('.css')).sort();
      for (const name of names) {
        const text = await readFile(path.join(cssDir, name), 'utf8');
        if (!text.trim()) continue;
        parts.push(
          `/* authored: css/${name} */\n${absolutizeCssUrls(text, page.url())}`,
        );
        fromDisk += 1;
        if (name === 'page-inline.css') inlineBlocks += 1;
        else sheetCount += 1;
      }
    } catch {
      /* no css dir */
    }
  }

  // Live document: every stylesheet link + style tags (fills failed/missing CDN sheets)
  /** @type {{ hrefs: string[], inline: string[] }} */
  let live = { hrefs: [], inline: [] };
  try {
    live = await page.evaluate(() => {
      const hrefs = [...document.querySelectorAll('link[rel~="stylesheet"][href]')].map(
        (el) => el.href,
      );
      const inline = [...document.querySelectorAll('style')]
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean);
      return { hrefs, inline };
    });
  } catch {
    /* ignore */
  }

  for (const href of live.hrefs || []) {
    if (!href || seenHref.has(href)) continue;
    seenHref.add(href);
    const text = await fetchCssText(page, href);
    if (!text || !text.trim()) continue;
    parts.push(`/* authored fetch: ${href} */\n${absolutizeCssUrls(text, href)}`);
    sheetCount += 1;
  }

  // Prefer fresh inline from the live page when catalog had none or page changed
  if ((live.inline || []).length) {
    const joined = live.inline
      .map((t, i) => `/* --- live inline style block ${i + 1} --- */\n${t}`)
      .join('\n\n');
    parts.push(`/* authored: live inline */\n${absolutizeCssUrls(joined, page.url())}`);
    inlineBlocks = Math.max(inlineBlocks, live.inline.length);
  }

  let css = parts.join('\n\n');
  if (css.length > AUTHORED_CSS_MAX_CHARS) {
    css =
      css.slice(0, AUTHORED_CSS_MAX_CHARS) +
      `\n\n/* authored CSS truncated at ${AUTHORED_CSS_MAX_CHARS} chars */\n`;
  }

  return {
    css,
    sheetCount,
    inlineBlocks,
    fromDisk,
    bytes: css.length,
  };
}

/**
 * Browser: filter authored CSS text to rules that match the section subtree.
 * Also keeps @font-face for used families and :root custom props referenced by kept rules.
 * Paint `url(...)` rules are kept only when that URL appears in the section's live
 * computed styles (captured before the filter sheet is injected) — see
 * authored-css-url-gate.mjs (algorithms mirrored here; page.evaluate is self-contained).
 * Self-contained for page.evaluate.
 * @param {{ sel: string, cssText: string }} opts
 */
function filterAuthoredCssToSectionInBrowser({ sel, cssText }) {
  const root = (() => {
    try {
      return document.querySelector(sel);
    } catch {
      return null;
    }
  })();
  if (!(root instanceof Element) || !cssText || !String(cssText).trim()) {
    return {
      css: '',
      rulesKept: 0,
      fontFaces: 0,
      rootVars: 0,
      rawBytes: 0,
      urlRulesDropped: 0,
    };
  }

  const rawBytes = String(cssText).length;

  const collectNodesDeep = (el, out = []) => {
    out.push(el);
    for (const child of el.querySelectorAll('*')) out.push(child);
    return out;
  };
  const nodes = collectNodesDeep(root);

  // --- Paint-url gate helpers (keep in sync with authored-css-url-gate.mjs) ---
  const PAINT_URL_PROPS = [
    'background-image',
    'background',
    'list-style-image',
    'content',
    'mask-image',
    '-webkit-mask-image',
    'border-image-source',
  ];
  const normalizeCssUrlToken = (raw) => {
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
    try {
      const u = new URL(s);
      u.hash = '';
      return u.href;
    } catch {
      return s;
    }
  };
  const extractCssUrls = (value) => {
    const t = String(value || '');
    if (!t || !/url\s*\(/i.test(t)) return [];
    /** @type {string[]} */
    const out = [];
    for (const m of t.matchAll(/url\s*\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) {
      const inner = String(m[2] || '').trim();
      if (inner) out.push(inner);
    }
    return out;
  };
  const extractPaintUrlsFromStyleCssText = (styleCssText) => {
    const t = String(styleCssText || '');
    if (!t || !/url\s*\(/i.test(t)) return [];
    /** @type {Set<string>} */
    const urls = new Set();
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
    if (!urls.size) {
      for (const u of extractCssUrls(t)) {
        const n = normalizeCssUrlToken(u);
        if (n) urls.add(n);
      }
    }
    return [...urls];
  };

  // Snapshot live computed paint urls BEFORE injecting the filter stylesheet
  // (injection would otherwise self-evidence leaked rules).
  /** @type {Set<string>} */
  const evidencedPaintUrls = new Set();
  const noteComputedPaint = (cs) => {
    if (!cs) return;
    for (const prop of PAINT_URL_PROPS) {
      let v = '';
      try {
        v = cs.getPropertyValue(prop) || '';
      } catch {
        v = '';
      }
      if (!v && prop === 'background') {
        try {
          v = cs.backgroundImage || '';
        } catch {
          /* ignore */
        }
      }
      for (const u of extractCssUrls(v)) {
        const n = normalizeCssUrlToken(u);
        if (n && n !== 'none') evidencedPaintUrls.add(n);
      }
    }
  };
  try {
    for (const n of nodes) {
      noteComputedPaint(getComputedStyle(n));
      try {
        noteComputedPaint(getComputedStyle(n, '::before'));
        noteComputedPaint(getComputedStyle(n, '::after'));
      } catch {
        /* ignore pseudo */
      }
    }
  } catch {
    /* ignore */
  }

  const style = document.createElement('style');
  style.setAttribute('data-bq-css-filter', '1');
  style.textContent = cssText;
  document.documentElement.appendChild(style);

  /** @type {CSSStyleSheet|null} */
  let sheet = null;
  try {
    sheet = style.sheet;
  } catch {
    sheet = null;
  }
  if (!sheet) {
    style.remove();
    return {
      css: '',
      rulesKept: 0,
      fontFaces: 0,
      rootVars: 0,
      rawBytes,
      urlRulesDropped: 0,
      error: 'sheet unavailable',
    };
  }

  const matchesSubtree = (selectorText) => {
    if (!selectorText) return false;
    const parts = selectorText.split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      // Strip real pseudos (:hover, ::before) but keep Tailwind escaped variants
      // (.md\:static, .hover\:bg-*) — a naive /::?[a-z]+/ eats ":static" from "md\:static".
      const cleaned = part
        .replace(/(?<!\\)::?[a-zA-Z-]+(\([^)]*\))?/g, '')
        .replace(/(?<!\\):host(?:\([^)]*\))?/g, '')
        .trim();
      if (!cleaned) continue;
      try {
        if (root.matches(cleaned) || root.querySelector(cleaned)) return true;
      } catch {
        /* invalid */
      }
      try {
        const hit = document.querySelector(cleaned);
        if (hit && (hit === root || root.contains(hit))) return true;
      } catch {
        /* ignore */
      }
      try {
        for (const n of nodes) {
          if (n.matches(cleaned)) return true;
        }
      } catch {
        /* ignore */
      }
    }
    return false;
  };

  /** @type {string[]} */
  const collected = [];
  const seen = new Set();
  const pushBlock = (text) => {
    const t = String(text || '').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    collected.push(t);
  };

  /** @type {string[]} */
  const allFontFaces = [];
  /** @type {{ selector: string, cssText: string, wrappers: string[] }[]} */
  const rootVarBlocks = [];
  const usedVars = new Set();
  const usedFonts = new Set();
  let urlRulesDropped = 0;

  const noteUsage = (cssTextInner) => {
    const t = String(cssTextInner || '');
    for (const m of t.matchAll(/var\(\s*(--[\w-]+)/gi)) {
      if (m[1]) usedVars.add(m[1].toLowerCase());
    }
    for (const m of t.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
      const fam = String(m[1] || '')
        .replace(/["']/g, '')
        .split(',')[0]
        .trim()
        .toLowerCase();
      if (fam && fam !== 'inherit' && fam !== 'initial') usedFonts.add(fam);
    }
  };

  try {
    for (const n of nodes) {
      const ff = getComputedStyle(n).fontFamily || '';
      for (const part of ff.split(',')) {
        const fam = part.replace(/["']/g, '').trim().toLowerCase();
        if (fam) usedFonts.add(fam);
      }
    }
  } catch {
    /* ignore */
  }

  const walkRules = (rules, wrappers = []) => {
    if (!rules) return;
    for (const rule of rules) {
      try {
        if (rule.type === CSSRule.STYLE_RULE) {
          const selText = rule.selectorText || '';
          const isRootish = /^\s*(:root|html)\b/i.test(selText.trim());
          if (isRootish) {
            rootVarBlocks.push({
              selector: selText,
              cssText: rule.style.cssText,
              wrappers: [...wrappers],
            });
            continue;
          }
          if (matchesSubtree(selText)) {
            const styleText = rule.style.cssText || '';
            const paintUrls = extractPaintUrlsFromStyleCssText(styleText);
            if (paintUrls.length) {
              const evidenced = paintUrls.some((u) => evidencedPaintUrls.has(u));
              if (!evidenced) {
                urlRulesDropped += 1;
                continue;
              }
            }
            noteUsage(styleText);
            const inner = `${selText} { ${styleText} }`;
            if (wrappers.length) {
              let block = inner;
              for (let wi = wrappers.length - 1; wi >= 0; wi--) {
                block = `${wrappers[wi]} {\n${block}\n}`;
              }
              pushBlock(block);
            } else {
              pushBlock(inner);
            }
          }
        } else if (rule.type === CSSRule.FONT_FACE_RULE) {
          allFontFaces.push(rule.cssText);
        } else if (
          rule.type === CSSRule.MEDIA_RULE ||
          rule.type === CSSRule.SUPPORTS_RULE ||
          (typeof CSSRule.CONTAINER_RULE === 'number' && rule.type === CSSRule.CONTAINER_RULE)
        ) {
          const header =
            rule.type === CSSRule.MEDIA_RULE
              ? `@media ${rule.conditionText || rule.media?.mediaText || ''}`
              : rule.type === CSSRule.SUPPORTS_RULE
                ? `@supports ${rule.conditionText || ''}`
                : rule.cssText?.split('{')[0]?.trim() || '@container';
          walkRules(rule.cssRules, [...wrappers, header]);
        }
      } catch {
        /* skip rule */
      }
    }
  };

  try {
    walkRules(sheet.cssRules);
  } catch {
    /* ignore */
  }

  let fontFacesKept = 0;
  for (const ff of allFontFaces) {
    const m = ff.match(/font-family\s*:\s*([^;}{]+)/i);
    const fam = m
      ? String(m[1]).replace(/["']/g, '').split(',')[0].trim().toLowerCase()
      : '';
    const used =
      !fam ||
      usedFonts.has(fam) ||
      [...usedFonts].some((u) => u.includes(fam) || fam.includes(u));
    if (!used) continue;
    if (!seen.has(ff)) {
      seen.add(ff);
      collected.unshift(ff);
      fontFacesKept += 1;
    }
  }

  let rootVarsKept = 0;
  for (const block of rootVarBlocks) {
    const decls = String(block.cssText || '')
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean);
    const keepDecls = decls.filter((d) => {
      const name = d.split(':')[0]?.trim().toLowerCase();
      return name && usedVars.has(name);
    });
    if (!keepDecls.length) continue;
    let inner = `${block.selector} { ${keepDecls.join('; ')}; }`;
    if (block.wrappers?.length) {
      for (let wi = block.wrappers.length - 1; wi >= 0; wi--) {
        inner = `${block.wrappers[wi]} {\n${inner}\n}`;
      }
    }
    pushBlock(inner);
    rootVarsKept += keepDecls.length;
  }

  style.remove();

  return {
    css: collected.join('\n\n'),
    rulesKept: collected.length,
    fontFaces: fontFacesKept,
    rootVars: rootVarsKept,
    rawBytes,
    urlRulesDropped,
  };
}

/**
 * Pull leading / embedded `<style>` blocks out of a body fragment so DOM structure
 * comes first (prefix truncation keeps markup; CSS can trail).
 * @param {string} html
 * @returns {{ structureHtml: string, hoistedStyles: string }}
 */
export function hoistStylesToEnd(html) {
  const raw = String(html || '');
  if (!raw.trim()) return { structureHtml: '', hoistedStyles: '' };
  /** @type {string[]} */
  const styles = [];
  const structureHtml = raw.replace(
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    (block) => {
      styles.push(block);
      return '';
    },
  );
  return {
    structureHtml: structureHtml.trim() || '<!-- empty -->',
    hoistedStyles: styles.join('\n'),
  };
}

/**
 * Self-contained section snapshot: minimal head, DOM first, all CSS at end of body.
 * Structure-before-styles so AI prefix truncation keeps real markup.
 */
export function wrapMiniDocument({ title, styleCss, bodyHtml, headerComment }) {
  const comment = headerComment
    ? `<!-- ${escapeHtmlComment(headerComment)} -->\n`
    : '';
  const { structureHtml, hoistedStyles } = hoistStylesToEnd(bodyHtml || '');
  const packedCss = [String(styleCss || '').trim(), hoistedStyles.trim()]
    .filter(Boolean)
    .join('\n\n');
  const styleBlock = packedCss
    ? `<style type="text/css">\n${packedCss}\n</style>\n`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtmlComment(title)}</title>
${comment}</head>
<body>
${structureHtml}
${styleBlock}</body>
</html>
`;
}

function absolutizeCssUrls(css, baseHref) {
  if (!css || !baseHref) return css || '';
  return String(css).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, q, raw) => {
    const u = String(raw || '').trim();
    if (!u || u.startsWith('data:') || u.startsWith('blob:') || /^[a-z]+:/i.test(u)) {
      return full;
    }
    try {
      const abs = new URL(u, baseHref).href;
      return `url(${q || '"'}${abs}${q || '"'})`;
    } catch {
      return full;
    }
  });
}

/**
 * Browser: at current viewport — style maps keyed by data-bq-id, optionally also
 * build flattened DOM skeleton (includeStructure) with stamped ids + materialized pseudos.
 * Self-contained for page.evaluate.
 *
 * stampIds: write data-bq-id on the live tree (desktop pass).
 * reuseStampedIds: key styles by existing data-bq-id (tablet/mobile). Critical for
 * dual-chrome sections — tree walk order changes across breakpoints, so index-based
 * ids mis-assign mobile absolute/paint onto the wrong desktop nodes (orphan accordion
 * headers, collapsed media, etc.).
 */
function captureViewportStyledSnapshotInBrowser({
  sel,
  props,
  pseudoProps,
  includeStructure,
  omitLayoutLengths = false,
  stampIds = false,
  reuseStampedIds = false,
}) {
  const root = (() => {
    try {
      return document.querySelector(sel);
    } catch {
      return null;
    }
  })();
  if (!(root instanceof Element)) return null;

  const baseHref = document.baseURI || location.href;

  const absolutizeAttrUrl = (value) => {
    const v = String(value || '').trim();
    if (!v || v.startsWith('data:') || v.startsWith('blob:') || v.startsWith('#') || /^[a-z]+:/i.test(v)) {
      return v;
    }
    try {
      return new URL(v, baseHref).href;
    } catch {
      return v;
    }
  };

  const absolutizeSrcset = (value) => {
    return String(value || '')
      .split(',')
      .map((part) => {
        const bits = part.trim().split(/\s+/);
        if (!bits[0]) return part.trim();
        bits[0] = absolutizeAttrUrl(bits[0]);
        return bits.join(' ');
      })
      .filter(Boolean)
      .join(', ');
  };

  const absolutizeStyleUrls = (styleText) => {
    return String(styleText || '').replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, q, raw) => {
      const abs = absolutizeAttrUrl(raw);
      if (abs === raw) return full;
      return `url(${q || '"'}${abs}${q || '"'})`;
    });
  };

  const applyAbsolutize = (el) => {
    if (!(el instanceof Element)) return;
    for (const attr of ['src', 'href', 'poster', 'data-src']) {
      if (el.hasAttribute(attr)) {
        el.setAttribute(attr, absolutizeAttrUrl(el.getAttribute(attr)));
      }
    }
    if (el.hasAttribute('srcset')) {
      el.setAttribute('srcset', absolutizeSrcset(el.getAttribute('srcset')));
    }
    const st = el.getAttribute('style');
    if (st) el.setAttribute('style', absolutizeStyleUrls(st));
  };

  const parsePseudoContent = (raw) => {
    const c = String(raw || '').trim();
    if (!c || c === 'none' || c === 'normal') return null;
    if (/^(url|counter|counters|attr)\(/i.test(c)) return null;
    const m = c.match(/^(['"])([\s\S]*)\1$/);
    if (!m) return null;
    let s = m[2];
    if (!s) return { kind: 'empty', value: '' };
    s = s.replace(/\\([0-9a-fA-F]{1,6})(\s)?/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    );
    s = s.replace(/\\(.)/g, '$1');
    return { kind: 'text', value: s };
  };

  const defaultsCache = new Map();
  const defaultFor = (tag) => {
    const key = tag.toLowerCase();
    if (defaultsCache.has(key)) return defaultsCache.get(key);
    const probe = document.createElement(key);
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const map = {};
    for (const p of props) map[p] = cs.getPropertyValue(p);
    probe.remove();
    defaultsCache.set(key, map);
    return map;
  };

  /** Rasterize a single glyph with the live computed font → PNG data-URL. */
  const rasterizeGlyph = (pcs, text) => {
    if (!text || [...text].length !== 1) return null;
    const fontSize = pcs.getPropertyValue('font-size') || '12px';
    const fontFamily = pcs.getPropertyValue('font-family') || 'sans-serif';
    const fontWeight = pcs.getPropertyValue('font-weight') || '400';
    const fontStyle = pcs.getPropertyValue('font-style') || 'normal';
    const color = pcs.getPropertyValue('color') || '#000';
    const px = Math.max(8, Math.ceil(parseFloat(fontSize) || 12));
    const canvas = document.createElement('canvas');
    const pad = 2;
    canvas.width = px + pad * 2;
    canvas.height = px + pad * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    try {
      return {
        dataUrl: canvas.toDataURL('image/png'),
        widthPx: `${canvas.width}px`,
        heightPx: `${canvas.height}px`,
      };
    } catch {
      return null;
    }
  };

  /**
   * Build prop→value map from computed style (object, not CSS text).
   * When omitLayoutLengths: skip used px layout so authored CSS can own fluid layout.
   * Otherwise: normal-flow fluid widths; stretching controls keep width:100%.
   */
  const mapFromComputed = (cs, defaults, propList, opts = {}) => {
    const {
      forPseudo = false,
      always = new Set(),
      isRoot = false,
      parentContentWidth = 0,
      omitLayout = false,
    } = opts;
    const pos = (cs.getPropertyValue('position') || '').trim();
    const display = (cs.getPropertyValue('display') || '').trim();
    const isOutOfFlow = pos === 'absolute' || pos === 'fixed';
    const isInlineLevel =
      display === 'inline' || display === 'inline-block' || display === 'inline-flex';
    const width = (cs.getPropertyValue('width') || '').trim();
    const height = (cs.getPropertyValue('height') || '').trim();
    const left = (cs.getPropertyValue('left') || '').trim();
    const top = (cs.getPropertyValue('top') || '').trim();
    const maxWidth = (cs.getPropertyValue('max-width') || '').trim();
    const ml = (cs.getPropertyValue('margin-left') || '').trim();
    const mr = (cs.getPropertyValue('margin-right') || '').trim();
    const widthPx = parseFloat(width) || 0;
    const fillsParent =
      parentContentWidth > 0 && widthPx > 0 && widthPx >= parentContentWidth * 0.85;
    const hasMax = Boolean(maxWidth) && maxWidth !== 'none' && maxWidth !== '0px';
    const symmetricMargins =
      Boolean(ml) && Boolean(mr) && ml === mr && (parseFloat(ml) || 0) > 0;

    const skipProps = new Set();
    if (omitLayout && !forPseudo) {
      // Authored CSS owns fluid layout — do not freeze used lengths.
      // Also skip insets/position/translate: baking left:NNpx for right-0 / md:static
      // controls (carousel arrows) pins them mid-card in section-html screenshots.
      for (const p of [
        'width',
        'height',
        'min-width',
        'min-height',
        'max-width',
        'max-height',
        'margin-top',
        'margin-right',
        'margin-bottom',
        'margin-left',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
        'font-size',
        'line-height',
        'letter-spacing',
        'gap',
        'row-gap',
        'column-gap',
        'flex-basis',
        'transform-origin',
        // Insets + position: trust Tailwind absolute/static/right-0/left-0/top-1/2
        'top',
        'right',
        'bottom',
        'left',
        'position',
        // Used grid tracks freeze the section narrower than live (carousel arrows drift)
        'grid',
        'grid-template-columns',
        'grid-template-rows',
      ]) {
        skipProps.add(p);
      }
    } else if (isOutOfFlow) {
      if (width && width !== 'auto' && left && left !== 'auto') skipProps.add('right');
      if (height && height !== 'auto' && top && top !== 'auto') skipProps.add('bottom');
    } else {
      // Never freeze used height / transform-origin in normal flow
      skipProps.add('height');
      skipProps.add('transform-origin');
      // Replace used width with fluid rules below (always skip raw used px width)
      skipProps.add('width');
      if (symmetricMargins || hasMax || isRoot || fillsParent) {
        skipProps.add('margin-left');
        skipProps.add('margin-right');
      }
    }

    /** @type {Record<string, string>} */
    const out = {};
    for (const prop of propList) {
      if (prop === 'content') continue;
      if (skipProps.has(prop)) continue;
      let val = cs.getPropertyValue(prop);
      if (!val) continue;
      if (
        isOutOfFlow &&
        (prop === 'top' || prop === 'right' || prop === 'bottom' || prop === 'left') &&
        val === 'auto'
      ) {
        continue;
      }
      if (
        forPseudo &&
        !always.has(prop) &&
        prop !== 'display' &&
        prop !== 'position' &&
        prop !== 'top' &&
        prop !== 'right' &&
        prop !== 'bottom' &&
        prop !== 'left' &&
        prop !== 'z-index' &&
        (val === 'auto' ||
          val === 'none' ||
          val === 'normal' ||
          val === 'static' ||
          val === 'visible' ||
          val === 'repeat' ||
          val === '0px')
      ) {
        continue;
      }
      const force = always.has(prop);
      if (!force && defaults && val === defaults[prop]) continue;
      if (isInertComputedValue(prop, val) && !force) continue;
      if (prop.includes('background') || prop.includes('image') || prop === 'list-style') {
        val = absolutizeStyleUrls(val);
      }
      // When authored CSS owns layout, drop pure translate transforms (e.g. -translate-y-1/2)
      // that pin controls to a capture-time matrix. Keep rotate/scale paints.
      if (
        omitLayout &&
        !forPseudo &&
        prop === 'transform' &&
        isPureTranslateTransform(val)
      ) {
        continue;
      }
      out[prop] = val;
    }

    pruneRedundantBorderLonghands(out);
    pruneRedundantBackgroundShorthand(out);

    // Fluid width / centering only when we are the layout authority (no authored CSS)
    if (!omitLayout && !isOutOfFlow && !forPseudo) {
      if (isRoot || hasMax || symmetricMargins) {
        out.width = '100%';
        out['box-sizing'] = out['box-sizing'] || 'border-box';
        if (hasMax) out['max-width'] = maxWidth;
        if (symmetricMargins || hasMax || isRoot) {
          out['margin-left'] = 'auto';
          out['margin-right'] = 'auto';
        }
      }
      // Stretching control (full-width button on tablet/mobile)
      if (fillsParent) {
        out.width = '100%';
        out['box-sizing'] = 'border-box';
        if (isInlineLevel) out.display = display;
      }
    }

    return out;
  };

  /**
   * True when transform is only a 2D translate (incl. matrix tx/ty with identity a/b/c/d).
   * Used with omitLayout so -translate-y-1/2 etc. stay under authored utilities.
   */
  function isPureTranslateTransform(val) {
    const v = String(val || '').trim().toLowerCase();
    if (!v || v === 'none') return true;
    if (/^translate(3d|x|y|z)?\(/i.test(v)) {
      // translate(...) with no other functions in the list
      return !/[a-z]+\(/i.test(v.replace(/^translate(3d|x|y|z)?\([^)]*\)\s*/i, ''));
    }
    const m = v.match(
      /^matrix\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/,
    );
    if (m) {
      const nums = m.slice(1).map(Number);
      return nums[0] === 1 && nums[1] === 0 && nums[2] === 0 && nums[3] === 1;
    }
    // matrix3d identity linear part + translation only is uncommon in Tailwind; leave those
    return false;
  }

  /**
   * Skip UA-default-ish paint that fails exact defaults match because color inherits
   * (e.g. border: 0px none rgb(255,255,255) vs detached rgb(0,0,0)).
   */
  function isInertComputedValue(prop, val) {
    const v = String(val || '').trim().toLowerCase();
    if (!v) return true;

    if (prop === 'border' || /^border-(top|right|bottom|left)$/.test(prop)) {
      // "0px none …" / "none" / "medium none …"
      if (/\bnone\b/.test(v)) return true;
      if (/^0(px|em|rem|%)?\s/.test(v) && /\bnone\b/.test(v)) return true;
      return false;
    }
    if (prop === 'outline') {
      if (/\bnone\b/.test(v)) return true;
      return false;
    }
    if (prop === 'list-style') {
      // "outside none none", "none", etc.
      const parts = v.split(/\s+/).filter(Boolean);
      if (parts.includes('none') && !parts.some((p) => p.startsWith('url('))) return true;
      return false;
    }
    if (prop === 'justify-content') {
      return v === 'normal';
    }
    if (prop === 'align-content') {
      return v === 'normal';
    }
    if (prop === 'transform') {
      // identity matrix / none
      if (v === 'none') return true;
      const m = v.match(
        /^matrix\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/,
      );
      if (m) {
        const nums = m.slice(1).map(Number);
        if (
          nums[0] === 1 &&
          nums[1] === 0 &&
          nums[2] === 0 &&
          nums[3] === 1 &&
          nums[4] === 0 &&
          nums[5] === 0
        ) {
          return true;
        }
      }
      return false;
    }
    if (prop === 'cursor') {
      return v === 'auto' || v === 'default';
    }
    if (prop === 'pointer-events') {
      return v === 'auto';
    }
    return false;
  }

  /** Drop border-* longhands when they duplicate `border` shorthand. */
  function pruneRedundantBorderLonghands(out) {
    const sh = out.border;
    if (!sh) return;
    for (const side of ['border-top', 'border-right', 'border-bottom', 'border-left']) {
      if (out[side] && out[side] === sh) delete out[side];
    }
  }

  /** Drop background-color when background shorthand already sets the same color. */
  function pruneRedundantBackgroundShorthand(out) {
    const bg = out.background;
    const bgc = out['background-color'];
    if (!bg || !bgc) return;
    if (bg === bgc || bg.startsWith(`${bgc} `) || bg.includes(` ${bgc} `)) {
      delete out['background-color'];
    }
  }

  const interestingPseudo = (pcs) => {
    const parsed = parsePseudoContent(pcs.getPropertyValue('content'));
    if (parsed == null) return null;
    const bg = (pcs.getPropertyValue('background-image') || '').trim();
    const hasBg = Boolean(bg && bg !== 'none');
    if (parsed.kind === 'empty' && !hasBg) return null;
    return parsed;
  };

  // Live tree (light + open shadow), stable order
  const liveList = [];
  const walkLive = (el) => {
    liveList.push(el);
    for (const child of el.children) walkLive(child);
    if (el.shadowRoot) {
      for (const child of el.shadowRoot.children) {
        if (child.tagName === 'STYLE' || child.tagName === 'LINK') continue;
        walkLive(child);
      }
    }
  };
  walkLive(root);

  /** @type {Record<string, Record<string, string>>} */
  const stylesById = {};
  /** @type {Array<{ liveIndex: number, which: string, id: string, text: string }>} */
  const pseudoPlan = [];

  for (let i = 0; i < liveList.length; i++) {
    const live = liveList[i];
    if (stampIds) {
      try {
        live.setAttribute('data-bq-id', String(i + 1));
      } catch {
        /* ignore */
      }
    }
    const stamped = (live.getAttribute('data-bq-id') || '').trim();
    // Never invent index ids when reusing — that remaps mobile styles onto wrong nodes
    if (reuseStampedIds && !stamped) continue;
    const id = stamped || String(i + 1);
    const cs = getComputedStyle(live);
    const defaults = defaultFor(live.tagName);
    const display = (cs.getPropertyValue('display') || '').trim();
    const always = new Set();
    if (display === 'inline' || display === 'inline-block' || display === 'inline-flex') {
      always.add('vertical-align');
    }
    if (display === 'flex' || display === 'inline-flex') {
      always.add('align-items');
      always.add('justify-content');
    }
    const textAlign = (cs.getPropertyValue('text-align') || '').trim();
    if (textAlign === 'center' || textAlign === 'right' || textAlign === 'justify') {
      always.add('text-align');
    }
    const textDecoration = (cs.getPropertyValue('text-decoration-line') || '').trim();
    if (textDecoration && textDecoration !== 'none') {
      always.add('text-decoration');
      always.add('text-decoration-line');
      always.add('text-decoration-color');
      always.add('text-decoration-style');
    } else if (live.tagName === 'A' || live.tagName === 'BUTTON') {
      // Prefer element's own decoration (e.g. none on button) over inherited underline
      always.add('text-decoration');
      always.add('text-decoration-line');
    }
    let parentContentWidth = 0;
    try {
      const parent = live.parentElement;
      if (parent) {
        const pcs = getComputedStyle(parent);
        const pl = parseFloat(pcs.paddingLeft) || 0;
        const pr = parseFloat(pcs.paddingRight) || 0;
        parentContentWidth = Math.max(0, parent.clientWidth - pl - pr);
      }
    } catch {
      /* ignore */
    }
    stylesById[id] = mapFromComputed(cs, defaults, props, {
      always,
      isRoot: live === root,
      parentContentWidth,
      omitLayout: omitLayoutLengths,
    });

    for (const which of ['::before', '::after']) {
      let pcs;
      try {
        pcs = getComputedStyle(live, which);
      } catch {
        continue;
      }
      const parsed = interestingPseudo(pcs);
      if (!parsed) continue;
      const pid = `${id}${which === '::before' ? 'b' : 'a'}`;
      const pmap = mapFromComputed(pcs, null, pseudoProps, {
        forPseudo: true,
        omitLayout: false,
      });
      // Icon-font / single-glyph: bake PNG data-URL so offline HTML shows the glyph
      if (parsed.kind === 'text' && [...parsed.value].length === 1) {
        const raster = rasterizeGlyph(pcs, parsed.value);
        if (raster) {
          pmap['background-image'] = `url("${raster.dataUrl}")`;
          pmap['background-repeat'] = 'no-repeat';
          pmap['background-position'] = 'center';
          pmap['background-size'] = 'contain';
          pmap.width = pmap.width || raster.widthPx;
          pmap.height = pmap.height || raster.heightPx;
          if (!pmap.display || pmap.display === 'inline') {
            pmap.display = 'inline-block';
          }
          // Hide any leftover glyph paint; data-URL is the sole visible mark
          pmap.color = 'transparent';
          pmap['-webkit-text-fill-color'] = 'transparent';
          pmap['font-size'] = '0';
          pmap['line-height'] = '0';
          pmap['text-decoration'] = 'none';
          pmap['text-decoration-line'] = 'none';
        }
      }
      stylesById[pid] = pmap;
      pseudoPlan.push({
        liveIndex: i,
        which,
        id: pid,
        // Empty text when rasterized — otherwise glyph + data-URL both paint (→→)
        text:
          parsed.kind === 'text' &&
          [...parsed.value].length === 1 &&
          stylesById[pid]['background-image']?.includes('data:image')
            ? ''
            : parsed.kind === 'text'
              ? parsed.value
              : '',
        glyph: parsed.kind === 'text' ? parsed.value : '',
      });
      // Ensure positioned host when absolute pseudo
      const pPos = pcs.getPropertyValue('position');
      if (pPos === 'absolute' || pPos === 'fixed') {
        const hostPos = cs.getPropertyValue('position');
        if (!hostPos || hostPos === 'static') {
          stylesById[id] = { ...stylesById[id], position: 'relative' };
        }
      }
      // Icon hosts inherit link underline — kill it so the mark is not a second “arrow”
      if (parsed.kind === 'text' && [...parsed.value].length === 1) {
        stylesById[id] = {
          ...stylesById[id],
          'text-decoration': 'none',
          'text-decoration-line': 'none',
        };
      }
    }
  }

  // Matched CSS + structure only when requested (desktop)
  let css = '';
  let shadowCss = '';
  let skippedSheets = 0;
  let truncated = false;
  let ruleCount = 0;
  let shadowHosts = 0;
  let closedSkipped = 0;
  let outerHTML = '';

  if (includeStructure) {
    const collectNodesDeep = (el, out = []) => {
      out.push(el);
      for (const child of el.querySelectorAll('*')) out.push(child);
      const walkShadow = (node) => {
        const sr = node.shadowRoot;
        if (!sr) return;
        for (const child of sr.querySelectorAll('*')) {
          out.push(child);
          walkShadow(child);
        }
      };
      walkShadow(el);
      for (const child of el.querySelectorAll('*')) walkShadow(child);
      return out;
    };
    const nodes = collectNodesDeep(root);
  const matchesSubtree = (selectorText) => {
      if (!selectorText) return false;
    const parts = selectorText.split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
        const cleaned = part
          .replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, '')
          .replace(/:host(?:\([^)]*\))?/g, '')
          .trim();
      if (!cleaned) continue;
      try {
        if (root.matches(cleaned) || root.querySelector(cleaned)) return true;
      } catch {
          /* invalid */
      }
      try {
        for (const n of nodes) {
          if (n.matches(cleaned)) return true;
        }
      } catch {
        /* ignore */
      }
    }
    return false;
  };

  const collected = [];
  const seen = new Set();
  const pushBlock = (text) => {
    const t = String(text || '').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    collected.push(t);
  };
  const walkRules = (rules, wrappers = []) => {
    if (!rules) return;
    for (const rule of rules) {
      try {
        if (rule.type === CSSRule.STYLE_RULE) {
          if (matchesSubtree(rule.selectorText)) {
            const inner = `${rule.selectorText} { ${rule.style.cssText} }`;
            if (wrappers.length) {
              let block = inner;
                for (let wi = wrappers.length - 1; wi >= 0; wi--) {
                  block = `${wrappers[wi]} {\n${block}\n}`;
              }
              pushBlock(block);
            } else {
              pushBlock(inner);
            }
          }
        } else if (
          rule.type === CSSRule.MEDIA_RULE ||
          rule.type === CSSRule.SUPPORTS_RULE ||
          (typeof CSSRule.CONTAINER_RULE === 'number' && rule.type === CSSRule.CONTAINER_RULE)
        ) {
          const header =
            rule.type === CSSRule.MEDIA_RULE
              ? `@media ${rule.conditionText || rule.media?.mediaText || ''}`
              : rule.type === CSSRule.SUPPORTS_RULE
                ? `@supports ${rule.conditionText || ''}`
                : rule.cssText?.split('{')[0]?.trim() || '@container';
          walkRules(rule.cssRules, [...wrappers, header]);
        }
      } catch {
          /* skip */
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try {
        walkRules(sheet.cssRules);
    } catch {
      skippedSheets += 1;
    }
  }
    css = collected.join('\n\n');
    ruleCount = collected.length;
    if (css.length > 500000) {
      css = `${css.slice(0, 500000)}\n\n/* truncated: matched CSS exceeded 500KB */`;
      truncated = true;
    }
    css = absolutizeStyleUrls(css);

    /** @type {string[]} */
    const shadowStyles = [];
    /** @type {Map<number, { before?: Element, after?: Element }>} */
    const pseudoSpansByLive = new Map();

    const deepClone = (el, liveIndexRef) => {
      if (!(el instanceof Element)) {
        return document.createTextNode(el?.textContent || '');
      }
      const myLiveIndex = liveIndexRef.i;
      liveIndexRef.i += 1;

      const clone = el.cloneNode(false);
      for (const attr of el.attributes || []) {
        try {
          clone.setAttribute(attr.name, attr.value);
        } catch {
          /* ignore */
        }
      }
      applyAbsolutize(clone);
      // Prefer live stamp so clone ids match tablet/mobile style maps
      const liveStamp = (el.getAttribute('data-bq-id') || '').trim();
      clone.setAttribute('data-bq-id', liveStamp || String(myLiveIndex + 1));

      // Drop capture-time portal geometry (video dialogs) that collapses media offline
      if (clone.tagName === 'DIALOG') {
        try {
          clone.removeAttribute('style');
          clone.removeAttribute('open');
        } catch {
          /* ignore */
        }
      }

      // Materialize pseudos for this live index (before children)
      const beforePlan = pseudoPlan.filter(
        (p) => p.liveIndex === myLiveIndex && p.which === '::before',
      );
      const afterPlan = pseudoPlan.filter(
        (p) => p.liveIndex === myLiveIndex && p.which === '::after',
      );
      const bucket = {};
      for (const p of beforePlan) {
        const span = document.createElement('span');
        span.setAttribute('aria-hidden', 'true');
        span.setAttribute('data-bq-pseudo', 'before');
        span.setAttribute('data-bq-id', p.id);
        if (p.glyph) span.setAttribute('data-bq-glyph', p.glyph);
        if (p.text) span.textContent = p.text;
        clone.appendChild(span);
        bucket.before = span;
      }

      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          clone.appendChild(document.createTextNode(child.textContent || ''));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          clone.appendChild(deepClone(/** @type {Element} */ (child), liveIndexRef));
        }
      }

      const sr = el.shadowRoot;
      if (sr) {
        shadowHosts += 1;
        const wrap = document.createElement('div');
        wrap.setAttribute('data-shadow-host', el.tagName.toLowerCase());
        wrap.setAttribute('data-shadow-flattened', 'true');
        for (const child of sr.childNodes) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = /** @type {Element} */ (child).tagName;
            if (tag === 'STYLE') {
              const text = /** @type {Element} */ (child).textContent || '';
              if (text.trim()) shadowStyles.push(absolutizeStyleUrls(text.trim()));
              continue;
            }
            if (tag === 'LINK') continue;
            wrap.appendChild(deepClone(/** @type {Element} */ (child), liveIndexRef));
          } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
            wrap.appendChild(document.createTextNode(child.textContent));
          }
        }
        if (wrap.childNodes.length) clone.appendChild(wrap);
      } else if (el.tagName.includes('-') && !el.childNodes.length) {
        closedSkipped += 1;
      }

      for (const p of afterPlan) {
        const span = document.createElement('span');
        span.setAttribute('aria-hidden', 'true');
        span.setAttribute('data-bq-pseudo', 'after');
        span.setAttribute('data-bq-id', p.id);
        if (p.glyph) span.setAttribute('data-bq-glyph', p.glyph);
        if (p.text) span.textContent = p.text;
        clone.appendChild(span);
        bucket.after = span;
      }
      if (bucket.before || bucket.after) pseudoSpansByLive.set(myLiveIndex, bucket);

      return clone;
    };

    const liveIndexRef = { i: 0 };
    const cloneRoot = deepClone(root, liveIndexRef);
    // deepClone increments for each light+shadow live node — must match liveList length
    if (cloneRoot instanceof Element) {
      outerHTML = cloneRoot.outerHTML;
    }
    shadowCss = shadowStyles.join('\n\n');
    void pseudoSpansByLive;
  }

  return {
    stylesById,
    pseudoPlan: includeStructure
      ? pseudoPlan.map((p) => ({ id: p.id, liveIndex: p.liveIndex, which: p.which }))
      : undefined,
    outerHTML,
    css,
    shadowCss,
    ruleCount,
    skippedSheets,
    truncated,
    shadowHosts,
    closedSkipped,
    liveCount: liveList.length,
    styleIdCount: Object.keys(stylesById).length,
  };
}

/**
 * Kill authored ::before/::after on hosts whose pseudos were materialized as spans,
 * so we do not paint the glyph twice (authored CSS + data-bq-pseudo).
 * @param {Array<{ liveIndex: number, which: string, id?: string }>|undefined} pseudoPlan
 */
function buildPseudoNeutralizeCss(pseudoPlan) {
  if (!Array.isArray(pseudoPlan) || !pseudoPlan.length) return '';
  /** @type {string[]} */
  const lines = [];
  const seen = new Set();
  for (const p of pseudoPlan) {
    const hostId = String((p.liveIndex ?? 0) + 1);
    const which = p.which === '::after' ? '::after' : '::before';
    const key = `${hostId}${which}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`[data-bq-id="${hostId}"]${which} { content: none !important; }`);
  }
  return lines.join('\n');
}

/**
 * Merge per-viewport style maps into shared + @media-banded [data-bq-id] CSS.
 * @param {Record<string, Record<string, Record<string, string>>>} mapsByDevice
 */
function buildBandedCssFromMaps(mapsByDevice) {
  const devices = ['desktop', 'tablet', 'mobile'];
  const allIds = new Set();
  for (const d of devices) {
    for (const id of Object.keys(mapsByDevice[d] || {})) allIds.add(id);
  }

  /** @type {string[]} */
  const sharedRules = [];
  /** @type {Record<string, string[]>} */
  const bandRules = { desktop: [], tablet: [], mobile: [] };

  const declsToCss = (obj) =>
    Object.entries(obj)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');

  for (const id of [...allIds].sort((a, b) => {
    const na = parseInt(String(a), 10) || 0;
    const nb = parseInt(String(b), 10) || 0;
    if (na !== nb) return na - nb;
    return String(a).localeCompare(String(b));
  })) {
    const d = mapsByDevice.desktop?.[id] || {};
    const t = mapsByDevice.tablet?.[id] || {};
    const m = mapsByDevice.mobile?.[id] || {};
    const props = new Set([...Object.keys(d), ...Object.keys(t), ...Object.keys(m)]);
    /** @type {Record<string, string>} */
    const shared = {};
    /** @type {Record<string, string>} */
    const dOnly = {};
    /** @type {Record<string, string>} */
    const tOnly = {};
    /** @type {Record<string, string>} */
    const mOnly = {};

    for (const p of props) {
      const dv = d[p];
      const tv = t[p];
      const mv = m[p];
      if (dv && tv && mv && dv === tv && tv === mv) {
        shared[p] = dv;
      } else {
        if (dv) dOnly[p] = dv;
        if (tv) tOnly[p] = tv;
        if (mv) mOnly[p] = mv;
      }
    }

    const sel = `[data-bq-id="${id}"]`;
    if (Object.keys(shared).length) {
      sharedRules.push(`${sel} {\n${declsToCss(shared)}\n}`);
    }
    if (Object.keys(dOnly).length) {
      bandRules.desktop.push(`${sel} {\n${declsToCss(dOnly)}\n}`);
    }
    if (Object.keys(tOnly).length) {
      bandRules.tablet.push(`${sel} {\n${declsToCss(tOnly)}\n}`);
    }
    if (Object.keys(mOnly).length) {
      bandRules.mobile.push(`${sel} {\n${declsToCss(mOnly)}\n}`);
    }
  }

  const parts = [];
  if (sharedRules.length) {
    parts.push(`/* shared across viewports */\n${sharedRules.join('\n\n')}`);
  }
  for (const device of devices) {
    const body = bandRules[device].join('\n\n');
    if (!body) continue;
    parts.push(`@media ${VIEWPORT_MEDIA[device]} {\n${body}\n}`);
  }
  return parts.join('\n\n');
}

/**
 * Browser: light-DOM computed inline for legacy per-viewport files.
 */
function inlineComputedLightDomInBrowser({ sel, props }) {
  const root = (() => {
    try {
      return document.querySelector(sel);
    } catch {
      return null;
    }
  })();
  if (!(root instanceof Element)) return null;

  const baseHref = document.baseURI || location.href;
  const absolutizeAttrUrl = (value) => {
    const v = String(value || '').trim();
    if (!v || v.startsWith('data:') || v.startsWith('blob:') || v.startsWith('#') || /^[a-z]+:/i.test(v)) {
      return v;
    }
    try {
      return new URL(v, baseHref).href;
    } catch {
      return v;
    }
  };
  const absolutizeStyleUrls = (styleText) => {
    return String(styleText || '').replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, q, raw) => {
      const abs = absolutizeAttrUrl(raw);
      if (abs === raw) return full;
      return `url(${q || '"'}${abs}${q || '"'})`;
    });
  };

  const defaultsCache = new Map();
  const defaultFor = (tag) => {
    const key = tag.toLowerCase();
    if (defaultsCache.has(key)) return defaultsCache.get(key);
    const probe = document.createElement(key);
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const map = {};
    for (const p of props) map[p] = cs.getPropertyValue(p);
    probe.remove();
    defaultsCache.set(key, map);
    return map;
  };

  const clone = root.cloneNode(true);
  const liveNodes = [root, ...root.querySelectorAll('*')];
  const cloneNodes = [clone, ...clone.querySelectorAll('*')];

  for (let i = 0; i < liveNodes.length && i < cloneNodes.length; i++) {
    const live = liveNodes[i];
    const node = cloneNodes[i];
    if (!(live instanceof Element) || !(node instanceof Element)) continue;
    if (live.tagName !== node.tagName) continue;
    for (const attr of ['src', 'href', 'poster']) {
      if (node.hasAttribute(attr)) {
        node.setAttribute(attr, absolutizeAttrUrl(node.getAttribute(attr)));
      }
    }
    const cs = getComputedStyle(live);
    const defaults = defaultFor(live.tagName);
    const parts = [];
    for (const prop of props) {
      let val = cs.getPropertyValue(prop);
      if (!val || val === defaults[prop]) continue;
      if (prop.includes('background') || prop.includes('image')) {
        val = absolutizeStyleUrls(val);
      }
      parts.push(`${prop}: ${val}`);
    }
    if (parts.length) {
      const existing = node.getAttribute('style') || '';
      node.setAttribute(
        'style',
        existing ? `${existing}; ${parts.join('; ')}` : parts.join('; '),
      );
    }
  }
  return clone.outerHTML;
}

/**
 * @param {import('playwright').Page} page
 * @param {object} opts
 * @param {string} opts.pageDir
 * @param {string} opts.sectionDir
 * @param {string} opts.sectionSelector
 * @param {string} [opts.folderName]
 * @param {boolean} [opts.writeLegacySiblings]
 * @param {(page: import('playwright').Page, device: string) => Promise<void>} [opts.beforeViewportSnapshot]
 *   Optional hook (e.g. re-open a tab) before each desktop/tablet/mobile style capture.
 * @param {string} [opts.preferredOpenLabel] — when set with beforeViewportSnapshot, sync
 *   dual desktop/narrow open-state into the structure clone (tabs/accordion).
 */
export async function saveSectionStyledHtml(page, opts) {
  const {
    pageDir,
    sectionDir,
    sectionSelector,
    folderName = 'section',
    writeLegacySiblings = false,
    beforeViewportSnapshot = null,
    preferredOpenLabel = '',
  } = opts;
  if (!sectionSelector) {
    return {
      sectionHtml: null,
      sectionStyledHtml: null,
      sectionStyledByViewport: null,
      errors: ['no selector'],
    };
  }

  /** @type {string[]} */
  const errors = [];
  /** @type {string|null} */
  let sectionHtmlRel = null;
  /** @type {string|null} */
  let sectionStyledHtml = null;
  /** @type {Record<string, string>|null} */
  let sectionStyledByViewport = null;

  const pageHref = page.url();
  const fontFaceCss = await buildFontFaceCss(pageDir, sectionDir);
  let shellCss = '';
  try {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.waitForTimeout(80);
    shellCss = (await page.evaluate(collectPageShellCssInBrowser)) || '';
  } catch (err) {
    errors.push(`styled: shell tokens — ${err instanceof Error ? err.message : err}`);
  }

  /** @type {{ css: string, sheetCount: number, inlineBlocks: number, fromDisk: number, bytes: number }} */
  let authoredRaw = { css: '', sheetCount: 0, inlineBlocks: 0, fromDisk: 0, bytes: 0 };
  /** @type {{ css: string, rulesKept: number, fontFaces: number, rootVars: number, rawBytes: number, urlRulesDropped?: number }} */
  let authoredScoped = {
    css: '',
    rulesKept: 0,
    fontFaces: 0,
    rootVars: 0,
    rawBytes: 0,
    urlRulesDropped: 0,
  };
  try {
    authoredRaw = await collectAuthoredPageCss(page, pageDir);
    if (authoredRaw.css && sectionSelector) {
      authoredScoped = await page.evaluate(filterAuthoredCssToSectionInBrowser, {
        sel: sectionSelector,
        cssText: authoredRaw.css,
      });
    }
  } catch (err) {
    errors.push(`styled: authored CSS — ${err instanceof Error ? err.message : err}`);
  }
  if (authoredScoped.urlRulesDropped > 0) {
    console.log(
      `    … authored CSS paint-url gate dropped ${authoredScoped.urlRulesDropped} rule(s) (not evidenced by computed style)`,
    );
  }
  const authoredCss = authoredScoped.css || '';
  const hasAuthoredCss = Boolean(authoredCss && authoredCss.length > 200);
  const omitLayoutLengths = hasAuthoredCss;

  // Fonts + shell + scoped authored (no computed overlay) — AI + offline shared base
  const authoredOnlyCss = mergeStyleCss(fontFaceCss, shellCss, authoredCss);
  try {
    const authoredOut = path.join(sectionDir, SECTION_AUTHORED_CSS);
    const authoredDoc = [
      `/* Scoped authored CSS for ${folderName} (no computed [data-bq-id] overlay). */`,
      authoredOnlyCss || '/* (empty) */',
      '',
    ].join('\n');
    await writeFile(authoredOut, authoredDoc, 'utf8');
  } catch (err) {
    errors.push(
      `styled: section.authored.css — ${err instanceof Error ? err.message : err}`,
    );
  }

  const baseStyleCss = authoredOnlyCss;

  // --- Primary section.html: desktop structure + per-viewport style maps → @media CSS ---
  try {
    /** @type {Record<string, Record<string, Record<string, string>>>} */
    const mapsByDevice = {};
    let structure = null;

    for (const device of ['desktop', 'tablet', 'mobile']) {
      await page.setViewportSize(VIEWPORTS[device]);
      await ensureOverlayScrollbars(page);
      await page.waitForTimeout(device === 'desktop' ? 120 : 150);
      if (typeof beforeViewportSnapshot === 'function') {
        try {
          await beforeViewportSnapshot(page, device);
          await page.waitForTimeout(150);
        } catch (err) {
          errors.push(
            `styled: beforeViewportSnapshot(${device}) — ${err instanceof Error ? err.message : err}`,
          );
        }
      }
      const snap = await page.evaluate(captureViewportStyledSnapshotInBrowser, {
        sel: sectionSelector,
        props: COMPUTED_PROPS,
        pseudoProps: PSEUDO_PROPS,
        includeStructure: device === 'desktop',
        omitLayoutLengths,
        // Desktop stamps stable ids on the live tree; narrow reuses them so
        // banded CSS cannot attach mobile paint to the wrong desktop node.
        stampIds: device === 'desktop',
        reuseStampedIds: device !== 'desktop',
      });
      if (!snap?.stylesById) {
        errors.push(`styled: ${device} — empty snapshot`);
        continue;
      }
      mapsByDevice[device] = snap.stylesById;
      if (device === 'desktop') structure = snap;
      else if (
        structure?.liveCount &&
        snap.liveCount &&
        Math.abs(snap.liveCount - structure.liveCount) > Math.max(20, structure.liveCount * 0.15)
      ) {
        errors.push(
          `styled: ${device} liveCount ${snap.liveCount} vs desktop ${structure.liveCount} (stamps may be partial after remount)`,
        );
      }
    }

    if (structure?.outerHTML) {
      let bodyHtml = structure.outerHTML;
      // Dual chrome (desktop tabs + narrow accordion): bake open-state into clone
      if (typeof beforeViewportSnapshot === 'function') {
        try {
          const synced = await syncOpenStateFromLivePage(page, {
            sectionSelector,
            structureHtml: bodyHtml,
            devices: ['desktop', 'tablet', 'mobile'],
            beforeDevice: beforeViewportSnapshot,
            preferredOpenLabel,
          });
          if (synced.html) bodyHtml = synced.html;
        } catch (err) {
          errors.push(
            `styled: open-state sync — ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      // Marquee/carousel mid-scroll + chrome-hide stamps → blank offline PNGs
      bodyHtml = normalizeSectionHtmlSnapshot(bodyHtml);

      // External SVG sprite <use href="….svg#id"> → inline standalone SVG
      // (original-section.html stays raw; this is styled section.html only).
      try {
        const sprite = await inlineSvgSpritesInHtml(bodyHtml, {
          pageUrl: pageHref,
          fetchText: (url) => fetchSvgSheetViaPage(page, url),
        });
        bodyHtml = sprite.html;
        if (sprite.inlined > 0) {
          console.log(
            `    … inlined ${sprite.inlined} SVG sprite icon(s) into section.html` +
              (sprite.failed ? ` (${sprite.failed} failed)` : ''),
          );
        }
      } catch (err) {
        errors.push(
          `styled: svg-sprite inline — ${err instanceof Error ? err.message : err}`,
        );
      }

      const bandedCss = buildBandedCssFromMaps(mapsByDevice);
      const neutralizeCss = buildPseudoNeutralizeCss(structure.pseudoPlan);
      const header = [
        'Self-contained styled section snapshot (multi-viewport).',
        'Includes page :root/html/body tokens + local @font-face when available.',
        hasAuthoredCss
          ? `Authored CSS scoped to section (rawBytes=${authoredScoped.rawBytes || authoredRaw.bytes}, scopedBytes=${authoredCss.length}, rulesKept=${authoredScoped.rulesKept}, fontFaces=${authoredScoped.fontFaces}, rootVars=${authoredScoped.rootVars}, urlRulesDropped=${authoredScoped.urlRulesDropped || 0}, sheets=${authoredRaw.sheetCount}); computed [data-bq-id] omits layout lengths.`
          : 'Authored CSS unavailable or empty after scope — computed maps include fluid layout heuristics.',
        'Matched stylesheet rules kept when extractable (may be empty for cross-origin).',
        'Computed styles captured at desktop/tablet/mobile and merged as [data-bq-id] rules.',
        `Media bands: desktop ${VIEWPORT_MEDIA.desktop}; tablet ${VIEWPORT_MEDIA.tablet}; mobile ${VIEWPORT_MEDIA.mobile}.`,
        'Open Shadow DOM flattened; ::before/::after materialized as data-bq-pseudo spans (host pseudos neutralized).',
        typeof beforeViewportSnapshot === 'function'
          ? 'Interaction open-state synced across desktop/tablet/mobile dual chrome.'
          : '',
        `rules=${structure.ruleCount}; skippedCrossOriginSheets=${structure.skippedSheets}`,
        `shadowHosts=${structure.shadowHosts || 0}; styleIds=${structure.styleIdCount || 0}`,
        structure.truncated ? 'Matched CSS truncated at 500KB.' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const styleCss = mergeStyleCss(
        baseStyleCss,
        absolutizeCssUrls(structure.shadowCss || '', pageHref),
        // Prefer authored sheets; matched cssRules are often empty under CORS
        hasAuthoredCss ? '' : absolutizeCssUrls(structure.css || '', pageHref),
        // Delimiter: everything after is computed overlay (preview-only for AI packing)
        BQ_COMPUTED_OVERLAY_MARKER,
        // Neutralize after authored so !important wins over sheet ::before/::after
        neutralizeCss,
        absolutizeCssUrls(bandedCss, pageHref),
      );
      const doc = wrapMiniDocument({
        title: `${folderName} (styled)`,
        styleCss,
        bodyHtml,
        headerComment: header,
      });
      const outPath = path.join(sectionDir, SECTION_HTML);
      await writeFile(outPath, doc, 'utf8');
      sectionHtmlRel = path.relative(pageDir, outPath).replace(/\\/g, '/');
    } else {
      errors.push('styled: primary section.html — empty root');
    }
  } catch (err) {
    errors.push(`styled: primary section.html — ${err instanceof Error ? err.message : err}`);
  }

  if (!writeLegacySiblings) {
    await page.setViewportSize(VIEWPORTS.desktop);
    return {
      sectionHtml: sectionHtmlRel,
      sectionStyledHtml: null,
      sectionStyledByViewport: null,
      errors,
    };
  }

  // --- Legacy A. Matched CSS + structure snapshot (section.styled.html) ---
  try {
    await page.setViewportSize(VIEWPORTS.desktop);
    await ensureOverlayScrollbars(page);
    await page.waitForTimeout(80);
    const matched = await page.evaluate(captureViewportStyledSnapshotInBrowser, {
      sel: sectionSelector,
      props: COMPUTED_PROPS,
      pseudoProps: PSEUDO_PROPS,
      includeStructure: true,
      stampIds: true,
      reuseStampedIds: false,
    });
    if (matched?.outerHTML) {
      const header = [
        'Matched stylesheet rules for this section subtree (legacy sibling).',
        `rules=${matched.ruleCount}; skippedCrossOriginSheets=${matched.skippedSheets}`,
        matched.truncated ? 'CSS truncated at 500KB.' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const doc = wrapMiniDocument({
        title: `${folderName} styled (matched CSS)`,
        styleCss: mergeStyleCss(
          baseStyleCss,
          absolutizeCssUrls(matched.shadowCss || '', pageHref),
          absolutizeCssUrls(matched.css || '/* no matched rules */', pageHref),
        ),
        bodyHtml: matched.outerHTML,
        headerComment: header,
      });
      const outPath = path.join(sectionDir, 'section.styled.html');
      await writeFile(outPath, doc, 'utf8');
      sectionStyledHtml = path.relative(pageDir, outPath).replace(/\\/g, '/');
    } else {
      errors.push('styled: matched CSS — empty root');
    }
  } catch (err) {
    errors.push(`styled: matched CSS — ${err instanceof Error ? err.message : err}`);
  }

  // --- Legacy B. Per-viewport computed inline ---
  const byViewport = {};
  for (const device of ['desktop', 'tablet', 'mobile']) {
    try {
      await page.setViewportSize(VIEWPORTS[device]);
      await ensureOverlayScrollbars(page);
      await page.waitForTimeout(120);
      let viewportShell = shellCss;
      try {
        viewportShell = (await page.evaluate(collectPageShellCssInBrowser)) || shellCss;
      } catch {
        /* keep */
      }
      const html = await page.evaluate(inlineComputedLightDomInBrowser, {
        sel: sectionSelector,
        props: COMPUTED_PROPS,
      });
      if (!html) {
        errors.push(`styled: ${device} — empty`);
        continue;
      }
      const doc = wrapMiniDocument({
        title: `${folderName} styled (${device})`,
        styleCss: mergeStyleCss(fontFaceCss, viewportShell),
        bodyHtml: html,
        headerComment: `Computed styles inlined at ${VIEWPORTS[device].width}x${VIEWPORTS[device].height}.`,
      });
      const outPath = path.join(sectionDir, `section.styled-${device}.html`);
      await writeFile(outPath, doc, 'utf8');
      byViewport[device] = path.relative(pageDir, outPath).replace(/\\/g, '/');
    } catch (err) {
      errors.push(`styled: ${device} — ${err instanceof Error ? err.message : err}`);
    }
  }

  await page.setViewportSize(VIEWPORTS.desktop);

  if (Object.keys(byViewport).length) {
    sectionStyledByViewport = byViewport;
  }

  return {
    sectionHtml: sectionHtmlRel,
    sectionStyledHtml,
    sectionStyledByViewport,
    errors,
  };
}
