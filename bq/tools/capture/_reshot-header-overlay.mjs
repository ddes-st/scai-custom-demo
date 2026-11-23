/**
 * Re-capture only section-02 header closed shots + menu states.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { resolvePlaywright } from './lib/playwright-resolve.mjs';
import { VIEWPORTS, ensureOverlayScrollbars } from './lib/viewports.mjs';
import { hideAllStickyOverlaysInPage } from './lib/sticky-overlays.mjs';
import {
  withChromeCaptureMode,
  detectChromePresentationVariants,
} from './lib/overlay-chrome-capture.mjs';
import { captureInteractiveStatesForSection } from './lib/interactive-states.mjs';
import { exportDetectedSections } from './lib/export-detected-sections.mjs';

// Use captureInteractiveStates + manual closed shots via evaluate measure from export path
// Simpler: import measure by re-running captureOne pieces

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pageDir = path.resolve(__dirname, '../../../.bq/captures/nl-renault-be/nl-renault-be--home');
const sectionDir = path.join(pageDir, 'sections', 'section-02');
const selector = 'div.MainHeaderV2';

const { chromium } = resolvePlaywright();
const browser = await chromium.launch({
  headless: true,
  channel: process.env.CAPTURE_CHANNEL || 'chrome',
  args: ['--disable-http2'],
});
const page = await (
  await browser.newContext({ locale: 'nl-BE', viewport: VIEWPORTS.desktop })
).newPage();
await page.goto('https://nl.renault.be/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3500);
await page.evaluate(() => {
  document.querySelector('#onetrust-accept-btn-handler')?.click();
  [...document.querySelectorAll('button')]
    .find((b) => /doorgaan|continuer|continue/i.test(b.textContent || ''))
    ?.click();
});
await page.waitForTimeout(1000);

const variants = await detectChromePresentationVariants(page, selector);
console.log('variants', JSON.stringify(variants, null, 2));

await rm(path.join(sectionDir, 'states'), { recursive: true, force: true }).catch(() => {});
await rm(path.join(sectionDir, 'statesbymutation'), { recursive: true, force: true }).catch(() => {});

// Closed chrome shots
for (const device of ['desktop', 'tablet', 'mobile']) {
  await page.setViewportSize(VIEWPORTS[device]);
  await ensureOverlayScrollbars(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await withChromeCaptureMode(page, selector, async () => {
    const rect = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      return {
        x: Math.max(0, Math.floor(r.left)),
        y: Math.max(0, Math.floor(r.top)),
        width: Math.ceil(r.width),
        height: Math.ceil(r.height),
        bg: getComputedStyle(el).backgroundColor,
        pos: getComputedStyle(el).position,
      };
    }, selector);
    console.log('closed', device, rect);
    await page.screenshot({
      path: path.join(sectionDir, `section-02-${device}.png`),
      clip: {
        x: rect.x,
        y: rect.y,
        width: Math.min(rect.width, VIEWPORTS[device].width - rect.x),
        height: Math.min(rect.height, VIEWPORTS[device].height - rect.y),
      },
    });
  });
}

// Interactive states
await page.setViewportSize(VIEWPORTS.desktop);
const interactive = await withChromeCaptureMode(page, selector, () =>
  captureInteractiveStatesForSection(page, {
    pageDir,
    sectionDir,
    folderName: 'section-02',
    sectionSelector: selector,
    devices: ['desktop', 'tablet', 'mobile'],
    sectionMeta: { cmsName: 'Header', folderName: 'section-02', track: 'overlay' },
  }),
);

console.log(
  'menus',
  (interactive.interactionStates || []).map((s) => ({
    slug: s.slug,
    detection: s.detection,
    panel: s.panel?.selector,
    notes: s.viewportNotes,
    desktop: s.outputs?.desktop,
    mobile: s.outputs?.mobile,
  })),
);

// Patch section-information.json
const infoPath = path.join(sectionDir, 'section-information.json');
const info = JSON.parse(await readFile(infoPath, 'utf8'));
info.presentationVariants = variants;
info.interactionStates = interactive.interactionStates;
delete info.interactionStatesMutation;
info.interactionSummary = interactive.interactionSummary;
await writeFile(infoPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');

await browser.close();
console.log('done');
