import { mkdir, writeFile } from 'node:fs/promises';
import { pageHtmlDir, pageHtmlPath } from './page-layout.mjs';

/**
 * Saves rendered HTML after client-side JS (Playwright page).
 * - html/page.html — full document
 */
export async function savePageHtml(page, pageDir) {
  const pageHtml = await page.content();
  await mkdir(pageHtmlDir(pageDir), { recursive: true });
  const pagePath = pageHtmlPath(pageDir);
  await writeFile(pagePath, pageHtml, 'utf8');
  return { page: pagePath };
}
