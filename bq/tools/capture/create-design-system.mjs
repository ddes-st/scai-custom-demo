#!/usr/bin/env node
/**
 * Ensure CSS/fonts + write ai-derived-design.md (Azure Foundry) for a captured URL.
 *
 *   npm run create:design-system -- --url https://nl.renault.be/
 *   npm run create:design-system -- https://nl.renault.be/ --force design
 *
 * Resolves the same folder as capture: .bq/captures/{hostSlug}/{pageSlug}
 */
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractPageDesign } from './lib/extract-page-design.mjs';
import { hideCookieBannerInPage } from './lib/cookie-banner.mjs';
import { resolvePlaywright } from './lib/playwright-resolve.mjs';
import { defaultCapturesDir } from './paths.mjs';
import { hostSlugFromUrl, slugFromUrl, validateUrl } from './lib/url-utils.mjs';
import { loadLocalEnvFiles } from './lib/design-system/load-env.mjs';
import { BASE_VIEWPORT } from './lib/design-system/constants.mjs';
import { AI_DERIVED_DESIGN_MD } from './lib/design-system/ai/generate-ai-design-guide.mjs';
import { consumeForceArg, forceHelpLine, shouldForce } from './lib/force-kinds.mjs';
import { resolveExistingPageHtml } from './lib/page-layout.mjs';

function parseArgs(argv) {
  let url = null;
  let force = null;
  let waitMs = 2000;
  let timeoutMs = 90000;
  let loadUntil = 'domcontentloaded';

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const forced = consumeForceArg(argv, i);
    if (forced) {
      force = forced.force;
      i = forced.nextIndex - 1;
      continue;
    }
    if (a === '--url') url = argv[++i];
    else if (a === '--page-dir' || a === '--out') {
      throw new Error(`${a} removed — pass --url (or a bare https URL); path is .bq/captures/{host}/{slug}`);
    } else if (a === '--ai') {
      /* removed: AI design is always on */
    } else if (a === '--debug') i++;
    else if (a === '--wait-ms') waitMs = Number(argv[++i]) || waitMs;
    else if (a === '--timeout-ms') timeoutMs = Number(argv[++i]) || timeoutMs;
    else if (a === '--load') loadUntil = argv[++i] === 'networkidle' ? 'networkidle' : 'domcontentloaded';
    else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  node create-design-system.mjs --url <https://…> [--force[=kinds]]
  node create-design-system.mjs <https://…> [--force[=kinds]]

Resolves the capture folder (.bq/captures/{host}/{slug}) the same way as capture:webpage.
Writes ${AI_DERIVED_DESIGN_MD} via Azure Foundry from full page HTML+CSS (script bodies stripped).
Reuses existing css/fonts when complete; skips Azure when HTML+CSS sourceHash matches
ai-meta.json (purpose ai-derived-design) unless --force design.
${forceHelpLine()}
Env: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY|AZURE_FOUNDRY_API_KEY, AZURE_OPENAI_DEFAULT_MODEL
Optional: AZURE_AI_DESIGN_MAX_CHARS`);
      process.exit(0);
    } else if (a.startsWith('http://') || a.startsWith('https://')) {
      url = a.trim();
    }
  }
  return { url, force, waitMs, timeoutMs, loadUntil };
}

function resolveTarget(url) {
  if (!url) throw new Error('Provide --url <https://…> or a bare https URL');
  validateUrl(url);
  const host = hostSlugFromUrl(url);
  const slug = slugFromUrl(url);
  const pageDir = path.join(defaultCapturesDir, host, slug);
  return { pageDir, url };
}

async function catalogComplete(pageDir, kind) {
  try {
    if (kind === 'css') {
      const catalog = JSON.parse(await readFile(path.join(pageDir, 'detected-css.json'), 'utf8'));
      const files = (catalog.files || []).filter((f) => f.status === 'downloaded' && f.file);
      if (!files.length) return false;
      for (const f of files) await access(path.join(pageDir, f.file));
      return true;
    }
    if (kind === 'fonts') {
      const catalog = JSON.parse(await readFile(path.join(pageDir, 'detected-fonts.json'), 'utf8'));
      const fonts = catalog.fonts || [];
      if (!fonts.length) return false;
      for (const font of fonts) {
        for (const f of font.files || []) {
          if (f.status === 'downloaded' && f.file) await access(path.join(pageDir, f.file));
        }
      }
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function assertCaptureFolderUsable(pageDir, url) {
  try {
    await access(pageDir);
  } catch {
    throw new Error(
      `No capture folder at ${pageDir}. Run: npm run capture:webpage -- --urls "${url}"`,
    );
  }
  const htmlPath = await resolveExistingPageHtml(pageDir);
  if (!htmlPath) {
    throw new Error(
      `Missing html/page.html under ${pageDir}. Run: npm run capture:webpage -- --urls "${url}"`,
    );
  }
}

async function main() {
  loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const { pageDir, url } = resolveTarget(args.url);

  await assertCaptureFolderUsable(pageDir, url);

  const needBrowser =
    shouldForce(args.force, 'css') ||
    shouldForce(args.force, 'fonts') ||
    !(await catalogComplete(pageDir, 'css')) ||
    !(await catalogComplete(pageDir, 'fonts'));

  console.log(`AI design → ${pageDir}`);
  console.log(
    `URL: ${url}${args.force?.size ? ` (force: ${[...args.force].join(',')})` : ''}\n`,
  );

  if (!needBrowser) {
    const design = await extractPageDesign(null, pageDir, { force: args.force, url });
    logSummary(design);
    return;
  }

  const { chromium } = resolvePlaywright();
  const browser = await chromium.launch({
    headless: process.env.CAPTURE_HEADLESS === '1',
    channel: process.env.CAPTURE_CHANNEL || 'chrome',
    args: ['--disable-http2', '--autoplay-policy=no-user-gesture-required'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: BASE_VIEWPORT.width, height: BASE_VIEWPORT.height },
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(args.timeoutMs);
    await page.goto(url, { waitUntil: args.loadUntil, timeout: args.timeoutMs });
    if (args.waitMs > 0) await page.waitForTimeout(args.waitMs);
    await page.evaluate(async () => {
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      const step = Math.max(window.innerHeight * 0.75, 400);
      let y = 0;
      const max = document.documentElement.scrollHeight;
      while (y < max) {
        window.scrollTo(0, y);
        await delay(120);
        y += step;
      }
      window.scrollTo(0, 0);
    });
    await page.evaluate(hideCookieBannerInPage);

    const design = await extractPageDesign(page, pageDir, { force: args.force, url });
    logSummary(design);
    await context.close();
  } finally {
    await browser.close();
  }
}

function logSummary(design) {
  const file = design.meta?.aiOutputs?.designMd;
  if (!file) {
    console.log(
      `\n✓ AI design` +
        (design.meta?.aiSkipReason ? `\n  ai note: ${design.meta.aiSkipReason}` : ''),
    );
    return;
  }
  const status = design.meta?.aiReused
    ? 'already existed (sourceHash match)'
    : design.meta?.aiUsed
      ? 'new'
      : 'skipped';
  console.log(`\n✓ ai outputs: ${file} (${status})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
