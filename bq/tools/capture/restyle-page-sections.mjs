/**
 * Re-save styled section.html for every section on an existing capture page
 * (does not re-detect slots or re-crop PNGs).
 *
 *   node tools/capture/restyle-page-sections.mjs --url https://www.axa.be/nl/particulieren
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { acceptCookieConsent } from './lib/cookie-banner.mjs';
import { resolvePlaywright } from './lib/playwright-resolve.mjs';
import { saveSectionStyledHtml } from './lib/save-section-styled-html.mjs';
import { VIEWPORTS } from './lib/viewports.mjs';
import { resolveCapturePageDir } from '../create-section-components/resolve-capture.mjs';

function parseArgs(argv) {
  let url = null;
  /** @type {string | null} */
  let section = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') url = argv[++i];
    else if (argv[i]?.startsWith('--url=')) url = argv[i].slice(6);
    else if (argv[i] === '--section') section = argv[++i];
    else if (argv[i]?.startsWith('--section=')) section = argv[i].slice(10);
    else if (!url && /^https?:\/\//i.test(argv[i])) url = argv[i];
  }
  return { url, section };
}

async function main() {
  const { url, section } = parseArgs(process.argv.slice(2));
  if (!url) {
    console.error(
      'Usage: node tools/capture/restyle-page-sections.mjs --url <https://…> [--section section-09]',
    );
    process.exit(1);
  }

  const { pageDir } = await resolveCapturePageDir(url);
  const sectionsRoot = path.join(pageDir, 'sections');
  let folders = (await readdir(sectionsRoot, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && /^section-\d+/i.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return na - nb;
    });
  if (section) {
    folders = folders.filter((f) => f === section || f.startsWith(`${section}-`));
    if (!folders.length) {
      console.error(`No section folder matching --section ${section}`);
      process.exit(1);
    }
  }

  console.log(`Page dir: ${pageDir}`);
  console.log(`Sections: ${folders.length}${section ? ` (filter: ${section})` : ''}`);

  const { chromium } = resolvePlaywright();
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.CAPTURE_CHANNEL || 'chrome',
    args: ['--disable-http2'],
  });
  const context = await browser.newContext({
    viewport: VIEWPORTS.desktop,
    locale: 'en-US',
  });
  const page = await context.newPage();

  console.log('Navigating', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await acceptCookieConsent(page).catch(() => {});
  await page.waitForTimeout(1000);
  // Nudge lazy content
  await page
    .evaluate(async () => {
      const maxY = Math.max(
        0,
        (document.documentElement.scrollHeight || 0) - (window.innerHeight || 900),
      );
      window.scrollTo(0, Math.min(maxY, (window.innerHeight || 900) * 2));
      await new Promise((r) => setTimeout(r, 400));
      window.scrollTo(0, maxY);
      await new Promise((r) => setTimeout(r, 400));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 300));
    })
    .catch(() => {});

  /** @type {{ folder: string, bytes: number, scopedHint: string, errors: string[] }[]} */
  const summary = [];

  for (const folder of folders) {
    const sectionDir = path.join(sectionsRoot, folder);
    let selector = null;
    try {
      const info = JSON.parse(
        await readFile(path.join(sectionDir, 'section-information.json'), 'utf8'),
      );
      selector = info.selector || null;
    } catch {
      /* skip */
    }
    if (!selector) {
      console.log(`  ${folder}: skip (no selector)`);
      summary.push({ folder, bytes: 0, scopedHint: 'no-selector', errors: ['no selector'] });
      continue;
    }

    console.log(`  ${folder}: ${selector}`);
    try {
      await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 8000 });
    } catch {
      /* continue anyway */
    }
    await page.waitForTimeout(200);

    const result = await saveSectionStyledHtml(page, {
      pageDir,
      sectionDir,
      sectionSelector: selector,
      folderName: folder,
      writeLegacySiblings: false,
    });

    let bytes = 0;
    let scopedHint = '';
    try {
      const html = await readFile(path.join(sectionDir, 'section.html'), 'utf8');
      bytes = Buffer.byteLength(html, 'utf8');
      const m = html.match(/scopedBytes=(\d+).*?rulesKept=(\d+)/);
      if (m) scopedHint = `scopedBytes=${m[1]} rulesKept=${m[2]}`;
      else if (/Authored CSS scoped/i.test(html.slice(0, 2500))) scopedHint = 'scoped';
      else if (/fluid layout heuristics/i.test(html.slice(0, 2500))) scopedHint = 'heuristics-fallback';
    } catch {
      /* missing */
    }

    console.log(
      `    → ${bytes} bytes${scopedHint ? ` (${scopedHint})` : ''}` +
        (result.errors?.length ? ` errors=${result.errors.length}` : ''),
    );
    if (result.errors?.length) {
      for (const e of result.errors) console.log(`      ! ${e}`);
    }
    summary.push({
      folder,
      bytes,
      scopedHint,
      errors: result.errors || [],
    });
  }

  await browser.close();

  console.log('\n=== section.html sizes ===');
  let total = 0;
  for (const row of summary) {
    total += row.bytes;
    const kb = (row.bytes / 1024).toFixed(1);
    console.log(
      `${row.folder.padEnd(12)} ${String(row.bytes).padStart(8)} B  (${kb} KB)  ${row.scopedHint}`,
    );
  }
  console.log(`TOTAL ${total} B (${(total / 1024).toFixed(1)} KB)`);
  console.log('\nPaused before TSX regen — review sizes, then say OK to run create:sectioncomponents --force.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
