/**
 * Playwright shots at Sitecore AI widths for visual-fidelity scoring.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { resolvePlaywright } from '../../capture/lib/playwright-resolve.mjs';
import { SITECORE_AI_VIEWPORTS, resolveVisualFidelityViewportKeys } from './viewports.mjs';
import { logVerbose } from '../create-log.mjs';

const { chromium } = resolvePlaywright();

/**
 * Resolve reference PNG for a section viewport.
 * @param {string} pageDir
 * @param {string} sectionFolder
 * @param {object} info section-information.json
 * @param {string} viewport
 */
export function resolveReferencePng(pageDir, sectionFolder, info, viewport) {
  const out = info?.outputs?.[viewport];
  if (out?.path) {
    return path.resolve(pageDir, out.path);
  }
  return path.join(pageDir, 'sections', sectionFolder, `${sectionFolder}-${viewport}.png`);
}

/**
 * @param {{
 *   baseUrl: string,
 *   pageDir: string,
 *   sectionFolder: string,
 *   info: object,
 *   outDir: string,
 * }} opts
 */
export async function captureAndCompare(opts) {
  const { baseUrl, pageDir, sectionFolder, info, outDir } = opts;
  await mkdir(outDir, { recursive: true });

  const viewportKeys = resolveVisualFidelityViewportKeys();
  logVerbose(`  · Visual fidelity capture: launching Chromium → ${baseUrl}/preview.html`);
  logVerbose(`  · Visual fidelity viewports: ${viewportKeys.join(', ')}`);
  const browser = await chromium.launch({
    headless: true,
    timeout: 30000,
  });
  /** @type {Record<string, object>} */
  const results = {};

  try {
    for (const vp of viewportKeys) {
      const size = SITECORE_AI_VIEWPORTS[vp];
      logVerbose(`  · Visual fidelity capture: ${vp} ${size.width}×${size.height}`);
      const page = await browser.newPage({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 1,
      });
      /** @type {string[]} */
      const pageErrors = [];
      page.on('pageerror', (err) => {
        pageErrors.push(err?.message || String(err));
      });
      // Prefer load over networkidle — idle can hang forever on long-lived requests.
      await page.goto(`${baseUrl}/preview.html`, {
        waitUntil: 'load',
        timeout: 45000,
      });
      try {
        await page.waitForSelector('#root', { timeout: 10000 });
      } catch {
        /* screenshot whatever is on screen */
      }
      await page.waitForTimeout(400);
      await page.addStyleTag({
        content: '*{animation:none!important;transition:none!important}',
      });

      const candidatePath = path.join(outDir, `candidate-${vp}.png`);
      const root = page.locator('#root');
      const shotOpts = { path: candidatePath, timeout: 30000 };
      const rootCount = await root.count();
      if (rootCount) {
        const childCount = await root.evaluate((el) => el.childNodes.length).catch(() => 0);
        if (pageErrors.length || childCount === 0) {
          const detail = pageErrors[0] || 'no #root children';
          logVerbose(`  ⚠ Visual fidelity preview empty/crashed (${vp}): ${detail}`);
        }
        // Fixed/sticky overlays (CMP preference centers, cookie banners) leave
        // #root with ~0 layout height; element screenshots become a 1px strip.
        // Reference crops for CMP preference centers are the dialog box itself
        // (not the dimmed full-viewport backdrop) — prefer the modal root.
        const box = await root.boundingBox().catch(() => null);
        const isOverlay =
          info?.isOverlay === true || String(info?.track || '').toLowerCase() === 'overlay';
        const rootCollapsed = !box || box.height < 48;
        if (isOverlay) {
          const modal = page.locator(
            '[data-consent-modal-root="true"], [role="dialog"][aria-modal="true"], [role="alertdialog"]',
          );
          const modalCount = await modal.count().catch(() => 0);
          if (modalCount) {
            const modalBox = await modal.first().boundingBox().catch(() => null);
            if (modalBox && modalBox.height >= 48 && modalBox.width >= 48) {
              logVerbose(
                `  · Visual fidelity capture: ${vp} using modal-root shot (${Math.round(modalBox.width)}×${Math.round(modalBox.height)})`,
              );
              await modal.first().screenshot(shotOpts);
            } else {
              logVerbose(`  · Visual fidelity capture: ${vp} using viewport shot (overlay modal tiny)`);
              await page.screenshot(shotOpts);
            }
          } else if (rootCollapsed) {
            logVerbose(`  · Visual fidelity capture: ${vp} using viewport shot (overlay, no modal)`);
            await page.screenshot(shotOpts);
          } else {
            await root.screenshot(shotOpts);
          }
        } else if (rootCollapsed) {
          logVerbose(
            `  · Visual fidelity capture: ${vp} using viewport shot (rootH=${box?.height ?? 0})`,
          );
          await page.screenshot(shotOpts);
        } else {
          await root.screenshot(shotOpts);
        }
      } else {
        await page.screenshot({ ...shotOpts, fullPage: true });
      }

      results[vp] = {
        candidatePath,
        referencePath: resolveReferencePng(pageDir, sectionFolder, info, vp),
        pageErrors: pageErrors.length ? pageErrors : undefined,
      };
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
  }

  logVerbose(`  · Visual fidelity capture: done (${viewportKeys.join(', ')})`);
  return results;
}
