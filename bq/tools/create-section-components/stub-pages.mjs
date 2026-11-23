/**
 * Page shell definitions from site-content-tree / extracted nav-footer links.
 * Writes kind: "page" under pages/ (neutral names — no stub- prefix).
 */
import {
  access,
  mkdir,
  readdir,
  readFile,
  rmdir,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { bqRoot } from '../capture/paths.mjs';
import { buildSiteContentTree } from '../capture/lib/build-site-content-tree.mjs';
import { toKebabCase, toPascalCase } from './naming.mjs';
import { stripLocalePrefixFromPathname } from '../shared/cultures.mjs';
import {
  lookupByLocalePath,
  makeSiteKey,
  normalizeLocalePath,
  resolveCanonicalEnglishPath,
} from '../shared/url-route-cache.ts';
import {
  ensurePageShellDefinition,
  pageDefinitionKey,
  pagesDir,
  routePathToSegments,
} from './page-defs.mjs';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * @deprecated Use pageDefinitionKey — kept for callers; no stub- prefix.
 * @param {string} siteSystem
 * @param {string[]} routeSegments
 * @returns {string}
 */
export function pageStubDefinitionKey(siteSystem, routeSegments) {
  return pageDefinitionKey(siteSystem, routeSegments);
}

/**
 * Prefer cached english Home path so NL/FR stubs share one routePath.
 * @param {string} route
 * @param {{ culture?: string, cultures?: string[], collectionSystem?: string, siteSystem?: string }} opts
 */
async function resolveStubEnglishRoutePath(route, opts = {}) {
  const localePath = normalizeLocalePath(route);
  const collectionSystem = String(opts.collectionSystem || '').trim();
  const siteSystem = String(opts.siteSystem || '').trim();
  if (collectionSystem && siteSystem) {
    const cached = lookupByLocalePath(
      makeSiteKey(collectionSystem, siteSystem),
      localePath,
    );
    if (cached?.englishPath) return cached.englishPath;
  }
  return resolveCanonicalEnglishPath({
    pathname: route,
    sourceCulture: opts.culture || 'en',
    cultures: opts.cultures || [],
  });
}

/**
 * Ensure site-content-tree.json exists; return stub page paths.
 */
export async function ensureSiteContentTree(projectRoot) {
  const treePath = path.join(projectRoot, 'site-content-tree.json');
  if (!(await exists(treePath))) {
    try {
      await buildSiteContentTree(projectRoot);
    } catch (err) {
      console.warn(`  ⚠ site-content-tree: ${err instanceof Error ? err.message : err}`);
      return { treePath: null, stubs: [] };
    }
  }
  try {
    const tree = JSON.parse(await readFile(treePath, 'utf8'));
    const pages = tree.pages || tree.pageList || [];
    const stubs = pages.filter((p) => p.status === 'stub' || p.status === 'mimicked');
    return { treePath, stubs, tree };
  } catch {
    return { treePath, stubs: [] };
  }
}

/**
 * Write kind: "page" shell definitions for internal routes (empty renderings).
 * Skips routes that already have a full layout page def.
 */
export async function writeStubPageDefinitions({
  stubs,
  siteSystem,
  collectionSystem,
  hostSlug,
  culture = 'en',
  cultures = [],
  dryRun = false,
}) {
  const written = [];
  const dir = pagesDir(hostSlug);

  const limited = (stubs || []).slice(0, 40);
  for (const stub of limited) {
    const captureRoute = stub.path || stub.pathname || stub.route || '';
    if (!captureRoute || captureRoute === '/') continue;
    const route = await resolveStubEnglishRoutePath(captureRoute, {
      culture,
      cultures,
      collectionSystem,
      siteSystem,
    });
    const segments = routePathToSegments(route);
    const leaf = segments[segments.length - 1] || 'page';
    const name = toPascalCase(leaf).slice(0, 40) || 'Page';
    const result = await ensurePageShellDefinition({
      siteSystem,
      collectionSystem,
      hostSlug,
      routePath: route,
      name: stub.navigationTitle || stub.title || name,
      navigationTitle: stub.navigationTitle || stub.title || name,
      culture,
      cultures,
      dryRun,
    });
    if (result.created) written.push(result.file);
  }
  if (!dryRun && written.length === 0 && (await exists(dir))) {
    try {
      if ((await readdir(dir)).length === 0) await rmdir(dir);
    } catch {
      /* ignore */
    }
  }
  if (written.length) {
    console.log(`  + ${written.length} page definition(s) under ${path.relative(bqRoot, dir)}`);
  }
  return written;
}

/** Extract same-host hrefs from HTML snippets. */
export function extractInternalHrefs(html, pageUrl) {
  let origin;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    origin = '';
  }
  const hrefs = new Set();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html || ''))) {
    const href = m[1];
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const u = new URL(href, origin || 'https://example.invalid');
      if (origin && u.origin !== origin) continue;
      hrefs.add(u.pathname);
    } catch {
      if (href.startsWith('/')) hrefs.add(href.split('?')[0]);
    }
  }
  return [...hrefs];
}

/**
 * Extract same-site Link/CTA urls from definition TS content seeds.
 * @param {string} definitionTs
 * @param {string} [pageUrl]
 * @returns {Array<{ path: string, navigationTitle?: string, title?: string }>}
 */
export function extractLinkStubsFromDefinitionTs(definitionTs, pageUrl) {
  const text = String(definitionTs || '');
  /** @type {Map<string, { path: string, navigationTitle?: string, title?: string }>} */
  const byPath = new Map();
  let origin = '';
  try {
    origin = pageUrl ? new URL(pageUrl).origin : '';
  } catch {
    origin = '';
  }

  const re =
    /\b(?:Link|CTA)\s*:\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const body = m[1] || '';
    const urlMatch = body.match(/\burl\s*:\s*(["'])([^"']*)\1/);
    const textMatch = body.match(/\btext\s*:\s*(["'])([^"']*)\1/);
    const url = urlMatch?.[2]?.trim() || '';
    const label = textMatch?.[2]?.trim() || '';
    if (!url || url.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(url)) {
      continue;
    }
    let pathname = '';
    try {
      if (/^https?:\/\//i.test(url)) {
        const u = new URL(url);
        if (origin && u.origin !== origin) continue;
        pathname = u.pathname || '/';
      } else if (url.startsWith('/')) {
        pathname = url.split('?')[0].split('#')[0] || '/';
      } else continue;
    } catch {
      continue;
    }
    if (!pathname || pathname === '/') continue;
    // Strip language / market-language folders — Sitecore uses cultures, not locale items.
    const route = stripLocalePrefixFromPathname(pathname);
    if (!route || route === '/') continue;
    const leaf = route.split('/').filter(Boolean).pop() || route;
    if (!byPath.has(route)) {
      byPath.set(route, {
        path: route,
        navigationTitle: label || leaf,
        title: label || leaf,
      });
    }
  }
  return [...byPath.values()];
}

/**
 * Write page shell defs for same-site links in a component definition.
 * Create-if-absent; never overwrite a full-layout page file.
 */
export async function writeStubPageDefinitionsFromLinks({
  definitionTs,
  pageUrl,
  siteSystem,
  collectionSystem,
  hostSlug,
  culture = 'en',
  cultures = [],
  dryRun = false,
}) {
  const stubs = extractLinkStubsFromDefinitionTs(definitionTs, pageUrl);
  if (!stubs.length) return [];

  const dir = pagesDir(hostSlug);
  const written = [];

  for (const stub of stubs) {
    const captureRoute = stub.path || '';
    if (!captureRoute || captureRoute === '/') continue;
    const route = await resolveStubEnglishRoutePath(captureRoute, {
      culture,
      cultures,
      collectionSystem,
      siteSystem,
    });
    const segments = routePathToSegments(route);
    const leaf = segments[segments.length - 1] || 'page';
    const name = toPascalCase(leaf).slice(0, 40) || 'Page';
    const result = await ensurePageShellDefinition({
      siteSystem,
      collectionSystem,
      hostSlug,
      routePath: route,
      name: stub.navigationTitle || stub.title || name,
      navigationTitle: stub.navigationTitle || stub.title || name,
      culture,
      cultures,
      dryRun,
    });
    if (result.created) written.push(result.file);
  }
  if (written.length) {
    console.log(
      `  + ${written.length} link page definition(s) under ${path.relative(bqRoot, dir)}`,
    );
  }
  return written;
}

/**
 * Heal colliding page definitionKeys across sites by ensuring siteSystem prefix.
 * Scans pages/ (and legacy _page-stubs).
 * @param {string} [componentsRoot]
 * @returns {Promise<{ healed: number, collisions: number }>}
 */
export async function healCollidingPageStubDefinitionKeys(
  componentsRoot = path.join(bqRoot, 'src', 'components'),
) {
  const hosts = await readdir(componentsRoot, { withFileTypes: true });
  /** @type {Map<string, Array<{ abs: string, host: string, site: string, key: string, src: string }>>} */
  const byKey = new Map();

  for (const h of hosts) {
    if (!h.isDirectory()) continue;
    for (const sub of ['pages', '_page-stubs']) {
      const stubDir = path.join(componentsRoot, h.name, sub);
      let files = [];
      try {
        files = await readdir(stubDir);
      } catch {
        continue;
      }
      for (const f of files.filter((x) => x.endsWith('.definition.ts'))) {
        const abs = path.join(stubDir, f);
        const src = await readFile(abs, 'utf8');
        const key = (src.match(/definitionKey:\s*["']([^"']+)/) || [])[1];
        const site = (src.match(/siteSystem:\s*["']([^"']+)/) || [])[1] || h.name;
        if (!key) continue;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push({ abs, host: h.name, site, key, src });
      }
    }
  }

  let healed = 0;
  let collisions = 0;
  for (const [, group] of byKey) {
    if (group.length < 2) continue;
    collisions += 1;
    for (const entry of group) {
      const siteKebab = toKebabCase(entry.site) || toKebabCase(entry.host) || 'site';
      if (entry.key.startsWith(`${siteKebab}-`)) continue;
      const rest = entry.key.replace(/^(stub-|page-)/, '');
      const newKey = `${siteKebab}-${rest}`.replace(/-+/g, '-').slice(0, 80);
      if (newKey === entry.key) continue;
      const newExport =
        newKey
          .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
          .replace(/[^a-zA-Z0-9_$]/g, '_') || 'pageDef';
      let next = entry.src.replace(
        /definitionKey:\s*["'][^"']+["']/,
        `definitionKey: "${newKey}"`,
      );
      next = next.replace(
        /export const\s+[A-Za-z0-9_$]+/,
        `export const ${newExport}`,
      );
      next = next.replace(/kind:\s*["']page-stub["']/, 'kind: "page"');
      next = next.replace(
        /PageStubDefinition/g,
        'PageDefinition',
      );
      // Always land under pages/ (migrate off legacy _page-stubs).
      const pagesSub = path.join(componentsRoot, entry.host, 'pages');
      await mkdir(pagesSub, { recursive: true });
      const newAbs = path.join(pagesSub, `${newKey}.definition.ts`);
      await writeFile(newAbs, next, 'utf8');
      if (path.resolve(newAbs) !== path.resolve(entry.abs)) {
        try {
          await unlink(entry.abs);
        } catch {
          /* ignore */
        }
      }
      healed += 1;
    }
  }
  if (healed) {
    console.log(
      `  ✓ healed ${healed} colliding page definitionKey(s) across ${collisions} collision(s)`,
    );
  }
  return { healed, collisions };
}
