/**
 * Per-page capture folder layout under `.bq/captures/{domain}/{page}/`.
 *
 * ```
 * {page}/
 *   source-url.txt
 *   ai-derived-design.md          — Azure Foundry design guide (Stitch-style)
 *   ai-meta.json                  — AI usage + design sourceHash (purpose ai-derived-design)
 *   detected-fonts.json
 *   detected-css.json
 *   detected-sections.json
 *   detected-sections.png
 *   fonts/         — downloaded font binaries
 *   screenshots/   — full-page PNGs (+ hybrid-summary.json)
 *   sections/      — page-local crops/HTML + AI-enriched section-information.json
 *   html/          — page.html
 *   css/           — extracted stylesheets (+ page-inline.css)
 * ```
 */
import path from 'node:path';

export function pageScreenshotsDir(pageDir) {
  return path.join(pageDir, 'screenshots');
}

export function pageSectionsDir(pageDir) {
  return path.join(pageDir, 'sections');
}

export function pageHtmlDir(pageDir) {
  return path.join(pageDir, 'html');
}

export function pageFontsDir(pageDir) {
  return path.join(pageDir, 'fonts');
}

export function pageHtmlPath(pageDir) {
  return path.join(pageHtmlDir(pageDir), 'page.html');
}

export function pageScreenshotPath(pageDir, fileName) {
  return path.join(pageScreenshotsDir(pageDir), fileName);
}

export function pageSectionPath(pageDir, fileName) {
  return path.join(pageSectionsDir(pageDir), fileName);
}

/** Resolve page.html for readers (new layout, then legacy root). */
export async function resolveExistingPageHtml(pageDir) {
  const { access } = await import('node:fs/promises');
  const candidates = [
    pageHtmlPath(pageDir),
    path.join(pageDir, 'page.html'),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}
