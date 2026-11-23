/**
 * Build site-content-tree.json from internal links in captured HTML.
 * Used to scaffold Sitecore page YAML for routes referenced in nav/footer
 * even when those pages were not fully mimicked.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readOriginalSectionHtml } from './section-html-files.mjs';

const SKIP_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|doc|docx|xls|xlsx|mp4|mp3|css|js)(\?|#|$)/i;
const SKIP_SCHEMES = /^(mailto:|tel:|javascript:|#)/i;

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

/** @param {string} slug */
export function slugToItemName(slug) {
  if (!slug) return '';
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => {
      if (/^\d+$/.test(part)) return part;
      if (part.length <= 4 && part === part.toUpperCase()) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * @param {string} pathname e.g. /en/calendar/hlth-2026
 * @param {string[]} languagePrefixes e.g. ['/en', '/nl']
 */
export function stripLanguagePrefix(pathname, languagePrefixes) {
  let p = pathname;
  for (const prefix of languagePrefixes.sort((a, b) => b.length - a.length)) {
    if (p === prefix || p === `${prefix}/`) return '/';
    if (p.startsWith(`${prefix}/`)) {
      p = p.slice(prefix.length);
      break;
    }
  }
  return p.startsWith('/') ? p : `/${p}`;
}

/**
 * @param {string} routePath normalized path after language strip, e.g. /calendar/hlth-2026
 */
export function routeToSitecoreSegments(routePath) {
  const segments = routePath.split('/').filter(Boolean);
  return segments.map((seg) => slugToItemName(seg));
}

export function buildYamlRelativePath(segments) {
  if (!segments.length) return 'Home.yml';
  return `Home/${segments.join('/')}.yml`;
}

export function buildSitecoreContentPath(siteContentPath, segments) {
  if (!segments.length) return `${siteContentPath}/Home`;
  return `${siteContentPath}/Home/${segments.join('/')}`;
}

function resolveHref(href, baseUrl) {
  if (!href || SKIP_SCHEMES.test(href)) return null;
  try {
    const url = new URL(href, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    return url;
  } catch {
    return null;
  }
}

function isSameOrigin(url, origin) {
  return url.origin === origin;
}

function isInternalPageLink(url) {
  if (SKIP_EXTENSIONS.test(url.pathname)) return false;
  return true;
}

/** @returns {{ href: string, text: string, component: string, sourceFile: string }[]} */
function extractLinksFromHtml(html, component, sourceFile, baseUrl, origin) {
  const links = [];
  const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = resolveHref(m[1], baseUrl);
    if (!url || !isSameOrigin(url, origin) || !isInternalPageLink(url)) continue;
    links.push({
      href: url.pathname + (url.search || ''),
      text: stripTags(m[2]),
      component,
      sourceFile,
    });
  }
  return links;
}

async function readTextIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function readBaseUrl(projectRoot) {
  for (const name of ['source-url.txt', 'base-url.txt']) {
    const raw = await readTextIfExists(path.join(projectRoot, name));
    if (raw?.trim()) return raw.trim();
  }
  const pages = await readdir(projectRoot, { withFileTypes: true });
  for (const entry of pages) {
    if (!entry.isDirectory() || entry.name === 'sections') continue;
    const pageDir = path.join(projectRoot, entry.name);
    const sourceUrl = await readTextIfExists(path.join(pageDir, 'source-url.txt'));
    if (sourceUrl?.trim()) {
      try {
        return new URL(sourceUrl.trim()).origin;
      } catch {
        /* ignore */
      }
    }
    const detected = await readTextIfExists(path.join(pageDir, 'detected-sections.json'));
    if (detected) {
      try {
        const url = JSON.parse(detected).url;
        if (url) return new URL(url).origin;
      } catch {
        /* ignore */
      }
    }
    const manifest = await readTextIfExists(path.join(pageDir, 'page-manifest.json'));
    if (manifest) {
      try {
        const url = JSON.parse(manifest).url;
        if (url) return new URL(url).origin;
      } catch {
        /* ignore */
      }
    }
  }
  return 'https://example.com';
}

function detectLanguagePrefixes(urls) {
  const prefixes = new Set();
  for (const u of urls) {
    const m = u.match(/^\/([a-z]{2})(\/|$)/i);
    if (m) prefixes.add(`/${m[1].toLowerCase()}`);
  }
  return [...prefixes].sort();
}

async function readMimickedPages(projectRoot) {
  /** @type {Map<string, { slug: string, url: string, title?: string }>} */
  const byRoute = new Map();
  const entries = await readdir(projectRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'sections') continue;
    const pageDir = path.join(projectRoot, entry.name);
    let url = null;
    let slug = entry.name;
    let title;

    const sourceUrl = await readTextIfExists(path.join(pageDir, 'source-url.txt'));
    if (sourceUrl?.trim()) url = sourceUrl.trim();

    const detectedRaw = await readTextIfExists(path.join(pageDir, 'detected-sections.json'));
    if (detectedRaw) {
      try {
        const detected = JSON.parse(detectedRaw);
        url = url || detected.url || null;
      } catch {
        /* ignore */
      }
    }

    const manifestRaw = await readTextIfExists(path.join(pageDir, 'page-manifest.json'));
    if (manifestRaw) {
      try {
        const manifest = JSON.parse(manifestRaw);
        url = url || manifest.url || null;
        slug = manifest.slug ?? slug;
        title = manifest.title;
      } catch {
        /* ignore */
      }
    }

    if (!url) continue;
    try {
      const pathname = new URL(url).pathname;
      byRoute.set(pathname, { slug, url, title });
    } catch {
      /* ignore invalid url */
    }
  }
  return byRoute;
}

async function harvestLinks(projectRoot, baseUrl, sectionsManifest) {
  const origin = new URL(baseUrl).origin;
  const all = [];

  const chromeFolders = ['header', 'navigation', 'footer', 'breadcrumb'];
  for (const folder of chromeFolders) {
    const original = await readOriginalSectionHtml(path.join(projectRoot, 'sections', folder));
    const html = original?.html || '';
    if (html) {
      all.push(
        ...extractLinksFromHtml(
          html,
          slugToItemName(folder),
          `sections/${folder}/${original.fileName}`,
          baseUrl,
          origin,
        ),
      );
    }
  }

  if (sectionsManifest?.components) {
    for (const comp of Object.values(sectionsManifest.components)) {
      if (comp.type !== 'link-list' && comp.componentType !== 'LinkList') continue;
      const folder = comp.folderName ?? comp.folder;
      if (!folder) continue;
      const original = await readOriginalSectionHtml(path.join(projectRoot, 'sections', folder));
      const html = original?.html || '';
      if (html) {
        all.push(
          ...extractLinksFromHtml(
            html,
            comp.cmsName ?? 'LinkList',
            `sections/${folder}/${original.fileName}`,
            baseUrl,
            origin,
          ),
        );
      }
    }
  }

  const entries = await readdir(projectRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'sections') continue;
    const pageDir = path.join(projectRoot, entry.name);
    const { resolveExistingPageHtml } = await import('./page-layout.mjs');
    const htmlPath = await resolveExistingPageHtml(pageDir);
    const html = htmlPath ? await readTextIfExists(htmlPath) : null;
    if (html) {
      all.push(
        ...extractLinksFromHtml(html, 'PageCapture', `${entry.name}/html/page.html`, baseUrl, origin),
      );
    }
  }

  return all;
}

/**
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {string} [options.siteContentPath] Sitecore content root, e.g. /sitecore/content/rai/rai-amsterdam
 * @param {string[]} [options.languagePrefixes]
 */
export async function buildSiteContentTree(projectRoot, options = {}) {
  const baseUrl = options.baseUrl ?? (await readBaseUrl(projectRoot));
  const siteContentPath =
    options.siteContentPath ?? `/sitecore/content/${path.basename(projectRoot)}`;

  let sectionsManifest = null;
  try {
    sectionsManifest = JSON.parse(
      await readFile(path.join(projectRoot, 'sections', 'manifest.json'), 'utf8'),
    );
  } catch {
    sectionsManifest = { components: {} };
  }

  const rawLinks = await harvestLinks(projectRoot, baseUrl, sectionsManifest);
  const languagePrefixes =
    options.languagePrefixes ??
    detectLanguagePrefixes(rawLinks.map((l) => l.href).concat([new URL(baseUrl).pathname]));

  const mimickedByPathname = await readMimickedPages(projectRoot);

  /** @type {Map<string, object>} */
  const pages = new Map();

  function upsertPage(pathname, source) {
    const normalizedRoute = stripLanguagePrefix(pathname, languagePrefixes);
    const segments = routeToSitecoreSegments(normalizedRoute);
    const key = normalizedRoute || '/';
    const mimicked = [...mimickedByPathname.entries()].find(([p]) => {
      const mRoute = stripLanguagePrefix(p, languagePrefixes);
      return mRoute === key || p === pathname;
    });

    const existing = pages.get(key) ?? {
      routePath: key === '/' ? '/' : key,
      pathnameVariants: new Set(),
      sitecoreSegments: segments,
      itemName: segments.length ? segments[segments.length - 1] : 'Home',
      parentSegments: segments.slice(0, -1),
      yamlRelativePath: buildYamlRelativePath(segments),
      sitecorePath: buildSitecoreContentPath(siteContentPath, segments),
      status: 'stub',
      captureSlug: null,
      title: null,
      sources: [],
    };

    existing.pathnameVariants.add(pathname);
    if (source) existing.sources.push(source);
    if (mimicked) {
      existing.status = 'mimicked';
      existing.captureSlug = mimicked[1].slug;
      existing.title = mimicked[1].title ?? existing.itemName;
    }
    if (source?.text && !existing.title) existing.title = source.text;
    if (!existing.title) existing.title = existing.itemName;

    pages.set(key, existing);
  }

  // Homepage
  upsertPage('/', { href: '/', text: 'Home', component: 'SiteRoot', sourceFile: 'implicit' });
  upsertPage(stripLanguagePrefix(new URL(baseUrl).pathname, languagePrefixes) || '/', null);

  for (const [pathname] of mimickedByPathname) {
    upsertPage(pathname, {
      href: pathname,
      text: null,
      component: 'PageCapture',
      sourceFile: 'page-manifest.json',
    });
  }

  for (const link of rawLinks) {
    upsertPage(link.href.split('#')[0].split('?')[0], {
      href: link.href,
      text: link.text,
      component: link.component,
      sourceFile: link.sourceFile,
    });
  }

  const pageList = [...pages.values()]
    .map((p) => ({
      routePath: p.routePath,
      pathnameVariants: [...p.pathnameVariants].sort(),
      sitecoreSegments: p.sitecoreSegments,
      itemName: p.itemName,
      parentSegments: p.parentSegments,
      yamlRelativePath: p.yamlRelativePath,
      sitecorePath: p.sitecorePath,
      title: p.title,
      navigationTitle: p.title,
      status: p.status,
      captureSlug: p.captureSlug,
      sources: p.sources,
    }))
    .sort((a, b) => a.sitecorePath.localeCompare(b.sitecorePath));

  const tree = {
    version: 1,
    generatedAt: new Date().toISOString(),
    project: path.basename(projectRoot),
    baseUrl,
    siteContentPath,
    languagePrefixes,
    pages: pageList,
    stats: {
      total: pageList.length,
      mimicked: pageList.filter((p) => p.status === 'mimicked').length,
      stub: pageList.filter((p) => p.status === 'stub').length,
    },
  };

  const outPath = path.join(projectRoot, 'site-content-tree.json');
  await writeFile(outPath, JSON.stringify(tree, null, 2), 'utf8');
  return { path: outPath, tree };
}
