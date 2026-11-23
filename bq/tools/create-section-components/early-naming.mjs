/**
 * Collection-scoped taken names + early section name lock for codegen.
 * FE identity = visual/sitecoreize proposal → validate → lock → disk definitionKey.
 * Enrich cmsName / alternativeNames are not invent sources.
 */
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot } from '../capture/paths.mjs';
import {
  ensureBrandComponentPrefix,
  ensureBrandDefinitionKeyPrefix,
  toDefinitionKey,
  toPascalCase,
} from './naming.mjs';
import {
  qualifySectionDir,
  readSectionNameIndex,
  sectionDirRelativePart,
  sectionNameIndexPath,
} from './write-component.mjs';
import { writeFileIfChanged } from '../shared/write-file-if-changed.mjs';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Host / infra dirs under src/components that are not site package trees. */
const NON_HOST_DIRS = new Set([
  'atoms',
  'collections',
  'content-sdk',
  'data',
  'dictionary',
  'enums',
  'hooks',
  'icons',
  'lib',
  'media',
  'parameters',
  'partial-design-dynamic-placeholder',
  'primitives',
  'renderings',
  'sites',
  'sxa',
  'validators',
  'variants',
]);

/**
 * @param {string} source
 * @returns {{ collectionSystem: string, componentName: string, definitionKey: string }}
 */
export function parseDefinitionIdentityFields(source) {
  const src = String(source || '');
  const pick = (field) => {
    const m = src.match(
      new RegExp(`${field}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`, 'i'),
    );
    return m ? String(m[1]).trim() : '';
  };
  return {
    collectionSystem: pick('collectionSystem'),
    componentName: pick('componentName'),
    definitionKey: pick('definitionKey'),
  };
}

/**
 * Normalize index children (legacy string[] or rich objects).
 * @param {unknown} children
 * @returns {Array<{ componentName: string, definitionKey: string, placeholderKey: string|null }>}
 */
export function normalizeIndexChildren(children) {
  if (!Array.isArray(children)) return [];
  /** @type {Array<{ componentName: string, definitionKey: string, placeholderKey: string|null }>} */
  const out = [];
  for (const raw of children) {
    if (typeof raw === 'string') {
      const componentName = toPascalCase(raw);
      if (!componentName) continue;
      out.push({
        componentName,
        definitionKey: toDefinitionKey(componentName),
        placeholderKey: null,
      });
      continue;
    }
    if (!raw || typeof raw !== 'object') continue;
    const componentName = toPascalCase(
      String(raw.componentName || raw.name || '').trim(),
    );
    if (!componentName) continue;
    const definitionKey =
      String(raw.definitionKey || '').trim() || toDefinitionKey(componentName);
    const placeholderKey = String(
      raw.placeholderKey || raw.placeholder || '',
    ).trim() || null;
    out.push({ componentName, definitionKey, placeholderKey });
  }
  return out;
}

/**
 * Child lock name at index slot (string or rich entry).
 * @param {object|null|undefined} indexEntry
 * @param {number} childIndex
 * @returns {string}
 */
export function childNameFromIndexEntry(indexEntry, childIndex) {
  const kids = normalizeIndexChildren(indexEntry?.children);
  const idx =
    childIndex != null && Number.isFinite(Number(childIndex))
      ? Math.trunc(Number(childIndex))
      : -1;
  if (idx < 0 || idx >= kids.length) return '';
  return kids[idx].componentName || '';
}

/**
 * Host folders that look like site package trees (crelan-be, axa-be, …).
 * @returns {Promise<string[]>}
 */
export async function listSiteHostSlugs() {
  const root = path.join(bqRoot, 'src', 'components');
  if (!(await exists(root))) return [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(
      (e) =>
        e.isDirectory() &&
        !e.name.startsWith('_') &&
        !e.name.startsWith('.') &&
        !NON_HOST_DIRS.has(e.name),
    )
    .map((e) => e.name);
}

/**
 * Whether a host has any component definition for this collectionSystem.
 * @param {string} hostSlug
 * @param {string} collectionSystem
 */
async function hostBelongsToCollection(hostSlug, collectionSystem) {
  const want = String(collectionSystem || '').trim().toLowerCase();
  if (!want) return true;
  const hostRoot = path.join(bqRoot, 'src', 'components', hostSlug);
  if (!(await exists(hostRoot))) return false;
  let entries;
  try {
    entries = await readdir(hostRoot, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith('_')) continue;
    if (
      ent.name === 'pages' ||
      ent.name === 'sites' ||
      ent.name === 'partials'
    ) {
      continue;
    }
    let files;
    try {
      files = await readdir(path.join(hostRoot, ent.name));
    } catch {
      continue;
    }
    const defFile = files.find((f) => f.endsWith('.definition.ts'));
    if (!defFile) continue;
    try {
      const src = await readFile(
        path.join(hostRoot, ent.name, defFile),
        'utf8',
      );
      const id = parseDefinitionIdentityFields(src);
      if (id.collectionSystem.toLowerCase() === want) return true;
      // Site/collection defs also encode collectionSystem
      if (
        /kind:\s*["'](?:site|collection|presentation)["']/.test(src) &&
        id.collectionSystem.toLowerCase() === want
      ) {
        return true;
      }
    } catch {
      /* skip */
    }
  }
  return false;
}

/**
 * Collect taken componentName + definitionKey for a collection (all matching hosts).
 *
 * @param {{
 *   collectionSystem?: string|null,
 *   hostSlug?: string|null,
 *   extraNames?: Iterable<string>|null,
 *   allowNames?: Iterable<string>|null,
 * }} [opts]
 * @returns {Promise<{
 *   componentNames: string[],
 *   definitionKeys: string[],
 *   takenLower: Set<string>,
 *   byHost: Record<string, string[]>,
 * }>}
 */
export async function listTakenComponentNames(opts = {}) {
  const collectionSystem = String(opts.collectionSystem || '').trim();
  const preferHost = String(opts.hostSlug || '').trim();
  const allowLower = new Set(
    [...(opts.allowNames || [])]
      .map((n) => String(n || '').trim().toLowerCase())
      .filter(Boolean),
  );
  /** @type {Set<string>} */
  const names = new Set();
  /** @type {Set<string>} */
  const keys = new Set();
  /** @type {Record<string, string[]>} */
  const byHost = {};

  const addName = (host, raw) => {
    const n = toPascalCase(String(raw || '').trim());
    if (!n) return;
    if (allowLower.has(n.toLowerCase())) return;
    names.add(n);
    const k = toDefinitionKey(n);
    if (!allowLower.has(k.toLowerCase())) keys.add(k);
    if (!byHost[host]) byHost[host] = [];
    if (!byHost[host].includes(n)) byHost[host].push(n);
  };
  const addKey = (raw) => {
    const k = toDefinitionKey(String(raw || '').trim());
    if (!k || allowLower.has(k.toLowerCase())) return;
    keys.add(k);
  };

  for (const extra of opts.extraNames || []) {
    addName(preferHost || '_inflight', extra);
  }

  let hosts = await listSiteHostSlugs();
  if (collectionSystem) {
    const matched = [];
    for (const h of hosts) {
      if (await hostBelongsToCollection(h, collectionSystem)) matched.push(h);
    }
    // Always include current host even if empty (first package in collection).
    if (preferHost && !matched.includes(preferHost)) matched.push(preferHost);
    hosts = matched.length ? matched : preferHost ? [preferHost] : hosts;
  } else if (preferHost) {
    hosts = [preferHost];
  }

  for (const host of hosts) {
    const hostRoot = path.join(bqRoot, 'src', 'components', host);
    if (!(await exists(hostRoot))) continue;

    // section-name-index locks
    const index = await readSectionNameIndex(host);
    for (const entry of Object.values(index || {})) {
      if (!entry || typeof entry !== 'object') continue;
      addName(host, entry.componentName);
      addKey(entry.definitionKey);
      for (const child of normalizeIndexChildren(entry.children)) {
        addName(host, child.componentName);
        addKey(child.definitionKey);
      }
    }

    let entries;
    try {
      entries = await readdir(hostRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name.startsWith('_')) continue;
      if (
        ent.name === 'pages' ||
        ent.name === 'sites' ||
        ent.name === 'partials'
      ) {
        continue;
      }
      let files;
      try {
        files = await readdir(path.join(hostRoot, ent.name));
      } catch {
        continue;
      }
      const defFile = files.find((f) => f.endsWith('.definition.ts'));
      if (!defFile) {
        // Folder without definition still occupies the Pascal name slot.
        addName(host, ent.name);
        continue;
      }
      try {
        const src = await readFile(
          path.join(hostRoot, ent.name, defFile),
          'utf8',
        );
        const id = parseDefinitionIdentityFields(src);
        if (
          collectionSystem &&
          id.collectionSystem &&
          id.collectionSystem.toLowerCase() !== collectionSystem.toLowerCase()
        ) {
          // Plan: collection-scoped uniqueness — skip other collections.
          continue;
        }
        addName(host, id.componentName || ent.name);
        if (id.definitionKey) addKey(id.definitionKey);
      } catch {
        addName(host, ent.name);
      }
    }
  }

  const takenLower = new Set(
    [...names, ...keys].map((s) => String(s).toLowerCase()),
  );
  return {
    componentNames: [...names].sort(),
    definitionKeys: [...keys].sort(),
    takenLower,
    byHost,
  };
}

/**
 * Brand-prefix + Pascal normalize a proposed FE name.
 * @param {string} raw
 * @param {string} codePrefix
 */
export function normalizeProposedComponentName(raw, codePrefix = '') {
  const prefix = toPascalCase(codePrefix);
  const pascal = toPascalCase(String(raw || '').trim());
  if (!pascal) return '';
  return prefix ? ensureBrandComponentPrefix(pascal, prefix) : pascal;
}

/**
 * @param {string} componentName
 * @param {string} codePrefix
 * @param {Set<string>|Iterable<string>} takenLower
 * @returns {{ ok: boolean, componentName: string, definitionKey: string, reason?: string }}
 */
export function validateProposedComponentName(
  componentName,
  codePrefix,
  takenLower,
) {
  const name = normalizeProposedComponentName(componentName, codePrefix);
  const prefix = toPascalCase(codePrefix);
  if (!name) {
    return {
      ok: false,
      componentName: '',
      definitionKey: '',
      reason: 'empty componentName',
    };
  }
  if (prefix && !name.toLowerCase().startsWith(prefix.toLowerCase())) {
    return {
      ok: false,
      componentName: name,
      definitionKey: toDefinitionKey(name),
      reason: `missing brand prefix ${prefix}`,
    };
  }
  const key = prefix
    ? ensureBrandDefinitionKeyPrefix(toDefinitionKey(name), prefix)
    : toDefinitionKey(name);
  const taken = takenLower instanceof Set ? takenLower : new Set(
    [...(takenLower || [])].map((s) => String(s).toLowerCase()),
  );
  if (taken.has(name.toLowerCase()) || taken.has(key.toLowerCase())) {
    return {
      ok: false,
      componentName: name,
      definitionKey: key,
      reason: `name taken: ${name}`,
    };
  }
  return { ok: true, componentName: name, definitionKey: key };
}

/**
 * Early / sticky lock for a sectionDir in section-name-index.json.
 *
 * @param {{
 *   hostSlug: string,
 *   pageSlug?: string|null,
 *   sectionDir: string,
 *   componentName: string,
 *   definitionKey?: string|null,
 *   children?: Array<object|string>|null,
 *   force?: boolean,
 *   dryRun?: boolean,
 * }} opts
 * @returns {Promise<{ componentName: string, definitionKey: string, sectionKey: string, children: object[] }>}
 */
export async function upsertSectionNameLock(opts) {
  const hostSlug = String(opts.hostSlug || '').trim();
  const sectionKey = qualifySectionDir(opts.pageSlug, opts.sectionDir);
  const force = Boolean(opts.force);
  const proposed = toPascalCase(String(opts.componentName || '').trim());
  const proposedKey =
    String(opts.definitionKey || '').trim() || toDefinitionKey(proposed);
  if (!hostSlug || !sectionKey || !proposed) {
    throw new Error('upsertSectionNameLock requires hostSlug, sectionDir, componentName');
  }

  const indexPath = sectionNameIndexPath(hostSlug);
  /** @type {Record<string, object>} */
  let index = {};
  if (await exists(indexPath)) {
    try {
      index = JSON.parse(await readFile(indexPath, 'utf8')) || {};
    } catch {
      index = {};
    }
  }

  const rel = sectionDirRelativePart(sectionKey);
  const prior =
    (index[sectionKey] && typeof index[sectionKey] === 'object'
      ? index[sectionKey]
      : null) ||
    (rel && rel !== sectionKey && index[rel] && typeof index[rel] === 'object'
      ? index[rel]
      : null);

  const lockedName =
    !force && String(prior?.componentName || '').trim()
      ? toPascalCase(prior.componentName)
      : proposed;
  const lockedKey =
    !force &&
    lockedName === toPascalCase(prior?.componentName || '') &&
    String(prior?.definitionKey || '').trim()
      ? String(prior.definitionKey).trim()
      : lockedName === proposed
        ? proposedKey
        : toDefinitionKey(lockedName);

  let children;
  if (opts.children != null) {
    children = normalizeIndexChildren(opts.children);
  } else {
    children = normalizeIndexChildren(prior?.children);
  }

  const entry = {
    componentName: lockedName,
    role: 'section',
    children: children.map((c) => ({
      componentName: c.componentName,
      definitionKey: c.definitionKey,
      placeholderKey: c.placeholderKey,
    })),
    mediaFolders: Array.isArray(prior?.mediaFolders) ? prior.mediaFolders : [],
    definitionKey: lockedKey,
    updatedAt: new Date().toISOString(),
  };

  index[sectionKey] = entry;
  if (rel && rel !== sectionKey && index[rel]) delete index[rel];

  if (!opts.dryRun) {
    const hostRoot = path.join(bqRoot, 'src', 'components', hostSlug);
    // ensure host dir exists for index write
    const { mkdir } = await import('node:fs/promises');
    await mkdir(hostRoot, { recursive: true });
    await writeFileIfChanged(
      indexPath,
      `${JSON.stringify(index, null, 2)}\n`,
    );
  }

  return {
    componentName: lockedName,
    definitionKey: lockedKey,
    sectionKey,
    children: entry.children,
  };
}

/**
 * Read definitionKey from a written package on disk (authoritative for page wiring).
 * @param {string} hostSlug
 * @param {string} componentName
 * @returns {Promise<string>}
 */
export async function readDefinitionKeyFromPackage(hostSlug, componentName) {
  const pascal = toPascalCase(componentName);
  if (!pascal || !hostSlug) return toDefinitionKey(componentName);
  const dir = path.join(bqRoot, 'src', 'components', hostSlug, pascal);
  if (!(await exists(dir))) return toDefinitionKey(pascal);
  let files;
  try {
    files = await readdir(dir);
  } catch {
    return toDefinitionKey(pascal);
  }
  const defFile = files.find((f) => f.endsWith('.definition.ts'));
  if (!defFile) return toDefinitionKey(pascal);
  try {
    const src = await readFile(path.join(dir, defFile), 'utf8');
    const id = parseDefinitionIdentityFields(src);
    return id.definitionKey || toDefinitionKey(pascal);
  } catch {
    return toDefinitionKey(pascal);
  }
}

/**
 * True when definitionKey resolves to a package / definition on disk.
 * @param {string} definitionKey
 * @param {string} hostSlug
 * @param {{ resolveDefinitionTsPath: Function, cache?: Map<string, boolean> }} helpers
 */
async function definitionKeyExistsOnDisk(definitionKey, hostSlug, helpers) {
  const key = String(definitionKey || '').trim();
  if (!key) return false;
  const cache = helpers.cache || (helpers.cache = new Map());
  if (cache.has(key)) return Boolean(cache.get(key));
  const defPath = await helpers.resolveDefinitionTsPath(key, hostSlug);
  if (defPath) {
    cache.set(key, true);
    return true;
  }
  const dir = path.join(
    bqRoot,
    'src',
    'components',
    hostSlug,
    toPascalCase(key),
  );
  const ok = await exists(dir);
  cache.set(key, ok);
  return ok;
}

/**
 * Drop page/home rendering entries (and nested children) whose definitionKey
 * has no package on disk. Parents are kept when their own key exists even if
 * all nested children are pruned.
 * @param {object[]} renderings
 * @param {string} hostSlug
 * @returns {Promise<object[]>}
 */
export async function pruneRenderingsMissingDefinitionKeys(
  renderings,
  hostSlug,
) {
  if (!Array.isArray(renderings) || !hostSlug) return renderings || [];
  const { resolveDefinitionTsPath } = await import('./presentation.mjs');
  /** @type {Map<string, boolean>} */
  const cache = new Map();
  const helpers = { resolveDefinitionTsPath, cache };

  /**
   * @param {object[]} nodes
   * @param {string} [parentKey]
   * @returns {Promise<object[]>}
   */
  async function pruneList(nodes, parentKey = '') {
    /** @type {object[]} */
    const kept = [];
    for (const r of nodes || []) {
      if (!r || typeof r !== 'object') continue;
      const key = String(r.definitionKey || '').trim();
      if (!key) continue;
      const ok = await definitionKeyExistsOnDisk(key, hostSlug, helpers);
      if (!ok) {
        const where = parentKey
          ? `${parentKey} → ${key}`
          : key;
        console.warn(
          `  ⚠ Presentation: pruned missing definitionKey "${where}" from page wiring`,
        );
        continue;
      }
      const next = { ...r };
      if (Array.isArray(r.children) && r.children.length) {
        next.children = await pruneList(r.children, key);
      }
      kept.push(next);
    }
    return kept;
  }

  return pruneList(renderings);
}
