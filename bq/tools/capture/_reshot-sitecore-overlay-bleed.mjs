/**
 * Validate overlay isolation + logo-carousel blank fix on Sitecore home.
 * Re-exports section-01/02/03/06 only.
 *
 *   node tools/capture/_reshot-sitecore-overlay-bleed.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolvePlaywright } from './lib/playwright-resolve.mjs';
import {
  VIEWPORTS,
  resolveScreenshotDevices,
  ensureOverlayScrollbars,
} from './lib/viewports.mjs';
import { exportDetectedSections } from './lib/export-detected-sections.mjs';
import { normalizeSectionHtmlSnapshot } from './lib/section-html-normalize.mjs';
import { screenshotSectionHtmlDevices } from './lib/screenshot-section-html.mjs';
import { SECTION_HTML } from './lib/section-html-files.mjs';
import { hideTransientOverlaysInPage } from './lib/sticky-overlays.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pageDir = path.resolve(
  __dirname,
  '../../../.bq/captures/www-sitecore-com/www-sitecore-com--home',
);
const TARGET = new Set(['section-01', 'section-02', 'section-03', 'section-06']);
const URL = 'https://www.sitecore.com/';

async function forceInvalidateSlot(folder) {
  const sectionDir = path.join(pageDir, 'sections', folder);
  const infoPath = path.join(sectionDir, 'section-information.json');
  try {
    const info = JSON.parse(await readFile(infoPath, 'utf8'));
    info.contentHash = `force-refresh-${Date.now()}`;
    info.outputs = {};
    await writeFile(infoPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
  } catch {
    /* missing */
  }
  for (const device of resolveScreenshotDevices()) {
    const slug = device.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    await rm(path.join(sectionDir, `${folder}-${slug}.png`), { force: true }).catch(() => {});
  }
}

async function normalizeExistingSection06Html() {
  const htmlPath = path.join(pageDir, 'sections', 'section-06', SECTION_HTML);
  const raw = await readFile(htmlPath, 'utf8');
  const next = normalizeSectionHtmlSnapshot(raw);
  if (next !== raw) {
    await writeFile(htmlPath, next, 'utf8');
    console.log('  normalized section-06/section.html (marquee/hide scrub)');
  } else {
    console.log('  section-06/section.html already normalized or no scrub needed');
  }
  return htmlPath;
}

const { chromium } = resolvePlaywright();
const browser = await chromium.launch({
  headless: true,
  channel: process.env.CAPTURE_CHANNEL || 'chrome',
  args: ['--disable-http2'],
});
const context = await browser.newContext({
  locale: 'en-US',
  viewport: VIEWPORTS.desktop,
});
const page = await context.newPage();

console.log('goto', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(4000);

const index = JSON.parse(await readFile(path.join(pageDir, 'detected-sections.json'), 'utf8'));
const all = index.sections || [];
const targets = all.filter((s) => TARGET.has(s.folderName));
if (targets.length !== TARGET.size) {
  console.warn(
    '  warn: expected',
    [...TARGET].join(','),
    'got',
    targets.map((s) => s.folderName).join(','),
  );
}

for (const folder of TARGET) {
  await forceInvalidateSlot(folder);
}

// --- Overlays first (CMP still visible): 01, 02, 03 ---
const overlays = targets.filter((s) => s.track === 'overlay' || s.isOverlay);
console.log(
  'export overlays',
  overlays.map((s) => s.folderName).join(', '),
);
const overlayResult = await exportDetectedSections(page, {
  pageDir,
  url: URL,
  sections: overlays,
  devices: resolveScreenshotDevices(),
  overlaysAlreadyHidden: false,
  styledHtml: true,
  culture: 'en',
  imageMeta: index.image || null,
  writeDetectedIndex: false,
});

// Accept cookies then shoot content section-06
await page.evaluate(() => {
  document.querySelector('.osano-cm-accept-all')?.click();
  document.querySelector('#onetrust-accept-btn-handler')?.click();
});
await page.waitForTimeout(800);
await page.evaluate(hideTransientOverlaysInPage);

const content = targets.filter((s) => s.track !== 'overlay' && !s.isOverlay);
if (content.length) {
  console.log(
    'export content',
    content.map((s) => s.folderName).join(', '),
  );
  // Prefer re-normalize existing HTML + section-html shots; also allow live fallback via export
  const htmlPath = await normalizeExistingSection06Html();
  const sectionDir = path.join(pageDir, 'sections', 'section-06');
  const htmlShots = await screenshotSectionHtmlDevices(page, {
    htmlPath,
    sectionDir,
    folderName: 'section-06',
    pageDir,
    devices: resolveScreenshotDevices(),
    baseURL: URL,
    liveSectionSelector: content[0]?.selector || '',
  });
  console.log('  section-06 html shots', JSON.stringify(htmlShots.outputs, null, 2));
  if (htmlShots.errors?.length) console.warn('  errors', htmlShots.errors);

  // If any device failed HTML shot, run export for live fallback
  const failed = resolveScreenshotDevices().filter((d) => !htmlShots.outputs[d]?.path);
  if (failed.length) {
    console.log('  live export fallback for', failed.join(','));
    await exportDetectedSections(page, {
      pageDir,
      url: URL,
      sections: content,
      devices: failed,
      overlaysAlreadyHidden: true,
      styledHtml: true,
      culture: 'en',
      imageMeta: index.image || null,
      writeDetectedIndex: false,
    });
  } else {
    // Patch section-information.json outputs
    const infoPath = path.join(sectionDir, 'section-information.json');
    const info = JSON.parse(await readFile(infoPath, 'utf8'));
    info.outputs = htmlShots.outputs;
    info.contentHash = createHash('sha256')
      .update(await readFile(htmlPath, 'utf8'), 'utf8')
      .digest('hex');
    await writeFile(infoPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
  }
}

// Merge results back into detected-sections.json for the four folders
const freshIndex = JSON.parse(await readFile(path.join(pageDir, 'detected-sections.json'), 'utf8'));
const byFolder = new Map((freshIndex.sections || []).map((s) => [s.folderName, s]));
for (const folder of TARGET) {
  const infoPath = path.join(pageDir, 'sections', folder, 'section-information.json');
  try {
    const info = JSON.parse(await readFile(infoPath, 'utf8'));
    byFolder.set(folder, { ...(byFolder.get(folder) || {}), ...info, folderName: folder });
  } catch {
    /* keep */
  }
}
index.sections = (index.sections || []).map((s) => byFolder.get(s.folderName) || s);
index.generatedAt = new Date().toISOString();
await writeFile(
  path.join(pageDir, 'detected-sections.json'),
  `${JSON.stringify(index, null, 2)}\n`,
  'utf8',
);

console.log('\n=== verify ===');
for (const folder of [...TARGET].sort()) {
  const info = JSON.parse(
    await readFile(path.join(pageDir, 'sections', folder, 'section-information.json'), 'utf8'),
  );
  const methods = resolveScreenshotDevices().map((d) => `${d}:${info.outputs?.[d]?.method || 'missing'}`);
  console.log(folder, info.cmsName, methods.join(' | '));
}

await browser.close();
console.log('done', overlayResult?.sections?.length ?? 0, 'overlay exports');
