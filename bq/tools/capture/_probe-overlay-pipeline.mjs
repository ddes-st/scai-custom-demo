/**
 * Probe overlay detect after scroll-prepare (mirrors capture timing).
 */
import { resolvePlaywright } from './lib/playwright-resolve.mjs';
import { detectOverlaySectionsInPage } from './lib/hybrid-section-detector.mjs';
import { detectAllStickyOverlaysInPage } from './lib/sticky-overlays.mjs';

const url = process.argv[2] || 'https://nl.renault.be/';
const { chromium } = resolvePlaywright();
const browser = await chromium.launch({
  headless: true,
  channel: process.env.CAPTURE_CHANNEL || 'chrome',
  args: ['--disable-http2'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'nl-BE',
});
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3000);

// mimic initial scroll prepare
await page.evaluate(async () => {
  const step = 700;
  const maxY = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  for (let y = 0; y < maxY; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 40));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1500);

const raw = await page.evaluate(detectAllStickyOverlaysInPage);
console.log('RAW', JSON.stringify(raw, null, 2));

const chromeState = await page.evaluate(() => {
  const el = document.querySelector('.MainHeaderV2');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return {
    cls: String(el.className),
    pos: s.position,
    z: s.zIndex,
    top: r.top,
    h: r.height,
    w: r.width,
    display: s.display,
    vis: s.visibility,
    opacity: s.opacity,
  };
});
console.log('CHROME STATE', JSON.stringify(chromeState, null, 2));

const overlays = await detectOverlaySectionsInPage(page, { skipReady: false });
console.log(
  'OVERLAYS',
  JSON.stringify(
    overlays.map((o) => ({ cmsName: o.cmsName, selector: o.selector, track: o.track, h: o.height })),
    null,
    2,
  ),
);

await browser.close();
