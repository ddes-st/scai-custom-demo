/**
 * Persist the public site logo URL under `.bq/captures/{host}/Logo/logo-meta.json`.
 * Brandkit needs an https URL — no local image bytes are stored.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractLogoUrlFromHtml } from './logo-from-html.mjs';
import { resolveExistingPageHtml } from './page-layout.mjs';

export const HOST_LOGO_DIR_NAME = 'Logo';
export const HOST_LOGO_META_FILE = 'logo-meta.json';

/**
 * @param {string} hostProjectRoot
 */
export function hostLogoDir(hostProjectRoot) {
  return path.join(String(hostProjectRoot || '').trim(), HOST_LOGO_DIR_NAME);
}

/**
 * @param {string} hostProjectRoot
 */
export function hostLogoMetaPath(hostProjectRoot) {
  return path.join(hostLogoDir(hostProjectRoot), HOST_LOGO_META_FILE);
}

/**
 * @param {string} hostProjectRoot
 * @returns {Promise<{ logoUrl: string, meta: object } | null>}
 */
export async function readExistingHostLogo(hostProjectRoot) {
  const root = String(hostProjectRoot || '').trim();
  if (!root) return null;
  try {
    const meta = JSON.parse(await readFile(hostLogoMetaPath(root), 'utf8'));
    const logoUrl = String(meta?.sourceUrl || '').trim();
    if (!/^https?:\/\//i.test(logoUrl)) return null;
    return { logoUrl, meta };
  } catch {
    return null;
  }
}

/**
 * Extract and store the public logo URL in `{host}/Logo/logo-meta.json`.
 *
 * @param {{
 *   hostProjectRoot: string,
 *   siteUrl: string,
 *   pageHtml?: string,
 *   pageDir?: string,
 *   force?: boolean,
 * }} opts
 * @returns {Promise<{
 *   ok: boolean,
 *   skipped?: boolean,
 *   reason?: string,
 *   logoUrl?: string|null,
 *   meta?: object|null,
 * }>}
 */
export async function saveHostLogo(opts) {
  const hostProjectRoot = String(opts.hostProjectRoot || '').trim();
  const siteUrl = String(opts.siteUrl || '').trim();
  if (!hostProjectRoot || !siteUrl) {
    return { ok: false, reason: 'missing-host-or-url' };
  }

  if (!opts.force) {
    const existing = await readExistingHostLogo(hostProjectRoot);
    if (existing) {
      return {
        ok: true,
        skipped: true,
        reason: 'already-exists',
        logoUrl: existing.logoUrl,
        meta: existing.meta,
      };
    }
  }

  let html = opts.pageHtml != null ? String(opts.pageHtml) : '';
  if (!html && opts.pageDir) {
    const htmlPath = await resolveExistingPageHtml(opts.pageDir);
    if (htmlPath) {
      try {
        html = await readFile(htmlPath, 'utf8');
      } catch {
        html = '';
      }
    }
  }
  if (!html) {
    return { ok: false, reason: 'no-html' };
  }

  const logoUrl = extractLogoUrlFromHtml(html, siteUrl);
  if (!logoUrl) {
    return { ok: false, reason: 'no-logo-url', logoUrl: null };
  }

  const meta = {
    sourceUrl: logoUrl,
    savedAt: new Date().toISOString(),
  };
  await mkdir(hostLogoDir(hostProjectRoot), { recursive: true });
  await writeFile(
    hostLogoMetaPath(hostProjectRoot),
    `${JSON.stringify(meta, null, 2)}\n`,
    'utf8',
  );

  return { ok: true, logoUrl, meta };
}
