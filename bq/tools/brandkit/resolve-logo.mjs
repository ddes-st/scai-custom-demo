/**
 * Resolve a public logo URL for Brand Management (prefer capture Logo/logo-meta.json).
 */
import { readFile } from 'node:fs/promises';
import { extractLogoUrlFromHtml } from '../capture/lib/logo-from-html.mjs';
import { resolveExistingPageHtml } from '../capture/lib/page-layout.mjs';
import {
  readExistingHostLogo,
  saveHostLogo,
} from '../capture/lib/save-host-logo.mjs';

export {
  absolutizeUrl,
  extractLogoUrlFromHtml,
  isLikelyRasterLogoUrl,
} from '../capture/lib/logo-from-html.mjs';

/**
 * @param {{
 *   pageDir: string,
 *   siteUrl: string,
 *   hostProjectRoot?: string,
 *   downloadCopy?: boolean,
 * }} opts
 * When `downloadCopy` is true and Logo/meta is missing, write logo-meta.json from HTML.
 * @returns {Promise<{ logoUrl: string|null, fromCaptureLogo?: boolean }>}
 */
export async function resolveBrandkitLogo(opts) {
  const hostProjectRoot = String(opts.hostProjectRoot || '').trim();
  const siteUrl = String(opts.siteUrl || '').trim();

  if (hostProjectRoot) {
    const existing = await readExistingHostLogo(hostProjectRoot);
    if (existing?.logoUrl) {
      return { logoUrl: existing.logoUrl, fromCaptureLogo: true };
    }
  }

  const htmlPath = await resolveExistingPageHtml(opts.pageDir);
  if (!htmlPath) return { logoUrl: null };
  let html;
  try {
    html = await readFile(htmlPath, 'utf8');
  } catch {
    return { logoUrl: null };
  }

  const logoUrl = extractLogoUrlFromHtml(html, siteUrl);
  if (!logoUrl) return { logoUrl: null };

  if (opts.downloadCopy && hostProjectRoot) {
    await saveHostLogo({
      hostProjectRoot,
      siteUrl,
      pageHtml: html,
      pageDir: opts.pageDir,
    });
  }

  return { logoUrl, fromCaptureLogo: false };
}
