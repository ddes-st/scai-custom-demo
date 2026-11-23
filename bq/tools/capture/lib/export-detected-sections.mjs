/**
 * Export page-local section assets from hybrid detectedSections.
 * Positional folders (section-01, …) with per-slot HTML hash reuse — no full wipe.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile, access, rm, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pageScreenshotPath, pageSectionsDir } from './page-layout.mjs';
import { saveSectionHtml } from './save-section-html.mjs';
import { saveSectionStyledHtml } from './save-section-styled-html.mjs';
import {
  ORIGINAL_SECTION_HTML,
  SECTION_HTML,
  readOriginalSectionHtml,
} from './section-html-files.mjs';
import {
  hideAllStickyOverlaysInPage,
  withSiblingOverlaysHidden,
} from './sticky-overlays.mjs';
import { nameDetectedSections } from './component-mapper/index.mjs';
import {
  captureInteractiveStatesForSection,
  sectionHasInteractiveTriggers,
} from './interactive-states.mjs';
import { screenshotSectionHtmlAtViewport } from './screenshot-section-html.mjs';
import {
  enrichSectionInfosWithChromeStack,
  probeSectionScrollBehavior,
  shouldDeepScrollProbe,
} from './section-scroll-behavior.mjs';
import {
  mergeMotionGeometryByDevice,
  probeMotionGeometry,
} from './motion-geometry-probe.mjs';
import {
  isChromeExportTrack,
  isFloatOverlaySection,
} from './chrome-kind-classify.mjs';
import {
  VIEWPORTS,
  resolveScreenshotDevices,
  deviceFileSlug,
  ensureOverlayScrollbars,
  warnIfLayoutWidthShrunk,
} from './viewports.mjs';
import {
  withChromeCaptureMode,
  detectChromePresentationVariants,
  looksLikeChromeOverlaySection,
} from './overlay-chrome-capture.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_CROP_SCRIPT = path.join(__dirname, 'hybrid-section-crop.py');
const PYTHON_TRIM_SCRIPT = path.join(__dirname, 'trim-section-edges.py');

const CMP_OVERLAY_RE =
  /cookie|consent|onetrust|cmp|didomi|osano|cookiebot|gdpr|privacy.?banner|trustcommander|usercentrics/i;

const SECTION_SLOT_RE = /^section-\d+$/;

/** Authentic closed chrome can be taller than the old 160px heuristic (two rows, large logo). */
export const SHORT_FULL_BLEED_MAX_PX = 220;

/** Fallback ceiling inside tighten when the root is inflated and neighbor clamp is unavailable. */
export const TIGHTEN_CHROME_FALLBACK_MAX_PX = 220;

/** @param {number} index 1-based band order */
export function positionalSectionFolder(index) {
  const n = Number(index);
  const i = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  return `section-${String(i).padStart(2, '0')}`;
}

/**
 * True when a section may be used as a vertical neighbor for crop clamp.
 * Skips float-overlay / CMP dialogs so they never become prevBottom/nextTop.
 * Header-stack and body bands are eligible.
 * @param {{ track?: string, isOverlay?: boolean, chromeKind?: string }|null|undefined} s
 */
export function isBodyNeighborSection(s) {
  return Boolean(s) && !isFloatOverlaySection(s);
}

/**
 * Nearest prev/next selectors among body + header-stack bands (skip float-overlay/CMP).
 * @param {Array<{ selector?: string, track?: string, isOverlay?: boolean, chromeKind?: string }>} ordered
 * @param {number} index
 * @returns {{ prevSelector: string|null, nextSelector: string|null }}
 */
export function resolveBodyNeighborSelectors(ordered, index) {
  const list = Array.isArray(ordered) ? ordered : [];
  let prevSelector = null;
  let nextSelector = null;
  for (let i = index - 1; i >= 0; i -= 1) {
    const s = list[i];
    if (isBodyNeighborSection(s) && s?.selector) {
      prevSelector = s.selector;
      break;
    }
  }
  for (let i = index + 1; i < list.length; i += 1) {
    const s = list[i];
    if (isBodyNeighborSection(s) && s?.selector) {
      nextSelector = s.selector;
      break;
    }
  }
  return { prevSelector, nextSelector };
}

/**
 * Whether resting crops should neighbor-clamp this section.
 * Header-stack + body: yes. Float overlays (CMP etc.): no.
 * @param {{ track?: string, isOverlay?: boolean, chromeKind?: string }|null|undefined} s
 */
export function shouldNeighborClampSection(s) {
  return isBodyNeighborSection(s);
}

/**
 * Clamp a closed chrome (header-stack) rect using next body top only when that
 * top is real clearance below the bar — not when the body underlays a fixed /
 * hide-on-scroll overlay-like header (nextTop inside/under the chrome band).
 * Input rect should already be tightenChrome'd (control-row), not the inflated root.
 *
 * @param {{ x0: number, y0: number, x1: number, y1: number, width?: number, height?: number }} rect
 * @param {{ prevBottom?: number|null, nextTop?: number|null }|null|undefined} edges
 * @param {{ minClosedPx?: number }} [opts]
 */
export function clampChromeRectToBodyNeighbor(rect, edges, opts = {}) {
  if (!rect) return rect;
  const minClosedPx = Number.isFinite(opts.minClosedPx) ? Number(opts.minClosedPx) : 48;
  let { x0, y0, x1, y1 } = rect;
  const eps = 1;

  if (Number.isFinite(edges?.prevBottom)) {
    y0 = Math.max(y0, /** @type {number} */ (edges.prevBottom) + eps);
  }

  if (Number.isFinite(edges?.nextTop)) {
    const nextTop = /** @type {number} */ (edges.nextTop);
    // Clearance: next body starts at/after a plausible closed chrome height.
    const clearanceOk = nextTop >= y0 + minClosedPx;
    if (clearanceOk && nextTop - eps < y1) {
      y1 = nextTop - eps;
    }
    // Underlay / missing clearance: keep tightened y1 (do not restore inflated root).
  }

  if (y1 <= y0 + 2) {
    return rect;
  }
  return {
    ...rect,
    x0,
    y0,
    x1,
    y1,
    width: Math.max(1, x1 - x0),
    height: Math.max(1, y1 - y0),
  };
}

/**
 * Apply neighbor clamp: header-stack uses clearance-aware chrome clamp; body uses full clamp.
 * Soft-caps residual inflated chrome heights.
 * @param {{ track?: string, isOverlay?: boolean, chromeKind?: string }|null|undefined} section
 * @param {{ x0: number, y0: number, x1: number, y1: number, width?: number, height?: number }} rect
 * @param {{ prevBottom?: number|null, nextTop?: number|null }|null|undefined} edges
 */
export function applySectionNeighborClamp(section, rect, edges) {
  if (!rect) return rect;
  const isChromeHeader =
    isChromeExportTrack(section) && !isFloatOverlaySection(section);
  let next = isChromeHeader
    ? clampChromeRectToBodyNeighbor(rect, edges)
    : clampRectToNeighbors(rect, edges);
  if (
    isChromeHeader &&
    next &&
    next.y1 - next.y0 > TIGHTEN_CHROME_FALLBACK_MAX_PX
  ) {
    next = {
      ...next,
      y1: next.y0 + TIGHTEN_CHROME_FALLBACK_MAX_PX,
      height: TIGHTEN_CHROME_FALLBACK_MAX_PX,
    };
  }
  return next;
}

/**
 * Pure closed-chrome Y tighten (mirrors page.evaluate tightenChrome).
 * Neighbor clamp is applied separately and is the primary bleed guard.
 * @param {{
 *   rootTop: number,
 *   rootBottom: number,
 *   rootHeight: number,
 *   rootWidth: number,
 *   vw: number,
 *   vh: number,
 *   controlTops?: number[],
 *   controlBottoms?: number[],
 * }} input
 * @returns {{ y0: number, y1: number, path: 'short-full-bleed'|'control-union'|'fallback-strip'|'root' }}
 */
export function tightenClosedChromeY(input) {
  const rootTop = Number(input?.rootTop) || 0;
  const rootBottom = Number(input?.rootBottom) || rootTop;
  const rootHeight = Number(input?.rootHeight) || Math.max(0, rootBottom - rootTop);
  const rootWidth = Number(input?.rootWidth) || 0;
  const vw = Number(input?.vw) || 1440;
  const vh = Number(input?.vh) || 900;
  const controlTops = Array.isArray(input?.controlTops) ? input.controlTops : [];
  const controlBottoms = Array.isArray(input?.controlBottoms) ? input.controlBottoms : [];

  const shortFullBleed =
    rootHeight <= SHORT_FULL_BLEED_MAX_PX && rootWidth >= vw * 0.65 && rootTop <= 120;
  if (shortFullBleed) {
    return { y0: rootTop, y1: rootBottom, path: 'short-full-bleed' };
  }

  if (controlTops.length && controlBottoms.length) {
    let y0 = Math.min(rootTop, ...controlTops);
    let y1 = Math.max(...controlBottoms);
    y0 = Math.max(rootTop, Math.min(y0, rootTop + 8));
    y1 = Math.min(rootBottom, Math.max(y1, y0 + 56));
    // Soft fallback only — do not re-expand toward inflated root.bottom (removed contentH).
    const maxChrome = Math.min(TIGHTEN_CHROME_FALLBACK_MAX_PX, Math.max(64, vh * 0.28));
    if (y1 - y0 > maxChrome) y1 = y0 + maxChrome;
    return { y0, y1, path: 'control-union' };
  }

  if (rootHeight > 140) {
    return {
      y0: rootTop,
      y1: Math.min(rootBottom, rootTop + 112),
      path: 'fallback-strip',
    };
  }
  return { y0: rootTop, y1: rootBottom, path: 'root' };
}

/**
 * Normalize section HTML for contentHash.
 * Strips all data-* attributes (volatile CMP/runtime ids such as
 * data-modalloaded / data-osbloaded) so cross-page twins hash equal when
 * authorable markup matches.
 */
export function normalizeSectionHtmlForHash(html) {
  return String(html || '')
    .replace(/\r\n/g, '\n')
    // Quoted data-* attrs (double or single quotes)
    .replace(/\s+data-[a-zA-Z0-9:_-]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    // Unquoted data-* attrs
    .replace(/\s+data-[a-zA-Z0-9:_-]+\s*=\s*[^\s>]+/gi, '')
    // Boolean / valueless data-* attrs
    .replace(/\s+data-[a-zA-Z0-9:_-]+(?=[\s>])/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sectionContentHash(html) {
  return createHash('sha256').update(normalizeSectionHtmlForHash(html), 'utf8').digest('hex');
}

/** True when this overlay band is a CMP/consent UI that must crop from dirty (pre-hide) screenshots. */
function isConsentCmpOverlay(section) {
  const blob = [
    section?.cmsName,
    section?.folderName,
    section?.type,
    section?.selector,
    section?.heading,
  ]
    .filter(Boolean)
    .join(' ');
  return CMP_OVERLAY_RE.test(blob);
}

/**
 * Force-open OneTrust / CookiePro preference center (and similar CMP shells)
 * after cookie accept+hide so live HTML/PNG see the full dialog, not a closed strip.
 * @param {import('playwright').Page} page
 * @param {string} [selector]
 */
async function forceOpenCmpPreferenceCenter(page, selector = '') {
  await page.evaluate(async (sel) => {
    const clearInlineHide = (el) => {
      if (!(el instanceof HTMLElement)) return;
      el.style.removeProperty('display');
      el.style.removeProperty('visibility');
      el.style.removeProperty('opacity');
      el.style.removeProperty('pointer-events');
      el.style.removeProperty('height');
      el.style.removeProperty('overflow');
      el.style.removeProperty('position');
      if (el.getAttribute('aria-hidden') === 'true') el.removeAttribute('aria-hidden');
      el.removeAttribute('data-screenshot-hidden');
    };

    const show = (el) => {
      if (!(el instanceof HTMLElement)) return;
      clearInlineHide(el);
      el.style.setProperty('display', 'block', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
    };

    const consent =
      document.querySelector('#onetrust-consent-sdk') ||
      (sel
        ? (() => {
            try {
              return document.querySelector(sel)?.closest?.(
                '#onetrust-consent-sdk, [id*="onetrust" i], [class*="onetrust" i]',
              );
            } catch {
              return null;
            }
          })()
        : null);

    const pc =
      document.querySelector('#onetrust-pc-sdk') ||
      document.querySelector('.otPcCenter') ||
      (sel
        ? (() => {
            try {
              return document.querySelector(sel);
            } catch {
              return null;
            }
          })()
        : null);

    if (!(pc instanceof HTMLElement) && !(consent instanceof HTMLElement)) return;

    if (consent instanceof HTMLElement) show(consent);
    for (const filter of document.querySelectorAll(
      '.onetrust-pc-dark-filter, .ot-fade-in.onetrust-pc-dark-filter',
    )) {
      show(filter);
    }
    if (pc instanceof HTMLElement) {
      show(pc);
      const dialog = pc.querySelector('[role="alertdialog"], [role="dialog"]');
      if (dialog instanceof HTMLElement) show(dialog);
      const footer = pc.querySelector('.ot-pc-footer');
      if (footer instanceof HTMLElement) show(footer);
    }

    /** @type {any} */
    const ot = globalThis.OneTrust;
    try {
      if (ot && typeof ot.ToggleInfoDisplay === 'function') ot.ToggleInfoDisplay();
      else if (ot && typeof ot.ShowPreferenceCenter === 'function') ot.ShowPreferenceCenter();
    } catch {
      /* ignore API failures — CSS force-show below still helps */
    }

    // Wait briefly for OT animation / layout
    await new Promise((r) => setTimeout(r, 350));

    if (pc instanceof HTMLElement) {
      show(pc);
      const dialog = pc.querySelector('[role="alertdialog"], [role="dialog"]');
      if (dialog instanceof HTMLElement) show(dialog);
      const footer = pc.querySelector('.ot-pc-footer');
      if (footer instanceof HTMLElement) {
        show(footer);
        footer.style.removeProperty('display');
        footer.style.setProperty('visibility', 'visible', 'important');
      }
      const r = pc.getBoundingClientRect();
      if (r.height < 200) {
        const h = Math.max(480, Math.min(720, Math.round(window.innerHeight * 0.75)));
        pc.style.setProperty('height', `${h}px`, 'important');
      }
    }
  }, selector);

  // Give layout a tick after evaluate
  await new Promise((r) => setTimeout(r, 200));
}

/**
 * Ensure CMP original HTML includes #onetrust-consent-sdk shell + open visibility
 * so authored `#onetrust-consent-sdk #onetrust-pc-sdk …` theme rules match.
 * @param {string} html
 * @param {{ heightPx?: number }} [opts]
 */
export function normalizeCmpConsentHtml(html, opts = {}) {
  let raw = String(html || '').trim();
  if (!raw) return raw;

  // Strip closed-state inline styles that hide the preference center.
  raw = raw
    .replace(
      /\sstyle="([^"]*)"/gi,
      (full, style) => {
        let s = String(style || '');
        const looksClosed =
          /visibility\s*:\s*hidden/i.test(s) ||
          /display\s*:\s*none/i.test(s) ||
          /opacity\s*:\s*0(?:\.0+)?(?:\s|;|$)/i.test(s);
        if (!looksClosed) return full;
        s = s
          .replace(/visibility\s*:\s*hidden\s*;?/gi, '')
          .replace(/display\s*:\s*none\s*;?/gi, '')
          .replace(/opacity\s*:\s*0(?:\.0+)?\s*;?/gi, '')
          .trim()
          .replace(/;\s*;/g, ';')
          .replace(/^;|;$/g, '');
        return s ? ` style="${s}"` : '';
      },
    );

  const heightPx =
    Number.isFinite(opts.heightPx) && opts.heightPx > 0
      ? Math.round(opts.heightPx)
      : null;

  const ensurePcHeight = (fragment) => {
    if (!heightPx) return fragment;
    if (/id=["']onetrust-pc-sdk["']/i.test(fragment) && /style="/i.test(fragment)) {
      return fragment.replace(
        /(<div[^>]*id=["']onetrust-pc-sdk["'][^>]*style=")([^"]*)(")/i,
        (m, a, style, c) => {
          let s = style.replace(/height\s*:\s*[^;]+;?/gi, '').trim();
          if (s && !s.endsWith(';')) s += ';';
          s += `height: ${heightPx}px; visibility: visible;`;
          return `${a}${s}${c}`;
        },
      );
    }
    if (/id=["']onetrust-pc-sdk["']/i.test(fragment)) {
      return fragment.replace(
        /(<div[^>]*id=["']onetrust-pc-sdk["'][^>]*)(>)/i,
        `$1 style="height: ${heightPx}px; visibility: visible;"$2`,
      );
    }
    return fragment;
  };

  raw = ensurePcHeight(raw);

  if (/id=["']onetrust-consent-sdk["']/i.test(raw)) {
    return raw;
  }

  // Wrap bare #onetrust-pc-sdk / .otPcCenter in the consent-sdk shell + dark filter.
  if (
    /id=["']onetrust-pc-sdk["']/i.test(raw) ||
    /class=["'][^"']*otPcCenter/i.test(raw)
  ) {
    return (
      `<div id="onetrust-consent-sdk">` +
      `<div class="onetrust-pc-dark-filter ot-fade-in"></div>` +
      raw +
      `</div>`
    );
  }

  return raw;
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
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Crop exited with code ${code}`));
        return;
      }
      resolve(outPath);
    });
  });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPngSize(filePath) {
  const buf = await readFile(filePath);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`Not a PNG: ${filePath}`);
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function fetchSectionHtml(page, selector) {
  if (!selector) return '';
  try {
    return (
      (await page.evaluate((sel) => {
        try {
          const el = document.querySelector(sel);
          return el ? el.outerHTML : '';
        } catch {
          return '';
        }
      }, selector)) || ''
    );
  } catch {
    return '';
  }
}

async function liveElementScreenshot(page, selector, filePath) {
  if (!selector) return false;
  try {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    if (count < 1) return false;
    await locator.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
    await locator.screenshot({
      path: filePath,
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Measure the section box at the *current* viewport (viewport-local coords).
 * For overlay/chrome bands, tighten to the visible chrome control row (logo +
 * actions) while keeping full-bleed width — avoid collapsing to a logo sliver
 * and avoid including off-screen mega-menu panels.
 * Also returns page-absolute coords for full-page PNG crops.
 * @returns {Promise<{
 *   x0: number, y0: number, x1: number, y1: number,
 *   pageX0: number, pageY0: number, pageX1: number, pageY1: number,
 *   width: number, height: number
 * }|null>}
 */
async function measureViewportSectionRect(page, selector, { tightenChrome = false } = {}) {
  if (!selector) return null;
  try {
    return await page.evaluate(
      ({ sel, tightenChrome: tighten }) => {
        let el;
        try {
          el = document.querySelector(sel);
        } catch {
          return null;
        }
        if (!(el instanceof Element)) return null;
        const root = el.getBoundingClientRect();
        if (root.width < 2 || root.height < 2) return null;

        const scrollX = window.scrollX || window.pageXOffset || 0;
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const style = window.getComputedStyle(el);
        const fixedLike = style.position === 'fixed' || style.position === 'sticky';
        const vw = window.innerWidth || 1440;
        const vh = window.innerHeight || 900;

        let x0 = root.left;
        let y0 = root.top;
        let x1 = root.right;
        let y1 = root.bottom;

        if (tighten) {
          // Keep authentic closed chrome (incl. ~170–220px two-row headers).
          // Neighbor clamp (outside evaluate) is the primary bleed guard.
          const shortFullBleedMax = 220;
          const shortFullBleed =
            root.height <= shortFullBleedMax && root.width >= vw * 0.65 && root.top <= 120;
          if (shortFullBleed) {
            // Use the live element box (matches DevTools) — do not over-tighten
            // short chrome roots down to a logo sliver.
            x0 = root.left;
            y0 = root.top;
            x1 = root.right;
            y1 = root.bottom;
          } else {
            // Vertical band for closed chrome row (not open drawers / mega menus).
            const chromeBandBottom =
              root.top + Math.min(Math.max(root.height, 48), shortFullBleedMax);
            /** @type {DOMRect[]} */
            const boxes = [];
            const pushIfChromeControl = (node) => {
              if (!(node instanceof Element)) return;
              const st = window.getComputedStyle(node);
              if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
                return;
              }
              const r = node.getBoundingClientRect();
              if (r.width < 8 || r.height < 8) return;
              if (r.top < root.top - 4 || r.top > chromeBandBottom) return;
              if (r.bottom > chromeBandBottom + 36 && r.height > 48) return;
              if (r.right < 4 || r.left > vw - 4) return;
              if (r.bottom < 0 || r.top > vh) return;
              if (r.height > 120 && r.width > vw * 0.5) return;
              boxes.push(r);
            };

            const controlSel =
              'a, button, img, svg, [role="button"], [class*="logo" i], [class*="button" i], [class*="Icon" i], [class*="action" i], [class*="Label" i], [class*="toggle" i]';
            for (const node of el.querySelectorAll(controlSel)) {
              pushIfChromeControl(node);
            }
            for (const node of el.children) {
              pushIfChromeControl(node);
              for (const child of node.children || []) pushIfChromeControl(child);
            }

            x0 = root.left;
            x1 = root.right;

            if (boxes.length) {
              y0 = Math.min(root.top, ...boxes.map((b) => b.top));
              y1 = Math.max(...boxes.map((b) => b.bottom));
              y0 = Math.max(root.top, Math.min(y0, root.top + 8));
              y1 = Math.min(root.bottom, Math.max(y1, y0 + 56));
              // Soft fallback only — never re-expand toward inflated root.bottom.
              const maxChrome = Math.min(220, Math.max(64, vh * 0.28));
              if (y1 - y0 > maxChrome) y1 = y0 + maxChrome;
            } else if (root.height > 140) {
              y1 = Math.min(root.bottom, root.top + 112);
            }
            if (y1 - y0 < 48) {
              y1 = Math.min(root.bottom, y0 + Math.min(112, Math.max(48, root.height)));
            }
          }
        }

        const pad = 1;
        x0 = Math.floor(x0) - pad;
        y0 = Math.floor(y0) - pad;
        x1 = Math.ceil(x1) + pad;
        y1 = Math.ceil(y1) + pad;

        const pageX0 = Math.round(fixedLike ? x0 : x0 + scrollX);
        const pageY0 = Math.round(fixedLike ? y0 : y0 + scrollY);
        const pageX1 = Math.round(fixedLike ? x1 : x1 + scrollX);
        const pageY1 = Math.round(fixedLike ? y1 : y1 + scrollY);

        return {
          x0,
          y0,
          x1,
          y1,
          pageX0,
          pageY0,
          pageX1,
          pageY1,
          width: Math.max(1, x1 - x0),
          height: Math.max(1, y1 - y0),
        };
      },
      { sel: selector, tightenChrome },
    );
  } catch {
    return null;
  }
}

/**
 * @deprecated Prefer withChromeCaptureMode from overlay-chrome-capture.mjs
 */
async function withOverlayChromeBackdrop(page, selector, fn) {
  return withChromeCaptureMode(page, selector, fn);
}

/**
 * Clip-screenshot using a measured viewport-local rect.
 */
async function clipScreenshot(page, rect, filePath) {
  if (!rect || !(rect.width > 1) || !(rect.height > 1)) return false;
  try {
    const vp = page.viewportSize() || { width: 1440, height: 900 };
    const x = Math.max(0, Math.round(rect.x0));
    const y = Math.max(0, Math.round(rect.y0));
    const width = Math.max(1, Math.min(Math.round(rect.width), vp.width - x));
    const height = Math.max(1, Math.min(Math.round(rect.height), vp.height - y));
    if (width < 2 || height < 2) return false;
    await page.screenshot({
      path: filePath,
      clip: { x, y, width, height },
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Viewport-local bottom/top of neighbor sections for clamp.
 * @returns {Promise<{ prevBottom: number|null, nextTop: number|null }>}
 */
async function measureNeighborEdges(page, prevSelector, nextSelector) {
  return page.evaluate(
    ({ prevSel, nextSel }) => {
      const box = (sel) => {
        if (!sel) return null;
        try {
          const el = document.querySelector(sel);
          if (!(el instanceof Element)) return null;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return null;
          return { top: r.top, bottom: r.bottom };
        } catch {
          return null;
        }
      };
      const prev = box(prevSel);
      const next = box(nextSel);
      return {
        prevBottom: prev ? prev.bottom : null,
        nextTop: next ? next.top : null,
      };
    },
    { prevSel: prevSelector || null, nextSel: nextSelector || null },
  );
}

/**
 * Clamp clip so it does not include previous/next band paint.
 * @param {{ x0: number, y0: number, x1: number, y1: number, width?: number, height?: number }} rect
 * @param {{ prevBottom?: number|null, nextTop?: number|null }|null|undefined} edges
 */
export function clampRectToNeighbors(rect, edges) {
  if (!rect) return rect;
  let { x0, y0, x1, y1 } = rect;
  const eps = 1;
  if (Number.isFinite(edges?.prevBottom)) {
    y0 = Math.max(y0, /** @type {number} */ (edges.prevBottom) + eps);
  }
  if (Number.isFinite(edges?.nextTop)) {
    y1 = Math.min(y1, /** @type {number} */ (edges.nextTop) - eps);
  }
  if (y1 <= y0 + 2) {
    // Clamp collapsed — keep original
    return rect;
  }
  return {
    ...rect,
    x0,
    y0,
    x1,
    y1,
    width: Math.max(1, x1 - x0),
    height: Math.max(1, y1 - y0),
  };
}

/**
 * Temporarily hide closed panels inside chrome so resting measure/shot
 * does not inflate over mega-menu / drawer markup left in the DOM.
 * Does not touch open (aria-hidden=false) panels — menu states keep those visible.
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {() => Promise<T>} fn
 * @template T
 */
async function withClosedChromePanelsCollapsed(page, selector, fn) {
  if (!selector) return fn();
  const token = `bq-closed-chrome-${Date.now().toString(36)}`;
  await page
    .evaluate(
      ({ sel, mark }) => {
        const root = document.querySelector(sel);
        if (!(root instanceof HTMLElement)) return 0;
        let n = 0;
        const rootBox = root.getBoundingClientRect();
        // Closed chrome band guess: short top strip even when the root is inflated.
        const bandH = rootBox.height > 220 ? 140 : Math.min(160, Math.max(48, rootBox.height));
        const bandBottom = rootBox.top + bandH;

        const hide = (el) => {
          if (!(el instanceof HTMLElement)) return;
          if (el.dataset.bqClosedChromeHide === mark) return;
          el.dataset.bqClosedChromeHide = mark;
          el.dataset.bqClosedChromePrevVisibility = el.style.visibility || '';
          el.dataset.bqClosedChromePrevDisplay = el.style.display || '';
          el.dataset.bqClosedChromePrevHeight = el.style.height || '';
          el.dataset.bqClosedChromePrevOverflow = el.style.overflow || '';
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('height', '0', 'important');
          el.style.setProperty('overflow', 'hidden', 'important');
          n += 1;
        };

        /** Keep closed L1 / hamburger / utilities that live in the chrome band. */
        const hasVisibleBandControls = (el) => {
          for (const c of el.querySelectorAll(
            'a, button, [role="button"], [role="link"], [role="menuitem"]',
          )) {
            if (!(c instanceof Element)) continue;
            const st = window.getComputedStyle(c);
            if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
              continue;
            }
            const r = c.getBoundingClientRect();
            if (r.width < 8 || r.height < 8) continue;
            if (r.top >= bandBottom - 2) continue;
            if (r.bottom <= rootBox.top + 2) continue;
            return true;
          }
          return false;
        };

        const mostlyBelowBand = (r) => r.top >= bandBottom - 4;

        for (const el of root.querySelectorAll('[aria-hidden="true"], [hidden]')) {
          if (!(el instanceof HTMLElement)) continue;
          const tag = el.tagName;
          if (tag === 'SVG' || tag === 'I' || tag === 'IMG' || tag === 'SPAN') {
            const r = el.getBoundingClientRect();
            if (r.height <= 48 && r.width <= 48) continue;
          }
          // Geometry-first: never strip visible closed-bar controls.
          if (hasVisibleBandControls(el)) continue;
          const r = el.getBoundingClientRect();
          if (!mostlyBelowBand(r) && r.height <= 160) continue;
          hide(el);
        }

        // Assist selectors only — band geometry + visible controls decide.
        for (const el of root.querySelectorAll(
          '[class*="mega" i], [class*="dropdown" i], [class*="drawer" i], [class*="accordion" i], [class*="navigation-wrapper" i], [role="menu"], [role="dialog"]',
        )) {
          if (!(el instanceof HTMLElement)) continue;
          if (el.getAttribute('aria-hidden') === 'false') continue;
          if (hasVisibleBandControls(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.height < 80) continue;
          if (!mostlyBelowBand(r)) continue;
          hide(el);
        }

        for (const el of root.querySelectorAll('[style*="height"]')) {
          if (!(el instanceof HTMLElement)) continue;
          if (el === root) continue;
          if (hasVisibleBandControls(el)) continue;
          const h = Number.parseFloat(el.style.height);
          if (!Number.isFinite(h) || h < 80) continue;
          if (!mostlyBelowBand(el.getBoundingClientRect())) continue;
          hide(el);
        }
        return n;
      },
      { sel: selector, mark: token },
    )
    .catch(() => 0);
  try {
    return await fn();
  } finally {
    await page
      .evaluate((mark) => {
        for (const el of document.querySelectorAll(`[data-bq-closed-chrome-hide="${mark}"]`)) {
          if (!(el instanceof HTMLElement)) continue;
          const prevVis = el.dataset.bqClosedChromePrevVisibility;
          const prevDisp = el.dataset.bqClosedChromePrevDisplay;
          const prevH = el.dataset.bqClosedChromePrevHeight;
          const prevOv = el.dataset.bqClosedChromePrevOverflow;
          if (prevVis) el.style.visibility = prevVis;
          else el.style.removeProperty('visibility');
          if (prevDisp) el.style.display = prevDisp;
          else el.style.removeProperty('display');
          if (prevH) el.style.height = prevH;
          else el.style.removeProperty('height');
          if (prevOv) el.style.overflow = prevOv;
          else el.style.removeProperty('overflow');
          delete el.dataset.bqClosedChromeHide;
          delete el.dataset.bqClosedChromePrevVisibility;
          delete el.dataset.bqClosedChromePrevDisplay;
          delete el.dataset.bqClosedChromePrevHeight;
          delete el.dataset.bqClosedChromePrevOverflow;
        }
      }, token)
      .catch(() => {});
  }
}

function runPythonTrim(filePath, { chrome = false } = {}) {
  return new Promise((resolve, reject) => {
    const args = ['--input', filePath, '--out', filePath];
    if (chrome) args.push('--chrome');
    const child = spawn('python', [PYTHON_TRIM_SCRIPT, ...args], {
      windowsHide: true,
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += c.toString('utf8');
    });
    child.stderr.on('data', (c) => {
      stderr += c.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Trim exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim() || '{}'));
      } catch {
        resolve({ path: filePath });
      }
    });
  });
}

/**
 * Prior slot screenshots that should not be reused — force a fresh capture pass.
 * - All png-crop (often identical desktop height on every viewport)
 * - Non-interactive slots still on live methods (pre–HTML-first resting shots)
 */
export function priorNeedsScreenshotRefresh(priorInfo) {
  const outs = priorInfo?.outputs;
  if (!outs || typeof outs !== 'object') return false;
  const devices = resolveScreenshotDevices();
  // Missing any configured Sitecore AI crop → refresh on next capture
  if (devices.some((d) => !outs[d]?.path)) return true;
  const methods = devices.map((d) => outs[d]?.method).filter(Boolean);
  if (methods.length < 2) return false;
  // All png-crop (often identical desktop height on every viewport)
  if (methods.every((m) => m === 'png-crop')) return true;

  const interactive =
    Boolean(priorInfo?.interactionSummary) ||
    (priorInfo?.interactionStates != null &&
      typeof priorInfo.interactionStates === 'object');
  // Resting shots for non-interactive sections must be section-html; live
  // methods here mean a stale reuse from before HTML-first (or a failed attempt).
  if (!interactive && methods.some((m) => m && m !== 'section-html')) return true;

  return false;
}

/** @deprecated use priorNeedsScreenshotRefresh */
function priorNeedsCropRefresh(priorInfo) {
  return priorNeedsScreenshotRefresh(priorInfo);
}

/**
 * Temporarily undo sticky-hide styles on a section subtree so interactive
 * discovery / HTML / PNG export can see overlay-track chrome (including CMP
 * `data-screenshot-hidden="cookie"`). Finally re-hides **only** elements this
 * call restored — never `hideAllStickyOverlaysInPage` (that collapses sibling
 * overlays before their HTML/PNG pass).
 * @template T
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {() => Promise<T>} fn
 */
async function withSectionUnhiddenForInteraction(page, selector, fn, opts = {}) {
  if (!selector) return fn();
  await page.evaluate((sel) => {
    const root = (() => {
      try {
        return document.querySelector(sel);
      } catch {
        return null;
      }
    })();
    if (!(root instanceof HTMLElement)) return;

    const restore = (el) => {
      if (!(el instanceof HTMLElement)) return;
      const tag = el.getAttribute('data-screenshot-hidden');
      if (!tag) return;
      // Stash prior hide so finally can restore only this subtree (incl. cookie).
      el.setAttribute('data-bq-was-hidden', tag);
      el.style.removeProperty('display');
      el.style.removeProperty('visibility');
      el.style.removeProperty('position');
      el.style.removeProperty('height');
      el.style.removeProperty('overflow');
      el.style.removeProperty('opacity');
      el.style.removeProperty('pointer-events');
      if (el.getAttribute('aria-hidden') === 'true') el.removeAttribute('aria-hidden');
      el.removeAttribute('data-screenshot-hidden');
    };

    for (let cur = root; cur && cur !== document.body; cur = cur.parentElement) {
      restore(cur);
    }
    root.querySelectorAll('[data-screenshot-hidden]').forEach(restore);

    // Also restore consent-sdk shell / dark filter when unhiding a pc-sdk child.
    const consent = document.querySelector('#onetrust-consent-sdk');
    if (consent instanceof HTMLElement) restore(consent);
    for (const filter of document.querySelectorAll('.onetrust-pc-dark-filter')) {
      restore(filter);
    }
  }, selector);

  if (opts.forceOpenCmp) {
    await forceOpenCmpPreferenceCenter(page, selector);
  }

  try {
    return await fn();
  } finally {
    await page.evaluate((sel) => {
      const root = (() => {
        try {
          return document.querySelector(sel);
        } catch {
          return null;
        }
      })();
      if (!(root instanceof HTMLElement)) return;

      const rehide = (el) => {
        if (!(el instanceof HTMLElement)) return;
        const tag = el.getAttribute('data-bq-was-hidden');
        if (!tag) return;
        el.removeAttribute('data-bq-was-hidden');
        if (tag === 'cookie') {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.setAttribute('aria-hidden', 'true');
          el.setAttribute('data-screenshot-hidden', 'cookie');
          return;
        }
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('position', 'static', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('data-screenshot-hidden', tag);
      };

      for (let cur = root; cur && cur !== document.body; cur = cur.parentElement) {
        rehide(cur);
      }
      root.querySelectorAll('[data-bq-was-hidden]').forEach(rehide);
    }, selector);
  }
}

/**
 * Temporarily hide sticky overlays via injected stylesheet (restorable).
 * @template T
 * @param {import('playwright').Page} page
 * @param {() => Promise<T>} fn
 */
export async function withOverlaysHiddenTemporarily(page, fn) {
  const style = await page.addStyleTag({
    content: `
      [data-screenshot-hidden],
      .osano-cm-window, .osano-cm-dialog, #onetrust-banner-sdk, #onetrust-consent-sdk,
      #CybotCookiebotDialog, #didomi-host, #didomi-popup, .qc-cmp2-container,
      [class*="cookie-banner" i], [class*="cookie-consent" i], [class*="consent-banner" i],
      header[style*="fixed"], [data-bq-temp-hide] {
        /* marker only — actual hide via evaluate below */
      }
    `,
  });
  await page.evaluate(() => {
    const mark = (el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.dataset.bqTempHide === '1') return;
      el.dataset.bqTempHide = '1';
      el.dataset.bqPrevDisplay = el.style.display || '';
      el.dataset.bqPrevVisibility = el.style.visibility || '';
      el.dataset.bqPrevOpacity = el.style.opacity || '';
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
    };
    const selectors = [
      '.osano-cm-window',
      '.osano-cm-dialog',
      '#onetrust-banner-sdk',
      '#onetrust-consent-sdk',
      '#CybotCookiebotDialog',
      '#didomi-host',
      '#didomi-popup',
      '.qc-cmp2-container',
      '[class*="cookie-banner" i]',
      '[class*="cookie-consent" i]',
      '[aria-label*="Cookie Consent" i]',
      '[role="dialog"][aria-label*="cookie" i]',
    ];
    for (const sel of selectors) {
      try {
        document.querySelectorAll(sel).forEach(mark);
      } catch {
        /* ignore */
      }
    }
    for (const el of document.querySelectorAll('header, [role="banner"], nav')) {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky') mark(el);
    }
  });
  try {
    return await fn();
  } finally {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-bq-temp-hide="1"]')) {
        if (!(el instanceof HTMLElement)) continue;
        el.style.display = el.dataset.bqPrevDisplay || '';
        el.style.visibility = el.dataset.bqPrevVisibility || '';
        el.style.opacity = el.dataset.bqPrevOpacity || '';
        delete el.dataset.bqTempHide;
        delete el.dataset.bqPrevDisplay;
        delete el.dataset.bqPrevVisibility;
        delete el.dataset.bqPrevOpacity;
      }
    });
    await style.dispose().catch(() => {});
  }
}

async function readPriorSlot(sectionDir) {
  const original = await readOriginalSectionHtml(sectionDir);
  if (!original?.html) return null;
  const metaPath = path.join(sectionDir, 'section-information.json');
  let info = null;
  try {
    info = JSON.parse(await readFile(metaPath, 'utf8'));
  } catch {
    info = null;
  }
  return {
    html: original.html,
    fileName: original.fileName,
    info,
    contentHash: sectionContentHash(original.html),
  };
}

/**
 * Remove leftover slots beyond N and legacy purpose-named folders.
 * @param {string} sectionsDir
 * @param {Set<string>} keepFolders
 */
async function pruneSectionSlots(sectionsDir, keepFolders) {
  let entries = [];
  try {
    entries = await readdir(sectionsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const name = ent.name;
    if (name.startsWith('__ai-tmp-')) {
      await rm(path.join(sectionsDir, name), { recursive: true, force: true }).catch(() => {});
      continue;
    }
    if (SECTION_SLOT_RE.test(name)) {
      if (!keepFolders.has(name)) {
        await rm(path.join(sectionsDir, name), { recursive: true, force: true }).catch(() => {});
        console.log(`  … pruned leftover ${name}/`);
      }
      continue;
    }
    // Legacy AI/purpose-named folders from before positional layout
    await rm(path.join(sectionsDir, name), { recursive: true, force: true }).catch(() => {});
    console.log(`  … removed legacy section folder ${name}/`);
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {string} params.pageDir
 * @param {string} params.url
 * @param {object[]} params.sections — hybrid sections / annotate payload
 * @param {string[]} [params.devices]
 * @param {object} [params.imageMeta]
 * @param {object} [params.mapping]
 * @param {object} [params.css]
 * @param {boolean} [params.styledHtml] — also emit legacy section.styled*.html siblings (--styled-html)
 * @param {boolean} [params.overlaysAlreadyHidden] — prefer PNG crop for overlay track
 */
export async function exportDetectedSections(page, params) {
  const {
    pageDir,
    url,
    sections: rawSections,
    devices = resolveScreenshotDevices(),
    imageMeta = null,
    mapping = null,
    css = null,
    overlaysAlreadyHidden = false,
    styledHtml = false,
    culture = null,
    /** When false, skip rewriting detected-sections.json (partial re-export). */
    writeDetectedIndex = true,
  } = params;

  const sourceCulture =
    culture && String(culture).trim() ? String(culture).trim() : null;

  const sectionsDir = pageSectionsDir(pageDir);
  await mkdir(sectionsDir, { recursive: true });

  const withHtml = [];
  for (const s of rawSections || []) {
    const selector = s.selector || '';
    const html = s.html || (await fetchSectionHtml(page, selector));
    withHtml.push({ ...s, html, selector });
  }

  const named = nameDetectedSections(withHtml);
  const ordered = [...named].sort((a, b) => (a.index || 0) - (b.index || 0));
  ordered.forEach((s, i) => {
    // Preserve positional folders when re-exporting a subset (e.g. section-06 alone).
    const priorFolder =
      s.folderName && SECTION_SLOT_RE.test(String(s.folderName)) ? String(s.folderName) : null;
    const priorIndex = priorFolder
      ? Number.parseInt(priorFolder.replace(/^section-/, ''), 10)
      : NaN;
    s.slotIndex = Number.isFinite(priorIndex) && priorIndex >= 1 ? priorIndex : i + 1;
    s.index = s.slotIndex;
    s.folderName = priorFolder || positionalSectionFolder(s.slotIndex);
  });

  const exported = [];
  const keepFolders = new Set(ordered.map((s) => s.folderName));

  // Header stack + float overlays share the chrome PNG pass; body is the rest.
  const overlays = ordered.filter((s) => isChromeExportTrack(s));
  const content = ordered.filter((s) => !isChromeExportTrack(s));

  async function captureOne(section, { hideChrome, preferCrop, prevSelector = null, nextSelector = null }) {
    const folder = section.folderName;
    const sectionDir = path.join(sectionsDir, folder);
    const newHash = sectionContentHash(section.html || '');
    const skipHashReuse = isChromeExportTrack(section);

    const prior = await readPriorSlot(sectionDir);
    // Overlay slots must re-export while unhidden — post-hide HTML hashes match
    // blank section-html PNGs and would otherwise poison reuse forever.
    if (
      !skipHashReuse &&
      prior &&
      prior.contentHash === newHash &&
      prior.info &&
      prior.info.scrollBehavior &&
      !priorNeedsCropRefresh(prior.info)
    ) {
      const reused = {
        ...prior.info,
        index: section.index,
        cmsName: prior.info.cmsName || section.cmsName,
        folderName: folder,
        selector: section.selector || null,
        heading: section.heading || null,
        track: section.track || null,
        rect: {
          x0: section.x0 ?? null,
          y0: section.y0 ?? null,
          x1: section.x1 ?? null,
          y1: section.y1 ?? null,
        },
        contentHash: newHash,
        reused: true,
        sectionHtml: `sections/${folder}/${SECTION_HTML}`,
        originalSectionHtml: `sections/${folder}/${ORIGINAL_SECTION_HTML}`,
        sectionDir: path.relative(pageDir, sectionDir).replace(/\\/g, '/'),
        ...(sourceCulture ? { culture: sourceCulture } : {}),
      };
      if (reused.outputs && typeof reused.outputs === 'object') {
        for (const device of devices) {
          const p = reused.outputs[device]?.path;
          if (p && !String(p).includes(`sections/${folder}/`)) {
            reused.outputs[device] = {
              ...reused.outputs[device],
              path: `sections/${folder}/${folder}-${deviceFileSlug(device)}.png`,
            };
          }
        }
      }
      await writeFile(
        path.join(sectionDir, 'section-information.json'),
        `${JSON.stringify(reused, null, 2)}\n`,
        'utf8',
      );
      console.log(`  section ${section.index}: ${reused.cmsName} (reused, unchanged HTML)`);
      return reused;
    }

    await mkdir(sectionDir, { recursive: true });
    await rm(path.join(sectionDir, 'states'), { recursive: true, force: true }).catch(() => {});
    await rm(path.join(sectionDir, 'statesbymutation'), { recursive: true, force: true }).catch(() => {});

    /** @type {string[]} */
    const captureErrors = [];

    /** @type {Awaited<ReturnType<typeof sectionHasInteractiveTriggers>>} */
    let interactionProbe = {
      hasInteractive: false,
      discovered: null,
      tabCandidatesPreview: [],
      accCandidatesPreview: [],
      menuL1Preview: [],
      hamPreview: null,
    };
    if (section.selector) {
      try {
        const runProbe = () =>
          sectionHasInteractiveTriggers(page, section.selector, {
            cmsName: section.cmsName,
            folderName: folder,
            track: section.track,
          });
        const isChromeProbe = isChromeExportTrack(section);
        interactionProbe = isChromeProbe
          ? await withSectionUnhiddenForInteraction(page, section.selector, runProbe)
          : await runProbe();
        if (interactionProbe.hasInteractive) {
          const tabsOnly =
            (interactionProbe.menuL1Preview || []).length === 0 &&
            !interactionProbe.hamPreview?.selector;
          console.log(
            tabsOnly
              ? `    … interactive tabs/accordion → section.html resting screenshots`
              : `    … interactive triggers detected → live resting screenshots`,
          );
        } else {
          console.log(`    … no interactive triggers → section.html resting screenshots`);
        }
      } catch (err) {
        captureErrors.push(
          `interactive-probe: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    const hasInteractive = Boolean(interactionProbe.hasInteractive);
    /** Tabs/accordion only (no menu/hamburger): resting PNGs from section.html like non-interactive. */
    const tabsAccordionOnlyInteractive =
      hasInteractive &&
      (interactionProbe.menuL1Preview || []).length === 0 &&
      !interactionProbe.hamPreview?.selector;
    const restingFromSectionHtml = !hasInteractive || tabsAccordionOnlyInteractive;

    let originalHtmlPath = null;
    let writtenHtml = section.html || '';
    let contentHash = sectionContentHash(writtenHtml);
    /** @type {string|null} */
    let styledSectionHtmlPath = null;
    /** @type {string|null} */
    let sectionStyledHtml = null;
    /** @type {Record<string, string>|null} */
    let sectionStyledByViewport = null;

    const isChromeSection = isChromeExportTrack(section);
    const isFloatOverlay = isFloatOverlaySection(section);

    async function writeSectionHtmlArtifacts() {
      const isCmp = isConsentCmpOverlay(section);
      try {
        if (section.html && isCmp) {
          originalHtmlPath = path.join(sectionDir, ORIGINAL_SECTION_HTML);
          let liveHeight = null;
          try {
            liveHeight = await page.evaluate((sel) => {
              const pc =
                document.querySelector('#onetrust-pc-sdk') ||
                (sel ? document.querySelector(sel) : null);
              if (!(pc instanceof Element)) return null;
              const h = pc.getBoundingClientRect().height;
              return h > 200 ? h : null;
            }, section.selector);
          } catch {
            /* ignore */
          }
          const normalized = normalizeCmpConsentHtml(section.html, {
            heightPx: liveHeight || undefined,
          });
          await writeFile(originalHtmlPath, normalized, 'utf8');
          // Keep in-memory html aligned for hashing / downstream.
          section.html = normalized;
        } else {
          originalHtmlPath = await saveSectionHtml(
            page,
            { selector: section.selector, bandSelectors: section.bandSelectors },
            sectionDir,
          );
        }
      } catch {
        const html = section.html || (await fetchSectionHtml(page, section.selector));
        originalHtmlPath = path.join(sectionDir, ORIGINAL_SECTION_HTML);
        const out = isCmp
          ? normalizeCmpConsentHtml(html || '')
          : html || `<!-- no HTML for ${section.selector || '(none)'} -->\n`;
        await writeFile(originalHtmlPath, out || `<!-- empty -->\n`, 'utf8');
      }

      try {
        writtenHtml = await readFile(originalHtmlPath, 'utf8');
      } catch {
        /* keep */
      }
      contentHash = sectionContentHash(writtenHtml);

      styledSectionHtmlPath = null;
      sectionStyledHtml = null;
      sectionStyledByViewport = null;
      if (section.selector) {
        try {
          const styled = await saveSectionStyledHtml(page, {
            pageDir,
            sectionDir,
            sectionSelector: section.selector,
            folderName: folder,
            writeLegacySiblings: Boolean(styledHtml),
          });
          styledSectionHtmlPath = styled.sectionHtml || null;
          sectionStyledHtml = styled.sectionStyledHtml || null;
          sectionStyledByViewport = styled.sectionStyledByViewport || null;
          if (styled.errors?.length) {
            for (const e of styled.errors) captureErrors.push(e);
          }
        } catch (err) {
          captureErrors.push(
            `styled-html: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      if (!styledSectionHtmlPath) {
        try {
          const fallbackPath = path.join(sectionDir, SECTION_HTML);
          await writeFile(fallbackPath, writtenHtml || '<!-- empty section -->\n', 'utf8');
          styledSectionHtmlPath = path.relative(pageDir, fallbackPath).replace(/\\/g, '/');
        } catch {
          /* ignore */
        }
      }
    }

    /** Overlay HTML/PNG must see this section; content export keeps overlays hidden. */
    async function writeSectionHtmlArtifactsForExport() {
      if (isChromeSection && overlaysAlreadyHidden && section.selector) {
        return withSectionUnhiddenForInteraction(
          page,
          section.selector,
          writeSectionHtmlArtifacts,
          { forceOpenCmp: isConsentCmpOverlay(section) },
        );
      }
      if (isConsentCmpOverlay(section) && section.selector) {
        await forceOpenCmpPreferenceCenter(page, section.selector);
      }
      return writeSectionHtmlArtifacts();
    }

    // Non-interactive + tabs/accordion-only: write section.html before resting PNGs.
    if (restingFromSectionHtml) {
      await page.setViewportSize(VIEWPORTS.desktop);
      await writeSectionHtmlArtifactsForExport();
    }

    const outputs = {};
    /** @type {Record<string, object>} */
    const scrollBehavior = {};
    /** @type {Record<string, object>} */
    const motionGeometry = {};

    for (const device of devices) {
      const fileName = `${folder}-${deviceFileSlug(device)}.png`;
      const filePath = path.join(sectionDir, fileName);
      await page.setViewportSize(VIEWPORTS[device] || VIEWPORTS.desktop);
      await ensureOverlayScrollbars(page);
      if (device === 'mobile') {
        await warnIfLayoutWidthShrunk(page, VIEWPORTS.mobile, `section/${folder}`);
      }
      await page.waitForTimeout(preferCrop ? 50 : 100);
      if (hideChrome) {
        await page.evaluate(hideAllStickyOverlaysInPage);
        // Edge case: short chrome nested inside a content band (not only sibling overlays).
        if (section.selector) {
          await page.evaluate((sel) => {
            const root = document.querySelector(sel);
            if (!(root instanceof Element)) return;
            const vw = window.innerWidth || 1440;
            const hits = [];
            for (const el of root.querySelectorAll('*')) {
              if (!(el instanceof HTMLElement)) continue;
              if (el.getAttribute('data-screenshot-hidden')) continue;
              const style = window.getComputedStyle(el);
              if (!['fixed', 'sticky', 'absolute'].includes(style.position)) continue;
              const rect = el.getBoundingClientRect();
              if (rect.top > 100 || rect.height < 28 || rect.height > 160) continue;
              if (rect.width < vw * 0.7) continue;
              const z = Number.parseInt(style.zIndex, 10);
              if (style.position !== 'sticky' && Number.isFinite(z) && z < 10) continue;
              const cls = String(el.className || '');
              const hint =
                /overlap|overlapping|minimize|fixed-top|sticky-header|main.?header|site.?header|global.?header|primary.?nav|main.?nav/i.test(
                  cls,
                );
              const hasChrome = !!el.querySelector(
                'img, svg, [class*="logo" i], nav, [role="navigation"], button, [class*="menu" i], a[href]',
              );
              if (!hint && !hasChrome) continue;
              hits.push(el);
            }
            const outermost = hits.filter((el) => !hits.some((o) => o !== el && o.contains(el)));
            for (const el of outermost) {
              el.setAttribute('data-screenshot-hidden', 'nested-overlapping-chrome');
              el.style.setProperty('visibility', 'hidden', 'important');
              el.style.setProperty('opacity', '0', 'important');
              el.style.setProperty('pointer-events', 'none', 'important');
            }
          }, section.selector);
        }
      }

      let ok = false;
      let method = 'live-dom';
      const isChrome = isChromeExportTrack(section);
      const isCmpShot = isFloatOverlay && isConsentCmpOverlay(section);
      // Preference-center dialogs must keep full box — tightenChrome collapses them to a strip.
      const tightenChrome = isChrome === true && !isCmpShot;

      const captureLiveAtViewport = async () => {
        const run = async () => {
          if (isCmpShot) {
            await forceOpenCmpPreferenceCenter(page, section.selector || '');
          }
          if (isChrome) {
            await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
          } else {
            await page
              .locator(section.selector)
              .first()
              .scrollIntoViewIfNeeded({ timeout: 2500 })
              .catch(() => {});
          }

          // Measure body neighbors BEFORE chrome-capture mode (sticky→relative) or
          // panel collapse mutates layout and pushes the next body band down.
          /** @type {{ prevBottom: number|null, nextTop: number|null }} */
          let neighborEdges = { prevBottom: null, nextTop: null };
          if (
            shouldNeighborClampSection(section) &&
            (prevSelector || nextSelector)
          ) {
            neighborEdges = await measureNeighborEdges(page, prevSelector, nextSelector);
          }

          const shoot = async () => {
            // Prefer measuring the visible preference center when CMP shell is open.
            let measureSel = section.selector;
            if (isCmpShot) {
              const pcSel = await page.evaluate(() => {
                const pc = document.querySelector('#onetrust-pc-sdk, .otPcCenter');
                if (!(pc instanceof Element)) return null;
                const r = pc.getBoundingClientRect();
                return r.height >= 200 ? '#onetrust-pc-sdk' : null;
              });
              if (pcSel) measureSel = pcSel;
            }
            let liveRect = await measureViewportSectionRect(page, measureSel, {
              tightenChrome,
            });

            // Header-stack + body: clamp to pre-measured body neighbors. Float CMP: skip.
            if (
              liveRect &&
              shouldNeighborClampSection(section) &&
              (Number.isFinite(neighborEdges.prevBottom) ||
                Number.isFinite(neighborEdges.nextTop) ||
                isChrome)
            ) {
              const clamped = applySectionNeighborClamp(
                section,
                {
                  x0: liveRect.x0,
                  y0: liveRect.y0,
                  x1: liveRect.x1,
                  y1: liveRect.y1,
                  width: liveRect.width,
                  height: liveRect.height,
                },
                neighborEdges,
              );
              const dTop = clamped.y0 - liveRect.y0;
              const dBot = liveRect.y1 - clamped.y1;
              liveRect = {
                ...liveRect,
                ...clamped,
                pageY0: liveRect.pageY0 + dTop,
                pageY1: liveRect.pageY1 - dBot,
              };
            }

            if (liveRect) {
              if (await clipScreenshot(page, liveRect, filePath)) {
                return { ok: true, method: 'viewport-clip' };
              }
              captureErrors.push(
                `${device}: viewport-clip failed (${Math.round(liveRect.width)}x${Math.round(liveRect.height)} @${Math.round(liveRect.x0)},${Math.round(liveRect.y0)})`,
              );
            } else {
              captureErrors.push(`${device}: live measure returned null`);
            }
            // Avoid element.screenshot on inflated chrome roots (timeouts); clip is preferred.
            if (!isChrome && (await liveElementScreenshot(page, measureSel || section.selector, filePath))) {
              return { ok: true, method: 'live-dom' };
            }
            return { ok: false, method: 'live-dom' };
          };

          // Isolate this chrome band from sibling sticky chrome (announcement over nav, etc.)
          const shootIsolated = async () => {
            if (isChrome && section.selector && !hideChrome) {
              return withSiblingOverlaysHidden(page, section.selector, shoot);
            }
            return shoot();
          };

          // Collapse closed drawers before resting measure so sticky→relative
          // capture mode does not inflate the header box over hero paint.
          // If collapse zeroes the box on some sites/viewports, retry without it.
          const shootRestingChrome = async () => {
            if (isChrome && !isCmpShot && section.selector) {
              const collapsed = await withClosedChromePanelsCollapsed(
                page,
                section.selector,
                shootIsolated,
              );
              if (collapsed?.ok) return collapsed;
              captureErrors.push(
                `${device}: collapsed chrome shot failed → retry without panel collapse`,
              );
            }
            return shootIsolated();
          };

          // Neutralize overlapping/transparent chrome so shots use the solid variant
          // (own background) and menus lay out without sticky/absolute fighting the page.
          // CMP preference centers skip chrome-capture mode (it can collapse the dialog).
          if (isChrome && !isCmpShot && looksLikeChromeOverlaySection(section)) {
            return withChromeCaptureMode(page, section.selector, shootRestingChrome);
          }
          return shootRestingChrome();
        };
        try {
          if (isChrome && overlaysAlreadyHidden) {
            return await withSectionUnhiddenForInteraction(page, section.selector || '', run, {
              forceOpenCmp: isCmpShot,
            });
          }
          return await run();
        } catch (err) {
          captureErrors.push(
            `${device}: live chrome shot: ${err instanceof Error ? err.message : String(err)}`,
          );
          return { ok: false, method: 'live-dom' };
        }
      };

      const tryCrop = async () => {
        const useDirtyOverlayShot = isFloatOverlay && isConsentCmpOverlay(section);
        const slug = deviceFileSlug(device);
        // CMP: only crop from this device's dirty shot — never reuse desktop for other widths.
        const cropCandidates = useDirtyOverlayShot
          ? [
              pageScreenshotPath(pageDir, `${slug}-annotate.png`),
              pageScreenshotPath(pageDir, `${slug}.png`),
              ...(device === 'desktop'
                ? [
                    pageScreenshotPath(pageDir, 'desktop-annotate.png'),
                    pageScreenshotPath(pageDir, 'desktop.png'),
                  ]
                : []),
            ]
          : [
              pageScreenshotPath(pageDir, `${slug}-clean.png`),
              pageScreenshotPath(pageDir, `${device}-clean.png`),
              ...(device === 'desktop'
                ? [pageScreenshotPath(pageDir, 'desktop-clean.png')]
                : []),
            ];
        let fallbackShot = null;
        for (const candidate of cropCandidates) {
          if (await fileExists(candidate)) {
            fallbackShot = candidate;
            break;
          }
        }
        if (useDirtyOverlayShot && !fallbackShot && device !== 'desktop') {
          captureErrors.push(
            `${device}: no device dirty PNG for CMP crop (refusing desktop fallback)`,
          );
          return false;
        }

        let rect = null;
        // Pre-measure neighbors + collapse closed chrome before box measure so
        // inflated sticky roots / pushed body bands do not defeat the clamp.
        /** @type {{ prevBottom: number|null, nextTop: number|null }} */
        let cropEdges = { prevBottom: null, nextTop: null };
        if (
          shouldNeighborClampSection(section) &&
          (prevSelector || nextSelector)
        ) {
          await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
          cropEdges = await measureNeighborEdges(page, prevSelector, nextSelector);
        }
        const measureForCrop = async () =>
          measureViewportSectionRect(page, section.selector, { tightenChrome });
        let liveRect =
          isChrome && !isCmpShot && section.selector
            ? await withClosedChromePanelsCollapsed(page, section.selector, measureForCrop)
            : await measureForCrop();
        if (!liveRect && isChrome && section.selector) {
          liveRect = await measureForCrop();
        }
        if (liveRect) {
          let pageRect = {
            x0: liveRect.pageX0,
            y0: liveRect.pageY0,
            x1: liveRect.pageX1,
            y1: liveRect.pageY1,
          };
          if (shouldNeighborClampSection(section)) {
            // Neighbor edges are viewport-local; convert delta onto page coords
            const clamped = applySectionNeighborClamp(
              section,
              {
                x0: liveRect.x0,
                y0: liveRect.y0,
                x1: liveRect.x1,
                y1: liveRect.y1,
              },
              cropEdges,
            );
            pageRect = {
              x0: liveRect.pageX0 + (clamped.x0 - liveRect.x0),
              y0: liveRect.pageY0 + (clamped.y0 - liveRect.y0),
              x1: liveRect.pageX1 + (clamped.x1 - liveRect.x1),
              y1: liveRect.pageY1 + (clamped.y1 - liveRect.y1),
            };
          }
          // Detection-time header height as last-resort ceiling when neighbors
          // were unavailable and the live root is still inflated.
          if (
            isChrome &&
            !isFloatOverlay &&
            Number.isFinite(section.y0) &&
            Number.isFinite(section.y1) &&
            section.y1 > section.y0 + 20
          ) {
            const detectedH = section.y1 - section.y0;
            if (pageRect.y1 - pageRect.y0 > detectedH + 24) {
              pageRect = { ...pageRect, y1: pageRect.y0 + detectedH };
            }
          }
          rect = pageRect;
        } else if (
          Number.isFinite(section.x0) &&
          Number.isFinite(section.y0) &&
          Number.isFinite(section.x1) &&
          Number.isFinite(section.y1)
        ) {
          rect = { x0: section.x0, y0: section.y0, x1: section.x1, y1: section.y1 };
          // Scale desktop annotate/dirty rect onto the chosen device full-page shot.
          if (fallbackShot && device !== 'desktop') {
            try {
              const desktopRef =
                (await fileExists(pageScreenshotPath(pageDir, 'desktop-annotate.png')))
                  ? pageScreenshotPath(pageDir, 'desktop-annotate.png')
                  : pageScreenshotPath(pageDir, 'desktop.png');
              if (await fileExists(desktopRef)) {
                const src = await readPngSize(desktopRef);
                const dst = await readPngSize(fallbackShot);
                const sx = dst.width / Math.max(1, src.width);
                const sy = dst.height / Math.max(1, src.height);
                // Top header-stack chrome height is viewport chrome, not page-length —
                // scaling Y by full-page height ratio inflates the crop into the hero.
                if (isChrome && !isFloatOverlay && rect.y0 <= 8) {
                  const detectedH = Math.max(48, Math.round(rect.y1 - rect.y0));
                  rect = {
                    x0: 0,
                    y0: 0,
                    x1: dst.width,
                    y1: Math.min(dst.height, detectedH),
                  };
                } else {
                  rect = {
                    x0: Math.round(rect.x0 * sx),
                    y0: Math.round(rect.y0 * sy),
                    x1: Math.round(rect.x1 * sx),
                    y1: Math.round(rect.y1 * sy),
                  };
                }
              }
            } catch {
              /* keep unscaled rect */
            }
          }
        }

        if (
          fallbackShot &&
          rect &&
          Number.isFinite(rect.x0) &&
          Number.isFinite(rect.y0) &&
          Number.isFinite(rect.x1) &&
          Number.isFinite(rect.y1)
        ) {
          try {
            await runPythonCrop(fallbackShot, filePath, rect);
            return true;
          } catch (err) {
            captureErrors.push(`${device}: ${err instanceof Error ? err.message : err}`);
            return false;
          }
        }
        captureErrors.push(`${device}: live screenshot failed and no crop source`);
        return false;
      };

      const isCmp = isCmpShot;
      // CMP: prefer live per Sitecore AI viewport (not section-html / not desktop crop).
      if (restingFromSectionHtml && styledSectionHtmlPath && !isCmp) {
        const absHtml = path.isAbsolute(styledSectionHtmlPath)
          ? styledSectionHtmlPath
          : path.join(pageDir, styledSectionHtmlPath);
        const htmlShot = await screenshotSectionHtmlAtViewport(page, {
          htmlPath: absHtml,
          outPath: filePath,
          device,
          baseURL: url,
        });
        if (htmlShot.ok) {
          ok = true;
          method = 'section-html';
        } else if (htmlShot.error) {
          captureErrors.push(
            `${device}: section-html failed (${htmlShot.error}) → live fallback`,
          );
        }
      }

      if (!ok) {
        // Live first (required for CMP; also fallback when section-html blank/fails).
        if (section.selector) {
          const live = await captureLiveAtViewport();
          ok = live.ok;
          method = live.method;
        }
        if (!ok) {
          ok = await tryCrop();
          if (ok) method = 'png-crop';
          else if (isCmp) {
            captureErrors.push(`${device}: CMP live + device crop both failed`);
          }
        }
      }

      if (ok && method !== 'section-html') {
        const skipChromeTrim =
          isCmp ||
          (isChrome &&
            /header|nav|topbar|top-bar|siteheader/i.test(
              `${section.cmsName || ''} ${section.type || ''} ${section.folderName || ''}`,
            ));
        if (!skipChromeTrim) {
          try {
            await runPythonTrim(filePath, { chrome: isChrome });
          } catch (err) {
            captureErrors.push(
              `${device} trim: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      outputs[device] = ok
        ? { path: path.relative(pageDir, filePath).replace(/\\/g, '/'), method }
        : null;

      // Per-device scroll behavior probe
      if (section.selector) {
        try {
          const probeRun = async () => {
            const deep = await shouldDeepScrollProbe(page, section);
            return probeSectionScrollBehavior(page, section.selector, { deep });
          };
          const behavior =
            isChrome && overlaysAlreadyHidden
              ? await withSectionUnhiddenForInteraction(page, section.selector, probeRun)
              : await probeRun();
          if (behavior) scrollBehavior[device] = behavior;
        } catch (err) {
          captureErrors.push(
            `${device} scrollBehavior: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        // Motion geometry BEFORE screenshot HTML normalize resets marquee translates.
        try {
          const motionRun = () => probeMotionGeometry(page, section.selector);
          const motion =
            isChrome && overlaysAlreadyHidden
              ? await withSectionUnhiddenForInteraction(
                  page,
                  section.selector,
                  motionRun,
                )
              : await motionRun();
          if (motion && motion.kind !== 'none') {
            motionGeometry[device] = motion;
          }
        } catch (err) {
          captureErrors.push(
            `${device} motionGeometry: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    await page.setViewportSize(VIEWPORTS.desktop);

    // Menu/hamburger interactive: live resting PNGs first, then HTML (states need live page).
    // Tabs/accordion-only already wrote HTML above for section-html resting shots.
    if (hasInteractive && !restingFromSectionHtml) {
      await writeSectionHtmlArtifactsForExport();
    }

    let interactionStates = [];
    let interactionStatesMutation = [];
    let interactionSummary = null;
    /** @type {object[]|null} */
    let presentationVariants = null;
    try {
      const isChrome = isChromeExportTrack(section);
      const chromeOverlay = isChrome && looksLikeChromeOverlaySection(section);

      if (chromeOverlay && section.selector) {
        try {
          const detectVariants = () => detectChromePresentationVariants(page, section.selector);
          const variants =
            overlaysAlreadyHidden === true
              ? await withSectionUnhiddenForInteraction(page, section.selector, detectVariants)
              : await detectVariants();
          if (variants?.length) presentationVariants = variants;
        } catch (err) {
          captureErrors.push(
            `presentationVariants: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      if (hasInteractive) {
        const runInteractive = () =>
          captureInteractiveStatesForSection(page, {
            pageDir,
            sectionDir,
            folderName: folder,
            sectionSelector: section.selector || '',
            devices,
            sectionMeta: {
              cmsName: section.cmsName,
              folderName: folder,
              track: section.track,
            },
            probe: interactionProbe,
          });

        const runInteractivePrepared = async () => {
          if (chromeOverlay && section.selector) {
            return withChromeCaptureMode(page, section.selector, runInteractive);
          }
          return runInteractive();
        };

        const interactive = isChrome
          ? await withSectionUnhiddenForInteraction(
              page,
              section.selector || '',
              runInteractivePrepared,
            )
          : await runInteractivePrepared();
        interactionStates = interactive.interactionStates || [];
        interactionStatesMutation = interactive.interactionStatesMutation || [];
        interactionSummary = interactive.interactionSummary || null;
        if (interactionStates.length) {
          console.log(
            `    … interactive states: ${interactionStates.length} (${interactionSummary?.menuStateCount || 0} menu, ${interactionSummary?.tabStateCount || 0} tab, ${interactionSummary?.accordionStateCount || 0} accordion)` +
              (interactionStatesMutation.length
                ? `; mutation: ${interactionStatesMutation.length}`
                : ''),
          );
        }
      }
    } catch (err) {
      captureErrors.push(
        `interactive-states: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Detection-time visibility (pre-hide). Float overlays only — sticky header
    // stack does not use Visible/Open overlay seed hard rules.
    const detectedVisible =
      isFloatOverlay &&
      (Boolean(section.heading) ||
        Boolean(section.html && String(section.html).trim().length > 40) ||
        (Number.isFinite(section.x0) &&
          Number.isFinite(section.y0) &&
          Number.isFinite(section.x1) &&
          Number.isFinite(section.y1) &&
          section.x1 > section.x0 &&
          section.y1 > section.y0));

    // Resting chrome PNGs are shot after neutralizing float/sticky/hide-on-scroll
    // so the crop looks like a normal in-flow box. Runtime behavior for codegen
    // still lives in scrollBehavior / chromeStack / presentationVariants.
    const chromeOverlay = isChromeSection && looksLikeChromeOverlaySection(section);
    const captureNormalization =
      isChromeSection && !isFloatOverlay
        ? {
            restingShotsNormalizedToInFlow: true,
            techniques: [
              'scrollY=0',
              ...(chromeOverlay ? ['position-relative'] : []),
              'closed-panels-collapsed',
            ],
            runtimeBehaviorSource: 'scrollBehavior',
            note:
              'Resting PNGs were captured with floating/sticky chrome forced in-flow and closed drawers collapsed. Implement runtime pin/hide-on-scroll/stacking from scrollBehavior (+ chromeStack / presentationVariants), not from the resting crop alone.',
          }
        : isChromeSection && isFloatOverlay
          ? {
              restingShotsNormalizedToInFlow: false,
              runtimeBehaviorSource: 'scrollBehavior',
              note:
                'Float-overlay resting shots keep overlay geometry; use scrollBehavior / track for runtime presentation.',
            }
          : null;

    const sectionJson = {
      index: section.index,
      cmsName: section.cmsName,
      folderName: folder,
      contentHash,
      ...(sourceCulture ? { culture: sourceCulture } : {}),
      selector: section.selector || null,
      heading: section.heading || null,
      track: section.track || null,
      ...(section.chromeKind ? { chromeKind: section.chromeKind } : {}),
      ...(isFloatOverlay
        ? { isOverlay: true, detectedVisible: Boolean(detectedVisible) }
        : section.track === 'header'
          ? { isOverlay: false }
          : {}),
      rect: {
        x0: section.x0 ?? null,
        y0: section.y0 ?? null,
        x1: section.x1 ?? null,
        y1: section.y1 ?? null,
      },
      matchStatus: section.matchStatus,
      confidence: section.confidence,
      reasons: section.reasons,
      alternatives: section.alternatives,
      mapping: section.mapping,
      outputs,
      ...(Object.keys(scrollBehavior).length ? { scrollBehavior } : {}),
      ...(captureNormalization ? { captureNormalization } : {}),
      ...(Object.keys(motionGeometry).length
        ? (() => {
            const layoutMotion = mergeMotionGeometryByDevice(motionGeometry);
            return {
              motionGeometry,
              ...(layoutMotion ? { layout: { motion: layoutMotion } } : {}),
            };
          })()
        : {}),
      ...(presentationVariants?.length ? { presentationVariants } : {}),
      sectionHtml: styledSectionHtmlPath,
      originalSectionHtml: originalHtmlPath
        ? path.relative(pageDir, originalHtmlPath).replace(/\\/g, '/')
        : `sections/${folder}/${ORIGINAL_SECTION_HTML}`,
      ...(sectionStyledHtml ? { sectionStyledHtml } : {}),
      ...(sectionStyledByViewport ? { sectionStyledByViewport } : {}),
      ...(interactionStates.length
        ? { interactionStates, interactionSummary }
        : {}),
      ...(interactionStatesMutation.length
        ? { interactionStatesMutation }
        : {}),
      errors: captureErrors,
    };
    await writeFile(
      path.join(sectionDir, 'section-information.json'),
      `${JSON.stringify(sectionJson, null, 2)}\n`,
      'utf8',
    );

    return {
      ...sectionJson,
      sectionDir: path.relative(pageDir, sectionDir).replace(/\\/g, '/'),
    };
  }

  for (const section of overlays) {
    console.log(`  section ${section.index}: ${section.cmsName} (overlay)`);
    const idx = ordered.indexOf(section);
    // Body/header neighbors only — never clamp against float-overlay/CMP geometry.
    const { prevSelector, nextSelector } = resolveBodyNeighborSelectors(ordered, idx);
    exported.push(
      await captureOne(section, {
        hideChrome: false,
        preferCrop: overlaysAlreadyHidden === true,
        prevSelector,
        nextSelector,
      }),
    );
  }

  await page.evaluate(hideAllStickyOverlaysInPage);

  for (const section of content) {
    console.log(`  section ${section.index}: ${section.cmsName}`);
    const idx = ordered.indexOf(section);
    const { prevSelector, nextSelector } = resolveBodyNeighborSelectors(ordered, idx);
    exported.push(
      await captureOne(section, {
        hideChrome: true,
        preferCrop: false,
        prevSelector,
        nextSelector,
      }),
    );
  }

  exported.sort((a, b) => (a.index || 0) - (b.index || 0));
  if (writeDetectedIndex) {
    await pruneSectionSlots(sectionsDir, keepFolders);
  }

  // Cross-section sticky stack: when top chrome A hides, B's stickyTopPx collapses.
  enrichSectionInfosWithChromeStack(exported);
  for (const section of exported) {
    if (!section?.chromeStack || typeof section.chromeStack !== 'object') continue;
    const folder = section.folderName;
    if (!folder) continue;
    const infoPath = path.join(sectionsDir, folder, 'section-information.json');
    try {
      const raw = await readFile(infoPath, 'utf8');
      const info = JSON.parse(raw);
      info.chromeStack = section.chromeStack;
      await writeFile(infoPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
    } catch {
      // Slot may be partial / missing on reuse edge cases — skip.
    }
  }

  const indexPath = path.join(pageDir, 'detected-sections.json');
  if (writeDetectedIndex) {
    const index = {
      url,
      generatedAt: new Date().toISOString(),
      image: imageMeta,
      css,
      mapping,
      detectedSectionsPng: 'detected-sections.png',
      sections: exported,
    };
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    const reusedCount = exported.filter((s) => s.reused).length;
    console.log(
      `  ✓ detected-sections.json (${exported.length} sections` +
        (reusedCount ? `, ${reusedCount} reused` : '') +
        `)`,
    );
  } else {
    console.log(
      `  ✓ partial export (${exported.length} sections; detected-sections.json unchanged)`,
    );
  }

  return { indexPath, sections: exported, sectionsDir };
}
