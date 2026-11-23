#!/usr/bin/env node
/**
 * Unified webpage capture (npm run capture:webpage).
 *
 * One Playwright session / one page load per URL:
 *  1) Overlay screenshots per viewport
 *  2) Detect overlays while visible
 *  3) Accept cookie consent (so gated content can load)
 *  4) Hide transient overlays (CMP/chat) → clean screenshots (site header kept)
 *  5) Hybrid section detection + page-local export (no reload; header still in DOM)
 */
import { mkdir, writeFile, readFile, access, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePlaywright } from './lib/playwright-resolve.mjs';
import { savePageHtml } from './lib/save-page-html.mjs';
import { extractPageDesign } from './lib/extract-page-design.mjs';
import { hideTransientOverlaysInPage, unlockDocumentScrollForCapture, restoreDocumentScrollLock } from './lib/sticky-overlays.mjs';
import { acceptCookieConsent } from './lib/cookie-banner.mjs';
import { preparePageForScreenshot } from './lib/page-ready.mjs';
import { shouldDiscardAnnotateShot } from './lib/annotate-screenshot-pick.mjs';
import { readUrlsFromFile, slugFromUrl, validateUrl, hostSlugFromUrl, isGenericDesignScreenshotsDir } from './lib/url-utils.mjs';
import { defaultCapturesDir } from './paths.mjs';
import { pageScreenshotPath, pageScreenshotsDir, pageSectionsDir, resolveExistingPageHtml } from './lib/page-layout.mjs';
import {
  detectOverlaySectionsInPage,
  runHybridSectionDetector,
} from './lib/hybrid-section-detector.mjs';
import { exportDetectedSections } from './lib/export-detected-sections.mjs';
import { AI_DERIVED_DESIGN_MD } from './lib/design-system/ai/generate-ai-design-guide.mjs';
import { buildAiDecidePageSections } from './lib/design-system/ai/aidecide-page-sections.mjs';
import { consumeForceArg, forceHelpLine, shouldForce } from './lib/force-kinds.mjs';
import {
  VIEWPORTS,
  resolveScreenshotDevices,
  deviceFileSlug,
  normalizeDeviceKey,
  ensureOverlayScrollbars,
  installOverlayScrollbarsOnContext,
  warnIfLayoutWidthShrunk,
} from './lib/viewports.mjs';
import { loadLocalEnvFiles } from './lib/design-system/load-env.mjs';
import {
  resolveCultures,
  resolveCaptureSourceCulture,
  parseHtmlLangAttribute,
  writePageCaptureSourceCulture,
} from '../shared/cultures.mjs';
import { saveHostLogo } from './lib/save-host-logo.mjs';

function emptyAiUsage() {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    calls: 0,
  };
}

function addAiUsage(acc, part) {
  if (!acc || !part) return acc;
  acc.promptTokens += Number(part.promptTokens) || 0;
  acc.completionTokens += Number(part.completionTokens) || 0;
  acc.totalTokens += Number(part.totalTokens) || 0;
  acc.costUsd += Number(part.costUsd) || 0;
  acc.calls += Number(part.calls) || 0;
  return acc;
}

function usageFromDesignResult(design) {
  const u = emptyAiUsage();
  if (!design?.meta?.aiUsed || design?.meta?.aiReused) return u;
  const usage = design.meta.aiUsage || design.ai?.usage || null;
  const cost = design.meta.aiCostEstimate || design.ai?.costEstimate || null;
  if (usage) {
    u.promptTokens = usage.promptTokens || 0;
    u.completionTokens = usage.completionTokens || 0;
    u.totalTokens = usage.totalTokens || 0;
    u.calls = 1;
  }
  if (cost?.totalUsd != null) u.costUsd = Number(cost.totalUsd) || 0;
  return u;
}

function usageFromUseAiResult(aiSections) {
  const u = emptyAiUsage();
  if (!aiSections?.usage || aiSections.skipped) return u;
  const usage = aiSections.usage;
  u.promptTokens = usage.promptTokens || 0;
  u.completionTokens = usage.completionTokens || 0;
  u.totalTokens = usage.totalTokens || 0;
  u.costUsd = usage.costUsd || 0;
  u.calls = usage.calls || 0;
  return u;
}

function formatAiCost(costUsd) {
  return costUsd > 0 ? `~$${Math.round(costUsd * 1e6) / 1e6}` : 'cost n/a';
}

function formatAiUsageLine(label, usage) {
  return `${label}: in=${usage.promptTokens} out=${usage.completionTokens} total=${usage.totalTokens} ${formatAiCost(usage.costUsd)}`;
}

/**
 * Print capture AI run total; on failure, banner first so the error is obvious.
 * @param {{ usage: ReturnType<typeof emptyAiUsage>, pages?: number, failed?: boolean, error?: unknown }} opts
 */
export function flushCaptureAiUsageSummary(opts = {}) {
  const usage = opts.usage || emptyAiUsage();
  const pages = opts.pages != null ? Number(opts.pages) : 0;
  if (opts.failed) {
    const msg = String(
      opts.error instanceof Error ? opts.error.message : opts.error || 'unknown',
    )
      .split('\n')[0]
      .trim();
    console.error(`\n✗ capture:webpage failed — AI usage recorded before failure:`);
    if (msg) console.error(`  ${msg}`);
  }
  const line = formatAiUsageLine(
    `${opts.failed ? '✗' : '✓'} AI run total: pages=${pages}`,
    usage,
  );
  if (opts.failed) console.error(`  ${line}`);
  else console.log(line);
  return line;
}

function printHelp() {
  console.log(`Usage: node capture.mjs [options]

Options:
  --urls <a,b,c>     Comma-separated URLs to capture
  --file <path>      Text file with one URL per line (# comments ignored)
  --out <dir>        Output directory (default: <repo>/.bq/captures)
  --full-page        Capture full scrollable page (default: true)
  --viewport-only    Capture above-the-fold only
  --no-html          Skip saving page.html
  --no-sections      Skip hybrid detection + section export
  --wait-ms <n>      Optional extra wait after readiness (default: 0)
  --timeout-ms <n>   Navigation timeout (default: 60000)
  --devices <list>   Comma-separated Sitecore AI widths (default: all five fixed).
                     Keys: mobile,tablet,desktop,desktopRegular,desktopLarge
                     (aliases: desktop-regular, desktop-large). Flexible is not a width.
  --manifest         Write manifest.json listing all output paths
  --load <mode>      commit | domcontentloaded | networkidle (default: domcontentloaded)
  --styled-html      Also write legacy section.styled.html + section.styled-{desktop|tablet|mobile}.html
                     (section.html is always a self-contained styled snapshot; raw DOM is original-section.html.
                     Interactive states/ folders use the same pair: original-section.html + styled section.html.
                     Tab/accordion resting + state PNGs prefer section-html screenshots of that file; menus stay live.)
  --cultures <list>  Preferred Sitecore culture tags when resolving source culture
                     (e.g. nl-BE,fr-BE). Not written to page-meta (page has one culture).
                     Default: BQ_CULTURES from bq/.env.local
  ${forceHelpLine()}
  -h, --help         Show this help

By default, existing html / css / fonts / screenshots / sections / ${AI_DERIVED_DESIGN_MD}
are reused when complete. Pass --force or --force=html,css,… to redo.

Per viewport, two full-page PNGs are saved under screenshots/:
  screenshots/{device}.png        — with sticky overlays visible
  screenshots/{device}-clean.png  — after sticky overlays are hidden

Then (same Playwright page, unless --no-sections):
  detected-sections.png              — numbered section boxes (page folder root)
  detected-sections.json             — canonical page section index (page folder root)
  sections/{folder}/                 — per-section PNGs, HTML, AI-enriched section-information.json
`);
}

function parseArgs(argv) {
  const options = {
    urls: [],
    file: null,
    out: defaultCapturesDir,
    fullPage: true,
    saveHtml: true,
    runSections: true,
    waitMs: 0,
    timeoutMs: 60000,
    devices: [...resolveScreenshotDevices()],
    manifest: false,
    loadUntil: 'domcontentloaded',
    force: null,
    styledHtml: false,
    cultures: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
    const forced = consumeForceArg(argv, i);
    if (forced) {
      options.force = forced.force;
      i = forced.nextIndex - 1;
      continue;
    }
    if (arg === '--cultures') {
      options.cultures = argv[++i] ?? '';
      continue;
    }
    if (arg.startsWith('--cultures=')) {
      options.cultures = arg.slice('--cultures='.length);
      continue;
    }
    if (arg === '--urls') {
      options.urls.push(...(argv[++i] ?? '').split(',').map((u) => u.trim()).filter(Boolean));
      continue;
    }
    if (arg === '--file') {
      options.file = argv[++i];
      continue;
    }
    if (arg === '--out') {
      options.out = path.resolve(process.cwd(), argv[++i] ?? options.out);
      continue;
    }
    if (arg === '--full-page') {
      options.fullPage = true;
      continue;
    }
    if (arg === '--viewport-only') {
      options.fullPage = false;
      continue;
    }
    if (arg === '--no-html') {
      options.saveHtml = false;
      continue;
    }
    if (arg === '--no-sections') {
      options.runSections = false;
      continue;
    }
    if (arg === '--styled-html') {
      options.styledHtml = true;
      continue;
    }
    if (arg === '--use-ai') {
      console.warn('  ⚠ --use-ai is obsolete: page capture always AI-enriches sections/');
      continue;
    }
    if (arg === '--wait-ms') {
      options.waitMs = Number(argv[++i]) || options.waitMs;
      continue;
    }
    if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[++i]) || options.timeoutMs;
      continue;
    }
    if (arg === '--devices') {
      options.devices = (argv[++i] ?? '')
        .split(',')
        .map((d) => normalizeDeviceKey(d.trim()))
        .filter(Boolean);
      continue;
    }
    if (arg === '--manifest') {
      options.manifest = true;
      continue;
    }
    if (arg === '--load') {
      const mode = argv[++i];
      options.loadUntil =
        mode === 'networkidle' || mode === 'commit' || mode === 'domcontentloaded'
          ? mode
          : 'domcontentloaded';
      continue;
    }
    if (arg.startsWith('http://') || arg.startsWith('https://')) {
      options.urls.push(arg.trim());
    }
  }

  return options;
}

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function deviceScreenshotsExist(pageDir, device) {
  return (
    (await pathExists(pageScreenshotPath(pageDir, `${device}.png`))) &&
    (await pathExists(pageScreenshotPath(pageDir, `${device}-clean.png`)))
  );
}

async function sectionsExist(pageDir) {
  if (!(await pathExists(path.join(pageDir, 'detected-sections.json')))) return false;
  try {
    const entries = await readdir(pageSectionsDir(pageDir), { withFileTypes: true });
    return entries.some((e) => e.isDirectory());
  } catch {
    return false;
  }
}

async function captureOverlayShot(page, pageDir, device, options) {
  const viewport = VIEWPORTS[device];
  const tDevice = Date.now();
  const light = options.lightPrepare === true;
  console.log(`  ▸ ${device} overlay: set viewport ${viewport.width}×${viewport.height}`);
  await page.setViewportSize(viewport);
  await ensureOverlayScrollbars(page);
  if (device === 'mobile') {
    await warnIfLayoutWidthShrunk(page, viewport, `${device}/overlay`);
  }

  const tPrepare = Date.now();
  await preparePageForScreenshot(page, {
    timeoutMs: light ? Math.min(options.timeoutMs, 15000) : options.timeoutMs,
    light,
    skipNetworkIdle: light,
    label: `${device}/overlay-prep`,
  });
  if (options.waitMs > 0) await page.waitForTimeout(options.waitMs);
  console.log(`  … ${device}: overlay prep ${((Date.now() - tPrepare) / 1000).toFixed(1)}s`);

  const overlayPath = pageScreenshotPath(pageDir, `${deviceFileSlug(device)}.png`);
  const tShot = Date.now();
  await page.screenshot({ path: overlayPath, fullPage: options.fullPage });
  console.log(
    `  ✓ ${device} (overlay): ${((Date.now() - tShot) / 1000).toFixed(1)}s → ${overlayPath}`,
  );
  console.log(`  ▸ ${device} overlay total ${((Date.now() - tDevice) / 1000).toFixed(1)}s`);
  return overlayPath;
}

async function captureCleanShot(page, pageDir, device, options) {
  const viewport = VIEWPORTS[device];
  const tDevice = Date.now();
  const light = options.lightPrepare !== false;
  console.log(`  ▸ ${device} clean: set viewport ${viewport.width}×${viewport.height}`);
  await page.setViewportSize(viewport);
  await ensureOverlayScrollbars(page);
  if (device === 'mobile') {
    await warnIfLayoutWidthShrunk(page, viewport, `${device}/clean`);
  }

  // Breakpoint changes can remount CMP — hide transient clutter again (keep Header/Nav).
  await page.evaluate(hideTransientOverlaysInPage);

  const tPrepare = Date.now();
  await preparePageForScreenshot(page, {
    timeoutMs: Math.min(options.timeoutMs, light ? 15000 : 45000),
    light,
    skipNetworkIdle: true,
    label: `${device}/clean-prep`,
  });
  // Re-hide in case scroll/lazy-load reintroduced CMP/chat.
  await page.evaluate(hideTransientOverlaysInPage);
  if (options.waitMs > 0) await page.waitForTimeout(options.waitMs);
  console.log(`  … ${device}: clean prep ${((Date.now() - tPrepare) / 1000).toFixed(1)}s`);

  const cleanPath = pageScreenshotPath(pageDir, `${deviceFileSlug(device)}-clean.png`);
  const tShot = Date.now();
  await page.screenshot({ path: cleanPath, fullPage: options.fullPage });
  console.log(
    `  ✓ ${device} (clean): ${((Date.now() - tShot) / 1000).toFixed(1)}s → ${cleanPath}`,
  );
  console.log(`  ▸ ${device} clean total ${((Date.now() - tDevice) / 1000).toFixed(1)}s`);
  return cleanPath;
}

async function captureUrl(browser, url, outDir, options) {
  const slug = slugFromUrl(url);
  const pageDir = path.join(outDir, slug);
  await mkdir(pageDir, { recursive: true });
  await mkdir(pageScreenshotsDir(pageDir), { recursive: true });
  await mkdir(pageSectionsDir(pageDir), { recursive: true });
  await writeFile(path.join(pageDir, 'source-url.txt'), url, 'utf8');

  const cultures =
    options.culturesResolved ??
    resolveCultures({
      argv: options.cultures != null ? ['--cultures', options.cultures] : [],
    });
  // Bootstrap from URL only; refined after page.html (+ design AI contentLanguage).
  let { pageLanguage, culture } = resolveCaptureSourceCulture({ url, cultures });
  /** @type {string | null} */
  let htmlLang = null;
  /** @type {string | null} */
  let aiLanguage = null;
  await writePageCaptureSourceCulture(pageDir, {
    url,
    pageLanguage,
    culture,
    overwriteSections: false,
  });

  const results = {
    url,
    slug,
    dir: pageDir,
    cultures,
    pageLanguage,
    culture,
    shots: {},
    shotsClean: {},
    html: {},
    sections: null,
    aiUsage: emptyAiUsage(),
  };

  // Prefer desktop first so hybrid detection has screenshots before other viewports finish.
  const deviceOrder = [
    ...options.devices.filter((d) => d === 'desktop'),
    ...options.devices.filter((d) => d !== 'desktop'),
  ];

  const context = await browser.newContext({
    viewport: VIEWPORTS.desktop,
    deviceScaleFactor: 1,
  });
  await installOverlayScrollbarsOnContext(context);
  const page = await context.newPage();
  // Keep navigation generous; cap action waits so hidden/missing elements can't burn 30s defaults.
  page.setDefaultNavigationTimeout(options.timeoutMs);
  page.setDefaultTimeout(10000);

  try {
    const tGoto = Date.now();
    console.log(`  ▸ navigate (${options.loadUntil})…`);
    await page.goto(url, { waitUntil: options.loadUntil, timeout: options.timeoutMs });
    console.log(`  … navigate ${((Date.now() - tGoto) / 1000).toFixed(1)}s`);

    await ensureOverlayScrollbars(page);

    const tInitial = Date.now();
    await preparePageForScreenshot(page, {
      timeoutMs: options.timeoutMs,
      imagesTimeoutMs: 2500,
      skipNetworkIdle: true,
      label: 'initial',
    });
    if (options.waitMs > 0) await page.waitForTimeout(options.waitMs);
    console.log(`  … initial prepare ${((Date.now() - tInitial) / 1000).toFixed(1)}s`);

    if (options.saveHtml) {
      const existingHtml = await resolveExistingPageHtml(pageDir);
      if (existingHtml && !shouldForce(options.force, 'html')) {
        results.html = { page: existingHtml, reused: true };
        console.log(`  ✓ page.html: reused → ${existingHtml}`);
      } else {
        const tHtml = Date.now();
        results.html = await savePageHtml(page, pageDir);
        console.log(`  ✓ page.html: ${((Date.now() - tHtml) / 1000).toFixed(1)}s → ${results.html.page}`);
      }

      const htmlPath =
        results.html?.page || (await resolveExistingPageHtml(pageDir));
      if (htmlPath) {
        try {
          htmlLang = parseHtmlLangAttribute(await readFile(htmlPath, 'utf8'));
          const resolved = resolveCaptureSourceCulture({
            url,
            htmlLang,
            cultures,
          });
          pageLanguage = resolved.pageLanguage;
          culture = resolved.culture;
          results.pageLanguage = pageLanguage;
          results.culture = culture;
          await writePageCaptureSourceCulture(pageDir, {
            url,
            pageLanguage,
            culture,
            overwriteSections: true,
          });
          if (htmlLang) {
            console.log(
              `  ✓ source culture from html lang="${htmlLang}" → ${culture}`,
            );
          }
        } catch (err) {
          console.warn(
            `  ⚠ html lang culture: ${err instanceof Error ? err.message : err}`,
          );
        }

        // Host-level logo for brandkit (`.bq/captures/{host}/Logo/`).
        try {
          const logoResult = await saveHostLogo({
            hostProjectRoot: outDir,
            siteUrl: url,
            pageDir,
            force: shouldForce(options.force, 'html'),
          });
          if (logoResult.ok && logoResult.skipped) {
            console.log(`  ✓ Logo/: reused URL → ${logoResult.logoUrl}`);
          } else if (logoResult.ok) {
            console.log(`  ✓ Logo/: saved URL → ${logoResult.logoUrl}`);
          } else if (logoResult.reason && logoResult.reason !== 'no-logo-url') {
            console.warn(`  ⚠ Logo/: ${logoResult.reason}`);
          }
        } catch (err) {
          console.warn(
            `  ⚠ Logo/: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    try {
      const tDesign = Date.now();
      results.design = await extractPageDesign(page, pageDir, {
        force: options.force,
        url,
      });
      let cssCount = 0;
      try {
        const detectedCss = JSON.parse(
          await readFile(path.join(pageDir, 'detected-css.json'), 'utf8'),
        );
        cssCount = (detectedCss.files || []).filter((f) => f.status === 'downloaded').length;
      } catch {
        /* optional */
      }
      const note = results.design?.meta?.aiReused
        ? 'reused'
        : results.design?.meta?.aiUsed
          ? 'generated'
          : 'skipped';
      console.log(
        `  ✓ ${AI_DERIVED_DESIGN_MD}: ${((Date.now() - tDesign) / 1000).toFixed(1)}s — ${cssCount} css file(s), ${note}`,
      );

      aiLanguage =
        results.design?.ai?.contentLanguage ||
        results.design?.meta?.contentLanguage ||
        null;
      if (aiLanguage) {
        const resolved = resolveCaptureSourceCulture({
          url,
          htmlLang,
          aiLanguage,
          cultures,
        });
        pageLanguage = resolved.pageLanguage;
        culture = resolved.culture;
        results.pageLanguage = pageLanguage;
        results.culture = culture;
        await writePageCaptureSourceCulture(pageDir, {
          url,
          pageLanguage,
          culture,
          overwriteSections: true,
        });
        console.log(
          `  ✓ source culture from design contentLanguage="${aiLanguage}" → ${culture}`,
        );
      }
    } catch (err) {
      console.warn(`  ⚠ ai design: ${err instanceof Error ? err.message : err}`);
    }

    // Phase A: overlay shots for every viewport (overlays still visible).
    // First device gets a normal light prepare; subsequent viewports always light.
    const tOverlayPhase = Date.now();
    console.log('  Phase A — overlay screenshots (all viewports)…');
    for (const device of deviceOrder) {
      try {
        if (
          !shouldForce(options.force, 'screenshots') &&
          (await deviceScreenshotsExist(pageDir, device))
        ) {
          results.shots[device] = pageScreenshotPath(pageDir, `${device}.png`);
          results.shotsClean[device] = pageScreenshotPath(pageDir, `${device}-clean.png`);
          console.log(`  ✓ ${device}: reused existing screenshots`);
          continue;
        }
        results.shots[device] = await captureOverlayShot(page, pageDir, device, {
          ...options,
          lightPrepare: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ ${device} overlay: ${message}`);
        results.shots[device] = null;
        results.error = message;
      }
    }
    console.log(`  ▸ overlay phase ${((Date.now() - tOverlayPhase) / 1000).toFixed(1)}s`);

    // Detect/measure overlays while still visible (avoids hybrid/export reloads).
    let overlaySections = [];
    /** @type {string|null} */
    let annotateShotPath = null;
    const reuseSections =
      options.runSections &&
      !shouldForce(options.force, 'sections') &&
      (await sectionsExist(pageDir));

    if (options.runSections && !reuseSections) {
      console.log('  Detecting overlays (while visible)…');
      const tOverlayDetect = Date.now();
      await page.setViewportSize(VIEWPORTS.desktop);
      overlaySections = await detectOverlaySectionsInPage(page, { skipReady: false });
      console.log(
        `  … ${overlaySections.length} overlay section(s) in ${((Date.now() - tOverlayDetect) / 1000).toFixed(1)}s`,
      );

      // Dedicated annotate shot: unlock CMP scroll-lock, keep banner visible, paint lazy content.
      // Only when CMP is present — unlock+scroll can blank SPAs that already painted (Cookiebot).
      const hasCmp = overlaySections.some(
        (s) =>
          /cookie|consent/i.test(s.cmsName || '') ||
          /cookie|consent/i.test(s.type || '') ||
          s.hints?.includes?.('cookie'),
      );
      if (hasCmp) {
        let scrollSnap = null;
        try {
          console.log('  Capturing desktop-annotate.png (unlock scroll, keep CMP)…');
          const tAnnotate = Date.now();
          scrollSnap = await unlockDocumentScrollForCapture(page);
          await preparePageForScreenshot(page, {
            timeoutMs: Math.min(options.timeoutMs, 20000),
            light: true,
            skipNetworkIdle: true,
            label: 'annotate-prep',
          });
          await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
          annotateShotPath = pageScreenshotPath(pageDir, 'desktop-annotate.png');
          await page.screenshot({ path: annotateShotPath, fullPage: options.fullPage !== false });
          console.log(
            `  ✓ desktop-annotate: ${((Date.now() - tAnnotate) / 1000).toFixed(1)}s → ${annotateShotPath}`,
          );

          // Discard if unlock blanked the page (Voetbal) — dirty overlay is richer.
          const dirtyPath = pageScreenshotPath(pageDir, 'desktop.png');
          const discardCheck = await shouldDiscardAnnotateShot(annotateShotPath, dirtyPath);
          if (discardCheck.discard) {
            console.log(`  … annotate shot discarded (${discardCheck.reason})`);
            try {
              await unlink(annotateShotPath);
            } catch {
              /* keep path null even if unlink fails */
            }
            annotateShotPath = null;
          }
        } catch (err) {
          console.warn(
            `  ⚠ desktop-annotate: ${err instanceof Error ? err.message : err}`,
          );
          annotateShotPath = null;
        } finally {
          await restoreDocumentScrollLock(page, scrollSnap).catch(() => {});
        }
      }
    }

    // Accept CMP so gated sites (AXA, etc.) load below-fold content before clean/hybrid.
    // Overlay CookieBanner was already measured above while the banner was visible.
    console.log('  Accepting cookie consent (if present)…');
    const tAccept = Date.now();
    const accepted = await acceptCookieConsent(page);
    if (accepted.clicked) {
      console.log(
        `  … consent accepted (${accepted.label || 'ok'}) in ${((Date.now() - tAccept) / 1000).toFixed(1)}s`,
      );
      await preparePageForScreenshot(page, {
        timeoutMs: Math.min(options.timeoutMs, 20000),
        light: true,
        skipNetworkIdle: true,
        label: 'post-consent',
      });
      // Nudge lazy sections to mount after consent
      await page
        .evaluate(async () => {
          const maxY = Math.max(
            0,
            (document.documentElement.scrollHeight || 0) - (window.innerHeight || 900),
          );
          window.scrollTo(0, Math.min(maxY, (window.innerHeight || 900) * 2));
          await new Promise((r) => setTimeout(r, 400));
          window.scrollTo(0, maxY);
          await new Promise((r) => setTimeout(r, 500));
          window.scrollTo(0, 0);
          await new Promise((r) => setTimeout(r, 300));
        })
        .catch(() => {});
    } else {
      console.log(`  … no consent click (${((Date.now() - tAccept) / 1000).toFixed(1)}s)`);
    }

    // Phase B: hide CMP/chat only (keep Header/TopBar/Nav for clean + hybrid).
    console.log('  Phase B — hide transient overlays (keep site chrome)…');
    const tHide = Date.now();
    await page.evaluate(hideTransientOverlaysInPage);
    console.log(`  … transient overlays hidden ${((Date.now() - tHide) / 1000).toFixed(1)}s`);

    const tCleanPhase = Date.now();
    console.log('  Phase C — clean screenshots (all viewports)…');
    for (const device of deviceOrder) {
      try {
        if (results.shotsClean[device]) {
          console.log(`  ✓ ${device} clean: already reused`);
          continue;
        }
        results.shotsClean[device] = await captureCleanShot(page, pageDir, device, {
          ...options,
          lightPrepare: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ ${device} clean: ${message}`);
        results.shotsClean[device] = null;
        results.error = message;
      }
    }
    console.log(`  ▸ clean phase ${((Date.now() - tCleanPhase) / 1000).toFixed(1)}s`);
    console.log(
      `  ▸ all viewport screenshots ${((Date.now() - tOverlayPhase) / 1000).toFixed(1)}s`,
    );

    // Hybrid + export on the same page session (no goto) — overlays already measured + hidden.
    if (reuseSections) {
      results.sections = { reused: true, indexPath: path.join(pageDir, 'detected-sections.json') };
      console.log('  ✓ sections: reused detected-sections.json + sections/');
    } else if (options.runSections && results.shotsClean.desktop) {
      console.log('  Hybrid section detection (same session, no reload)…');
      await page.setViewportSize(VIEWPORTS.desktop);
      const tHybrid = Date.now();
      const hybrid = await runHybridSectionDetector(page, url, {
        screenshotPath: results.shotsClean.desktop,
        annotateScreenshotPath: annotateShotPath,
        capturesDir: outDir,
        overlaySections,
        overlaysAlreadyHidden: true,
        skipReady: true,
      });
      console.log(`  … hybrid detect ${((Date.now() - tHybrid) / 1000).toFixed(1)}s`);
      if (hybrid.error) {
        console.warn(`  ⚠ hybrid: ${hybrid.error}`);
        results.sectionsError = hybrid.error;
      } else {
        const payload =
          hybrid.annotatePayload?.length > 0
            ? hybrid.annotatePayload
            : (hybrid.sections || []).map((s, i) => ({
                ...s,
                index: i + 1,
                label: String(i + 1),
                x0: s.x0 ?? s.cssLeft ?? 0,
                x1: s.x1 ?? s.cssRight ?? 1440,
                y0: s.y0 ?? s.cssTop ?? 0,
                y1: s.y1 ?? s.cssBottom ?? 0,
              }));

        console.log('  Exporting page-local sections (same session, no reload)…');
        const tExport = Date.now();
        const exported = await exportDetectedSections(page, {
          pageDir,
          url,
          sections: payload,
          devices: options.devices,
          imageMeta: hybrid.imageWidth
            ? { width: hybrid.imageWidth, height: hybrid.imageHeight }
            : null,
          overlaysAlreadyHidden: true,
          styledHtml: options.styledHtml === true,
          culture,
        });
        results.sections = {
          count: exported.sections.length,
          indexPath: exported.indexPath,
          detectedSectionsPng: hybrid.detectedSectionsPngPath || hybrid.annotatedPath,
        };
        console.log(
          `  ✓ ${exported.sections.length} section folder(s) in ${((Date.now() - tExport) / 1000).toFixed(1)}s`,
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ ${message}`);
    results.error = message;
  } finally {
    await context.close();
  }

  if (options.runSections && (await sectionsExist(pageDir))) {
    try {
      results.aiSections = await buildAiDecidePageSections({
        pageDir,
        url,
        force: options.force,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  ⚠ AI sections: ${message}`);
      results.aiSectionsError = message;
    }
  }

  const designUsage = usageFromDesignResult(results.design);
  const useAiUsage = usageFromUseAiResult(results.aiSections);
  results.aiUsage = addAiUsage(emptyAiUsage(), designUsage);
  addAiUsage(results.aiUsage, useAiUsage);
  console.log(
    `  ✓ ${formatAiUsageLine('AI page total', results.aiUsage)} (design + sections enrich)`,
  );

  return results;
}

function resolveProjectRoot(out, urls) {
  if (!isGenericDesignScreenshotsDir(out) || urls.length === 0) {
    return out;
  }
  const hosts = [...new Set(urls.map(hostSlugFromUrl))];
  const projectRoot = path.join(out, hosts[0]);
  if (hosts.length > 1) {
    console.warn(
      `Warning: URLs span multiple hosts (${hosts.join(', ')}). Using project folder: ${hosts[0]}`,
    );
  }
  console.log(`Project folder: ${projectRoot} (derived from host)`);
  return projectRoot;
}

async function main() {
  loadLocalEnvFiles();
  const options = parseArgs(process.argv.slice(2));

  if (options.file) {
    options.urls.push(...(await readUrlsFromFile(options.file)));
  }

  options.urls = [...new Set(options.urls.map((u) => u.trim()).filter(Boolean))];

  if (options.urls.length === 0) {
    printHelp();
    process.exit(1);
  }

  options.out = resolveProjectRoot(options.out, options.urls);
  options.culturesResolved = resolveCultures({
    argv:
      options.cultures != null && String(options.cultures).trim()
        ? ['--cultures', String(options.cultures)]
        : [],
  });

  const validatedUrls = options.urls.map(validateUrl);
  await mkdir(options.out, { recursive: true });

  const { chromium } = resolvePlaywright();
  const browser = await chromium.launch({
    headless: process.env.CAPTURE_HEADLESS === '1',
    channel: process.env.CAPTURE_CHANNEL || 'chrome',
    args: ['--disable-http2', '--autoplay-policy=no-user-gesture-required'],
  });
  const manifest = [];
  const runAiUsage = emptyAiUsage();
  /** @type {unknown} */
  let fatal = null;
  let aiFlushed = false;

  const flushAi = (failed, error) => {
    if (aiFlushed) return;
    aiFlushed = true;
    return flushCaptureAiUsageSummary({
      usage: runAiUsage,
      pages: manifest.length,
      failed: Boolean(failed),
      error,
    });
  };

  console.log(`Output: ${options.out}`);
  console.log(`Devices: ${options.devices.join(', ')}`);
  console.log(`HTML: ${options.saveHtml ? 'yes' : 'no'}`);
  console.log(`Sections: ${options.runSections ? 'hybrid+export+AI enrich' : 'skipped'}`);
  console.log(
    `Styled HTML: section.html always styled; legacy siblings: ${options.styledHtml ? 'yes (--styled-html)' : 'no'}`,
  );
  console.log(
    `Cultures: ${options.culturesResolved.length ? options.culturesResolved.join(', ') : '(none — set BQ_CULTURES or --cultures)'}`,
  );
  console.log(`URLs: ${validatedUrls.length}\n`);

  try {
    try {
      for (const url of validatedUrls) {
        const tUrl = Date.now();
        console.log(`Capturing ${url}`);
        const pageResult = await captureUrl(browser, url, options.out, options);
        manifest.push(pageResult);
        addAiUsage(runAiUsage, pageResult.aiUsage);
        console.log(`URL total: ${((Date.now() - tUrl) / 1000).toFixed(1)}s\n`);
      }
    } finally {
      await browser.close();
    }

    if (options.manifest) {
      const manifestPath = path.join(options.out, 'manifest.json');
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      console.log(`Manifest: ${manifestPath}`);
    }

    const aiRunLine = flushAi(false);

    const logPath = path.join(options.out, 'capture.log');
    const logLines = [
      `# capture:webpage`,
      `# finished: ${new Date().toISOString()}`,
      `# out: ${options.out}`,
      `# devices: ${options.devices.join(', ')}`,
      `# sections: ${options.runSections ? 'on' : 'off'}`,
      `# urls: ${validatedUrls.length}`,
      `# ai: in=${runAiUsage.promptTokens} out=${runAiUsage.completionTokens} total=${runAiUsage.totalTokens} costUsd=${runAiUsage.costUsd > 0 ? Math.round(runAiUsage.costUsd * 1e6) / 1e6 : 'n/a'}`,
      ``,
      ...manifest.map((m) => {
        const status = m.error ? `ERROR ${m.error}` : 'ok';
        const sec = m.sections?.count != null ? `, ${m.sections.count} sections` : '';
        const ai = m.aiUsage
          ? `, ai total=${m.aiUsage.totalTokens} ${formatAiCost(m.aiUsage.costUsd)}`
          : '';
        return `- ${m.url} → ${m.dir} (${status}${sec}${ai})`;
      }),
      ``,
      aiRunLine,
      ``,
    ];
    await writeFile(logPath, `${logLines.join('\n')}\n`, 'utf8');
    console.log(`Detail log: ${logPath}`);

    if (manifest.some((m) => m.error)) {
      process.exitCode = 1;
    }

    console.log('Done.');
  } catch (error) {
    fatal = error;
    const aiRunLine = flushAi(true, error);
    try {
      const logPath = path.join(options.out, 'capture.log');
      const logLines = [
        `# capture:webpage`,
        `# finished: ${new Date().toISOString()}`,
        `# out: ${options.out}`,
        `# FAILED: ${String(error instanceof Error ? error.message : error).split('\n')[0]}`,
        `# devices: ${options.devices.join(', ')}`,
        `# sections: ${options.runSections ? 'on' : 'off'}`,
        `# urls: ${validatedUrls.length}`,
        `# ai: in=${runAiUsage.promptTokens} out=${runAiUsage.completionTokens} total=${runAiUsage.totalTokens} costUsd=${runAiUsage.costUsd > 0 ? Math.round(runAiUsage.costUsd * 1e6) / 1e6 : 'n/a'}`,
        ``,
        ...manifest.map((m) => {
          const status = m.error ? `ERROR ${m.error}` : 'ok';
          const sec = m.sections?.count != null ? `, ${m.sections.count} sections` : '';
          const ai = m.aiUsage
            ? `, ai total=${m.aiUsage.totalTokens} ${formatAiCost(m.aiUsage.costUsd)}`
            : '';
          return `- ${m.url} → ${m.dir} (${status}${sec}${ai})`;
        }),
        ``,
        aiRunLine || '',
        ``,
      ];
      await writeFile(logPath, `${logLines.join('\n')}\n`, 'utf8');
      console.error(`Detail log: ${logPath}`);
    } catch {
      /* best-effort capture.log on failure */
    }
    throw error;
  } finally {
    flushAi(Boolean(fatal), fatal);
  }
}

function isCliEntry() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
