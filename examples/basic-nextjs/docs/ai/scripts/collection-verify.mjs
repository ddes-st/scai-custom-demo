// Browser-level verification of the SearchCollection component (ticket #47)
// on the Home page: heading renders, MaxItems cards appear, and titles are in
// publication-date-descending order (the sort contract proven end-to-end
// against the live endpoint).
//
// Usage (from examples/basic-nextjs, dev server running):
//   node docs/ai/scripts/collection-verify.mjs [baseUrl]
//
// Screenshot lands in .tmp-search-verify/. Selectors are scoped to
// section.search-collection so other components on the page cannot
// contaminate the run (console errors are reported but attributed).

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.argv[2] ?? 'http://localhost:3000';
const outDir = '.tmp-search-verify';
mkdirSync(outDir, { recursive: true });

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
await page.waitForTimeout(3000); // hydration + client-side search fetch

const component = page.locator('section.search-collection');
const heading = component.locator('h2');
const cards = component.locator('h3');

const componentPresent = (await component.count()) === 1;
record('component-present', componentPresent, `section.search-collection count: ${await component.count()}`);

if (componentPresent) {
  const headingText = (await heading.textContent())?.trim() ?? '';
  record('heading', headingText === 'Latest Articles', `heading: "${headingText}"`);

  const titles = (await cards.allTextContents()).map((t) => t.trim());
  record('card-count', titles.length === 3, `cards: ${titles.length} (MaxItems 3)`);

  // Live corpus newest three (2026-08-18 expansion): AI Meets Human Connection
  // Aug 6 > Observability Jul 28 > Migrations Jul 15. Date-desc sort must
  // yield exactly this order.
  const expectedOrder = ['AI Meets Human Connection', 'Observability', 'Migrations'];
  const orderCorrect =
    titles.length === 3 && expectedOrder.every((word, i) => titles[i]?.includes(word));
  record('date-desc-order', orderCorrect, `titles: [${titles.join(' | ')}]`);

  const dates = await component.locator('p.text-sm').allTextContents();
  record('dates-rendered', dates.length === 3, `dates: [${dates.join(' | ')}]`);

  const links = await component.locator('a').count();
  const firstLink =
    (await component.locator('a').first().getAttribute('href').catch(() => null)) ?? '(none)';
  record(
    'result-links-work',
    links === 3 && firstLink === '/Articles/AI-Meets-Human-Connection',
    `links: ${links}, first: ${firstLink} (live since #49)`
  );
}

if (componentPresent) {
  await component.screenshot({ path: `${outDir}/collection-home.png` });
} else {
  await page.screenshot({ path: `${outDir}/collection-home.png`, fullPage: false });
}

const ownErrors = consoleErrors.filter((e) => !e.includes('SearchExperience_'));
record(
  'no-console-errors',
  consoleErrors.length === 0,
  consoleErrors.length === 0
    ? 'clean'
    : `${consoleErrors.length} total, ${ownErrors.length} not attributable to V2 dictionary keys: ${ownErrors.slice(0, 2).join(' || ') || '(none)'}`
);

await browser.close();

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed. Screenshot in ${outDir}/`);
process.exit(passed === results.length ? 0 : 1);
