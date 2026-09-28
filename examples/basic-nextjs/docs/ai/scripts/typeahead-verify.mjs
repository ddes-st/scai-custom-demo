// Browser-level verification of the typeahead search (ticket #48, header slot
// era): since the page-scoped instances were removed, the typeahead lives in
// the NavigationHeader search slot on every page. Suggestions appear while
// typing, keyboard navigation works, and Enter / see-all hand the query to
// the SearchResults page via ?q=.
//
// Usage (from examples/basic-nextjs, dev server running):
//   node docs/ai/scripts/typeahead-verify.mjs [baseUrl]
//
// Screenshot lands in .tmp-search-verify/. Selectors are scoped to the
// header combobox; console errors are reported but attributed.

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

await page.goto(`${baseUrl}/Articles`, { waitUntil: 'load' });
await page.waitForTimeout(3000); // hydration

const component = page.locator('header [role="combobox"]');
const input = component.locator('input');
const listbox = component.locator('[role="listbox"]');
const options = listbox.locator('[role="option"]');

record('component-present', (await component.count()) === 1, `header combobox count: ${await component.count()}`);

// 1. Typing shows title suggestions after the debounce. ("canary" not "can" —
// the expanded corpus matches 8 documents for "can" and the target ranks 5th;
// the keyboard step below needs the target first.)
await input.fill('canary');
await page.waitForTimeout(2500); // debounce + fetch
const optionTexts = (await options.allTextContents()).map((t) => t.trim());
const hasCanary = optionTexts.some((t) => t.includes('Canary'));
record('suggestions-appear', hasCanary, `options: [${optionTexts.join(' | ')}]`);

// 2. See-all link carries the query.
const seeAllHref = (await listbox.locator('a').getAttribute('href')) ?? '';
record('see-all-href', seeAllHref === '/Articles?q=canary', `href: "${seeAllHref}"`);

await component.screenshot({ path: `${outDir}/typeahead-open.png` });

// 3. Keyboard: ArrowDown selects the first option, Enter chooses it. With
// LinkMapping live (since #49) this navigates DIRECTLY to the article page.
await input.press('ArrowDown');
await input.press('Enter');
await page.waitForURL(/Canary-Releases-Explained/, { timeout: 10000 });
record(
  'keyboard-enter-opens-article',
  new URL(page.url()).pathname === '/Articles/Canary-Releases-Explained',
  `landed: ${new URL(page.url()).pathname}`
);

// 4. The handoff: Enter WITHOUT a selection goes to the results page with ?q=,
// where SearchResults hydrates and the probe article ranks first.
await page.goto(`${baseUrl}/Articles`, { waitUntil: 'load' });
await page.waitForTimeout(2000);
await input.fill('canary');
await page.waitForTimeout(2500);
await input.press('Enter');
await page.waitForURL(/\?q=canary/, { timeout: 10000 });
await page.waitForTimeout(3500);
const resultsInput = page.locator('section.search-results input');
const firstCard = page.locator('section.search-results h3').first();
const hydrated = (await resultsInput.inputValue()) === 'canary';
const firstTitle = (await firstCard.textContent().catch(() => ''))?.trim() ?? '';
record(
  'handoff-filters-results',
  hydrated && firstTitle.includes('Canary'),
  `results input: "${await resultsInput.inputValue()}", first card: "${firstTitle}"`
);

// 5. Gibberish yields no title suggestions.
await page.goto(`${baseUrl}/Articles`, { waitUntil: 'load' });
await page.waitForTimeout(2000);
await input.fill('xyzzyqwerty');
await page.waitForTimeout(2500);
const gibberishTitles = (await options.allTextContents())
  .map((t) => t.trim())
  .filter((t) => !t.includes('See all results') && !t.includes('SeeAllResults'));
record('gibberish-no-suggestions', gibberishTitles.length === 0, `title options: ${gibberishTitles.length}`);

// Attribution: this script also visits the article detail page (suggestion
// navigation), whose hero is not the component under test — its missing-alt
// warning surfaces when the published image lacks alt text.
const ownErrors = consoleErrors.filter(
  (e) =>
    !e.includes('SearchExperience_') &&
    !e.includes('Failed to load resource') &&
    !e.includes('missing required "alt"')
);
const attributed = consoleErrors.length - ownErrors.length;
record(
  'no-console-errors',
  ownErrors.length === 0,
  consoleErrors.length === 0
    ? 'clean'
    : `${consoleErrors.length} total (${attributed} attributed to other components), own: ${ownErrors.slice(0, 2).join(' || ') || '(none)'}`
);

await browser.close();

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed. Screenshot in ${outDir}/`);
process.exit(passed === results.length ? 0 : 1);
