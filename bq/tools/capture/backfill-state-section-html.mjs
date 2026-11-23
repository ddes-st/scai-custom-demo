/**
 * One-shot: for existing capture state folders, ensure original-section.html +
 * styled section.html (same contract as a normal section).
 *
 * With --screenshots: also re-shot parent + state PNGs for all Sitecore AI
 * fixed widths (mobile/tablet/desktop/desktopRegular/desktopLarge) from section.html.
 *
 *   node tools/capture/backfill-state-section-html.mjs --url https://www.sitecore.com/ --section section-10 --screenshots
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolvePlaywright } from './lib/playwright-resolve.mjs';
import { acceptCookieConsent } from './lib/cookie-banner.mjs';
import {
  VIEWPORTS,
  resolveScreenshotDevices,
  deviceFileSlug,
} from './lib/viewports.mjs';
import {
  backfillStateSectionHtml,
  ensureStateOpenOnPage,
} from './lib/interactive-states.mjs';
import { screenshotSectionHtmlDevices } from './lib/screenshot-section-html.mjs';
import { SECTION_HTML } from './lib/section-html-files.mjs';
import { resolveCapturePageDir } from '../create-section-components/resolve-capture.mjs';

function parseArgs(argv) {
  let url = null;
  let section = 'section-10';
  let screenshots = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') url = argv[++i];
    else if (argv[i]?.startsWith('--url=')) url = argv[i].slice(6);
    else if (argv[i] === '--section') section = argv[++i];
    else if (argv[i]?.startsWith('--section=')) section = argv[i].slice(10);
    else if (argv[i] === '--screenshots') screenshots = true;
    else if (!url && /^https?:\/\//i.test(argv[i])) url = argv[i];
  }
  return { url, section, screenshots };
}

/** True when open-state HTML mentions the state label as selected/expanded. */
async function verifyOpenStateHtml(htmlPath, label) {
  if (!label) return true;
  try {
    const html = await readFile(htmlPath, 'utf8');
    const esc = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Selected tab or expanded accordion near the label
    const selectedNear = new RegExp(
      `aria-selected="true"[^>]{0,200}${esc}|${esc}[^>]{0,120}aria-selected="true"`,
      'i',
    );
    const expandedNear = new RegExp(
      `aria-expanded="true"[^>]{0,200}${esc}|${esc}[^>]{0,120}aria-expanded="true"`,
      'i',
    );
    const activeClass = new RegExp(
      `(NavButtonActive|SlideActive|AccordionItemActive)[\\s\\S]{0,400}${esc}|${esc}[\\s\\S]{0,400}(NavButtonActive|SlideActive|AccordionItemActive)`,
      'i',
    );
    return selectedNear.test(html) || expandedNear.test(html) || activeClass.test(html);
  } catch {
    return false;
  }
}

async function main() {
  const { url, section, screenshots } = parseArgs(process.argv.slice(2));
  if (!url) {
    console.error(
      'Usage: node tools/capture/backfill-state-section-html.mjs --url <https://…> [--section section-10] [--screenshots]',
    );
    process.exit(1);
  }

  const { pageDir } = await resolveCapturePageDir(url);
  const sectionDir = path.join(pageDir, 'sections', section);
  const infoPath = path.join(sectionDir, 'section-information.json');
  const info = JSON.parse(await readFile(infoPath, 'utf8'));
  const sectionSelector = info.selector;
  if (!sectionSelector) {
    console.error(`No selector in ${infoPath}`);
    process.exit(1);
  }

  const statesRoot = path.join(sectionDir, 'states');
  const slugs = (await readdir(statesRoot, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  console.log(`Page dir: ${pageDir}`);
  console.log(`Section: ${section} (${sectionSelector})`);
  console.log(`States: ${slugs.length}`);
  console.log(`Screenshots: ${screenshots ? 'yes' : 'no'}`);

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
  await page.waitForTimeout(1500);
  try {
    await page.locator(sectionSelector).first().scrollIntoViewIfNeeded({ timeout: 10000 });
  } catch {
    /* continue */
  }
  await page.waitForTimeout(400);

  for (const slug of slugs) {
    console.log(`  ${slug}…`);
    try {
      await page
        .locator(sectionSelector)
        .first()
        .scrollIntoViewIfNeeded({ timeout: 8000 })
        .catch(() => {});
      const result = await backfillStateSectionHtml(page, {
        pageDir,
        sectionDir,
        sectionSelector,
        stateSlug: slug,
        device: 'desktop',
      });
      const styledPath = path.join(statesRoot, slug, SECTION_HTML);
      let bytes = 0;
      try {
        bytes = Buffer.byteLength(await readFile(styledPath, 'utf8'), 'utf8');
      } catch {
        /* */
      }
      const errN = result.styledErrors?.length || 0;
      const openOk = await verifyOpenStateHtml(styledPath, result.state?.label);
      console.log(
        `    → section.html ${bytes} B` +
          (errN ? ` (styled warnings=${errN})` : '') +
          (openOk ? ' open-ok' : ' ! open-state MISMATCH'),
      );

      if (screenshots) {
        const stateForShot = result.state || {};
        const htmlShot = await screenshotSectionHtmlDevices(page, {
          htmlPath: styledPath,
          sectionDir: path.join(statesRoot, slug),
          folderName: `${section}-${slug}`,
          pageDir,
          devices: resolveScreenshotDevices(),
          baseURL: url,
          preferredOpenLabel: stateForShot.label || '',
          liveSectionSelector: sectionSelector,
          ensureLiveOpen: async (_p, device) => {
            await ensureStateOpenOnPage(page, {
              sectionSelector,
              state: stateForShot,
              device,
            });
          },
        });
        const stateJsonPath = path.join(statesRoot, slug, 'state.json');
        const st = JSON.parse(await readFile(stateJsonPath, 'utf8'));
        st.outputs = { ...(st.outputs || {}) };
        for (const device of resolveScreenshotDevices()) {
          if (htmlShot.outputs[device]) {
            st.outputs[device] = htmlShot.outputs[device];
          }
        }
        await writeFile(stateJsonPath, `${JSON.stringify(st, null, 2)}\n`, 'utf8');
        const okN = Object.values(htmlShot.outputs).filter(Boolean).length;
        const methods = resolveScreenshotDevices().map(
          (d) => htmlShot.outputs[d]?.method || '—',
        ).join('/');
        console.log(
          `    → PNGs ${okN}/${resolveScreenshotDevices().length} [${methods}]` +
            (htmlShot.errors?.length ? ` (${htmlShot.errors.join('; ')})` : ''),
        );
      }
    } catch (err) {
      console.error(
        `    ! failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (screenshots) {
    const parentHtml = path.join(sectionDir, SECTION_HTML);
    console.log(`  parent ${section} resting PNGs from section.html…`);
    const parentShot = await screenshotSectionHtmlDevices(page, {
      htmlPath: parentHtml,
      sectionDir,
      folderName: section,
      pageDir,
      devices: resolveScreenshotDevices(),
      baseURL: url,
    });
    if (info.outputs && typeof info.outputs === 'object') {
      for (const device of resolveScreenshotDevices()) {
        if (parentShot.outputs[device]) {
          info.outputs[device] = parentShot.outputs[device];
        }
      }
    }
    const okN = Object.values(parentShot.outputs).filter(Boolean).length;
    console.log(
      `    → parent PNGs ${okN}/${resolveScreenshotDevices().length}` +
        (parentShot.errors?.length ? ` (${parentShot.errors.join('; ')})` : ''),
    );
  }

  // Refresh interactionStates paths in section-information.json if present
  if (Array.isArray(info.interactionStates)) {
    for (const st of info.interactionStates) {
      if (!st?.slug) continue;
      const rel = `sections/${section}/states/${st.slug}/section.html`;
      st.sectionHtml = rel;
      if (st.panel) st.panel.htmlPath = rel;
      if (screenshots && st.outputs) {
        for (const device of resolveScreenshotDevices()) {
          const p = `sections/${section}/states/${st.slug}/${section}-${st.slug}-${deviceFileSlug(device)}.png`;
          st.outputs[device] = { ...(st.outputs[device] || {}), path: p, method: 'section-html' };
        }
      }
    }
  }
  await writeFile(infoPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
  console.log('Updated section-information.json');

  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
