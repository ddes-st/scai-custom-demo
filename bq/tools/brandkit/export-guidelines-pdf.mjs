/**
 * Render brandkit draft.json → guidelines.pdf via Playwright.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolvePlaywright } from '../capture/lib/playwright-resolve.mjs';
import { brandkitDir } from './state.mjs';

/**
 * @param {object} draft
 */
export function draftToGuidelinesHtml(draft) {
  const title = String(draft?.brandName || draft?.companyName || 'Brand kit').trim();
  const desc = String(draft?.description || '').trim();
  const sections = draft?.sections && typeof draft.sections === 'object' ? draft.sections : {};

  const escape = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const blocks = [];
  blocks.push(`<h1>${escape(title)} — Brand guidelines</h1>`);
  if (desc) blocks.push(`<p class="lead">${escape(desc)}</p>`);
  if (draft?.industry) {
    blocks.push(`<p><strong>Industry:</strong> ${escape(draft.industry)}</p>`);
  }

  for (const [secName, fields] of Object.entries(sections)) {
    blocks.push(`<h2>${escape(secName)}</h2>`);
    if (!fields || typeof fields !== 'object') continue;
    for (const [fieldName, value] of Object.entries(fields)) {
      blocks.push(`<h3>${escape(fieldName)}</h3>`);
      const paras = String(value || '')
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);
      for (const p of paras) blocks.push(`<p>${escape(p)}</p>`);
    }
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>${escape(title)} Brand guidelines</title>
<style>
  body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.45; color: #111; margin: 48px; }
  h1 { font-size: 22pt; margin: 0 0 12px; }
  h2 { font-size: 16pt; margin: 28px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 12pt; margin: 16px 0 6px; }
  p { margin: 0 0 10px; white-space: pre-wrap; }
  .lead { font-size: 11pt; color: #333; }
</style></head><body>
${blocks.join('\n')}
</body></html>`;
}

/**
 * @param {{
 *   hostProjectRoot: string,
 *   draft: object,
 *   dryRun?: boolean,
 * }} opts
 */
export async function exportBrandkitGuidelinesPdf(opts) {
  const dir = brandkitDir(opts.hostProjectRoot);
  await mkdir(dir, { recursive: true });
  const htmlPath = path.join(dir, 'guidelines.html');
  const pdfPath = path.join(dir, 'guidelines.pdf');
  const html = draftToGuidelinesHtml(opts.draft);
  await writeFile(htmlPath, html, 'utf8');

  if (opts.dryRun) {
    console.log(`  [dry-run] would write ${pdfPath}`);
    return { ok: true, dryRun: true, htmlPath, pdfPath };
  }

  const { chromium } = await resolvePlaywright();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '16mm', right: '16mm' },
    });
  } finally {
    await browser.close();
  }

  return { ok: true, htmlPath, pdfPath };
}
