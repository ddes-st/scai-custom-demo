import { chromium } from 'playwright';

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
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const out = [];
  const push = (el, why) => {
    if (!(el instanceof Element)) return;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    out.push({
      why,
      tag: el.tagName,
      id: el.id,
      className: String(el.className).slice(0, 160),
      role: el.getAttribute('role'),
      aria: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      pos: s.position,
      z: s.zIndex,
      display: s.display,
      text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
      rect: {
        t: Math.round(r.top),
        l: Math.round(r.left),
        w: Math.round(r.width),
        h: Math.round(r.height),
        bottom: Math.round(r.bottom),
        right: Math.round(r.right),
      },
      shadow: Boolean(el.shadowRoot),
      parent: el.parentElement
        ? `${el.parentElement.tagName}#${el.parentElement.id}.${String(el.parentElement.className).slice(0, 40)}`
        : null,
    });
  };

  const cookieSels = [
    '#onetrust-banner-sdk',
    '#onetrust-consent-sdk',
    '#onetrust-pc-sdk',
    '[id*="onetrust"]',
    '[class*="onetrust"]',
    '[id*="cookie" i]',
    '[class*="cookie" i]',
    '[aria-label*="cookie" i]',
  ];
  for (const sel of cookieSels) {
    try {
      document.querySelectorAll(sel).forEach((el) => push(el, `cookie:${sel}`));
    } catch {
      /* ignore */
    }
  }

  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof Element)) continue;
    const s = getComputedStyle(el);
    if (!['fixed', 'sticky'].includes(s.position)) continue;
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 18 || r.height < 18) continue;
    const text = `${el.id} ${el.className} ${el.getAttribute('aria-label') || ''} ${el.innerText || ''}`.toLowerCase();
    const nearRight = r.right >= window.innerWidth - 100;
    const nearBottomWide = r.bottom >= window.innerHeight - 160 && r.width >= window.innerWidth * 0.35;
    if (
      nearRight ||
      nearBottomWide ||
      /cookie|consent|onetrust|thumb|feedback|survey|usabilla|hotjar|qualtrics|medallia|kampyle|rating|smile|nps/.test(
        text,
      )
    ) {
      push(el, 'fixed');
    }
  }

  document.querySelectorAll('iframe').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 16 && r.height > 16) {
      push(el, `iframe:${el.id || el.name || el.title || (el.src || '').slice(0, 80)}`);
    }
  });

  return out.slice(0, 100);
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
