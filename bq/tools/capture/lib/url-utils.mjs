export function slugFromUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return 'invalid-url';
  }

  const host = parsed.hostname.replace(/\./g, '-');
  const pathname =
    parsed.pathname === '/'
      ? 'home'
      : parsed.pathname
          .replace(/^\/+|\/+$/g, '')
          .replace(/[^\w-]+/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 80) || 'page';

  return `${host}--${pathname}`;
}

export function validateUrl(urlString) {
  const parsed = new URL(urlString);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported protocol for ${urlString}`);
  }
  return parsed.toString();
}

export async function readUrlsFromFile(filePath) {
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(filePath, 'utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/** Host slug for project folder, e.g. www.sitecore.net → www-sitecore-net */
export function hostSlugFromUrl(urlString) {
  try {
    return new URL(urlString).hostname.replace(/\./g, '-');
  } catch {
    return 'unknown-site';
  }
}

/** True when --out points at the shared captures bucket (not a site folder). */
export function isGenericDesignScreenshotsDir(outDir) {
  const normalized = String(outDir).replace(/\\/g, '/').replace(/\/+$/, '');
  return (
    normalized === 'design-screenshots' ||
    /\/design-screenshots$/.test(normalized) ||
    normalized === 'screenshots' ||
    /\/\.bq\/screenshots$/.test(normalized) ||
    normalized === 'captures' ||
    /\/\.bq\/captures$/.test(normalized)
  );
}
