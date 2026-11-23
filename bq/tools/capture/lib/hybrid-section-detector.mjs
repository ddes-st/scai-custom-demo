/**
 * HybridSectionDetector — hybrid CMS section detection:
 *  1) Semantic / structural chapters (section, header, footer, layout children)
 *  2) OpenCV visual bands → DOM (second opinion / gap fill)
 *  3) Reconcile to the best keep-set + numbered detected-sections.png
 *
 * Prerequisites:
 *   Full-page screenshots/desktop.png + desktop-clean.png (same capture pass)
 *   Python 3 + `opencv-python` / `opencv-python-headless` + `numpy`
 *
 * Writes (page folder root):
 *   detected-sections.json
 *   detected-sections.png (numeric badges on desktop-clean.png; content bands only)
 */
import { access, writeFile, mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { pageScreenshotPath, pageSectionsDir, pageScreenshotsDir } from './page-layout.mjs';
import { defaultCapturesDir } from '../paths.mjs';
import { hostSlugFromUrl, slugFromUrl } from './url-utils.mjs';
import { detectAllStickyOverlaysInPage, detectScrollRevealOverlaysInPage } from './sticky-overlays.mjs';
import {
  stampChromeKindOnSections,
  dropNestedHeaderStackSections,
} from './chrome-kind-classify.mjs';
import { waitUntilPageReady } from './page-ready.mjs';
import {
  discoverSemanticCmsSectionsInPage,
  reconcileHybridSections,
} from './hybrid-section-reconcile.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_OPENCV_SCRIPT = path.join(__dirname, 'hybrid-section-bands.py');
const PYTHON_ANNOTATE_SCRIPT = path.join(__dirname, 'hybrid-section-annotate.py');
const PYTHON_CROP_SCRIPT = path.join(__dirname, 'hybrid-section-crop.py');

/** Read PNG IHDR width/height (CSS-pixel scale of the file we annotate onto). */
async function readPngSize(filePath) {
  const buf = await readFile(filePath);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`Not a PNG: ${filePath}`);
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Map CSS boxes onto a specific screenshot's pixel grid.
 * Always scale with the *target image* size (overlay vs clean often differ).
 */
function cssBoxToImageRect(box, { imgW, imgH, cssW, cssH }) {
  const xScale = imgW / Math.max(1, cssW);
  const yScale = imgH / Math.max(1, cssH);
  const x0 = Math.max(0, Math.round((box.left ?? 0) * xScale));
  const x1 = Math.max(x0 + 1, Math.round((box.right ?? box.left + (box.width || 1)) * xScale));
  const y0 = Math.max(0, Math.round((box.top ?? 0) * yScale));
  const y1 = Math.max(y0 + 1, Math.round((box.bottom ?? box.top + (box.height || 1)) * yScale));
  return { x0, x1, y0, y1 };
}

/**
 * Scale for fixed/sticky overlays on full-page screenshots.
 *
 * Chromium paints position:fixed|sticky chrome into the first stitch using layout
 * CSS pixels. A wider PNG than the CSS viewport is usually a scrollbar gutter —
 * applying imgW/cssW to X *and* Y shifts cookie bars and FABs down/right.
 * Only apply a uniform scale when both axes agree (true devicePixelRatio enlarge).
 */
function fixedOverlayImageScale({ imgW, imgH, cssW, cssH }) {
  const xScale = imgW / Math.max(1, cssW);
  const yScale = imgH / Math.max(1, cssH);
  const axesAgree = Math.abs(xScale - yScale) < 0.08;
  const looksLikeDpr = axesAgree && xScale >= 1.5;
  return looksLikeDpr ? xScale : 1;
}

/**
 * Painted content width inside a full-page PNG (excludes empty right gutter).
 * Capture viewport is usually innerWidth; live remasure often sees a smaller
 * clientWidth when a classic scrollbar is present — X must use paintW/clientW.
 */
function resolveOverlayPaintWidth({ imgW, innerW, clientW }) {
  const inner = Math.max(1, innerW || clientW || imgW);
  const client = Math.max(1, clientW || inner);
  // Typical: PNG wider than viewport by a scrollbar/gutter strip on the right.
  if (imgW > inner && imgW - inner < 160) return inner;
  if (imgW > client && imgW - client < 160) return Math.min(imgW, Math.max(inner, client));
  return Math.min(imgW, Math.max(inner, client));
}

/**
 * Map a fixed/sticky viewport box onto screenshot pixels.
 * Y stays ~1:1 (or DPR). X uses paintW/clientW so full-bleed chrome and
 * right-docked FABs land on the painted pixels, not the live scrollbar width.
 */
function mapFixedOverlayToImage(box, { imgW, imgH, paintW, clientW, dprScale = 1 }) {
  const layoutW = Math.max(1, clientW || paintW);
  const xScale = (dprScale * Math.max(1, paintW)) / layoutW;
  const yScale = dprScale;
  let x0 = Math.round((box.vpLeft ?? box.left ?? 0) * xScale);
  let x1 = Math.round((box.vpRight ?? box.right ?? x0 + 1) * xScale);
  let y0 = Math.round((box.vpTop ?? 0) * yScale);
  let y1 = Math.round((box.vpBottom ?? (box.vpTop || 0) + 1) * yScale);

  // Near-full-bleed overlays (cookie / sticky header): snap to painted content width.
  const cssWidth = Math.max(1, (box.vpRight ?? box.right ?? 0) - (box.vpLeft ?? box.left ?? 0));
  if (cssWidth / layoutW >= 0.85 || (x0 <= 4 && cssWidth >= layoutW * 0.75)) {
    x0 = 0;
    x1 = Math.round(paintW * dprScale);
  } else {
    // Never draw fixed chrome into the empty right gutter.
    const paintRight = Math.round(paintW * dprScale);
    if (x1 > paintRight) x1 = paintRight;
  }

  return clampImageRect({ x0, x1, y0, y1 }, imgW, imgH);
}

function clampImageRect(rect, imgW, imgH) {
  const x0 = Math.max(0, Math.min(imgW - 1, rect.x0));
  const y0 = Math.max(0, Math.min(imgH - 1, rect.y0));
  const x1 = Math.max(x0 + 1, Math.min(imgW, rect.x1));
  const y1 = Math.max(y0 + 1, Math.min(imgH, rect.y1));
  return { x0, x1, y0, y1 };
}

function yOverlapRatio(a, b) {
  const top = Math.max(a.y0, b.y0);
  const bot = Math.min(a.y1, b.y1);
  const overlap = Math.max(0, bot - top);
  const shorter = Math.max(1, Math.min(a.y1 - a.y0, b.y1 - b.y0));
  return overlap / shorter;
}

function isHeaderLikeName(name) {
  return /^(Header|HeaderBand|TopBar|Navigation)$/i.test(String(name || ''));
}

/** Overlays that can replace a content Header band (not nested utility TopBar). */
function isHeaderSuppressorName(name) {
  return /^(Header|HeaderBand|Navigation)$/i.test(String(name || ''));
}

/**
 * Remeasure overlay elements in the live page and return boxes in *document CSS*
 * coords, plus the page metrics needed to map onto a screenshot.
 * Fixed/sticky widgets use the tight visible box (icon/media when present).
 */
async function measureOverlayBoxesInPage(page, overlays) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  return page.evaluate((items) => {
    const vw = window.innerWidth || 1440;
    const clientW = document.documentElement?.clientWidth || vw;
    const pageH = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight || 0,
      window.innerHeight || 0,
    );
    const measured = items.map((o) => {
      let el = null;
      try {
        el = document.querySelector(o.selector);
      } catch {
        el = null;
      }
      if (!el) return null;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') < 0.05) {
        return null;
      }
      let box = el.getBoundingClientRect();
      const outer = box;
      const isCookieOrConsent =
        /cookie|consent/i.test(o.cmsName || '') ||
        /cookie|consent/i.test(o.type || '') ||
        /cookie|consent/i.test(o.folderName || '');
      // Large wrappers (full-bleed hosts) → tighten to a compact media/control child.
      // Never shrink cookie/CMP dialogs — their close buttons would steal the box.
      // Already-compact widgets (FAB, chat launcher) keep the outer painted control.
      const isCompact = box.width <= 140 && box.height <= 140;
      if (!isCookieOrConsent && !isCompact) {
        const media = el.querySelector?.('img, svg, canvas, button, a, [role="button"]');
        if (media instanceof Element) {
          const mr = media.getBoundingClientRect();
          const compactChild = mr.width >= 16 && mr.height >= 16 && mr.width <= 140 && mr.height <= 140;
          const nestedInOuter =
            mr.left >= outer.left - 4 &&
            mr.top >= outer.top - 4 &&
            mr.right <= outer.right + 4 &&
            mr.bottom <= outer.bottom + 4;
          if (compactChild && nestedInOuter) box = mr;
        }
      }
      if (box.width < 8 || box.height < 8) return null;
      const top = box.top + window.scrollY;
      const left = box.left + window.scrollX;
      return {
        selector: o.selector,
        cmsName: o.cmsName,
        heading: o.heading || null,
        track: 'overlay',
        position: style.position,
        left,
        right: left + box.width,
        top,
        bottom: top + box.height,
        width: box.width,
        height: box.height,
        // Viewport-relative (useful when fixed elements paint into the first stitch).
        vpLeft: box.left,
        vpTop: box.top,
        vpRight: box.right,
        vpBottom: box.bottom,
      };
    });
    return {
      viewportWidth: vw,
      clientWidth: clientW,
      pageHeight: pageH,
      boxes: measured.filter(Boolean),
    };
  }, overlays);
}

/** Generic CMS-oriented names (not site-specific class names). */
export const HYBRID_SECTION_GENERIC_NAMES = [
  'TopBar',
  'Header',
  'Navigation',
  'Hero',
  'HeroCarousel',
  'CtaStrip',
  'PromoBand',
  'TitleBand',
  'FeatureBand',
  'CardGrid',
  'MediaBand',
  'StatsBand',
  'Newsletter',
  'Accordion',
  'ContentBand',
  'Footer',
];

/**
 * Resolve capture page dir + preferred desktop screenshot for a URL.
 * @param {string} url
 * @param {string} [capturesDir]
 */
export async function resolveDesktopScreenshot(url, capturesDir = defaultCapturesDir) {
  return resolveDeviceScreenshot(url, 'desktop', capturesDir);
}

/**
 * Resolve a device screenshot (`desktop-clean.png`, `mobile-clean.png`, …).
 * @param {string} url
 * @param {'desktop'|'tablet'|'mobile'} device
 * @param {string} [capturesDir]
 */
export async function resolveDeviceScreenshot(url, device = 'desktop', capturesDir = defaultCapturesDir) {
  const host = hostSlugFromUrl(url);
  const pageSlug = slugFromUrl(url);
  const pageDir = path.join(capturesDir, host, pageSlug);
  const candidates = [
    pageScreenshotPath(pageDir, `${device}-clean.png`),
    pageScreenshotPath(pageDir, `${device}.png`),
    path.join(pageDir, `${device}-clean.png`),
    path.join(pageDir, `${device}.png`),
  ];
  for (const file of candidates) {
    try {
      await access(file);
      return { pageDir, screenshotPath: file, host, pageSlug, device };
    } catch {
      /* try next */
    }
  }
  return { pageDir, screenshotPath: null, host, pageSlug, device };
}

function runPythonOpenCv(screenshotPath, options = {}) {
  const args = [PYTHON_OPENCV_SCRIPT, '--input', screenshotPath];
  if (options.writeArtifacts && options.outDir) {
    args.push('--out-dir', options.outDir, '--write-artifacts');
  }
  return new Promise((resolve, reject) => {
    const child = spawn('python', args, {
      windowsHide: true,
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python OpenCV exited with code ${code}`));
        return;
      }
      try {
        const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || '';
        resolve(JSON.parse(line));
      } catch (err) {
        reject(
          new Error(
            `Failed to parse OpenCV stdout JSON: ${err instanceof Error ? err.message : err}\nstdout=${stdout.slice(0, 200)}\nstderr=${stderr.slice(0, 400)}`,
          ),
        );
      }
    });
  });
}

/**
 * Detect horizontal section bands with Python OpenCV
 * (LAB colour change + Canny edge change + uniform-row separators).
 * Band data is returned in-memory; debug png/jpg/json are off unless writeArtifacts.
 *
 * @param {string} screenshotPath
 * @param {{ outDir?: string, writeArtifacts?: boolean }} [options]
 * @returns {Promise<{ bands: Array<{ y0: number, y1: number, height: number, score: number }>, imageWidth: number, imageHeight: number, annotatedPath?: string|null, previewPath?: string|null, engine?: string }>}
 */
export async function findBandsWithOpenCv(screenshotPath, options = {}) {
  const payload = await runPythonOpenCv(screenshotPath, {
    outDir: options.outDir,
    writeArtifacts: options.writeArtifacts === true,
  });

  if (payload.error) {
    throw new Error(payload.error);
  }

  return {
    bands: (payload.bands || []).map((b) => ({
      y0: b.y0,
      y1: b.y1,
      height: b.height,
      score: b.score ?? 0,
    })),
    imageWidth: payload.imageWidth,
    imageHeight: payload.imageHeight,
    annotatedPath: payload.annotatedPath || null,
    previewPath: payload.previewPath || null,
    engine: payload.engine || 'opencv-python',
    opencvVersion: payload.opencvVersion,
    boundaries: payload.boundaries,
  };
}

function toPascalCase(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'ContentBand';
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(raw) && /[A-Z]/.test(raw) && /[a-z]/.test(raw)) {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return raw
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function toFolderName(cmsName) {
  return cmsName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Map OpenCV bands to DOM elements via elementFromPoint sampling.
 * One logical section can own multiple layout roots (siblings under main/#Page).
 * Later OpenCV bands that hit an already-owned root merge into that section and
 * expand the OpenCV y-range (bigger visual component).
 *
 * @param {import('playwright').Page} page
 * @param {Array<{ y0: number, y1: number, height: number, score: number }>} bands
 * @param {{ imageWidth: number, imageHeight: number }} imageMeta
 */
export async function mapOpenCvBandsToDom(page, bands, imageMeta) {
  const viewport = page.viewportSize() || { width: 1440, height: 900 };
  // Cookie/consent layers steal elementFromPoint — hide them before probing.
  await page.evaluate(() => {
    for (const sel of [
      '#onetrust-banner-sdk',
      '#onetrust-consent-sdk',
      '#onetrust-pc-sdk',
      '.onetrust-pc-dark-filter',
      '#tc-privacy-wrapper',
      '#didomi-host',
      '[id*="cookie" i]',
      '[class*="cookie-banner" i]',
    ]) {
      document.querySelectorAll(sel).forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        }
      });
    }
  });

  const cssScrollHeight = await page.evaluate(() =>
    Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
  );
  const yScale = cssScrollHeight > 0 ? cssScrollHeight / imageMeta.imageHeight : 1;

  // Resolve dense chapter host (same deepen logic as semantic discovery) for SPA sites.
  const layoutContext = await page.evaluate(() => {
    const vw = window.innerWidth || 1440;
    const pageH = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    const buildSelector = (root) => {
      if (!root) return null;
      if (root.id && !/^[0-9]/.test(root.id)) return `#${CSS.escape(root.id)}`;
      const parts = [];
      let n = root;
      while (n && n.nodeType === 1 && parts.length < 10) {
        if (n.id && !/^[0-9]/.test(n.id) && n !== root) {
          parts.unshift(`#${CSS.escape(n.id)}`);
          break;
        }
        let part = n.tagName.toLowerCase();
        const parent = n.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((c) => c.tagName === n.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(n) + 1})`;
        }
        parts.unshift(part);
        n = n.parentElement;
        if (n === document.body) {
          parts.unshift('body');
          break;
        }
      }
      return parts.join(' > ');
    };
    const substantialChildren = (host) => {
      const out = [];
      for (const child of host?.children || []) {
        if (!(child instanceof Element)) continue;
        const rect = child.getBoundingClientRect();
        if (rect.width < vw * 0.55 || rect.height < 56) continue;
        const style = getComputedStyle(child);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        out.push(child);
      }
      return out;
    };
    const isChromeChild = (el) => {
      const tag = el.tagName;
      if (tag === 'HEADER' || tag === 'FOOTER' || tag === 'NAV') return true;
      if (/^APP-HEADER/i.test(tag) || /^APP-FOOTER/i.test(tag) || /^APP-NAV/i.test(tag)) return true;
      return false;
    };
    const deepen = (start) => {
      let el = start;
      for (let d = 0; d < 10 && el; d++) {
        const kids = substantialChildren(el);
        if (kids.length >= 3) return el;
        if (kids.length === 1) {
          el = kids[0];
          continue;
        }
        if (kids.length === 2) {
          const sorted = [...kids].sort(
            (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
          );
          if (sorted[0].getBoundingClientRect().height / Math.max(1, el.getBoundingClientRect().height) >= 0.55) {
            el = sorted[0];
            continue;
          }
        }
        return el;
      }
      return el;
    };

    const content = document.querySelector('#content');
    const main = document.querySelector('main, [role="main"]');
    if (content && substantialChildren(content).length >= 2) {
      return { contentHostSelector: '#content', spaRootSelector: null };
    }
    if (main && substantialChildren(main).length >= 2) {
      return { contentHostSelector: buildSelector(main), spaRootSelector: null };
    }
    const spaRoot =
      [...document.body.children].find((c) => {
        if (!(c instanceof Element)) return false;
        const r = c.getBoundingClientRect();
        return (c.tagName.includes('-') || c.id === 'root' || c.id === 'app') && r.height >= pageH * 0.45;
      }) || null;
    if (!spaRoot) return { contentHostSelector: null, spaRootSelector: null };
    const contentCandidates = substantialChildren(spaRoot).filter((c) => !isChromeChild(c));
    const seed =
      contentCandidates.sort(
        (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
      )[0] || spaRoot;
    const dense = deepen(seed);
    return {
      contentHostSelector: buildSelector(dense),
      spaRootSelector: buildSelector(spaRoot),
    };
  });

  const sections = [];
  /** @type {Map<string, object>} */
  const selectorToSection = new Map();

  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const y0 = band.y0 * yScale;
    const y1 = band.y1 * yScale;
    const sampleXs = [0.5, 0.25, 0.75].map((r) => Math.round(viewport.width * r));
    const sampleYs = [0.45, 0.2, 0.75].map((r) => y0 + (y1 - y0) * r);

    /** @type {Array<object>} */
    const hits = [];

    for (const sy of sampleYs) {
      await page.evaluate((y) => {
        window.scrollTo(0, Math.max(0, y - window.innerHeight * 0.4));
      }, sy);
      await page.waitForTimeout(40);

      for (const sx of sampleXs) {
        const hit = await page.evaluate(
          ({ x, yCss, y0, y1, vw, contentHostSelector, spaRootSelector }) => {
            const contentHost = contentHostSelector ? document.querySelector(contentHostSelector) : null;
            const spaRoot = spaRootSelector ? document.querySelector(spaRootSelector) : null;
            const buildSelector = (root) => {
              if (root.id && !/^[0-9]/.test(root.id)) return `#${CSS.escape(root.id)}`;
              const parts = [];
              let n = root;
              while (n && n.nodeType === 1 && parts.length < 8) {
                if (n.id && !/^[0-9]/.test(n.id) && n !== root) {
                  parts.unshift(`#${CSS.escape(n.id)}`);
                  break;
                }
                let part = n.tagName.toLowerCase();
                const parent = n.parentElement;
                if (parent) {
                  const siblings = [...parent.children].filter((c) => c.tagName === n.tagName);
                  if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(n) + 1})`;
                }
                parts.unshift(part);
                n = n.parentElement;
                if (n === document.body) {
                  parts.unshift('body');
                  break;
                }
              }
              return parts.join(' > ');
            };
            const describeRoot = (root) => {
              const heading =
                root.querySelector?.('h1, h2, h3')?.textContent?.trim()?.replace(/\s+/g, ' ').slice(0, 80) ||
                '';
              const cls = String(root.className || '');
              const childCls = [...(root.children || [])]
                .slice(0, 8)
                .map((c) => String(c.className || ''))
                .join(' ');
              const html = (root.innerHTML || '').slice(0, 1800).toLowerCase();
              const classBlob = `${cls} ${childCls}`;
              const hints = [];
              if (root.tagName === 'HEADER' || /header|mainheader|menu/i.test(classBlob)) hints.push('header');
              if (root.tagName === 'FOOTER' || /footer/i.test(classBlob)) hints.push('footer');
              if (/carousel|slider|swiper|heroeditorial|slidertransition/i.test(classBlob + html)) {
                hints.push('carousel');
              }
              if (/hero/i.test(classBlob)) hints.push('hero');
              if (/newsletter|subscribe/i.test(classBlob + html)) hints.push('newsletter');
              if (/accordion|accordeon/i.test(classBlob + html)) hints.push('accordion');
              if (/promo|offer|actionbanner/i.test(classBlob)) hints.push('promo');
              if (/cta|quicklink|shortcut|horizontalcta/i.test(classBlob + html)) hints.push('cta');
              if (root.querySelectorAll?.('img, picture').length >= 3 || /cards|grid|teaser/i.test(classBlob)) {
                hints.push('cards');
              }
              if (/lang|locale|language/i.test(classBlob + (root.innerText || '').slice(0, 80).toLowerCase())) {
                hints.push('topbar');
              }
              if (root.querySelector?.('video')) hints.push('media');
              if (root.querySelector?.('nav') || root.tagName === 'NAV') hints.push('nav');
              const rect = root.getBoundingClientRect();
              return {
                tag: root.tagName.toLowerCase(),
                className: `${cls} ${childCls}`.split(/\s+/).filter(Boolean).slice(0, 12).join(' '),
                id: root.id || '',
                selector: buildSelector(root),
                heading,
                hints,
                height: Math.round(rect.height),
                width: Math.round(rect.width),
                top: Math.round(rect.top + window.scrollY),
              };
            };

            const vpY = yCss - window.scrollY;
            if (vpY < 0 || vpY > window.innerHeight) return null;
            let el = document.elementFromPoint(x, vpY);
            if (!el || !(el instanceof Element)) return null;
            if (el.closest('#onetrust-consent-sdk, #onetrust-banner-sdk, [id*="cookie" i]')) return null;

            const bandH = Math.max(1, y1 - y0);
            let best = el;
            let bestScore = -1;
            let node = el;
            for (let depth = 0; depth < 16 && node && node !== document.documentElement; depth++) {
              if (!(node instanceof Element)) break;
              const rect = node.getBoundingClientRect();
              const top = rect.top + window.scrollY;
              const bottom = top + rect.height;
              const overlap = Math.max(0, Math.min(bottom, y1) - Math.max(top, y0));
              const coverage = overlap / bandH;
              const widthRatio = rect.width / Math.max(1, vw);
              const heightPenalty = rect.height > bandH * 3.2 ? 0.4 : 0;
              const score = coverage * 2.2 + Math.min(1.1, widthRatio) - heightPenalty - depth * 0.015;
              if (score > bestScore && widthRatio >= 0.55 && coverage >= 0.28) {
                bestScore = score;
                best = node;
              }
              if (
                node.parentElement &&
                (node.parentElement.tagName === 'MAIN' ||
                  node.parentElement.id === 'Page' ||
                  node.parentElement.id === 'content' ||
                  node.parentElement.id === 'footer-wrapper' ||
                  node.parentElement.tagName === 'FOOTER' ||
                  node.parentElement.getAttribute('role') === 'main' ||
                  (contentHost && node.parentElement === contentHost) ||
                  (spaRoot && node.parentElement === spaRoot))
              ) {
                if (rect.width >= vw * 0.65 && coverage >= 0.35) {
                  best = node;
                  break;
                }
              }
              node = node.parentElement;
            }
            const isShell = (node) => {
              if (!node || !(node instanceof Element)) return true;
              const id = (node.id || '').toLowerCase();
              const tag = node.tagName;
              if (
                tag === 'HTML' ||
                tag === 'BODY' ||
                tag === 'MAIN' ||
                id === 'app' ||
                id === 'page' ||
                id === 'content' ||
                id === '__next' ||
                id === 'root'
              ) {
                return true;
              }
              // Ancestors of the dense chapter host (SPA app-root / router wrappers).
              if (contentHost && node !== contentHost && node.contains(contentHost)) return true;
              if (spaRoot && node === spaRoot) return true;
              // Full-page app wrappers (e.g. body > div.prod-mode) — not a content chapter.
              if (tag === 'DIV' && !id) {
                const rect = node.getBoundingClientRect();
                const pageH = Math.max(
                  document.documentElement.scrollHeight,
                  document.body?.scrollHeight || 0,
                );
                if (rect.height >= pageH * 0.82 && rect.width >= vw * 0.85) {
                  let substantial = 0;
                  for (const child of node.children || []) {
                    if (!(child instanceof Element)) continue;
                    if (child.getBoundingClientRect().height >= 64) substantial += 1;
                    if (substantial >= 2) return true;
                  }
                }
              }
              return false;
            };
            /** Page layout parents whose *direct children* are chapter-sized sections. */
            const isLayoutParent = (node) => {
              if (!node || !(node instanceof Element)) return false;
              const id = (node.id || '').toLowerCase();
              const tag = node.tagName;
              if (tag === 'MAIN' || tag === 'FOOTER') return true;
              if (node.getAttribute('role') === 'main') return true;
              if (id === 'content' || id === 'page' || id === 'main' || id === 'footer-wrapper') return true;
              if (contentHost && node === contentHost) return true;
              if (spaRoot && node === spaRoot) return true;
              return false;
            };
            const bestOverlappingChild = (parent) => {
              let pick = null;
              let pickOverlap = 0;
              for (const child of parent.children || []) {
                if (!(child instanceof Element) || isShell(child)) continue;
                const r = child.getBoundingClientRect();
                const top = r.top + window.scrollY;
                const bottom = top + r.height;
                const overlap = Math.max(0, Math.min(bottom, y1) - Math.max(top, y0));
                if (r.width >= vw * 0.55 && overlap > pickOverlap && overlap / bandH >= 0.15) {
                  pickOverlap = overlap;
                  pick = child;
                }
              }
              return pick;
            };
            while (best && isShell(best)) {
              const pick = bestOverlappingChild(best);
              if (!pick) return null;
              best = pick;
            }

            // Tall chrome wrappers (footer ContentZone, etc.) — descend to the child
            // whose height best matches this OpenCV band.
            const fitScore = (node) => {
              if (!(node instanceof Element)) return -Infinity;
              const rect = node.getBoundingClientRect();
              const top = rect.top + window.scrollY;
              const bottom = top + rect.height;
              const overlap = Math.max(0, Math.min(bottom, y1) - Math.max(top, y0));
              const coverage = overlap / bandH;
              const widthRatio = rect.width / Math.max(1, vw);
              const heightRatio = rect.height / bandH;
              if (widthRatio < 0.5 || coverage < 0.25) return -Infinity;
              const heightFit =
                heightRatio <= 1.35
                  ? 1.25 - Math.abs(1 - heightRatio)
                  : Math.max(-1.2, 1.35 - heightRatio * 0.75);
              return coverage * 1.4 + Math.min(1, widthRatio) + heightFit * 3.2;
            };
            let guard = 0;
            while (
              best &&
              best.getBoundingClientRect().height > bandH * 1.55 &&
              guard < 8
            ) {
              const midY = (y0 + y1) / 2;
              let childBest = null;
              let childScore = -Infinity;
              for (const child of best.children || []) {
                if (!(child instanceof Element) || isShell(child)) continue;
                const r = child.getBoundingClientRect();
                const top = r.top + window.scrollY;
                const bottom = top + r.height;
                if (midY < top - 12 || midY > bottom + 12) continue;
                const s = fitScore(child);
                if (s > childScore) {
                  childScore = s;
                  childBest = child;
                }
              }
              for (const child of best.children || []) {
                if (!(child instanceof Element)) continue;
                for (const grand of child.children || []) {
                  if (!(grand instanceof Element)) continue;
                  const r = grand.getBoundingClientRect();
                  if (r.width < vw * 0.5) continue;
                  const top = r.top + window.scrollY;
                  const bottom = top + r.height;
                  if (midY < top - 12 || midY > bottom + 12) continue;
                  const s = fitScore(grand) + 0.05;
                  if (s > childScore) {
                    childScore = s;
                    childBest = grand;
                  }
                }
              }
              if (!childBest || childScore <= fitScore(best) + 0.15) break;
              best = childBest;
              guard += 1;
            }
            if (isShell(best)) return null;

            const bandOverlapRatio = (node) => {
              if (!(node instanceof Element)) return 0;
              const r = node.getBoundingClientRect();
              const top = r.top + window.scrollY;
              const bottom = top + r.height;
              return Math.max(0, Math.min(bottom, y1) - Math.max(top, y0)) / bandH;
            };

            // Prefer fixed/absolute media when it owns the band visually — chapter
            // climb would otherwise absorb parallax heroes into a later layout sibling.
            let overflowMedia = null;
            {
              let n = best;
              for (let d = 0; d < 14 && n && n !== document.documentElement; d++) {
                if (!(n instanceof Element)) break;
                const pos = getComputedStyle(n).position;
                if (
                  (pos === 'fixed' || pos === 'absolute') &&
                  bandOverlapRatio(n) >= 0.4 &&
                  n.getBoundingClientRect().width >= vw * 0.65 &&
                  n.getBoundingClientRect().height >= 160
                ) {
                  const hasMedia =
                    /^(IMG|VIDEO|PICTURE|CANVAS|IFRAME)$/i.test(n.tagName) ||
                    Boolean(n.querySelector?.('img, video, picture, source')) ||
                    (() => {
                      const bg = getComputedStyle(n).backgroundImage;
                      return Boolean(bg && bg !== 'none');
                    })();
                  if (hasMedia) {
                    overflowMedia = n;
                    break;
                  }
                }
                n = n.parentElement;
              }
            }

            // Promote deep hits to the page *chapter* (direct child of main/#content/#Page/footer),
            // then snap by geometry so overflowing carousel children don't steal the next section.
            {
              let node = best;
              if (isLayoutParent(node)) {
                const pick = bestOverlappingChild(node);
                if (pick) node = pick;
              }
              let chapter = node;
              let cur = node;
              for (let d = 0; d < 24 && cur?.parentElement; d++) {
                const parent = cur.parentElement;
                if (isLayoutParent(parent)) {
                  chapter = cur;
                  break;
                }
                if (parent === document.body || parent === document.documentElement) {
                  chapter = cur;
                  break;
                }
                cur = parent;
              }
              const layoutParent = chapter?.parentElement;
              if (layoutParent && isLayoutParent(layoutParent)) {
                const midY = (y0 + y1) / 2;
                let snap = null;
                let snapScore = -1;
                for (const child of layoutParent.children || []) {
                  if (!(child instanceof Element) || isShell(child)) continue;
                  const r = child.getBoundingClientRect();
                  if (r.width < vw * 0.55 || r.height < 24) continue;
                  const top = r.top + window.scrollY;
                  const bottom = top + r.height;
                  const overlap = Math.max(0, Math.min(bottom, y1) - Math.max(top, y0));
                  if (overlap < bandH * 0.18) continue;
                  const containsMid = midY >= top - 10 && midY <= bottom + 10;
                  const score = overlap / bandH + (containsMid ? 1.25 : 0) + Math.min(0.35, r.height / Math.max(bandH, 1) * 0.15);
                  if (score > snapScore) {
                    snapScore = score;
                    snap = child;
                  }
                }
                if (snap) chapter = snap;
              }
              if (chapter && !isShell(chapter) && !isLayoutParent(chapter)) {
                best = chapter;
              }
            }

            if (
              overflowMedia &&
              bandOverlapRatio(best) < 0.25 &&
              bandOverlapRatio(overflowMedia) >= 0.4
            ) {
              best = overflowMedia;
            }
            return describeRoot(best);
          },
          { x: sx, yCss: sy, y0, y1, vw: viewport.width, ...layoutContext },
        );
        if (hit?.selector) hits.push(hit);
      }
    }

    if (!hits.length) continue;

    const bySel = new Map();
    for (const hit of hits) {
      if (!bySel.has(hit.selector)) bySel.set(hit.selector, { hit, n: 0 });
      bySel.get(hit.selector).n += 1;
    }
    const best = [...bySel.values()].sort((a, b) => b.n - a.n)[0].hit;

    // Layout roots = overlapping children of main / #Page chrome (never main/#app/body).
    const overlapRoots = await page.evaluate(
      ({ y0, y1, vw, pageH, contentHostSelector, spaRootSelector }) => {
        const buildSelector = (root) => {
          if (root.id && !/^[0-9]/.test(root.id)) return `#${CSS.escape(root.id)}`;
          const parts = [];
          let n = root;
          while (n && n.nodeType === 1 && parts.length < 8) {
            if (n.id && !/^[0-9]/.test(n.id) && n !== root) {
              parts.unshift(`#${CSS.escape(n.id)}`);
              break;
            }
            let part = n.tagName.toLowerCase();
            const parent = n.parentElement;
            if (parent) {
              const siblings = [...parent.children].filter((c) => c.tagName === n.tagName);
              if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(n) + 1})`;
            }
            parts.unshift(part);
            n = n.parentElement;
            if (n === document.body) {
              parts.unshift('body');
              break;
            }
          }
          return parts.join(' > ');
        };
        const contentHost = contentHostSelector ? document.querySelector(contentHostSelector) : null;
        const spaRootEl = spaRootSelector ? document.querySelector(spaRootSelector) : null;
        const isShell = (node) => {
          if (!node || !(node instanceof Element)) return true;
          const id = (node.id || '').toLowerCase();
          const tag = node.tagName;
          if (
            tag === 'HTML' ||
            tag === 'BODY' ||
            tag === 'MAIN' ||
            id === 'app' ||
            id === 'page' ||
            id === 'content' ||
            id === '__next' ||
            id === 'root'
          ) {
            return true;
          }
          if (contentHost && node !== contentHost && node.contains(contentHost)) return true;
          if (spaRootEl && node === spaRootEl) return true;
          return false;
        };
        const describeRoot = (root) => {
          const heading =
            root.querySelector?.('h1, h2, h3')?.textContent?.trim()?.replace(/\s+/g, ' ').slice(0, 80) || '';
          const cls = String(root.className || '');
          const html = (root.innerHTML || '').slice(0, 1200).toLowerCase();
          const hints = [];
          if (root.tagName === 'HEADER' || /header|mainheader|menu/i.test(cls)) hints.push('header');
          if (root.tagName === 'FOOTER' || /footer/i.test(cls)) hints.push('footer');
          if (/carousel|slider|swiper|heroeditorial|slidertransition/i.test(cls + html)) hints.push('carousel');
          if (/hero/i.test(cls)) hints.push('hero');
          if (/newsletter|subscribe/i.test(cls + html)) hints.push('newsletter');
          if (/accordion|accordeon/i.test(cls + html)) hints.push('accordion');
          if (/promo|offer|actionbanner/i.test(cls)) hints.push('promo');
          if (/cta|quicklink|shortcut/i.test(cls)) hints.push('cta');
          if (root.querySelectorAll?.('img, picture').length >= 3 || /cards|grid|teaser/i.test(cls)) {
            hints.push('cards');
          }
          if (root.querySelector?.('video')) hints.push('media');
          if (root.querySelector?.('nav') || root.tagName === 'NAV') hints.push('nav');
          const rect = root.getBoundingClientRect();
          return {
            tag: root.tagName.toLowerCase(),
            className: cls.split(/\s+/).filter(Boolean).slice(0, 4).join(' '),
            id: root.id || '',
            selector: buildSelector(root),
            heading,
            hints,
            height: Math.round(rect.height),
            width: Math.round(rect.width),
            top: Math.round(rect.top + window.scrollY),
          };
        };

        const bandH = Math.max(1, y1 - y0);
        // Prefer band-sized roots. Tall page chrome (footer zone) is expanded to children.
        const maxRootH = bandH * 2.35;
        /** @type {Element[]} */
        const candidates = [];
        const mains = [...document.querySelectorAll('main, [role="main"]')];
        mains.sort(
          (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
        );
        if (mains[0]) {
          for (const child of mains[0].children || []) {
            if (child instanceof Element) candidates.push(child);
          }
        }
        for (const sel of ['#content', '#Page', '#footer-wrapper', 'footer']) {
          const host = document.querySelector(sel);
          if (!host) continue;
          for (const child of host.children || []) {
            if (!(child instanceof Element) || isShell(child)) continue;
            candidates.push(child);
          }
        }
        // Dense SPA chapter host + app chrome root (resolved outside).
        for (const sel of [contentHostSelector, spaRootSelector].filter(Boolean)) {
          try {
            const host = document.querySelector(sel);
            if (!host) continue;
            for (const child of host.children || []) {
              if (!(child instanceof Element) || isShell(child)) continue;
              candidates.push(child);
            }
          } catch {
            /* ignore */
          }
        }

        const seen = new Set();
        const roots = [];
        const consider = (child) => {
          if (!(child instanceof Element) || seen.has(child) || isShell(child)) return;
          const rect = child.getBoundingClientRect();
          if (rect.width < vw * 0.55) return;
          const top = rect.top + window.scrollY;
          const bottom = top + rect.height;
          const overlap = Math.max(0, Math.min(bottom, y1) - Math.max(top, y0));
          const mid = (top + bottom) / 2;
          const mostlyInside = overlap / Math.max(1, rect.height) >= 0.55;
          const midInBand = mid >= y0 - 4 && mid <= y1 + 4;
          if (!mostlyInside && !midInBand) return;
          if (overlap / bandH < 0.15 && !mostlyInside) return;

          if (rect.height > maxRootH) {
            for (const nested of child.children || []) consider(nested);
            return;
          }
          seen.add(child);
          roots.push(describeRoot(child));
        };
        for (const child of candidates) consider(child);
        roots.sort((a, b) => a.top - b.top);
        return roots;
      },
      { y0, y1, vw: viewport.width, pageH: cssScrollHeight, ...layoutContext },
    );

    /** @type {Map<string, object>} */
    const rootMap = new Map();
    rootMap.set(best.selector, best);
    for (const r of overlapRoots || []) {
      if (!r?.selector || r.selector === best.selector) {
        if (r?.selector) rootMap.set(r.selector, r);
        continue;
      }
      // Keep nested roots under the primary chapter only — never sibling chapters.
      const nested = await page.evaluate(
        ({ primarySel, otherSel }) => {
          try {
            const primary = document.querySelector(primarySel);
            const other = document.querySelector(otherSel);
            return !!(primary && other && primary !== other && primary.contains(other));
          } catch {
            return false;
          }
        },
        { primarySel: best.selector, otherSel: r.selector },
      );
      if (nested) rootMap.set(r.selector, r);
    }
    const roots = [...rootMap.values()];

    // Merge only when the primary hit selector is already owned (same DOM node).
    // Ancestor/wrapper merges collapsed footer Prefooter vs columns vs legal.
    let existing = selectorToSection.get(best.selector) || null;

    if (existing) {
      existing.opencv.y0 = Math.min(existing.opencv.y0, band.y0);
      existing.opencv.y1 = Math.max(existing.opencv.y1, band.y1);
      existing.opencv.height = existing.opencv.y1 - existing.opencv.y0;
      existing.opencv.score = Math.max(existing.opencv.score, Number(band.score.toFixed(4)));
      existing.opencv.bands = existing.opencv.bands || [];
      existing.opencv.bands.push({ y0: band.y0, y1: band.y1, score: Number(band.score.toFixed(4)) });
      for (const r of roots) {
        if (!existing.roots.some((x) => x.selector === r.selector)) {
          existing.roots.push({
            selector: r.selector,
            tag: r.tag,
            className: r.className,
            heading: r.heading || null,
            hints: r.hints || [],
            height: r.height,
            top: r.top,
          });
        }
      }
      existing.roots.sort(
        (a, b) => (a.top ?? 0) - (b.top ?? 0) || String(a.selector).localeCompare(String(b.selector)),
      );
      if (!existing.heading) {
        const withHeading = roots.find((r) => r.heading);
        if (withHeading) existing.heading = withHeading.heading;
      }
      for (const r of roots) {
        for (const h of r.hints || []) {
          if (!existing.hints.includes(h)) existing.hints.push(h);
        }
      }
      existing.reason = `HybridSectionDetector: OpenCV y=${existing.opencv.y0}-${existing.opencv.y1} (${existing.opencv.bands.length} bands, ${existing.roots.length} roots) → DOM`;
      existing.cssTop = Math.min(
        existing.cssTop ?? Infinity,
        ...roots.map((r) => r.top ?? Infinity),
        Math.round(y0),
      );
      existing.cssBottom = Math.max(
        existing.cssBottom ?? 0,
        ...roots.map((r) => (r.top || 0) + (r.height || 0)),
        Math.round(y1),
      );
      continue;
    }

    const chapterHeight = Math.max(y1 - y0, Number(best.height) || 0);
    const genericName = nameBandGenerically({
      index: i,
      bandHeight: chapterHeight,
      pageHeight: cssScrollHeight,
      top: y0,
      hints: best.hints,
      heading: best.heading || roots.find((r) => r.heading)?.heading || '',
      className: best.className,
      tag: best.tag,
    });

    const section = {
      cmsName: genericName,
      folderName: toFolderName(genericName),
      name: toFolderName(genericName),
      selector: best.selector,
      roots: roots.map((r) => ({
        selector: r.selector,
        tag: r.tag,
        className: r.className,
        heading: r.heading || null,
        hints: r.hints || [],
        height: r.height,
        top: r.top,
      })),
      heading: best.heading || roots.find((r) => r.heading)?.heading || null,
      reason: `HybridSectionDetector: OpenCV band y=${Math.round(band.y0)}-${Math.round(band.y1)} → DOM`,
      type: typeFromGenericName(genericName),
      componentType: genericName,
      scope: genericName === 'Footer' || genericName === 'Header' || genericName === 'TopBar' ? 'site' : 'page',
      order: sections.length,
      source: 'hybrid-section-opencv',
      opencv: {
        y0: band.y0,
        y1: band.y1,
        height: band.height,
        score: Number(band.score.toFixed(4)),
        bands: [{ y0: band.y0, y1: band.y1, score: Number(band.score.toFixed(4)) }],
      },
      className: best.className,
      tag: best.tag,
      hints: [...(best.hints || [])],
    };

    // Own primary only for merge keys. Listing multiple roots on the section is fine,
    // but registering every sibling caused CTA+ActionBanner / footer parts to collapse.
    selectorToSection.set(best.selector, section);
    for (const h of best.hints || []) {
      if (!section.hints.includes(h)) section.hints.push(h);
    }
    for (const r of overlapRoots || []) {
      for (const h of r.hints || []) {
        if (!section.hints.includes(h)) section.hints.push(h);
      }
    }
    if (section.roots.length > 1) {
      section.reason = `HybridSectionDetector: OpenCV y=${section.opencv.y0}-${section.opencv.y1} (${section.roots.length} roots) → DOM`;
    }
    section.cssTop = roots[0]?.top ?? best.top ?? Math.round(y0);
    section.cssBottom = Math.round(
      (roots.reduce((max, r) => Math.max(max, (r.top || 0) + (r.height || 0)), 0) ||
        (best.top || 0) + (best.height || 0) ||
        y1),
    );
    if (section.cssBottom <= section.cssTop) {
      section.cssTop = Math.round(y0);
      section.cssBottom = Math.round(y1);
    }
    sections.push(section);
  }

  for (const s of sections) {
    if (s.roots?.length) {
      s.roots.sort((a, b) => (a.top ?? 0) - (b.top ?? 0) || String(a.selector).localeCompare(String(b.selector)));
      const primary = s.roots.find((r) => r.selector === s.selector) || s.roots[0];
      s.selector = primary.selector;
      s.tag = primary.tag || s.tag;
      s.className = primary.className || s.className;
    }
  }

  const seen = new Map();
  for (const s of sections) {
    const base = s.cmsName;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    if (n > 0) {
      s.cmsName = `${base}${n + 1}`;
      s.folderName = toFolderName(s.cmsName);
      s.name = s.folderName;
    }
  }

  return sections;
}

function typeFromGenericName(name) {
  if (name === 'Header' || name === 'TopBar' || name === 'Navigation') return 'header';
  if (name === 'Footer') return 'footer';
  if (name === 'HeroCarousel') return 'carousel';
  if (name === 'Hero') return 'hero';
  if (name === 'Accordion') return 'faq-section';
  return 'content-section';
}

/**
 * Prefer generic component names over site-specific class tokens.
 */
export function nameBandGenerically({ index, bandHeight, pageHeight, top, hints = [], heading = '', className = '', tag = '' }) {
  const blob = `${hints.join(' ')} ${className} ${tag} ${heading}`.toLowerCase();
  const nearTop = top < Math.min(180, pageHeight * 0.08);
  const nearBottom = top > pageHeight * 0.78;
  const short = bandHeight < 160;
  const tallHero = bandHeight >= Math.min(420, pageHeight * 0.35) && nearTop;

  if (hints.includes('footer') || /footer/.test(blob) || (nearBottom && /footer|legal|copyright/.test(blob))) {
    return 'Footer';
  }
  if (hints.includes('topbar') || (nearTop && short && /lang|locale|français|nederlands/.test(blob))) {
    return 'TopBar';
  }
  // Tall top media bands are heroes/carousels even if a sticky header overlaps the hit.
  if (tallHero || (nearTop && bandHeight >= 360 && (hints.includes('carousel') || hints.includes('hero')))) {
    return hints.includes('carousel') || /carousel|slider|swiper/.test(blob) ? 'HeroCarousel' : 'Hero';
  }
  if (hints.includes('header') || (nearTop && short && /header|nav|menu/.test(blob))) {
    return 'Header';
  }
  if (hints.includes('nav') && short && !hints.includes('carousel') && !hints.includes('cards')) {
    return 'Navigation';
  }
  if (hints.includes('carousel') || (/slider|swiper|carousel/.test(blob) && bandHeight > 280)) {
    return 'MediaBand';
  }
  if (hints.includes('hero')) return 'Hero';
  if (hints.includes('newsletter') || /newsletter|subscribe/.test(blob)) return 'Newsletter';
  if (hints.includes('accordion') || /accordion|accordeon/.test(blob)) return 'Accordion';
  if (hints.includes('cta') || (short && /cta|quick.?link|shortcut/.test(blob))) return 'CtaStrip';
  // Page title / breadcrumb strip under site chrome (not a marketing promo).
  const titleStrip =
    bandHeight >= 72 &&
    bandHeight <= 280 &&
    top < Math.min(480, pageHeight * 0.22);
  if (
    hints.includes('title') ||
    (titleStrip &&
      (/breadcrumb|page.?title|hero.?title|inner_?banner/.test(blob) ||
        (/^h[12]$/i.test(tag) && heading) ||
        (heading && /banner/.test(className))))
  ) {
    return 'TitleBand';
  }
  if (hints.includes('promo') || /promo|offer/.test(blob) || (/\bbanner\b/.test(blob) && !titleStrip)) {
    return 'PromoBand';
  }
  if (hints.includes('cards') || /card|grid|teaser|services/.test(blob)) return 'CardGrid';
  if (hints.includes('media') || /video|gallery|media/.test(blob)) return 'MediaBand';
  if (/stat|counter|metric/.test(blob)) return 'StatsBand';
  if (/feature|spotlight|highlight/.test(blob)) return 'FeatureBand';
  if (heading) {
    // Short title strip just under header — distinct from sticky Header chrome.
    if (titleStrip) return 'TitleBand';
    // Still generic — feature/content, not raw heading pascal-case as primary.
    if (bandHeight > 900) return 'FeatureBand';
    return 'ContentBand';
  }
  if (index === 0 && nearTop) return short ? 'Header' : 'Hero';
  return 'ContentBand';
}

/**
 * Map sticky/fixed layover popups (cookie, consent, chat, floating CTA, scroll-reveal bars, …)
 * into HybridSections sections. Detected on the live page before overlays are hidden for OpenCV→DOM mapping.
 * @param {import('playwright').Page} page
 * @param {{ skipReady?: boolean }} [options]
 */
export async function detectOverlaySectionsInPage(page, options = {}) {
  const { waitUntilPageReady } = await import('./page-ready.mjs');

  // Caller (capture/compare) already did one bottom→top scroll for lazy load.
  // Only probe mid→top here for scroll-reveal chrome — no extra full-page pass.
  if (!options.skipReady) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await waitUntilPageReady(page, {
      light: true,
      skipNetworkIdle: true,
      imagesTimeoutMs: 2000,
      label: 'overlay-detect/top',
    });
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  const staticOverlays = await page.evaluate(detectAllStickyOverlaysInPage);
  const scrollReveal = await detectScrollRevealOverlaysInPage(page);

  await page.evaluate(() => window.scrollTo(0, 0));
  if (!options.skipReady) {
    await waitUntilPageReady(page, {
      light: true,
      skipImages: true,
      skipNetworkIdle: true,
      label: 'overlay-detect/after-reveal',
    });
  }

  const bySelector = new Map();
  for (const o of [...(staticOverlays || []), ...(scrollReveal || [])]) {
    if (!o?.selector || bySelector.has(o.selector)) continue;
    bySelector.set(o.selector, o);
  }

  const popupLike = [...bySelector.values()].filter((o) => {
    const blob = `${o.cmsName || ''} ${o.type || ''} ${o.folderName || ''}`.toLowerCase();
    // Layover popups / floating chrome — not in-flow page bands.
    return /cookie|consent|privacy|chat|widget|float|side.?button|sticky.?cta|modal|dialog|overlay|banner|topbar|top-bar|header|navigation|nav|lang|locale|suggested|scroll.?reveal/.test(
      blob,
    );
  });

  const measured = await page.evaluate((overlays) => {
    return overlays.map((o) => {
      let el = null;
      try {
        el = document.querySelector(o.selector);
      } catch {
        el = null;
      }
      if (!el) {
        return { ...o, top: 0, height: 0, bottom: 0, width: 0, visible: false, heading: null };
      }
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      let box = rect;
      const media = el.querySelector?.('img, svg, canvas, iframe, video');
      if (
        rect.width <= 120 &&
        rect.height <= 120 &&
        media instanceof Element
      ) {
        const mr = media.getBoundingClientRect();
        if (mr.width >= 12 && mr.height >= 12 && mr.width <= rect.width + 8 && mr.height <= rect.height + 8) {
          box = mr;
        }
      }
      const left = Math.round(box.left);
      const right = Math.round(box.right);
      const top = Math.round(box.top + window.scrollY);
      const height = Math.round(box.height);
      const heading =
        el.querySelector?.('h1, h2, h3, p, a, span')?.textContent?.trim()?.replace(/\s+/g, ' ').slice(0, 80) ||
        (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) ||
        null;
      const isCmp =
        /cookie|consent|privacy/i.test(`${o.cmsName || ''} ${o.type || ''} ${o.folderName || ''}`);
      let html = null;
      if (isCmp) {
        try {
          html = el.outerHTML || null;
        } catch {
          html = null;
        }
      }
      return {
        ...o,
        top,
        height,
        bottom: top + height,
        left,
        right,
        width: Math.round(box.width),
        visible:
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity || '1') > 0.05 &&
          rect.width > 8 &&
          rect.height > 8,
        heading,
        position: style.position,
        html,
      };
    });
  }, popupLike);

  const mapped = measured
    .filter((o) => o.visible && o.height >= 12)
    .map((o, index) => {
      const cmsName = toPascalCase(o.cmsName || 'Overlay');
      const type = o.type || typeFromGenericName(cmsName);
      return {
        cmsName,
        folderName: o.folderName || toFolderName(cmsName),
        name: o.folderName || toFolderName(cmsName),
        selector: o.selector,
        roots: o.selector
          ? [{ selector: o.selector, tag: '', className: '', heading: o.heading || null, hints: ['overlay'], height: o.height }]
          : [],
        heading: o.heading || null,
        reason: `HybridSectionDetector: layover overlay (${o.cmsName})`,
        type,
        componentType: cmsName,
        scope: 'site',
        order: index,
        source: 'hybrid-section-overlay',
        // Provisional — stampChromeKindOnSections overwrites track/isOverlay.
        track: 'overlay',
        opencv: null,
        className: '',
        tag: '',
        hints: ['overlay', type || 'popup', o.position === 'fixed' || o.position === 'sticky' ? 'sticky' : null].filter(
          Boolean,
        ),
        isOverlay: true,
        roleDialog: Boolean(o.roleDialog),
        cssLeft: o.left,
        cssRight: o.right,
        cssTop: o.top,
        cssBottom: o.bottom,
        cssHeight: o.height,
        ...(o.html ? { html: o.html } : {}),
      };
    })
    // Prefer named chrome (TopBar/Header) over generic ScrollRevealBar on the same strip.
    // Do not drop Header/TopBar when a CMP dialog overlaps the same Y-range (common with centered cookie modals).
    .sort((a, b) => {
      const rank = (s) =>
        /cookie|consent/i.test(s.cmsName) ? 0 : /topbar|header|nav/i.test(s.cmsName) ? 1 : /scrollreveal/i.test(s.cmsName) ? 3 : 2;
      return rank(a) - rank(b) || a.cssTop - b.cssTop;
    })
    .filter((o, _i, all) => {
      const family = (s) => {
        if (/cookie|consent/i.test(s.cmsName) || /cookie|consent/i.test(s.type || '')) return 'cmp';
        if (/topbar|header|nav|lang|locale/i.test(s.cmsName) || /topbar|header|nav|lang/i.test(s.type || '')) {
          return 'chrome';
        }
        if (/scrollreveal/i.test(s.cmsName)) return 'reveal';
        return 'other';
      };
      const clash = all.find((k) => {
        if (k === o || k.selector === o.selector) return false;
        // CMP dialogs and site chrome can share Y-range without being duplicates.
        if (family(o) === 'cmp' || family(k) === 'cmp') return false;
        // Distinct chrome kinds (lang bar + overlapping header) may stack — keep both.
        if (family(o) === 'chrome' && family(k) === 'chrome') {
          const sameKind =
            (/header|nav/i.test(o.cmsName) && /header|nav/i.test(k.cmsName)) ||
            (/topbar/i.test(o.cmsName) && /topbar/i.test(k.cmsName)) ||
            (/lang|locale/i.test(o.cmsName) && /lang|locale/i.test(k.cmsName));
          if (!sameKind) return false;
        }
        const overlap = Math.max(0, Math.min(k.cssBottom, o.cssBottom) - Math.max(k.cssTop, o.cssTop));
        const smaller = Math.max(1, Math.min(k.cssHeight || 1, o.cssHeight || 1));
        return overlap / smaller >= 0.7;
      });
      if (!clash) return true;
      const rank = (s) =>
        /cookie|consent/i.test(s.cmsName) ? 0 : /topbar|header|nav/i.test(s.cmsName) ? 1 : /scrollreveal/i.test(s.cmsName) ? 3 : 2;
      return rank(o) < rank(clash) || (rank(o) === rank(clash) && all.indexOf(o) < all.indexOf(clash));
    })
    .map((o, index) => ({ ...o, order: index }));

  // Sticky header stack vs true overlay (clearance / dialog / CMP) — site-generic.
  const layoutCtx = await page.evaluate(() => {
    const vh = window.innerHeight || 900;
    const main =
      document.querySelector('main, [role="main"], #main-content, #main, #content') ||
      null;
    let mainTop = main ? main.getBoundingClientRect().top : NaN;
    if (!Number.isFinite(mainTop)) {
      // First large in-flow block below short top chrome.
      const blocks = [...document.body.querySelectorAll('section, article, div')].slice(0, 80);
      for (const el of blocks) {
        if (el.closest('header, nav, [role="banner"], [role="dialog"], [role="alertdialog"]')) {
          continue;
        }
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        if (['fixed', 'sticky', 'absolute'].includes(st.position)) continue;
        if (r.width < (window.innerWidth || 1440) * 0.5) continue;
        if (r.height < 80) continue;
        if (r.top < 20) continue;
        mainTop = r.top;
        break;
      }
    }
    if (!Number.isFinite(mainTop)) mainTop = 0;
    const htmlPad = Number.parseFloat(window.getComputedStyle(document.documentElement).paddingTop) || 0;
    const bodyPad = Number.parseFloat(window.getComputedStyle(document.body).paddingTop) || 0;
    const scrollPad =
      Number.parseFloat(window.getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    return {
      mainTop,
      bodyPadTop: Math.max(htmlPad, bodyPad, scrollPad),
      viewportHeight: vh,
    };
  });

  // Mark dialog roles from measured DOM when type already says cookie/consent.
  for (const s of mapped) {
    const blob = `${s.cmsName || ''} ${s.type || ''}`.toLowerCase();
    if (/cookie|consent|cmp|gdpr|privacy/.test(blob)) {
      s.roleDialog = true;
      s.type = s.type || 'cookie-banner';
    }
  }

  stampChromeKindOnSections(mapped, layoutCtx);

  // Nested header-stack twins (outer landmark contains inner strip) → keep outer only.
  // Sibling stacked chrome (announcement above nav) is not DOM/rect-contained and stays.
  let domContains = null;
  const headerIdx = mapped
    .map((s, i) => ({ s, i }))
    .filter(
      ({ s }) =>
        String(s?.chromeKind || '').toLowerCase() === 'header-stack' ||
        String(s?.track || '').toLowerCase() === 'header',
    );
  if (headerIdx.length >= 2) {
    try {
      const sels = mapped.map((s) => String(s.selector || ''));
      const matrix = await page.evaluate((selectors) => {
        const els = selectors.map((sel) => {
          if (!sel) return null;
          try {
            return document.querySelector(sel);
          } catch {
            return null;
          }
        });
        return selectors.map((_, i) =>
          selectors.map((__, j) => {
            if (i === j || !els[i] || !els[j]) return false;
            return els[i].contains(els[j]);
          }),
        );
      }, sels);
      if (Array.isArray(matrix)) domContains = matrix;
    } catch {
      domContains = null;
    }
  }

  return dropNestedHeaderStackSections(mapped, { domContains });
}

function runPythonAnnotate(screenshotPath, sectionsJsonPath, outPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'python',
      [PYTHON_ANNOTATE_SCRIPT, '--input', screenshotPath, '--sections', sectionsJsonPath, '--out', outPath],
      { windowsHide: true, env: process.env },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Annotate exited with code ${code}`));
        return;
      }
      resolve((stdout || outPath).trim());
    });
  });
}

function runPythonCrop(screenshotPath, outPath, rect) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'python',
      [
        PYTHON_CROP_SCRIPT,
        '--input',
        screenshotPath,
        '--out',
        outPath,
        '--x0',
        String(Math.round(rect.x0)),
        '--y0',
        String(Math.round(rect.y0)),
        '--x1',
        String(Math.round(rect.x1)),
        '--y1',
        String(Math.round(rect.y1)),
      ],
      { windowsHide: true, env: process.env },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Crop exited with code ${code}`));
        return;
      }
      resolve((stdout || outPath).trim());
    });
  });
}

/**
 * Export each detected section into sections/{ComponentName}/
 * with section.png (crop) + original-section.html (outerHTML when selector resolves).
 */
async function exportSectionBundles(page, {
  outDir,
  overlayScreenshotPath,
  cleanScreenshotPath,
  overlaySections = [],
  contentSections = [],
  cleanSize,
}) {
  const items = [];
  for (const s of overlaySections) {
    items.push({
      cmsName: s.cmsName,
      folderName: s.folderName || toFolderName(s.cmsName),
      selector: s.selector || '',
      track: 'overlay',
      screenshotPath: overlayScreenshotPath,
      rect: { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 },
    });
  }
  for (const s of contentSections) {
    // Prefer clean-screenshot coords when available (opencv y-range on clean).
    const cleanY0 = s.cleanY0 ?? s.y0;
    const cleanY1 = s.cleanY1 ?? s.y1;
    const imgW = cleanSize?.width || s.x1 || 1440;
    items.push({
      cmsName: s.cmsName,
      folderName: s.folderName || toFolderName(s.cmsName),
      selector: s.selector || '',
      track: s.track || 'both',
      screenshotPath: cleanScreenshotPath || overlayScreenshotPath,
      rect: {
        x0: 0,
        y0: cleanY0,
        x1: imgW,
        y1: cleanY1,
      },
    });
  }

  const usedFolders = new Map();
  let count = 0;
  for (const item of items) {
    if (!item.screenshotPath || item.rect.y1 <= item.rect.y0) continue;
    let folder = item.folderName || toFolderName(item.cmsName || 'Section');
    const n = usedFolders.get(folder) || 0;
    usedFolders.set(folder, n + 1);
    if (n > 0) folder = `${folder}-${n + 1}`;

    const sectionDir = path.join(outDir, folder);
    await mkdir(sectionDir, { recursive: true });

    const pngPath = path.join(sectionDir, 'section.png');
    await runPythonCrop(item.screenshotPath, pngPath, item.rect);

    let html = '';
    if (item.selector) {
      try {
        html = await page.evaluate((sel) => {
          let el = null;
          try {
            el = document.querySelector(sel);
          } catch {
            el = null;
          }
          return el ? el.outerHTML : '';
        }, item.selector);
      } catch {
        html = '';
      }
    }
    const htmlPath = path.join(sectionDir, 'original-section.html');
    const metaPath = path.join(sectionDir, 'section-information.json');
    await writeFile(htmlPath, html || `<!-- no HTML for selector: ${item.selector || '(none)'} -->\n`, 'utf8');
    await writeFile(
      metaPath,
      `${JSON.stringify(
        {
          cmsName: item.cmsName,
          folderName: folder,
          selector: item.selector || null,
          track: item.track,
          rect: item.rect,
          screenshotSource: path.basename(item.screenshotPath),
          hasHtml: Boolean(html),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    count += 1;
  }
  return count;
}

/** @param {string} screenshotPath @param {object[]} annotateSections @param {string} outPath */
export async function annotateHybridSections(screenshotPath, annotateSections, outPath) {
  const tmpJson = `${outPath}.json`;
  await writeFile(tmpJson, `${JSON.stringify({ sections: annotateSections }, null, 2)}\n`, 'utf8');
  return runPythonAnnotate(screenshotPath, tmpJson, outPath);
}

function finalizeSectionNames(sections) {
  const seen = new Map();
  for (const s of sections) {
    const base = s.cmsName;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    if (n > 0) {
      s.cmsName = `${base}${n + 1}`;
      s.folderName = toFolderName(s.cmsName);
      s.name = s.folderName;
    }
  }
  return sections;
}

/**
 * Full HybridSectionDetector pipeline for one URL (screenshot must already exist).
 * Semantic landmarks first, OpenCV visual second, then reconcile + annotate.
 *
 * @param {import('playwright').Page} page
 * @param {string} url
 * @param {{
 *   capturesDir?: string,
 *   screenshotPath?: string,
 *   overlaySections?: object[],
 *   overlaysAlreadyHidden?: boolean,
 *   skipReady?: boolean,
 *   exportBundles?: boolean,
 * }} [options]
 */
export async function runHybridSectionDetector(page, url, options = {}) {
  const resolved = options.screenshotPath
    ? {
        screenshotPath: options.screenshotPath,
        pageDir: path.dirname(path.dirname(options.screenshotPath)),
        host: hostSlugFromUrl(url),
        pageSlug: slugFromUrl(url),
      }
    : await resolveDesktopScreenshot(url, options.capturesDir || defaultCapturesDir);

  if (!resolved.screenshotPath) {
    return {
      error: `No desktop screenshot found. Run: npm run capture:webpage -- --urls "${url}" --devices desktop`,
      sections: [],
      screenshotPath: null,
      bands: [],
      overlays: [],
    };
  }

  // Layover popups: prefer caller-precomputed (detected while still visible) to avoid reload.
  const overlaySections = Array.isArray(options.overlaySections)
    ? options.overlaySections
    : await detectOverlaySectionsInPage(page, { skipReady: options.skipReady === true });

  // Track 1 — semantic / structural CMS chapters (section tags + layout children).
  const semanticDiscovery = await discoverSemanticCmsSectionsInPage(page);
  const semanticRaw = semanticDiscovery.sections || [];
  const semanticMeta = semanticDiscovery.meta || {};

  // Track 2 — OpenCV visual bands → DOM (Renault-style second opinion).
  const shotsDir = pageScreenshotsDir(resolved.pageDir);
  const outDir = pageSectionsDir(resolved.pageDir);
  await mkdir(shotsDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  const cvResult = await findBandsWithOpenCv(resolved.screenshotPath, { outDir: shotsDir });
  const visualSections = await mapOpenCvBandsToDom(page, cvResult.bands, {
    imageWidth: cvResult.imageWidth,
    imageHeight: cvResult.imageHeight,
  });

  const pageHeightCss = semanticMeta.pageHeight || (await page.evaluate(() =>
    Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
  ));

  const reconciled = reconcileHybridSections(semanticRaw, visualSections, {
    pageHeightCss,
    imageHeight: cvResult.imageHeight,
    semanticMeta,
  });

  const contentSections = reconciled.sections.map((s, index) => {
    const chapterHeight = s.height || (s.bottom - s.top) || 0;
    const genericName = nameBandGenerically({
      index,
      bandHeight: chapterHeight,
      pageHeight: pageHeightCss,
      top: s.top || 0,
      hints: s.hints || [],
      heading: s.heading || '',
      className: s.className || '',
      tag: s.tag || '',
    });
    const track = s.track || 'semantic';
    return {
      cmsName: genericName,
      folderName: toFolderName(genericName),
      name: toFolderName(genericName),
      selector: s.selector,
      roots: s.roots || [
        {
          selector: s.selector,
          tag: s.tag,
          className: s.className,
          heading: s.heading || null,
          hints: s.hints || [],
          height: s.height,
          top: s.top,
        },
      ],
      heading: s.heading || null,
      reason:
        track === 'both'
          ? `HybridSectionDetector: semantic chapter confirmed by OpenCV (${reconciled.mode})`
          : track === 'visual'
            ? `HybridSectionDetector: OpenCV visual gap-fill (${reconciled.mode})`
            : `HybridSectionDetector: semantic/structural chapter (${reconciled.mode})`,
      type: typeFromGenericName(genericName),
      componentType: genericName,
      scope: genericName === 'Footer' || genericName === 'Header' || genericName === 'TopBar' ? 'site' : 'page',
      order: index,
      source: `hybrid-section-${track}`,
      track,
      opencv: s.opencv,
      className: s.className || '',
      tag: s.tag || '',
      hints: [...(s.hints || [])],
      landmark: Boolean(s.landmark),
      cssTop: s.top,
      cssBottom: s.bottom ?? s.top + s.height,
    };
  });

  const sections = finalizeSectionNames(
    [...overlaySections, ...contentSections].map((s, i) => ({ ...s, order: i })),
  );

  // Clean-screenshot y-ranges (for per-component crops); no separate annotatedClean PNG.
  const cleanSize = await readPngSize(resolved.screenshotPath).catch(() => ({
    width: cvResult.imageWidth,
    height: cvResult.imageHeight,
  }));
  const cleanAnnotatePayload = contentSections.map((s) => ({
    label: s.cmsName,
    cmsName: s.cmsName,
    folderName: s.folderName || toFolderName(s.cmsName),
    selector: s.selector || s.roots?.[0]?.selector || '',
    x0: 6,
    x1: Math.max(7, (cleanSize.width || cvResult.imageWidth) - 6),
    y0: s.opencv?.y0 ?? 0,
    y1: s.opencv?.y1 ?? 0,
    track: s.track,
    heading: s.heading || '',
  }));

  // detected-sections.png: always paint onto desktop-clean.png (content bands only).
  // If clean is missing, skip the PNG (no dirty fallback, no crash). Identification JSON unchanged.
  let annotatedPath = null;
  let detectedSectionsJsonPath = null;
  /** @type {object[]} */
  let annotatePayload = [];
  const cleanCanvasPath = pageScreenshotPath(resolved.pageDir, 'desktop-clean.png');
  const dirtyCanvasPath = pageScreenshotPath(resolved.pageDir, 'desktop.png');
  let cleanExists = false;
  try {
    await access(cleanCanvasPath);
    cleanExists = true;
  } catch {
    /* missing */
  }
  /** @type {string|null} sizing shot for JSON mapping (clean preferred; dirty only if clean absent) */
  let sizingScreenshotPath = cleanExists ? cleanCanvasPath : null;
  if (!sizingScreenshotPath) {
    try {
      await access(dirtyCanvasPath);
      sizingScreenshotPath = dirtyCanvasPath;
    } catch {
      sizingScreenshotPath = resolved.screenshotPath || null;
    }
  }
  const overlayScreenshotPath = cleanExists ? cleanCanvasPath : null;
  if (cleanExists) {
    console.log(`  detected-sections base: desktop-clean.png`);
  } else {
    console.log(`  detected-sections.png: skipped (desktop-clean.png missing)`);
  }

  if (sizingScreenshotPath) {
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      if (!options.skipReady && !options.overlaysAlreadyHidden) {
        await waitUntilPageReady(page, {
          light: true,
          skipNetworkIdle: true,
          imagesTimeoutMs: 2000,
          label: 'hybrid-annotate',
        });
      }
      const overlaySize = await readPngSize(sizingScreenshotPath);
      // When overlays were already hidden, live measure returns empty — use precomputed CSS boxes.
      const live =
        options.overlaysAlreadyHidden === true
          ? await page.evaluate(() => ({
              boxes: [],
              viewportWidth: window.innerWidth || 1440,
              clientWidth: document.documentElement?.clientWidth || window.innerWidth || 1440,
              pageHeight: Math.max(
                document.documentElement?.scrollHeight || 0,
                document.body?.scrollHeight || 0,
              ),
            }))
          : await measureOverlayBoxesInPage(
              page,
              overlaySections.map((s) => ({
                selector: s.selector,
                cmsName: s.cmsName,
                type: s.type,
                folderName: s.folderName,
                heading: s.heading,
              })),
            );
      const cssW = Math.max(1, live.viewportWidth || 1440);
      const clientW = Math.max(1, live.clientWidth || cssW);
      const cssH = Math.max(1, live.pageHeight || pageHeightCss);
      const pageYScale = overlaySize.height / cssH;
      const dprScale = fixedOverlayImageScale({
        imgW: overlaySize.width,
        imgH: overlaySize.height,
        cssW,
        cssH,
      });
      const paintW = resolveOverlayPaintWidth({
        imgW: overlaySize.width,
        innerW: cssW,
        clientW,
      });
      const overlayXScale = (dprScale * paintW) / clientW;

      const overlaySource =
        live.boxes?.length > 0
          ? live.boxes
          : overlaySections.map((s) => ({
              cmsName: s.cmsName,
              heading: s.heading,
              selector: s.selector,
              left: s.cssLeft ?? 0,
              right: s.cssRight ?? cssW,
              top: s.cssTop ?? 0,
              bottom: s.cssBottom ?? (s.cssTop || 0) + (s.cssHeight || 40),
              position: 'fixed',
              vpLeft: s.cssLeft ?? 0,
              vpTop: s.cssTop ?? 0,
              vpRight: s.cssRight ?? cssW,
              vpBottom: (s.cssTop || 0) + (s.cssHeight || 40),
              width: (s.cssRight ?? cssW) - (s.cssLeft ?? 0),
              height: s.cssHeight || 40,
            }));

      const overlayAnnotatePayload = overlaySource.map((b) => {
        const track = b.track || (b.isOverlay === false ? 'header' : 'overlay');
        if (typeof b.vpTop === 'number') {
          return {
            label: b.cmsName,
            cmsName: b.cmsName,
            selector: b.selector || '',
            ...mapFixedOverlayToImage(b, {
              imgW: overlaySize.width,
              imgH: overlaySize.height,
              paintW,
              clientW,
              dprScale,
            }),
            track,
            ...(b.chromeKind ? { chromeKind: b.chromeKind } : {}),
            ...(b.isOverlay === false ? { isOverlay: false } : { isOverlay: true }),
            heading: b.heading || '',
          };
        }
        const rect = cssBoxToImageRect(
          { left: b.left ?? b.cssLeft, right: b.right ?? b.cssRight, top: b.top ?? b.cssTop, bottom: b.bottom ?? b.cssBottom },
          { imgW: overlaySize.width, imgH: overlaySize.height, cssW: paintW, cssH },
        );
        return {
          label: b.cmsName,
          cmsName: b.cmsName,
          selector: b.selector || '',
          ...rect,
          track,
          ...(b.chromeKind ? { chromeKind: b.chromeKind } : {}),
          ...(b.isOverlay === false ? { isOverlay: false } : { isOverlay: true }),
          heading: b.heading || '',
        };
      });

      const contentOnOverlayPayload = contentSections
        .map((s) => {
          const y0 = Math.max(0, Math.round((s.cssTop ?? 0) * pageYScale));
          const y1 = Math.max(y0 + 1, Math.round((s.cssBottom ?? (s.cssTop || 0) + 40) * pageYScale));
          return {
            label: s.cmsName,
            cmsName: s.cmsName,
            selector: s.selector || s.roots?.[0]?.selector || '',
            folderName: s.folderName || toFolderName(s.cmsName),
            x0: 6,
            x1: Math.max(7, overlaySize.width - 6),
            y0,
            y1,
            track: s.track,
            heading: s.heading || '',
          };
        })
        .filter((s) => {
          // TopBar is nested utility chrome — must not delete a taller content Header.
          if (!isHeaderLikeName(s.cmsName)) return true;
          return !overlayAnnotatePayload.some(
            (o) => isHeaderSuppressorName(o.cmsName) && yOverlapRatio(s, o) >= 0.65,
          );
        });

      // Close small vertical gutters (AXA utility margins ~64–80px) so annotate bands tile.
      const MAX_GAP_CLOSE_PX = 100;
      contentOnOverlayPayload.sort((a, b) => a.y0 - b.y0);
      for (let i = 0; i < contentOnOverlayPayload.length - 1; i++) {
        const cur = contentOnOverlayPayload[i];
        const next = contentOnOverlayPayload[i + 1];
        const gap = next.y0 - cur.y1;
        if (gap > 0 && gap < MAX_GAP_CLOSE_PX) {
          cur.y1 = next.y0;
        }
      }

      for (const o of overlayAnnotatePayload) {
        o.folderName = toFolderName(o.cmsName);
      }

      const combinedPayload = [...overlayAnnotatePayload, ...contentOnOverlayPayload].map(
        (s, i) => {
          const fromOverlay = overlaySections.find(
            (o) => o.selector === s.selector || o.cmsName === s.cmsName,
          );
          const track = fromOverlay?.track || s.track;
          const isHeader = track === 'header' || fromOverlay?.chromeKind === 'header-stack';
          const isFloat =
            !isHeader &&
            (fromOverlay?.isOverlay === true ||
              s.isOverlay === true ||
              track === 'overlay');
          return {
            ...s,
            index: i + 1,
            label: String(i + 1),
            ...(fromOverlay?.html ? { html: fromOverlay.html } : {}),
            ...(fromOverlay?.chromeKind ? { chromeKind: fromOverlay.chromeKind } : {}),
            ...(isHeader
              ? { isOverlay: false, track: 'header' }
              : isFloat
                ? { isOverlay: true, track: track || 'overlay' }
                : {}),
          };
        },
      );
      annotatePayload = combinedPayload;
      detectedSectionsJsonPath = path.join(resolved.pageDir, 'detected-sections.json');
      const detectedSectionsPngPath = path.join(resolved.pageDir, 'detected-sections.png');
      await writeFile(
        detectedSectionsJsonPath,
        `${JSON.stringify(
          {
            url,
            generatedAt: new Date().toISOString(),
            image: { width: overlaySize.width, height: overlaySize.height },
            css: { viewportWidth: cssW, clientWidth: clientW, pageHeight: cssH },
            mapping: {
              overlayPxScale: dprScale,
              overlayXScale,
              paintW,
              pageYScale,
            },
            sections: combinedPayload,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );

      // PNG: content bands only (no CMP/overlay rectangles), always on desktop-clean.png.
      if (cleanExists) {
        const pngPayload = contentOnOverlayPayload.map((s, i) => ({
          ...s,
          index: i + 1,
          label: String(i + 1),
        }));
        const pngAnnotateJsonPath = path.join(resolved.pageDir, '.detected-sections-png.json');
        await writeFile(
          pngAnnotateJsonPath,
          `${JSON.stringify({ sections: pngPayload }, null, 2)}\n`,
          'utf8',
        );
        try {
          annotatedPath = await runPythonAnnotate(
            cleanCanvasPath,
            pngAnnotateJsonPath,
            detectedSectionsPngPath,
          );
          console.log(`  detected-sections: ${annotatedPath} (base desktop-clean.png)`);
        } finally {
          try {
            await unlink(pngAnnotateJsonPath);
          } catch {
            /* ignore */
          }
        }
      }

      // Legacy crop-only bundles (optional). Prefer exportDetectedSections from capture.mjs.
      if (options.exportBundles === true) {
        try {
          const exported = await exportSectionBundles(page, {
            outDir,
            overlayScreenshotPath: cleanExists ? cleanCanvasPath : sizingScreenshotPath,
            cleanScreenshotPath: resolved.screenshotPath,
            overlaySections: overlayAnnotatePayload,
            contentSections: contentOnOverlayPayload.map((s) => {
              const src = contentSections.find((c) => c.cmsName === s.cmsName);
              const clean = cleanAnnotatePayload.find((c) => c.cmsName === s.cmsName);
              return {
                ...s,
                selector: s.selector || src?.selector || clean?.selector || '',
                folderName: s.folderName || clean?.folderName || toFolderName(s.cmsName),
                cleanY0: clean?.y0 ?? s.y0,
                cleanY1: clean?.y1 ?? s.y1,
              };
            }),
            cleanSize,
          });
          console.log(`  section bundles: ${exported} folder(s) under ${outDir}`);
        } catch (exportErr) {
          console.warn(
            `  ⚠ section bundles failed: ${exportErr instanceof Error ? exportErr.message : exportErr}`,
          );
        }
      }
    } catch (err) {
      console.warn(
        `  ⚠ detected-sections annotate failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  try {
    await writeFile(
      path.join(shotsDir, 'hybrid-summary.json'),
      `${JSON.stringify(
        {
          mode: reconciled.mode,
          meta: reconciled.meta,
          visualCount: visualSections.length,
          kept: contentSections.map((s) => ({
            cmsName: s.cmsName,
            selector: s.selector,
            track: s.track,
            heading: s.heading,
            opencv: s.opencv,
          })),
          overlays: overlaySections.map((s) => ({
            cmsName: s.cmsName,
            selector: s.selector,
            cssLeft: s.cssLeft,
            cssRight: s.cssRight,
            cssTop: s.cssTop,
            cssBottom: s.cssBottom,
            heading: s.heading,
          })),
          detectedSectionsPng: annotatedPath,
          detectedSectionsJson: detectedSectionsJsonPath,
          overlayScreenshotPath,
          sectionsDir: outDir,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  } catch {
    /* ignore */
  }

  return {
    error: null,
    sections,
    overlays: overlaySections,
    annotatePayload,
    semantic: semanticRaw,
    visual: visualSections,
    reconcile: reconciled.meta,
    screenshotPath: resolved.screenshotPath,
    overlayScreenshotPath,
    bands: cvResult.bands,
    imageWidth: cvResult.imageWidth,
    imageHeight: cvResult.imageHeight,
    annotatedPath,
    detectedSectionsJsonPath,
    detectedSectionsPngPath: annotatedPath,
    pageDir: resolved.pageDir,
    sectionsDir: outDir,
    shotsDir,
    engine: `hybrid:${reconciled.mode}+${cvResult.engine || 'opencv'}`,
    opencvVersion: cvResult.opencvVersion,
  };
}
