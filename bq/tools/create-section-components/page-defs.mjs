/**
 * Per-route page definitions under src/components/{host}/pages/.
 * kind: "page" — empty renderings = link shell; with renderings = full layout.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot } from '../capture/paths.mjs';
import { toKebabCase, toPascalCase } from './naming.mjs';
import { writeFileIfChanged } from '../shared/write-file-if-changed.mjs';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Host-relative pages directory (not _page-stubs).
 * @param {string} hostSlug
 * @param {string} [componentsRoot] override for tests
 */
export function pagesDir(hostSlug, componentsRoot) {
  const root =
    componentsRoot || path.join(bqRoot, 'src', 'components');
  return path.join(root, hostSlug, 'pages');
}

/**
 * Neutral definitionKey / file stem: {site}-{routeSlug} or {site}-home.
 * No stub- / page- prefix.
 * @param {string} siteSystem
 * @param {string[]} routeSegments
 */
export function pageDefinitionKey(siteSystem, routeSegments) {
  const site = toKebabCase(String(siteSystem || '').trim()) || 'site';
  const pathPart = toKebabCase(
    (Array.isArray(routeSegments) ? routeSegments : [])
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .join('-'),
  );
  const base = pathPart ? `${site}-${pathPart}` : `${site}-home`;
  return base.slice(0, 80);
}

/**
 * @param {string} routePath
 * @returns {string[]}
 */
export function routePathToSegments(routePath) {
  const p = String(routePath || '/')
    .replace(/\/+$/, '')
    .replace(/^\//, '');
  if (!p || p === '/') return [];
  return p.split('/').filter(Boolean);
}

/**
 * Extract content.items[].name from a component definition.ts source.
 * @param {string} source
 * @returns {string[]}
 */
/**
 * Span a balanced `{…}` starting at openIdx (quote-aware).
 * @param {string} text
 * @param {number} openIdx
 * @returns {number} closing index, or -1
 */
function findMatchingBraceInText(text, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Top-level `content.items[].name` only (not nested `children[].name`).
 * LinkList packages seed one group + Link children — presentation must place
 * ONE rendering with datasource = the group name.
 */
export function extractContentItemNames(source) {
  const text = String(source || '');
  const names = [];
  const itemsIdx = text.search(/\bitems\s*:\s*\[/);
  if (itemsIdx < 0) return names;
  const start = text.indexOf('[', itemsIdx);
  if (start < 0) return names;
  let depth = 0;
  let end = start;
  let quote = null;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = text.slice(start + 1, end);
  // Walk top-level `{…}` objects in the items array only.
  quote = null;
  for (let i = 0; i < block.length; i++) {
    const c = block[i];
    if (quote) {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }
    if (c !== '{') continue;
    const close = findMatchingBraceInText(block, i);
    if (close < 0) break;
    const obj = block.slice(i, close + 1);
    const m =
      obj.match(/\bname\s*:\s*"([^"]+)"/) ||
      obj.match(/\bname\s*:\s*'([^']+)'/);
    if (m?.[1] && !names.includes(m[1])) names.push(m[1]);
    i = close;
  }
  return names;
}

/**
 * Strip straight/curly apostrophes for loose datasource name compare.
 * @param {string} s
 */
function stripApostrophes(s) {
  return String(s || '').replace(/['\u2019\u2018`´]/g, '');
}

/**
 * True when preferred matches a seed allowing apostrophe truncation
 * (`Thema` ↔ `Thema's`) or equal after stripping apostrophes.
 * @param {string} preferred
 * @param {string} seed
 */
export function datasourceNamesMatchLoose(preferred, seed) {
  const pref = String(preferred || '').trim();
  const name = String(seed || '').trim();
  if (!pref || !name) return false;
  if (pref === name) return true;
  const prefBare = stripApostrophes(pref);
  const seedBare = stripApostrophes(name);
  if (prefBare && seedBare && prefBare === seedBare) return true;
  // Truncated preferred before apostrophe: "Thema" vs "Thema's"
  const seedBefore = name.split(/['\u2019\u2018`´]/)[0];
  if (seedBefore && seedBefore === pref) return true;
  const prefBefore = pref.split(/['\u2019\u2018`´]/)[0];
  if (prefBefore && prefBefore === name) return true;
  return false;
}

/**
 * True for invented hashed labels like "Foo ab12cd34" (not real content seeds).
 * @param {string|null|undefined} name
 */
export function isHashedOrphanDatasourceLabel(name) {
  return /\s[0-9a-f]{8}$/i.test(String(name || '').trim());
}

/**
 * Datasource name for a host/page slot: only when the definition has exactly
 * one content.items seed. Multi-seed packages use children (rebind), not this.
 * Ignores any prior presentation label — always from current seeds.
 * @param {string[]|null|undefined} seedNames
 * @returns {string|null}
 */
export function soleSeedDatasourceName(seedNames) {
  const names = Array.isArray(seedNames) ? seedNames.filter(Boolean) : [];
  return names.length === 1 ? names[0] : null;
}

/**
 * True if definition source already has non-empty renderings.
 * @param {string} source
 */
export function definitionHasRenderings(source) {
  return /renderings\s*:\s*\[\s*\{/.test(String(source || ''));
}

function exportNameFromKey(key) {
  return (
    String(key || '')
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      .replace(/[^a-zA-Z0-9_$]/g, '_') || 'pageDef'
  );
}

/**
 * Write or upgrade a full page definition (authoritative renderings rewrite).
 * @param {object} opts
 */
export async function writePageDefinition(opts) {
  const {
    siteSystem,
    collectionSystem,
    hostSlug,
    routePath,
    name,
    navigationTitle,
    culture = 'en',
    cultures = [],
    pageTemplateId,
    renderings = [],
    dryRun = false,
    componentsRoot,
  } = opts;

  const segments = routePathToSegments(routePath);
  const key = pageDefinitionKey(siteSystem, segments);
  const dir = pagesDir(hostSlug, componentsRoot);
  const file = path.join(dir, `${key}.definition.ts`);
  const title =
    navigationTitle ||
    name ||
    toPascalCase(segments[segments.length - 1] || 'Home').slice(0, 60) ||
    'Page';

  const cultureLiteral = culture ? `\n  culture: ${JSON.stringify(culture)},` : '';
  const culturesLiteral =
    Array.isArray(cultures) && cultures.length
      ? `\n  cultures: ${JSON.stringify(cultures)},`
      : '';
  const templateLiteral = pageTemplateId
    ? `\n  pageTemplateId: ${JSON.stringify(pageTemplateId)},`
    : '';
  const exportName = exportNameFromKey(key);

  const body = `import type { PageDefinition } from "../../../../tools/definitions/types";

/** Page ${routePath} (${siteSystem}) — create:sectioncomponents */
export const ${exportName} = {
  kind: "page",
  definitionKey: "${key}",
  name: ${JSON.stringify(title)},
  routePath: ${JSON.stringify(routePath || '/')},
  siteSystem: "${siteSystem}",
  collectionSystem: "${collectionSystem}",
  navigationTitle: ${JSON.stringify(title)},${cultureLiteral}${culturesLiteral}${templateLiteral}
  renderings: ${JSON.stringify(renderings || [], null, 2)},
} satisfies PageDefinition;
`;

  if (!dryRun) {
    await mkdir(dir, { recursive: true });
    await writeFileIfChanged(file, body);
  }
  return { file, definitionKey: key, routePath: routePath || '/' };
}

/**
 * Ensure a link-shell page file exists (create only if missing; never overwrite full layout).
 * @param {object} opts
 */
export async function ensurePageShellDefinition(opts) {
  const {
    siteSystem,
    collectionSystem,
    hostSlug,
    routePath,
    name,
    navigationTitle,
    culture = 'en',
    cultures = [],
    dryRun = false,
    componentsRoot,
  } = opts;

  const segments = routePathToSegments(routePath);
  if (!segments.length && routePath !== '/' && routePath !== '') {
    /* allow home */
  }
  const key = pageDefinitionKey(siteSystem, segments);
  const dir = pagesDir(hostSlug, componentsRoot);
  const file = path.join(dir, `${key}.definition.ts`);

  if (await exists(file)) {
    const existing = await readFile(file, 'utf8');
    if (definitionHasRenderings(existing)) {
      return { file, definitionKey: key, skipped: 'has-renderings' };
    }
    return { file, definitionKey: key, skipped: 'exists' };
  }

  const title =
    navigationTitle ||
    name ||
    toPascalCase(segments[segments.length - 1] || 'Page').slice(0, 60) ||
    'Page';
  const cultureLiteral = culture ? `\n  culture: ${JSON.stringify(culture)},` : '';
  const culturesLiteral =
    Array.isArray(cultures) && cultures.length
      ? `\n  cultures: ${JSON.stringify(cultures)},`
      : '';
  const exportName = exportNameFromKey(key);

  const body = `import type { PageDefinition } from "../../../../tools/definitions/types";

/** Link shell for ${routePath} — upgraded to full layout by create:sectioncomponents when captured */
export const ${exportName} = {
  kind: "page",
  definitionKey: "${key}",
  name: ${JSON.stringify(title)},
  routePath: ${JSON.stringify(routePath)},
  siteSystem: "${siteSystem}",
  collectionSystem: "${collectionSystem}",
  navigationTitle: ${JSON.stringify(title)},${cultureLiteral}${culturesLiteral}
} satisfies PageDefinition;
`;

  if (!dryRun) {
    await mkdir(dir, { recursive: true });
    await writeFile(file, body, 'utf8');
  }
  return { file, definitionKey: key, created: true };
}
