// Diagnostic v2: capture /v1/search successes AND failures, then run the same
// fetch from inside the page to expose the exact browser-side error.
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('/v1/search')) {
    console.log(`<< RESPONSE ${res.status()} ${res.url().slice(0, 80)}`);
  }
});
page.on('requestfailed', (req) => {
  if (req.url().includes('/v1/search')) {
    console.log(`!! REQUEST FAILED: ${req.failure()?.errorText}`);
  }
});

await page.goto(`${baseUrl}/Articles`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

const inPage = await page.evaluate(async () => {
  try {
    const res = await fetch('https://edge-platform.sitecorecloud.io/v1/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sitecore-contextid': '1O6QOre7d7cSx3IGEjX5lr',
      },
      body: JSON.stringify({
        config: { id: '5db6d2f0-4157-45fc-9017-fd928f94f87c' },
        limit: 6,
        offset: 0,
        query: { keyphrase: '' },
        sessionId: '',
        sort: { fields: [] },
      }),
    });
    const data = await res.json();
    return `in-page fetch OK: status ${res.status}, total ${data.total}`;
  } catch (e) {
    return `in-page fetch FAILED: ${e.message}`;
  }
});
console.log(inPage);

const v2Text = await page
  .locator('.search-experience-v2 p[aria-live="polite"]')
  .first()
  .textContent()
  .catch(() => '<v2 total line not found>');
const v3Text = await page
  .locator('section.search-results p[aria-live="polite"]')
  .first()
  .textContent()
  .catch(() => '<v3 total line not found>');
console.log(`V2 total line: ${v2Text?.trim()}`);
console.log(`V3 total line: ${v3Text?.trim()}`);

await browser.close();
