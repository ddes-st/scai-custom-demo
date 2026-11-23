import { chromium } from 'playwright';
import { hideAllStickyOverlaysInPage } from './lib/sticky-overlays.mjs';

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
await page.waitForTimeout(4000);

await page.evaluate(async () => {
  const step = 700;
  const maxY = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  for (let y = 0; y < maxY; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 80));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(5000);

const before = await page.evaluate(() => {
  const rightFixed = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof Element)) continue;
    const s = getComputedStyle(el);
    if (!['fixed', 'sticky', 'absolute'].includes(s.position)) continue;
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 20 || r.width > 400) continue;
    if (r.right < window.innerWidth - 120) continue;
    rightFixed.push({
      tag: el.tagName,
      id: el.id,
      cls: String(el.className).slice(0, 100),
      aria: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      pos: s.position,
      text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 60),
      html: el.outerHTML.slice(0, 200),
      rect: { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
    });
  }
  const ot = document.querySelector('#onetrust-banner-sdk');
  return {
    rightFixed,
    iframes: [...document.querySelectorAll('iframe')].map((f) => ({
      id: f.id,
      src: (f.src || '').slice(0, 120),
      title: f.title,
      rect: (() => {
        const r = f.getBoundingClientRect();
        return { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) };
      })(),
    })),
    otVisible: ot ? getComputedStyle(ot).display !== 'none' : false,
  };
});
console.log('BEFORE HIDE', JSON.stringify(before, null, 2));

await page.evaluate(hideAllStickyOverlaysInPage);
await page.waitForTimeout(500);

const after = await page.evaluate(() => {
  const ot = document.querySelector('#onetrust-banner-sdk');
  const otParent = document.querySelector('#onetrust-consent-sdk');
  return {
    otDisplay: ot ? getComputedStyle(ot).display : null,
    otHiddenAttr: ot?.getAttribute('data-screenshot-hidden'),
    otParentDisplay: otParent ? getComputedStyle(otParent).display : null,
    otParentHidden: otParent?.getAttribute('data-screenshot-hidden'),
    rightStill: [...document.querySelectorAll('body *')]
      .filter((el) => {
        if (!(el instanceof Element)) return false;
        const s = getComputedStyle(el);
        if (!['fixed', 'sticky'].includes(s.position)) return false;
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width >= 20 && r.height >= 20 && r.right >= window.innerWidth - 120 && r.width <= 400;
      })
      .map((el) => ({
        id: el.id,
        cls: String(el.className).slice(0, 80),
        aria: el.getAttribute('aria-label'),
      })),
  };
});
console.log('AFTER HIDE', JSON.stringify(after, null, 2));
await browser.close();
