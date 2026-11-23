import { chromium } from 'playwright';
import { hideAllStickyOverlaysInPage, detectAllStickyOverlaysInPage } from './lib/sticky-overlays.mjs';

const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-http2'] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  locale: 'en-GB',
});
const page = await context.newPage();
await page.goto('https://www.britishcouncil.org/', { waitUntil: 'commit', timeout: 90000 });
await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => null);
await page.waitForTimeout(5000);

async function scroll() {
  await page.evaluate(async () => {
    const step = 700;
    const maxY = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    for (let y = 0; y < maxY; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    for (let y = maxY; y > 0; y -= step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
}

await scroll();
await page.waitForTimeout(3000);

const detected = await page.evaluate(detectAllStickyOverlaysInPage);
console.log('DETECTED', JSON.stringify(detected, null, 2));

const svgThumbs = await page.evaluate(() => {
  const hits = [];
  for (const el of document.querySelectorAll('button, a, div, span, iframe, [role="button"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 24 || r.width > 120 || r.height > 120) continue;
    const blob = `${el.id} ${el.className} ${el.getAttribute('aria-label') || ''} ${el.title || ''} ${el.innerHTML || ''}`
      .toLowerCase()
      .slice(0, 400);
    if (
      /thumb|feedback|survey|usabilla|kampyle|medallia|qualtrics|hotjar|smile|rating|nps| helploom|getsitecontrol|juicer/.test(
        blob,
      ) ||
      (r.right > 1300 && r.width >= 40 && r.height >= 40)
    ) {
      const s = getComputedStyle(el);
      hits.push({
        tag: el.tagName,
        id: el.id,
        cls: String(el.className).slice(0, 100),
        aria: el.getAttribute('aria-label'),
        pos: s.position,
        rect: { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
        blob: blob.slice(0, 160),
      });
    }
  }
  return hits.slice(0, 40);
});
console.log('THUMB CANDIDATES', JSON.stringify(svgThumbs, null, 2));

await page.evaluate(hideAllStickyOverlaysInPage);
await page.waitForTimeout(300);
console.log(
  'OT after hide',
  await page.evaluate(() => {
    const ot = document.querySelector('#onetrust-banner-sdk');
    return ot ? { display: getComputedStyle(ot).display, hidden: ot.getAttribute('data-screenshot-hidden') } : null;
  }),
);

await scroll();
await page.waitForTimeout(1000);
console.log(
  'OT after resroll',
  await page.evaluate(() => {
    const ot = document.querySelector('#onetrust-banner-sdk');
    return ot
      ? {
          display: getComputedStyle(ot).display,
          visibility: getComputedStyle(ot).visibility,
          opacity: getComputedStyle(ot).opacity,
          hidden: ot.getAttribute('data-screenshot-hidden'),
          rectH: Math.round(ot.getBoundingClientRect().height),
        }
      : null;
  }),
);

await browser.close();
