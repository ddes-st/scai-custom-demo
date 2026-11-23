/**
 * Quick probe: overlapping top chrome detection on Renault home.
 * Usage: node tools/capture/_probe-overlapping-header.mjs
 */
import { resolvePlaywright } from './lib/playwright-resolve.mjs';
import { detectAllStickyOverlaysInPage, hideAllStickyOverlaysInPage } from './lib/sticky-overlays.mjs';

const url = process.argv[2] || 'https://nl.renault.be/';
const { chromium } = resolvePlaywright();
const browser = await chromium.launch({
  headless: true,
  channel: process.env.CAPTURE_CHANNEL || 'chrome',
  args: ['--disable-http2'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  locale: 'nl-BE',
});
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(4000);
await page.evaluate(() => window.scrollTo(0, 0));

const detected = await page.evaluate(detectAllStickyOverlaysInPage);
console.log('DETECTED', JSON.stringify(detected, null, 2));

const headerInfo = await page.evaluate(() => {
  const headers = [...document.querySelectorAll('header, [class*="MainHeader"], [class*="pageHeader"]')].map(
    (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        cls: String(el.className).slice(0, 120),
        pos: s.position,
        z: s.zIndex,
        top: Math.round(r.top),
        h: Math.round(r.height),
        w: Math.round(r.width),
      };
    },
  );
  return headers.slice(0, 20);
});
console.log('HEADER-LIKE', JSON.stringify(headerInfo, null, 2));

await page.evaluate(hideAllStickyOverlaysInPage);
const afterHide = await page.evaluate(() => {
  const chrome = document.querySelector('[class*="MainHeader"], [data-screenshot-hidden="overlapping-top-chrome"]');
  const hidden = [...document.querySelectorAll('[data-screenshot-hidden]')].map((el) => ({
    reason: el.getAttribute('data-screenshot-hidden'),
    cls: String(el.className).slice(0, 80),
    tag: el.tagName,
  }));
  return {
    chromeHidden: chrome
      ? {
          attr: chrome.getAttribute('data-screenshot-hidden'),
          vis: getComputedStyle(chrome).visibility,
          cls: String(chrome.className).slice(0, 80),
        }
      : null,
    hiddenCount: hidden.length,
    hiddenSample: hidden.slice(0, 15),
  };
});
console.log('AFTER HIDE', JSON.stringify(afterHide, null, 2));

await browser.close();
const hasHeader = detected.some((d) => d.cmsName === 'Header');
const looksLikeTallHero = detected.some(
  (d) => d.cmsName === 'Header' && /pageHeader|ContentZone/i.test(d.selector || ''),
);
if (!hasHeader) {
  console.error('FAIL: no Header overlay detected');
  process.exit(1);
}
if (looksLikeTallHero) {
  console.error('FAIL: Header overlay looks like tall page hero');
  process.exit(1);
}
console.log('OK: short chrome Header detected');
