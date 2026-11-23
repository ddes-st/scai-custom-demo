#!/usr/bin/env node
/**
 * Generates site serialization YAML on disk under a collection and updates the collection module.json.
 * Does NOT create items in Sitecore CM — run dotnet sitecore serialization push after generation.
 *
 * Usage:
 *   node .cursor/skills/sitecore-yaml/generators/sitecore-new-site-yaml/scripts/Generate-SitecoreSite.mjs "Site Display Name" --collection "Collection Display Name"
 *
 * Prerequisite: collection YAML must exist (see sitecore-new-collection-yaml skill).
 */
import { randomUUID } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rename, rm, writeFile, access } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(__dirname, '..');
const REPO_ROOT = process.cwd();
const TEMPLATES_ROOT = join(SKILL_ROOT, 'templates');
const COLLECTION_TEMPLATES_ROOT = join(
  SKILL_ROOT,
  '..',
  'sitecore-new-collection-yaml',
  'templates',
  'serialized-content',
);
const SITE_INCLUDE_TEMPLATE = join(SKILL_ROOT, 'references', 'site-include.template.json');

const TEMPLATE_SITE_SYSTEM = 'new-site';
const TEMPLATE_SITE_DISPLAY = 'New Site';
const TEMPLATE_COLLECTION_SYSTEM = 'new-collection';

const UUID_RE =
  /\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}?/g;

function parseArgs(argv) {
  const args = { dryRun: false, collection: null, siteName: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--collection') args.collection = argv[++i];
    else if (!argv[i].startsWith('--')) args.siteName = argv[i];
  }
  if (!args.siteName || !args.collection) {
    console.error(
      'Usage: node Generate-SitecoreSite.mjs "Site Display Name" --collection "Collection Display Name" [--dry-run]',
    );
    process.exit(1);
  }
  return args;
}

function toSystemName(displayName) {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function walkFiles(dir, acc = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) await walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function collectItemIds(content) {
  const ids = new Set();
  for (const line of content.split('\n')) {
    const m = line.match(/^ID: "([0-9a-fA-F-]{36})"/);
    if (m) ids.add(m[1].toLowerCase());
  }
  return ids;
}

function extractPathAndId(content) {
  const idMatch = content.match(/^ID: "([0-9a-fA-F-]{36})"/m);
  const pathMatch = content.match(/^Path: "(.*)"/m);
  if (!idMatch || !pathMatch) return null;
  return { id: idMatch[1].toLowerCase(), path: pathMatch[1].trim() };
}

function normalizeCollectionPath(path, collectionSystem) {
  return path
    .replaceAll(`/Project/${collectionSystem}`, '/Project/{collection}')
    .replaceAll(`/Settings/Project/${collectionSystem}`, '/Settings/Project/{collection}')
    .replaceAll(`/content/${collectionSystem}`, '/content/{collection}');
}

function isSiteContentRelativePath(rel) {
  const normalized = rel.replace(/\\/g, '/');
  if (normalized.startsWith(`${TEMPLATE_SITE_SYSTEM}/`)) return true;
  if (normalized.startsWith(`media-library/${TEMPLATE_COLLECTION_SYSTEM}/${TEMPLATE_SITE_SYSTEM}`)) {
    return true;
  }
  return false;
}

async function firstExisting(paths) {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      // continue
    }
  }
  throw new Error(`None of these paths exist:\n  ${paths.join('\n  ')}`);
}

async function buildCollectionBridge(templateSerializedRoot, targetSerializedRoot, templateColSys, targetColSys) {
  const targetByPath = new Map();

  async function indexCollection(serializedRoot, colSys, store) {
    for (const file of await walkFiles(serializedRoot)) {
      if (!file.endsWith('.yml')) continue;
      const rel = relative(serializedRoot, file);
      if (isSiteContentRelativePath(rel)) continue;
      const content = await readFile(file, 'utf8');
      const parsed = extractPathAndId(content);
      if (!parsed) continue;
      const key = normalizeCollectionPath(parsed.path, colSys);
      store.set(key, parsed.id);
    }
  }

  await indexCollection(targetSerializedRoot, targetColSys, targetByPath);

  const bridge = new Map();
  for (const file of await walkFiles(templateSerializedRoot)) {
    if (!file.endsWith('.yml')) continue;
    const rel = relative(templateSerializedRoot, file);
    if (isSiteContentRelativePath(rel)) continue;
    const content = await readFile(file, 'utf8');
    const parsed = extractPathAndId(content);
    if (!parsed) continue;
    const key = normalizeCollectionPath(parsed.path, templateColSys);
    const targetId = targetByPath.get(key);
    if (targetId) bridge.set(parsed.id, targetId);
  }

  return bridge;
}

function buildIdMap(allIds) {
  const map = new Map();
  for (const id of allIds) map.set(id.toLowerCase(), randomUUID().toLowerCase());
  return map;
}

function replaceGuids(text, idMap) {
  return text.replace(UUID_RE, (match) => {
    const bare = match.replace(/[{}]/g, '').toLowerCase();
    const next = idMap.get(bare);
    if (!next) return match;
    const hadBrace = match.startsWith('{') || match.endsWith('}');
    if (hadBrace) return `{${next.toUpperCase()}}`;
    return next;
  });
}

function applyNameTokens(text, siteDisplay, siteSystem, collectionDisplay, collectionSystem) {
  return text
    .replaceAll(TEMPLATE_SITE_DISPLAY, siteDisplay)
    .replaceAll(TEMPLATE_COLLECTION_SYSTEM, collectionSystem)
    .replaceAll(TEMPLATE_SITE_SYSTEM, siteSystem)
    .replaceAll('New Collection', collectionDisplay);
}

async function renameNewSitePaths(root, siteSystem) {
  const dirsToRename = [];
  async function walk(dir) {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === TEMPLATE_SITE_SYSTEM) dirsToRename.push(full);
        await walk(full);
      }
    }
  }
  await walk(root);
  dirsToRename.sort((a, b) => b.length - a.length);
  for (const dir of dirsToRename) {
    await rename(dir, join(dirname(dir), siteSystem));
  }

  for (const file of await walkFiles(root)) {
    const base = file.split(/[/\\]/).pop();
    if (base === `${TEMPLATE_SITE_SYSTEM}.yml`) {
      await rename(file, join(dirname(file), `${siteSystem}.yml`));
    }
  }
}

async function resolveCollectionFolder(collectionInput) {
  const itemsRoot = join(REPO_ROOT, 'authoring', 'items');
  const direct = join(itemsRoot, collectionInput.trim());
  try {
    await access(direct);
    return direct;
  } catch {
    // fall through
  }

  for (const ent of await readdir(itemsRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const candidate = join(itemsRoot, ent.name);
    if (toSystemName(ent.name) === toSystemName(collectionInput)) return candidate;
  }

  throw new Error(`Collection folder not found for "${collectionInput}". Expected authoring/items/{Collection Name}/`);
}

async function findCollectionModulePath(collectionFolder, collectionSystem) {
  const direct = join(collectionFolder, `${collectionSystem}.module.json`);
  await access(direct);
  return direct;
}

const COLLECTION_SERIALIZED_DIRS = new Set([
  'templates',
  'branches',
  'renderings',
  'placeholder-settings',
  'project-settings',
  'media-library',
  'collection',
]);

async function readTenantId(collectionFolder, collectionSystem) {
  const tenantFile = join(collectionFolder, 'serialized-content', 'collection', `${collectionSystem}.yml`);
  try {
    await access(tenantFile);
    const content = await readFile(tenantFile, 'utf8');
    const parsed = extractPathAndId(content);
    if (parsed) return parsed.id;
  } catch {
    // tenant YAML removed after first site — resolve from an existing site root
  }

  const serializedRoot = join(collectionFolder, 'serialized-content');
  for (const ent of await readdir(serializedRoot, { withFileTypes: true })) {
    if (!ent.isDirectory() || COLLECTION_SERIALIZED_DIRS.has(ent.name) || ent.name.startsWith('.staging-')) {
      continue;
    }
    const siteRootYaml = join(serializedRoot, ent.name, `${ent.name}.yml`);
    try {
      const content = await readFile(siteRootYaml, 'utf8');
      const parentMatch = content.match(/^Parent: "([0-9a-fA-F-]{36})"/m);
      if (parentMatch) return parentMatch[1].toLowerCase();
    } catch {
      // not a site folder
    }
  }

  throw new Error(
    `Could not resolve tenant ID for ${collectionSystem}. Push the collection to CM before adding sites, or ensure serialized-content/collection/${collectionSystem}.yml exists.`,
  );
}

function isCollectionInclude(include, collectionSystem) {
  const path = include.path?.replace(/\/$/, '') ?? '';
  const isCollectionName = include.name === 'collection' || include.name === 'site';
  return isCollectionName && path === `/sitecore/content/${collectionSystem}`;
}

function ensureCollectionInclude(includes, collectionSystem) {
  if (includes.some((include) => isCollectionInclude(include, collectionSystem))) return;
  includes.push({
    name: 'collection',
    path: `/sitecore/content/${collectionSystem}/`,
    allowedPushOperations: 'CreateUpdateAndDelete',
    scope: 'SingleItem',
  });
}

async function removeStraySiteTemplateFolder(collectionFolder) {
  await rm(join(collectionFolder, 'site'), { recursive: true, force: true });
}

function hasSiteInclude(includes, siteSystem, collectionSystem) {
  return includes.some((include) => include.path === `/sitecore/content/${collectionSystem}/${siteSystem}`);
}

async function buildSiteInclude(siteDisplay, siteSystem, collectionSystem) {
  const template = await readFile(SITE_INCLUDE_TEMPLATE, 'utf8');
  const parsed = JSON.parse(
    applyNameTokens(template, siteDisplay, siteSystem, 'New Collection', collectionSystem),
  );
  parsed.name = siteSystem;
  parsed.path = `/sitecore/content/${collectionSystem}/${siteSystem}`;
  return parsed;
}

async function updateCollectionModule(modulePath, collectionFolder, siteDisplay, siteSystem, collectionSystem) {
  const module = JSON.parse(await readFile(modulePath, 'utf8'));
  const includes = module.items.includes;
  if (hasSiteInclude(includes, siteSystem, collectionSystem)) {
    throw new Error(`Site include already exists in collection module: ${siteSystem}`);
  }

  const siteInclude = await buildSiteInclude(siteDisplay, siteSystem, collectionSystem);
  ensureCollectionInclude(includes, collectionSystem);
  await removeStraySiteTemplateFolder(collectionFolder);
  includes.push(siteInclude);

  await writeFile(modulePath, `${JSON.stringify(module, null, 2)}\n`, 'utf8');
}

function setHintGuidValue(content, hint, guidLower) {
  const braced = `{${guidLower.toUpperCase()}}`;
  const re = new RegExp(
    `(- ID: "[^"]+"\\r?\\n  Hint: ${hint}\\r?\\n  Value: )"\\{[0-9A-Fa-f-]+\\}"`,
    'g',
  );
  return content.replace(re, `$1"${braced}"`);
}

function setAdditionalChildrenFirstGuid(content, guidLower) {
  const braced = `{${guidLower.toUpperCase()}}`;
  return content.replace(
    /(Hint: AdditionalChildren\r?\n  Value: \|\r?\n\s+)\{[0-9A-Fa-f-]+\}/,
    `$1${braced}`,
  );
}

async function wireSiteMediaLibraryReferences(outSiteDir, outMediaSiteYml, siteSystem) {
  const mediaContent = await readFile(outMediaSiteYml, 'utf8');
  const parsed = extractPathAndId(mediaContent);
  if (!parsed) throw new Error(`Could not read site media library ID from ${outMediaSiteYml}`);

  const mediaId = parsed.id;
  const siteRootPath = join(outSiteDir, `${siteSystem}.yml`);
  let siteRoot = await readFile(siteRootPath, 'utf8');
  siteRoot = setHintGuidValue(siteRoot, 'SiteMediaLibrary', mediaId);
  await writeFile(siteRootPath, siteRoot, 'utf8');

  const mediaYamlPath = join(outSiteDir, siteSystem, 'Media.yml');
  let mediaYaml = await readFile(mediaYamlPath, 'utf8');
  mediaYaml = setAdditionalChildrenFirstGuid(mediaYaml, mediaId);
  await writeFile(mediaYamlPath, mediaYaml, 'utf8');

  const groupingPath = join(outSiteDir, siteSystem, 'Settings', 'Site Grouping', `${siteSystem}.yml`);
  let grouping = await readFile(groupingPath, 'utf8');
  grouping = setHintGuidValue(grouping, 'ThumbnailsRootPath', mediaId);
  await writeFile(groupingPath, grouping, 'utf8');

  console.log(`SiteMediaLibrary wired to: ${relative(REPO_ROOT, outMediaSiteYml)} (${mediaId})`);
}

async function verifyRequiredFiles(serializedRoot, siteSystem, collectionSystem) {
  const required = [
    join(serializedRoot, siteSystem, `${siteSystem}.yml`),
    join(serializedRoot, siteSystem, siteSystem, 'Home.yml'),
    join(serializedRoot, siteSystem, siteSystem, 'Settings', 'Site Grouping', `${siteSystem}.yml`),
    join(serializedRoot, 'media-library', collectionSystem, `${siteSystem}.yml`),
  ];
  const missing = [];
  for (const file of required) {
    try {
      await access(file);
    } catch {
      missing.push(relative(serializedRoot, file));
    }
  }
  if (missing.length) {
    throw new Error(`Missing required site files:\n  ${missing.join('\n  ')}`);
  }
}

async function main() {
  const { siteName, collection, dryRun } = parseArgs(process.argv);
  const siteDisplay = siteName.trim();
  const siteSystem = toSystemName(siteDisplay);
  const collectionDisplay = collection.trim();
  const collectionSystem = toSystemName(collectionDisplay);

  if (!siteSystem || !collectionSystem) {
    console.error('Could not derive system names from display names.');
    process.exit(1);
  }

  const collectionFolder = await resolveCollectionFolder(collectionDisplay);
  const collectionFolderName = collectionFolder.split(/[/\\]/).pop();
  const serializedRoot = join(collectionFolder, 'serialized-content');
  const outSiteDir = join(serializedRoot, siteSystem);
  const outMediaRoot = join(serializedRoot, 'media-library', collectionSystem);
  const outMediaSiteYml = join(outMediaRoot, `${siteSystem}.yml`);
  const outMediaSiteDir = join(outMediaRoot, siteSystem);
  const collectionModulePath = await findCollectionModulePath(collectionFolder, collectionSystem);
  const collectionNamespace = `${collectionSystem}-scs`;

  console.log(`Site display name:       ${siteDisplay}`);
  console.log(`Site system name:        ${siteSystem}`);
  console.log(`Collection:            ${collectionFolderName} (${collectionSystem})`);
  console.log(`Site content folder:   ${outSiteDir}`);
  console.log(`Collection module:     ${collectionModulePath}`);

  if (dryRun) {
    console.log('Dry run — no files written.');
    return;
  }

  try {
    await access(outSiteDir);
    console.error(`Site folder already exists: ${outSiteDir}`);
    process.exit(1);
  } catch {
    // ok
  }

  const templateSerializedRoot = await firstExisting([
    join(REPO_ROOT, 'authoring', 'items', 'New Collection', 'serialized-content'),
    COLLECTION_TEMPLATES_ROOT,
  ]);
  const bridge = await buildCollectionBridge(
    templateSerializedRoot,
    serializedRoot,
    TEMPLATE_COLLECTION_SYSTEM,
    collectionSystem,
  );
  const tenantId = await readTenantId(collectionFolder, collectionSystem);
  console.log(`Collection ID bridge:  ${bridge.size} mapped IDs`);
  console.log(`Tenant root ID:        ${tenantId}`);

  await mkdir(serializedRoot, { recursive: true });
  const stagingDir = join(serializedRoot, `.staging-${siteSystem}`);
  await cp(join(TEMPLATES_ROOT, 'new-site'), stagingDir, { recursive: true });
  await renameNewSitePaths(stagingDir, siteSystem);
  await rename(stagingDir, outSiteDir);

  await mkdir(outMediaRoot, { recursive: true });
  await cp(join(TEMPLATES_ROOT, 'media-library', 'new-collection', 'new-site.yml'), outMediaSiteYml);
  await cp(join(TEMPLATES_ROOT, 'media-library', 'new-collection', 'new-site'), outMediaSiteDir, {
    recursive: true,
  });
  await renameNewSitePaths(outMediaSiteDir, siteSystem);

  const files = [
    ...(await walkFiles(outSiteDir)).filter((f) => f.endsWith('.yml')),
    ...(await walkFiles(outMediaSiteDir)).filter((f) => f.endsWith('.yml')),
    outMediaSiteYml,
  ];

  const siteIds = new Set();
  const contents = new Map();
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    contents.set(file, text);
    for (const id of collectItemIds(text)) siteIds.add(id);
  }

  const siteIdMap = buildIdMap(siteIds);
  const combinedMap = new Map([...bridge, ...siteIdMap]);
  console.log(`Remapping ${siteIdMap.size} site item IDs to new GUIDs.`);

  for (const [file, text] of contents) {
    let next = applyNameTokens(text, siteDisplay, siteSystem, collectionFolderName, collectionSystem);
    next = replaceGuids(next, combinedMap);
    await writeFile(file, next, 'utf8');
  }

  const siteRootYaml = join(outSiteDir, `${siteSystem}.yml`);
  let rootContent = await readFile(siteRootYaml, 'utf8');
  rootContent = rootContent.replace(/^Parent: "[0-9a-fA-F-]{36}"/m, `Parent: "${tenantId}"`);
  await writeFile(siteRootYaml, rootContent, 'utf8');

  await wireSiteMediaLibraryReferences(outSiteDir, outMediaSiteYml, siteSystem);

  await updateCollectionModule(collectionModulePath, collectionFolder, siteDisplay, siteSystem, collectionSystem);
  await verifyRequiredFiles(serializedRoot, siteSystem, collectionSystem);

  try {
    execSync(`dotnet sitecore serialization validate --fix -i ${collectionNamespace}`, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
  } catch {
    console.warn('Validation reported issues — review output above.');
  }

  console.log('\nGenerated site YAML (local files only — not yet in Sitecore CM):');
  console.log(`  ${relative(REPO_ROOT, outSiteDir)}`);
  console.log(`  ${relative(REPO_ROOT, outMediaSiteDir)}`);
  console.log(`  Updated ${relative(REPO_ROOT, collectionModulePath)}`);
  console.log('\nNext steps:');
  console.log(`  1. Review generated YAML under serialized-content/${siteSystem}/`);
  console.log(`  2. Push to Sitecore CM: dotnet sitecore serialization push -n production -i ${collectionNamespace}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
