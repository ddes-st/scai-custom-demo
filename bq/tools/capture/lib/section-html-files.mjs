/**
 * Resolve/read section HTML with the new capture contract:
 * - original-section.html — raw outerHTML (structure / hash identity)
 * - section.html — styled self-contained snapshot (offline preview + AI codegen evidence)
 * - section.authored.css — scoped authored CSS only (debug / tooling; no computed overlay)
 */
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const ORIGINAL_SECTION_HTML = 'original-section.html';
export const SECTION_HTML = 'section.html';
export const SECTION_AUTHORED_CSS = 'section.authored.css';

/** Marker inserted before [data-bq-id] computed overlay in section.html <style>. */
export const BQ_COMPUTED_OVERLAY_MARKER = '/* === BQ_COMPUTED_OVERLAY === */';

/**
 * Prefer original-section.html for structural identity; fall back to section.html
 * for captures written before the rename.
 * @param {string} sectionDir
 * @returns {Promise<{ html: string, fileName: string, absPath: string }|null>}
 */
export async function readOriginalSectionHtml(sectionDir) {
  for (const fileName of [ORIGINAL_SECTION_HTML, SECTION_HTML]) {
    const absPath = path.join(sectionDir, fileName);
    try {
      const html = await readFile(absPath, 'utf8');
      if (html != null) return { html, fileName, absPath };
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Sync variant for older sync call sites.
 * @param {string} sectionDir
 * @returns {{ html: string, fileName: string, absPath: string }|null}
 */
export function readOriginalSectionHtmlSync(sectionDir) {
  for (const fileName of [ORIGINAL_SECTION_HTML, SECTION_HTML]) {
    const absPath = path.join(sectionDir, fileName);
    if (!existsSync(absPath)) continue;
    try {
      const html = readFileSync(absPath, 'utf8');
      return { html, fileName, absPath };
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Prefer styled section.html; fall back to original for incomplete captures.
 * @param {string} sectionDir
 * @returns {Promise<{ html: string, fileName: string, absPath: string }|null>}
 */
export async function readStyledSectionHtml(sectionDir) {
  for (const fileName of [SECTION_HTML, ORIGINAL_SECTION_HTML]) {
    const absPath = path.join(sectionDir, fileName);
    try {
      const html = await readFile(absPath, 'utf8');
      if (html != null) return { html, fileName, absPath };
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Strip computed [data-bq-id] overlay from a section.html style blob / full doc.
 * Prefers BQ_COMPUTED_OVERLAY_MARKER; falls back to first [data-bq-id= rule.
 * @param {string} cssOrHtml
 * @returns {string}
 */
export function extractAuthoredCssFromSectionHtml(cssOrHtml) {
  const raw = String(cssOrHtml || '');
  if (!raw.trim()) return '';

  // Prefer <style> body when given a full mini-document
  let css = raw;
  const styleMatch = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch) css = styleMatch[1];

  const markerIdx = css.indexOf(BQ_COMPUTED_OVERLAY_MARKER);
  if (markerIdx >= 0) return css.slice(0, markerIdx).trim();

  const bqIdx = css.search(/\[data-bq-id\s*=/);
  if (bqIdx >= 0) return css.slice(0, bqIdx).trim();

  return css.trim();
}

/**
 * Load scoped authored CSS (section.authored.css, else extract from section.html).
 * Kept for tooling/debug; AI packing uses full section.html instead.
 * @param {string} sectionDir
 * @returns {Promise<{ css: string, source: string }>}
 */
export async function readSectionAuthoredCss(sectionDir) {
  const authoredAbs = path.join(sectionDir, SECTION_AUTHORED_CSS);
  try {
    const css = await readFile(authoredAbs, 'utf8');
    if (css.trim()) return { css: css.trim(), source: SECTION_AUTHORED_CSS };
  } catch {
    /* fall through */
  }
  const styled = await readStyledSectionHtml(sectionDir);
  if (!styled?.html) return { css: '', source: '(missing)' };
  const css = extractAuthoredCssFromSectionHtml(styled.html);
  return { css, source: `${styled.fileName}#authored` };
}
