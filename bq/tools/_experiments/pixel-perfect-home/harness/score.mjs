/**
 * Score a preview HTML (or file:// / http URL) against capture reference PNGs.
 *
 * Usage:
 *   node harness/score.mjs --preview <path.html> --ref <path.png> --out <dir> [--viewport desktop]
 *   node harness/score.mjs --method-dir <.bq/experiments/.../methods/M01/section-04>
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { comparePngs } from './compare.mjs';
import { VIEWPORT_KEYS, CAPTURE_REF_FALLBACK } from './viewports.mjs';
import { capturePageDir } from '../lib/paths.mjs';
import { startStaticServer, toServerUrl } from './static-server.mjs';

const OVERLAY_SCROLLBAR_CSS = `
html { scrollbar-gutter: auto !important; }
html, body { scrollbar-width: none !important; margin: 0; padding: 0; }
* { scrollbar-width: none !important; }
::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
`;

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve reference PNG for a section or full page.
 * @param {{ kind: 'section'|'page', sectionFolder?: string, viewport: string }} opts
 */
export function resolveReferencePath(opts) {
  const { kind, sectionFolder, viewport } = opts;
  if (kind === 'page') {
    return path.join(capturePageDir, 'screenshots', `${viewport}-clean.png`);
  }
  const folder = path.join(capturePageDir, 'sections', sectionFolder);
  return path.join(folder, `${sectionFolder}-${viewport}.png`);
}

/**
 * @param {string} previewHtmlPath
 * @param {string} referencePngPath
 * @param {string} outDir
 * @param {{ viewport?: string, fullPage?: boolean, maxHeight?: number, baseUrl?: string, browser?: import('playwright').Browser }} [opts]
 */
export async function scorePreviewAgainstRef(previewHtmlPath, referencePngPath, outDir, opts = {}) {
  await mkdir(outDir, { recursive: true });

  if (!(await exists(previewHtmlPath))) {
    throw new Error(`Preview missing: ${previewHtmlPath}`);
  }
  if (!(await exists(referencePngPath))) {
    return {
      skipped: true,
      reason: `reference missing: ${referencePngPath}`,
      viewport: opts.viewport || 'unknown',
    };
  }

  const refMeta = await sharp(referencePngPath).metadata();
  const width =
    refMeta.width ||
    CAPTURE_REF_FALLBACK[opts.viewport || 'desktop']?.width ||
    1440;
  const height = opts.fullPage
    ? Math.min(refMeta.height || 900, opts.maxHeight || 14000)
    : Math.max(refMeta.height || 900, 900);

  let ownedServer = null;
  let ownedBrowser = null;
  const baseUrl =
    opts.baseUrl ||
    ((ownedServer = await startStaticServer()), ownedServer.baseUrl);
  const browser = opts.browser || ((ownedBrowser = await chromium.launch({ headless: true })), ownedBrowser);

  try {
    const context = await browser.newContext({
      viewport: { width, height: Math.min(height, 4000) },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.addInitScript(`(() => {
      const style = document.createElement('style');
      style.id = 'bq-exp-overlay-scrollbars';
      style.textContent = ${JSON.stringify(OVERLAY_SCROLLBAR_CSS)};
      document.documentElement.appendChild(style);
    })()`);

    const finalUrl = toServerUrl(baseUrl, path.resolve(previewHtmlPath));
    if (!finalUrl) throw new Error(`Preview not under capture/exp roots: ${previewHtmlPath}`);

    await page.goto(finalUrl, { waitUntil: 'networkidle', timeout: 90000 }).catch(async () => {
      await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    });
    await page.waitForTimeout(500);
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });

    const shotPath = path.join(outDir, `candidate-${opts.viewport || 'vp'}.png`);
    if (opts.fullPage) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: shotPath, fullPage: true, type: 'png' });
    } else {
      const bodyBox = await page.evaluate(() => {
        const r = document.body.getBoundingClientRect();
        return {
          width: Math.ceil(Math.max(document.documentElement.scrollWidth, r.width)),
          height: Math.ceil(Math.max(document.documentElement.scrollHeight, r.height)),
        };
      });
      await page.setViewportSize({
        width,
        height: Math.min(Math.max(bodyBox.height, refMeta.height || 400), 4000),
      });
      await page.screenshot({
        path: shotPath,
        clip: {
          x: 0,
          y: 0,
          width,
          height: Math.min(refMeta.height || bodyBox.height, 8000),
        },
        type: 'png',
      });
    }

    const diffPath = path.join(outDir, `diff-${opts.viewport || 'vp'}.png`);
    const metrics = await comparePngs(shotPath, referencePngPath, {
      outDiffPath: diffPath,
      threshold: 0.1,
      maxHeight: opts.fullPage ? 8000 : 12000,
    });

    const result = {
      skipped: false,
      viewport: opts.viewport || 'unknown',
      previewHtmlPath,
      previewUrl: finalUrl,
      referencePngPath,
      candidatePngPath: shotPath,
      diffPngPath: diffPath,
      ...metrics,
    };
    await writeFile(path.join(outDir, `score-${opts.viewport || 'vp'}.json`), JSON.stringify(result, null, 2));
    await context.close();
    return result;
  } finally {
    if (ownedBrowser) await ownedBrowser.close();
    if (ownedServer) await ownedServer.close();
  }
}

/**
 * Score all available viewports for a method section or page folder that contains preview-*.html
 * @param {string} methodTargetDir  e.g. .../M01/section-04 or .../M01/full-page
 */
export async function scoreMethodTarget(methodTargetDir, opts = {}) {
  const kind = opts.kind || (path.basename(methodTargetDir) === 'full-page' ? 'page' : 'section');
  const sectionFolder = kind === 'section' ? path.basename(methodTargetDir) : undefined;
  const results = [];

  const server = opts.baseUrl ? null : await startStaticServer();
  const baseUrl = opts.baseUrl || server.baseUrl;
  const browser = opts.browser || (await chromium.launch({ headless: true }));
  const ownedBrowser = !opts.browser;

  try {
    for (const vp of VIEWPORT_KEYS) {
      let preview = null;
      if (await exists(path.join(methodTargetDir, `preview-${vp}.html`))) {
        preview = path.join(methodTargetDir, `preview-${vp}.html`);
      } else if (await exists(path.join(methodTargetDir, 'preview.html'))) {
        preview = path.join(methodTargetDir, 'preview.html');
      }
      if (!preview) {
        results.push({ skipped: true, viewport: vp, reason: 'no preview.html' });
        continue;
      }
      const ref = resolveReferencePath({ kind, sectionFolder, viewport: vp });
      const outDir = path.join(methodTargetDir, 'scores', vp);
      try {
        const r = await scorePreviewAgainstRef(preview, ref, outDir, {
          viewport: vp,
          fullPage: kind === 'page',
          maxHeight: opts.maxHeight,
          baseUrl,
          browser,
        });
        results.push(r);
      } catch (err) {
        results.push({
          skipped: true,
          viewport: vp,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    if (ownedBrowser) await browser.close();
    if (server) await server.close();
  }

  const summary = {
    target: methodTargetDir,
    kind,
    sectionFolder: sectionFolder || null,
    results,
    avgMismatchPercent: averageMismatch(results),
  };
  await writeFile(path.join(methodTargetDir, 'score.json'), JSON.stringify(summary, null, 2));
  return summary;
}

function averageMismatch(results) {
  const scored = results.filter((r) => !r.skipped && typeof r.mismatchPercent === 'number');
  if (!scored.length) return null;
  return Math.round((scored.reduce((a, r) => a + r.mismatchPercent, 0) / scored.length) * 100) / 100;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--method-dir') out.methodDir = argv[++i];
    else if (a === '--preview') out.preview = argv[++i];
    else if (a === '--ref') out.ref = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--viewport') out.viewport = argv[++i];
    else if (a === '--full-page') out.fullPage = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.methodDir) {
    const summary = await scoreMethodTarget(args.methodDir, {
      kind: args.fullPage ? 'page' : undefined,
    });
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (!args.preview || !args.ref || !args.out) {
    console.error('Usage: node harness/score.mjs --method-dir <dir> | --preview <html> --ref <png> --out <dir>');
    process.exit(1);
  }
  const r = await scorePreviewAgainstRef(args.preview, args.ref, args.out, {
    viewport: args.viewport || 'desktop',
    fullPage: !!args.fullPage,
  });
  console.log(JSON.stringify(r, null, 2));
}

const isDirect = process.argv[1] && path.normalize(process.argv[1]).endsWith(`${path.sep}score.mjs`);
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
