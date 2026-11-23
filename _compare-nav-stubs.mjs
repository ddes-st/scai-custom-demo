import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function extractInternalHrefs(html, pageUrl) {
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

function extractLinkStubsFromDefinitionTs(definitionTs, pageUrl) {
  const text = String(definitionTs || '');
  const byPath = new Map();
  let origin = '';
  try {
    origin = pageUrl ? new URL(pageUrl).origin : '';
  } catch {
    origin = '';
  }
  const re = /\b(?:Link|CTA)\s*:\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const body = m[1] || '';
    const urlMatch = body.match(/\burl\s*:\s*(["'])([^"']*)\1/);
    const url = urlMatch?.[2]?.trim() || '';
    if (!url || url.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(url)) continue;
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
    if (!byPath.has(pathname)) byPath.set(pathname, pathname);
  }
  return [...byPath.keys()];
}

const pageUrl = 'https://www.sitecore.com/';
const base = '.bq/captures/www-sitecore-com/www-sitecore-com--home/sections/section-03';
const collapsed = extractInternalHrefs(readFileSync(join(base, 'section.html'), 'utf8'), pageUrl)
  .filter((p) => p && p !== '/')
  .sort();
const menuOpen = extractInternalHrefs(
  readFileSync(join(base, 'states/menu-open/section.html'), 'utf8'),
  pageUrl,
)
  .filter((p) => p && p !== '/')
  .sort();

const stubDir = 'bq/src/components/sitecore-com/_page-stubs';
const routePaths = readdirSync(stubDir)
  .filter((f) => f.endsWith('.definition.ts'))
  .map((f) => {
    const t = readFileSync(join(stubDir, f), 'utf8');
    return t.match(/routePath:\s*"([^"]+)"/)?.[1];
  })
  .filter(Boolean)
  .sort();

const navDef = 'bq/src/components/sitecore-com/SitecoreMainNav/sitecore-main-nav.definition.ts';
const defTs = readFileSync(navDef, 'utf8');
const linkCtaPaths = extractLinkStubsFromDefinitionTs(defTs, pageUrl);
const generalLinkFields = [...defTs.matchAll(/type:\s*['"]General Link['"]/g)].length;
const contentUrlPaths = [];
const urlRe = /\burl\s*:\s*(["'])([^"']*)\1/g;
let um;
while ((um = urlRe.exec(defTs))) {
  const url = um[2];
  if (!url || url.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(url)) continue;
  try {
    const u = new URL(url, pageUrl);
    if (u.origin === new URL(pageUrl).origin && u.pathname && u.pathname !== '/') {
      contentUrlPaths.push(u.pathname);
    }
  } catch {}
}

const tree = JSON.parse(
  readFileSync('.bq/captures/www-sitecore-com/site-content-tree.json', 'utf8'),
);
const treePages = tree.pages || [];
const treeStubs = treePages.filter((p) => p.status === 'stub' || p.status === 'mimicked');
const treePaths = treeStubs.map((p) => p.routePath).filter((p) => p && p !== '/').sort();

const stubSet = new Set(routePaths);
const missingCollapsed = collapsed.filter((h) => !stubSet.has(h));
const missingMenuOpen = menuOpen.filter((h) => !stubSet.has(h));
const treeNotInStubs = treePaths.filter((h) => !stubSet.has(h));
const stubsNotInTree = routePaths.filter((h) => !treePaths.includes(h));

console.log(
  JSON.stringify(
    {
      collapsedHtmlCount: collapsed.length,
      collapsedPaths: collapsed,
      missingFromCollapsed: missingCollapsed,
      menuOpenHtmlCount: menuOpen.length,
      menuOpenPaths: menuOpen,
      missingFromMenuOpenCount: missingMenuOpen.length,
      missingFromMenuOpen: missingMenuOpen.slice(0, 40),
      stubFiles: routePaths.length,
      routePaths,
      navDef: {
        generalLinkFieldCount: generalLinkFields,
        extractLinkStubsCount: linkCtaPaths.length,
        extractLinkStubsPaths: linkCtaPaths,
        uniqueSameHostContentUrls: [...new Set(contentUrlPaths)].sort(),
      },
      treeStubOrMimickedExclHome: treePaths.length,
      treeNotInStubs,
      stubsNotInTree,
      writeStubLooksFor: 'path|pathname|route (NOT routePath)',
      treeField: 'routePath',
    },
    null,
    2,
  ),
);
