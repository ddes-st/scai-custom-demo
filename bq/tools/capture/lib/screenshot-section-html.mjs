/**
 * Screenshot a self-contained section.html at capture VIEWPORTS.
 * Used for non-interactive sections so resting PNGs match the HTML evidence.
 */
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  VIEWPORTS,
  resolveScreenshotDevices,
  deviceFileSlug,
  ensureOverlayScrollbars,
} from './viewports.mjs';
import {
  resetMarqueeTransformsInPage,
  stripScreenshotHideAttrsInPage,
  sectionHtmlHasVisibleContentInPage,
} from './section-html-normalize.mjs';

/**
 * @param {import('playwright').Page} livePage — page still on the live site (for context)
 * @param {object} opts
 * @param {string} opts.htmlPath — absolute path to section.html
 * @param {string} opts.outPath — absolute PNG output path
 * @param {'desktop'|'tablet'|'mobile'|string} opts.device
 * @param {string} [opts.baseURL] — capture page URL for relative assets (setContent)
 * @returns {Promise<{ ok: boolean, method: string, error?: string }>}
 */
export async function screenshotSectionHtmlAtViewport(livePage, opts) {
  const { htmlPath, outPath, device, baseURL = '' } = opts;
  const vp = VIEWPORTS[device] || VIEWPORTS.desktop;
  let htmlPage = null;
  try {
    const html = await readFile(htmlPath, 'utf8');
    if (!String(html || '').trim()) {
      return { ok: false, method: 'section-html', error: 'empty section.html' };
    }

    const context = livePage.context();
    htmlPage = await context.newPage();
    await htmlPage.setViewportSize(vp);
    await ensureOverlayScrollbars(htmlPage);

    const fileUrl = pathToFileURL(path.resolve(htmlPath)).href;
    let loaded = false;
    if (baseURL && /^https?:\/\//i.test(baseURL)) {
      try {
        const withBase = /<base\s/i.test(html)
          ? html
          : html.replace(
              /<head([^>]*)>/i,
              `<head$1><base href="${baseURL.replace(/"/g, '&quot;')}">`,
            );
        const doc =
          withBase === html && !/<html[\s>]/i.test(html)
            ? `<!DOCTYPE html><html><head><base href="${baseURL.replace(/"/g, '&quot;')}"></head><body>${html}</body></html>`
            : withBase;
        await htmlPage.setContent(doc, {
          waitUntil: 'load',
          timeout: 45000,
        });
        loaded = true;
      } catch {
        loaded = false;
      }
    }
    if (!loaded) {
      await htmlPage.goto(fileUrl, { waitUntil: 'load', timeout: 45000 });
    }

    await htmlPage
      .evaluate(async () => {
        try {
          if (document.fonts?.ready) await document.fonts.ready;
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    await htmlPage.waitForTimeout(120);

    // Rest marquees frozen mid-scroll; undo chrome-hide stamps baked into clones.
    await htmlPage.evaluate(resetMarqueeTransformsInPage).catch(() => {});
    await htmlPage.evaluate(stripScreenshotHideAttrsInPage).catch(() => {});
    await htmlPage.waitForTimeout(60);

    // section.html often starts with hidden wrappers / style hosts — first-child
    // element screenshots time out with "element is not visible". Prefer the
    // largest visible body descendant. Fail closed when nothing is visible —
    // blank fullPage must NOT report ok (blocks live/dirty overlay fallbacks).
    const shotOk = await htmlPage
      .evaluate(() => {
        const body = document.body;
        if (!body) return false;
        /** @type {Element|null} */
        let best = null;
        let bestArea = 0;
        for (const el of body.querySelectorAll('*')) {
          if (!(el instanceof HTMLElement)) continue;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
            continue;
          }
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) continue;
          const area = r.width * r.height;
          if (area > bestArea) {
            bestArea = area;
            best = el;
          }
        }
        if (best) {
          best.setAttribute('data-bq-html-shot-root', '1');
          return true;
        }
        return false;
      })
      .catch(() => false);

    if (!shotOk) {
      return {
        ok: false,
        method: 'section-html',
        error: 'no visible element in section.html (hidden overlay / empty document)',
      };
    }

    const hasContent = await htmlPage
      .evaluate(sectionHtmlHasVisibleContentInPage)
      .catch(() => false);
    if (!hasContent) {
      return {
        ok: false,
        method: 'section-html',
        error: 'section.html appears blank (no visible text/media after marquee reset)',
      };
    }

    const root = htmlPage.locator('[data-bq-html-shot-root="1"]').first();
    try {
      await root.screenshot({
        path: outPath,
        animations: 'disabled',
        type: 'png',
        timeout: 8000,
      });
    } catch (err) {
      return {
        ok: false,
        method: 'section-html',
        error: err instanceof Error ? err.message : String(err),
      };
    }
    return { ok: true, method: 'section-html' };
  } catch (err) {
    return {
      ok: false,
      method: 'section-html',
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (htmlPage) {
      await htmlPage.close().catch(() => {});
    }
  }
}

/**
 * After loading section.html, reject shots where the preferred open label's
 * accordion/tab content collapsed to an empty shell (common dual-chrome miss).
 * @param {import('playwright').Page} htmlPage
 * @param {string} preferredOpenLabel
 */
export async function probeSectionHtmlOpenFidelity(htmlPage, preferredOpenLabel) {
  const label = String(preferredOpenLabel || '').trim();
  if (!label) return { ok: true, reasons: [] };
  return htmlPage.evaluate((want) => {
    const norm = (s) =>
      String(s || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    const target = norm(want);
    /** @type {string[]} */
    const reasons = [];
    const matches = (el) => {
      const t = norm(el.getAttribute('aria-label') || el.innerText || el.textContent);
      return t === target || t.startsWith(target) || target.startsWith(t.slice(0, 24));
    };
    const expanded = [...document.querySelectorAll('[aria-expanded="true"]')].find(matches);
    const selected = [...document.querySelectorAll('[aria-selected="true"]')].find(matches);
    if (!expanded && !selected) {
      reasons.push('preferred-label-not-open');
      return { ok: false, reasons };
    }
    const regionLooksFilled = (region) => {
      if (!(region instanceof HTMLElement)) return false;
      const st = getComputedStyle(region);
      if (st.display === 'none' || st.visibility === 'hidden' || region.hasAttribute('hidden')) {
        return false;
      }
      const r = region.getBoundingClientRect();
      const textLen = (region.innerText || '').trim().length;
      const media = region.querySelector('img, video, iframe');
      const mediaOk =
        media instanceof HTMLElement &&
        media.getBoundingClientRect().width >= 40 &&
        media.getBoundingClientRect().height >= 40;
      return r.height >= 48 || textLen >= 8 || mediaOk;
    };
    /** Dual chrome: desktop tabpanel OR narrow accordion region may hold the media */
    let filled = false;
    if (expanded) {
      const controls = expanded.getAttribute('aria-controls');
      const region =
        (controls && document.getElementById(controls)) ||
        expanded
          .closest('[class*="AccordionItem"]')
          ?.querySelector('[id^="accordion-content"], [role="region"]');
      if (regionLooksFilled(region)) filled = true;
    }
    if (selected) {
      const controls = selected.getAttribute('aria-controls');
      const panel = controls ? document.getElementById(controls) : null;
      if (regionLooksFilled(panel)) filled = true;
      // CompactLayout slide often nests media beside the tablist
      const slide = document.querySelector(
        '[class*="SlideActive"], [class*="CompactLayout"] [aria-hidden="false"]',
      );
      if (regionLooksFilled(slide)) filled = true;
    }
    if (!filled) reasons.push('open-region-empty');
    // Orphan absolute accordion headers (mis-banded mobile CSS)
    for (const item of document.querySelectorAll('[class*="AccordionItem"]')) {
      if (!(item instanceof HTMLElement)) continue;
      const st = getComputedStyle(item);
      if (st.position !== 'absolute' && st.position !== 'fixed') continue;
      const r = item.getBoundingClientRect();
      if (r.top < 8 && r.height > 20 && r.height < 120) {
        reasons.push('orphan-absolute-accordion');
        break;
      }
    }
    return { ok: reasons.length === 0, reasons };
  }, label);
}

/**
 * Screenshot section.html for each device into the given output map paths.
 *
 * @param {import('playwright').Page} livePage
 * @param {object} opts
 * @param {string} opts.htmlPath
 * @param {string} opts.sectionDir
 * @param {string} opts.folderName
 * @param {string} opts.pageDir
 * @param {string[]} [opts.devices]
 * @param {string} [opts.baseURL]
 * @param {string} [opts.preferredOpenLabel] — fidelity probe for open tab/accordion
 * @param {string} [opts.liveSectionSelector] — when set, fall back to live crop if HTML probe fails
 * @param {(page: import('playwright').Page, device: string) => Promise<void>} [opts.ensureLiveOpen]
 * @returns {Promise<{ outputs: Record<string, { path: string, method: string }|null>, errors: string[] }>}
 */
export async function screenshotSectionHtmlDevices(livePage, opts) {
  const {
    htmlPath,
    sectionDir,
    folderName,
    pageDir,
    devices = resolveScreenshotDevices(),
    baseURL = '',
    preferredOpenLabel = '',
    liveSectionSelector = '',
    ensureLiveOpen = null,
  } = opts;
  /** @type {Record<string, { path: string, method: string }|null>} */
  const outputs = {};
  /** @type {string[]} */
  const errors = [];

  for (const device of devices) {
    const fileName = `${folderName}-${deviceFileSlug(device)}.png`;
    const filePath = path.join(sectionDir, fileName);
    const result = await screenshotSectionHtmlAtViewport(livePage, {
      htmlPath,
      outPath: filePath,
      device,
      baseURL,
    });

    let used = result.ok ? 'section-html' : null;
    if (result.ok && preferredOpenLabel) {
      // Re-open the just-written PNG's source page briefly to probe — cheaper: probe during shot.
      // screenshotSectionHtmlAtViewport closes the page; re-probe via a light reload.
      const probePage = await livePage.context().newPage();
      try {
        await probePage.setViewportSize(VIEWPORTS[device] || VIEWPORTS.desktop);
        await ensureOverlayScrollbars(probePage);
        const html = await readFile(htmlPath, 'utf8');
        const withBase =
          baseURL && /^https?:\/\//i.test(baseURL) && !/<base\s/i.test(html)
            ? html.replace(
                /<head([^>]*)>/i,
                `<head$1><base href="${baseURL.replace(/"/g, '&quot;')}">`,
              )
            : html;
        const doc = /<html[\s>]/i.test(withBase)
          ? withBase
          : `<!DOCTYPE html><html><head><base href="${String(baseURL || '').replace(/"/g, '&quot;')}"></head><body>${withBase}</body></html>`;
        await probePage.setContent(doc, { waitUntil: 'load', timeout: 45000 });
        await probePage.waitForTimeout(80);
        const fidelity = await probeSectionHtmlOpenFidelity(probePage, preferredOpenLabel);
        if (!fidelity.ok) {
          used = null;
          errors.push(
            `${device}: section-html fidelity failed (${(fidelity.reasons || []).join(',')})`,
          );
        }
      } catch (err) {
        errors.push(
          `${device}: section-html fidelity probe error — ${err instanceof Error ? err.message : err}`,
        );
      } finally {
        await probePage.close().catch(() => {});
      }
    }

    if (!used && liveSectionSelector) {
      try {
        const vp = VIEWPORTS[device] || VIEWPORTS.desktop;
        await livePage.setViewportSize(vp);
        await ensureOverlayScrollbars(livePage);
        if (typeof ensureLiveOpen === 'function') {
          await ensureLiveOpen(livePage, device);
          await livePage.waitForTimeout(200);
        }
        const loc = livePage.locator(liveSectionSelector).first();
        await loc.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
        await loc.screenshot({
          path: filePath,
          animations: 'disabled',
          type: 'png',
          timeout: 10000,
        });
        used = 'live-dom';
      } catch (err) {
        errors.push(
          `${device}: live fallback failed — ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (used) {
      outputs[device] = {
        path: path.relative(pageDir, filePath).replace(/\\/g, '/'),
        method: used,
      };
    } else if (result.ok) {
      // HTML shot written but fidelity failed and no live fallback — keep file, mark method
      outputs[device] = {
        path: path.relative(pageDir, filePath).replace(/\\/g, '/'),
        method: 'section-html',
      };
      if (!errors.some((e) => e.startsWith(`${device}:`))) {
        errors.push(`${device}: section-html kept despite fidelity concerns`);
      }
    } else {
      outputs[device] = null;
      errors.push(
        `${device}: section-html screenshot failed${result.error ? `: ${result.error}` : ''}`,
      );
    }
  }

  return { outputs, errors };
}
