/**
 * Resolve capture page folder from a URL under `.bq/captures/{host}/{page}/`.
 */
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { defaultCapturesDir } from '../capture/paths.mjs';
import { discoverPageDirs } from '../capture/merge-page-sections.mjs';
import { hostSlugFromUrl, slugFromUrl, validateUrl } from '../capture/lib/url-utils.mjs';

/**
 * @param {string} a
 * @param {string} b
 */
export function urlsRoughlyEqual(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    const norm = (u) => {
      const p = u.pathname.replace(/\/+$/, '') || '/';
      return `${u.protocol}//${u.hostname.toLowerCase()}${p}${u.search}`;
    };
    return norm(ua) === norm(ub);
  } catch {
    return String(a || '').trim() === String(b || '').trim();
  }
}

/**
 * True when the URL path is a host seed (site root / docs ellipsis), not a page path.
 * Treats `/`, empty, `/…`, `/...`, and decoded `%E2%80%A6` as host-wide seeds.
 * @param {string} pathname
 */
export function isHostSeedPathname(pathname) {
  let p = String(pathname || '');
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep raw */
  }
  p = p.replace(/\/+$/, '') || '/';
  if (p === '/' || p === '') return true;
  const leaf = p.replace(/^\//, '').trim();
  // Unicode ellipsis U+2026, ascii "...", or lone placeholder segment
  if (leaf === '\u2026' || leaf === '…' || leaf === '...') return true;
  if (/^(\.\.\.|\u2026|…)$/.test(leaf)) return true;
  return false;
}

/**
 * Score how much a captured pathname looks like a localized site home
 * (common when `--url https://host/` was redirected/captured as `/nl/…`).
 * @param {string} pathname
 * @returns {number} higher = better home candidate; 0 = not a home
 */
export function scoreLocaleHomePath(pathname) {
  const p = String(pathname || '')
    .replace(/\/+$/, '')
    .toLowerCase() || '/';
  if (p === '/' || p === '') return 100;
  const parts = p.split('/').filter(Boolean);
  // /nl /en /fr /de /nl-be …
  if (parts.length === 1 && /^[a-z]{2}(-[a-z]{2})?$/i.test(parts[0])) return 90;
  // /nl/particulieren /fr/particuliers /en/personal /nl/private /en/individuals …
  if (parts.length === 2) {
    const [locale, leaf] = parts;
    if (!/^[a-z]{2}(-[a-z]{2})?$/i.test(locale)) return 0;
    if (
      /^(particulieren|particuliers|personal|private|individuals|retail|home|start|index)$/i.test(
        leaf,
      )
    ) {
      return 85;
    }
    return 40;
  }
  return 0;
}

/**
 * Pick best seed among same-host captures (locale-home score, then slug).
 * @param {Array<{ pageDir: string, pageSlug: string, sourceUrl: string }>} sameHost
 * @param {boolean} allowAmbiguous — when true (host-wide), break ties by slug
 * @returns {{ pageDir: string, pageSlug: string, sourceUrl: string, reason: string }|null}
 */
function pickBestHostSeed(sameHost, allowAmbiguous) {
  if (!sameHost.length) return null;
  if (sameHost.length === 1) {
    return {
      ...sameHost[0],
      reason: 'sole host capture (site-root URL)',
    };
  }
  const scored = sameHost
    .map((c) => {
      let pathname = '/';
      try {
        pathname = new URL(c.sourceUrl).pathname;
      } catch {
        /* keep / */
      }
      return { c, score: scoreLocaleHomePath(pathname) };
    })
    .sort((a, b) => b.score - a.score || a.c.pageSlug.localeCompare(b.c.pageSlug));

  const withScore = scored.filter((x) => x.score > 0);
  const pool = withScore.length ? withScore : scored;
  if (!pool.length) return null;

  if (
    !allowAmbiguous &&
    pool.length > 1 &&
    pool[0].score === pool[1].score
  ) {
    // Ambiguous: multiple equal top scores — do not guess (page-only).
    return null;
  }

  const top = pool[0];
  const reason =
    top.score > 0
      ? `locale-home capture (score=${top.score})`
      : 'first host capture (host-wide seed)';
  return { ...top.c, reason };
}

/**
 * List usable capture pages under a host project (source-url + sections/).
 * @param {string} projectRoot
 * @returns {Promise<Array<{ pageDir: string, pageSlug: string, sourceUrl: string }>>}
 */
export async function listUsableHostCaptures(projectRoot) {
  /** @type {Array<{ pageDir: string, pageSlug: string, sourceUrl: string }>} */
  const out = [];
  let pageDirs = [];
  try {
    pageDirs = await discoverPageDirs(projectRoot);
  } catch {
    return out;
  }
  for (const pageDir of pageDirs) {
    const pageSlug = path.basename(pageDir);
    let sourceUrl = '';
    try {
      sourceUrl = (await readFile(path.join(pageDir, 'source-url.txt'), 'utf8')).trim();
    } catch {
      continue;
    }
    if (!sourceUrl) continue;
    try {
      await access(path.join(pageDir, 'sections'));
    } catch {
      continue;
    }
    out.push({ pageDir, pageSlug, sourceUrl });
  }
  return out;
}

/**
 * When the exact slug folder is missing, pick a host capture that matches the
 * requested URL (exact source-url) or — for site-root / host-wide — a locale-home seed.
 * @param {string} projectRoot
 * @param {string} requestedUrl
 * @param {{ hostWide?: boolean }} [opts]
 *   hostWide: always pick a seed from usable same-host captures (tie-break by slug).
 * @returns {Promise<{ pageDir: string, pageSlug: string, sourceUrl: string, reason: string }|null>}
 */
export async function resolveFallbackCapturePage(
  projectRoot,
  requestedUrl,
  opts = {},
) {
  const hostWide = Boolean(opts.hostWide);
  const candidates = await listUsableHostCaptures(projectRoot);
  if (!candidates.length) return null;

  const exact = candidates.find((c) => urlsRoughlyEqual(c.sourceUrl, requestedUrl));
  if (exact) {
    return { ...exact, reason: 'source-url match' };
  }

  let reqPath = '/';
  let reqHost = '';
  try {
    const u = new URL(requestedUrl);
    reqPath = u.pathname.replace(/\/+$/, '') || '/';
    reqHost = u.hostname.toLowerCase();
  } catch {
    return null;
  }

  const sameHost = candidates.filter((c) => {
    try {
      return new URL(c.sourceUrl).hostname.toLowerCase() === reqHost;
    } catch {
      return false;
    }
  });
  if (!sameHost.length) return null;

  const isHostSeed = isHostSeedPathname(reqPath);

  // Host-wide (--all): any missing path still seeds from usable captures.
  if (hostWide) {
    return pickBestHostSeed(sameHost, true);
  }

  // Page-only: site-root / host-seed paths only — strict unique locale-home.
  if (isHostSeed) {
    return pickBestHostSeed(sameHost, false);
  }

  return null;
}

/**
 * @param {Array<{ pageSlug: string, sourceUrl: string }>} available
 */
function formatAvailableCapturesHint(available, reqHost) {
  if (!available.length) return 'No usable captures under this host.';
  let hostRoot = available[0].sourceUrl;
  try {
    const u = new URL(available[0].sourceUrl);
    hostRoot = `${u.protocol}//${u.hostname}/`;
  } catch {
    if (reqHost) hostRoot = `https://${reqHost}/`;
  }
  return [
    'Available captures:',
    ...available.map((c) => `  ${c.pageSlug} ← ${c.sourceUrl}`),
    `Host-wide (all captures): npm run create:sectioncomponents -- --url "${hostRoot}"`,
    `Single page: npm run create:sectioncomponents -- --url "${available[0].sourceUrl}" --page-only`,
  ].join('\n');
}

/**
 * @param {string} urlString
 * @param {string} [capturesRoot]
 * @param {{ hostWide?: boolean }} [opts]
 */
export async function resolveCapturePageDir(
  urlString,
  capturesRoot = defaultCapturesDir,
  opts = {},
) {
  const hostWide = Boolean(opts.hostWide);
  const url = validateUrl(urlString);
  const hostSlug = hostSlugFromUrl(url);
  const pageSlugExact = slugFromUrl(url);
  const projectRoot = path.join(capturesRoot, hostSlug);
  let pageDir = path.join(projectRoot, pageSlugExact);
  let pageSlug = pageSlugExact;
  /** @type {string|null} */
  let resolvedFrom = null;

  try {
    await access(pageDir);
  } catch {
    const fallback = await resolveFallbackCapturePage(projectRoot, url, {
      hostWide,
    });
    if (fallback) {
      pageDir = fallback.pageDir;
      pageSlug = fallback.pageSlug;
      resolvedFrom = fallback.reason;
      console.warn(
        `  ⚠ No capture at ${pageSlugExact}; using ${pageSlug} (${fallback.reason})` +
          `\n    requested: ${url}` +
          `\n    captured:  ${fallback.sourceUrl}`,
      );
    } else {
      const available = await listUsableHostCaptures(projectRoot);
      let reqHost = '';
      try {
        reqHost = new URL(url).hostname;
      } catch {
        /* ignore */
      }
      throw new Error(
        `No capture found for ${url}\nExpected: ${path.join(projectRoot, pageSlugExact)}\n` +
          formatAvailableCapturesHint(available, reqHost) +
          `\nOr run: npm run capture:webpage -- --urls "${url}"`,
      );
    }
  }

  const sectionsDir = path.join(pageDir, 'sections');
  try {
    await access(sectionsDir);
  } catch {
    throw new Error(`Capture has no sections/: ${sectionsDir}`);
  }

  /** @type {string|null} */
  let sourceUrl = null;
  try {
    sourceUrl = (
      await readFile(path.join(pageDir, 'source-url.txt'), 'utf8')
    ).trim();
  } catch {
    sourceUrl = null;
  }

  // When site-root URL resolved to a locale capture, operate on the captured URL
  // so route/culture match evidence — but mark site-entry so chrome partials still wire.
  const effectiveUrl =
    resolvedFrom && sourceUrl ? validateUrl(sourceUrl) : url;

  let requestedPath = '/';
  try {
    requestedPath = new URL(url).pathname;
  } catch {
    /* keep / */
  }
  /** Host-seed fallbacks own chrome; host-wide seed from a deep missing path does not. */
  const isSiteEntryFallback =
    Boolean(resolvedFrom) && isHostSeedPathname(requestedPath);

  return {
    url: effectiveUrl,
    requestedUrl: url,
    sourceUrl: sourceUrl || effectiveUrl,
    hostSlug,
    pageSlug,
    projectRoot,
    pageDir,
    sectionsDir,
    capturesRoot,
    resolvedFrom,
    /** True when `--url https://host/` (or ellipsis seed) mapped onto a locale capture. */
    isSiteEntryFallback,
  };
}

/**
 * Whether this capture page should own Partial Design chrome (header/footer/cookie).
 * Home path always owns; otherwise sole/locale site-entry pages own when no --home exists.
 * @param {{
 *   url?: string,
 *   hostSlug?: string,
 *   pageSlug?: string,
 *   projectRoot?: string,
 *   isSiteEntryFallback?: boolean,
 * }} capture
 * @param {{ isHome?: boolean }} [pageRoute]
 */
export async function captureOwnsSiteChrome(capture, pageRoute = {}) {
  if (pageRoute?.isHome || capture?.isSiteEntryFallback) return true;
  const projectRoot = capture?.projectRoot;
  if (!projectRoot || !capture?.hostSlug) return Boolean(pageRoute?.isHome);
  const homeDir = path.join(projectRoot, `${capture.hostSlug}--home`);
  try {
    await access(homeDir);
    // Real home capture exists — only that page owns chrome.
    return Boolean(pageRoute?.isHome);
  } catch {
    /* no home folder */
  }
  const pages = await listUsableHostCaptures(projectRoot);
  if (pages.length <= 1) return true;
  try {
    const pathname = new URL(capture.url || capture.sourceUrl || '').pathname;
    return scoreLocaleHomePath(pathname) >= 85;
  } catch {
    return pages[0]?.pageSlug === capture.pageSlug;
  }
}

/**
 * @param {string} sectionsDir
 * @param {string|string[]|null} [only] — section-NN, numeric id, or list of section folders
 */
export async function listSectionFolders(sectionsDir, only = null) {
  const entries = await readdir(sectionsDir, { withFileTypes: true });
  let folders = entries
    .filter((e) => e.isDirectory() && /^section-\d+/i.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => {
      const na = Number((a.match(/section-(\d+)/i) || [])[1] || 0);
      const nb = Number((b.match(/section-(\d+)/i) || [])[1] || 0);
      return na - nb;
    });
  if (only != null && only !== '') {
    const tokens = Array.isArray(only)
      ? only
      : String(only)
          .split(/[,;\s]+/)
          .map((t) => t.trim())
          .filter(Boolean);
    /** @type {Set<string>} */
    const want = new Set();
    for (const token of tokens) {
      if (/^section-\d+/i.test(token)) {
        want.add(token);
        continue;
      }
      if (/^\d+$/.test(token)) {
        const n = Number(token);
        const match = folders.find((f) => {
          const fn = Number((f.match(/section-(\d+)/i) || [])[1]);
          return fn === n;
        });
        if (match) want.add(match);
        else want.add(`section-${String(n).padStart(2, '0')}`);
        continue;
      }
      want.add(token);
    }
    folders = folders.filter((f) => want.has(f));
    if (!folders.length && want.size) {
      throw new Error(
        `Section not found: ${[...want].join(', ')} under ${sectionsDir}`,
      );
    }
  }
  return folders;
}

/**
 * Captured pages under a host, seed `--url` page first then remaining slugs sorted.
 * Requires `source-url.txt` + `sections/`.
 * @param {string} seedUrl
 * @param {string} [capturesRoot]
 * @returns {Promise<Array<{ url: string, pageSlug: string, pageDir: string, projectRoot: string }>>}
 */
export async function listHostCapturePages(seedUrl, capturesRoot = defaultCapturesDir) {
  // Host listing always seeds host-wide so TLD / ellipsis / missing paths still work.
  const seed = await resolveCapturePageDir(seedUrl, capturesRoot, {
    hostWide: true,
  });
  const pageDirs = await discoverPageDirs(seed.projectRoot);
  /** @type {Array<{ url: string, pageSlug: string, pageDir: string, projectRoot: string }>} */
  const pages = [];
  for (const pageDir of pageDirs) {
    const pageSlug = path.basename(pageDir);
    let url = '';
    try {
      url = (await readFile(path.join(pageDir, 'source-url.txt'), 'utf8')).trim();
    } catch {
      /* skip */
    }
    if (!url) {
      console.warn(`  ⚠ skip ${pageSlug}: no source-url.txt`);
      continue;
    }
    try {
      await access(path.join(pageDir, 'sections'));
    } catch {
      console.warn(`  ⚠ skip ${pageSlug}: no sections/`);
      continue;
    }
    pages.push({ url, pageSlug, pageDir, projectRoot: seed.projectRoot });
  }
  const rest = pages
    .filter((p) => p.pageSlug !== seed.pageSlug)
    .sort((a, b) => a.pageSlug.localeCompare(b.pageSlug));
  const first = pages.find((p) => p.pageSlug === seed.pageSlug);
  if (!first) {
    return [{ url: seed.url, pageSlug: seed.pageSlug, pageDir: seed.pageDir, projectRoot: seed.projectRoot }, ...rest];
  }
  return [first, ...rest];
}
