#!/usr/bin/env node
/**
 * Generates collection serialization YAML on disk from skill templates.
 * Does NOT create items in Sitecore CM — run dotnet sitecore serialization push after generation.
 *
 * Usage: node .cursor/skills/sitecore-yaml/generators/sitecore-new-collection-yaml/scripts/Generate-SitecoreCollection.mjs "My Collection Name"
 *
 * Options:
 *   --folder "Display Folder Name"  Override authoring/items folder name (default: collection display name)
 *   --dry-run                       Print actions without writing files
 */
import { randomUUID, createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rename, rm, writeFile, access } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(__dirname, '..');
const TEMPLATES_ROOT = join(SKILL_ROOT, 'templates');
const REPO_ROOT = process.cwd();

const TEMPLATE_SYSTEM_NAME = 'new-collection';
const TEMPLATE_NAMESPACE = 'new-collection-scs';
const TEMPLATE_DISPLAY_NAME = 'New Collection';

const UUID_RE =
  /\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}?/g;

function parseArgs(argv) {
  const args = { dryRun: false, folder: null, name: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--folder') args.folder = argv[++i];
    else if (!argv[i].startsWith('--')) args.name = argv[i];
  }
  if (!args.name) {
    console.error('Usage: node Generate-SitecoreCollection.mjs "Collection Display Name" [--folder "Folder Name"] [--dry-run]');
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

function buildIdMap(allIds) {
  const map = new Map();
  for (const id of allIds) {
    map.set(id.toLowerCase(), randomUUID().toLowerCase());
  }
  return map;
}

function replaceGuids(text, idMap) {
  return text.replace(UUID_RE, (match) => {
    const bare = match.replace(/[{}]/g, '').toLowerCase();
    const next = idMap.get(bare);
    if (!next) return match;
    const hadBrace = match.startsWith('{') || match.endsWith('}');
    if (hadBrace) {
      const upper = next.toUpperCase();
      return `{${upper}}`;
    }
    return next;
  });
}

function applyNameTokens(text, displayName, systemName, namespace) {
  return text
    .replaceAll(TEMPLATE_DISPLAY_NAME, displayName)
    .replaceAll(TEMPLATE_NAMESPACE, namespace)
    .replaceAll(TEMPLATE_SYSTEM_NAME, systemName);
}

async function renameNewCollectionPaths(root, systemName) {
  const dirsToRename = [];
  async function walk(dir) {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === TEMPLATE_SYSTEM_NAME) dirsToRename.push(full);
        await walk(full);
      }
    }
  }
  await walk(root);
  dirsToRename.sort((a, b) => b.length - a.length);
  for (const dir of dirsToRename) {
    await rename(dir, join(dirname(dir), systemName));
  }

  const files = await walkFiles(root);
  for (const file of files) {
    const base = file.split(/[/\\]/).pop();
    if (base === `${TEMPLATE_SYSTEM_NAME}.yml` || base === `${TEMPLATE_SYSTEM_NAME}.json`) {
      await rename(file, join(dirname(file), `${systemName}${base.slice(TEMPLATE_SYSTEM_NAME.length)}`));
    }
  }
}

async function verifyRequiredFiles(outRoot, systemName) {
  const required = [
    join(outRoot, `${systemName}.module.json`),
    join(outRoot, 'serialized-content', 'templates', `${systemName}.yml`),
    join(outRoot, 'serialized-content', 'templates', systemName, 'Headless Tenant.yml'),
    join(outRoot, 'serialized-content', 'collection', `${systemName}.yml`),
    join(outRoot, 'serialized-content', 'branches', `${systemName}.yml`),
    join(outRoot, 'serialized-content', 'media-library', `${systemName}.yml`),
    join(outRoot, 'serialized-content', 'media-library', systemName, 'shared.yml'),
    join(outRoot, 'serialized-content', 'renderings', `${systemName}.yml`),
    join(outRoot, 'serialized-content', 'placeholder-settings', `${systemName}.yml`),
    join(outRoot, 'serialized-content', 'project-settings', `${systemName}.yml`),
    join(outRoot, 'serialized-content', 'project-settings', systemName, `${systemName}.yml`),
  ];
  const missing = [];
  for (const file of required) {
    try {
      await access(file);
    } catch {
      missing.push(relative(outRoot, file));
    }
  }
  if (missing.length) {
    throw new Error(`Missing required collection files:\n  ${missing.join('\n  ')}`);
  }
}

async function main() {
  const { name, folder, dryRun } = parseArgs(process.argv);
  const displayName = name.trim();
  const systemName = toSystemName(displayName);
  const namespace = `${systemName}-scs`;
  const folderName = folder?.trim() || displayName;
  const outRoot = join(REPO_ROOT, 'authoring', 'items', folderName);

  if (!systemName) {
    console.error('Could not derive system name from display name.');
    process.exit(1);
  }

  console.log(`Collection display name: ${displayName}`);
  console.log(`System name:           ${systemName}`);
  console.log(`SCS namespace:         ${namespace}`);
  console.log(`Output folder:         ${outRoot}`);

  if (dryRun) {
    console.log('Dry run — no files written.');
    return;
  }

  try {
    await readdir(outRoot);
    console.error(`Output folder already exists: ${outRoot}`);
    process.exit(1);
  } catch {
    // ok
  }

  await mkdir(outRoot, { recursive: true });
  await cp(join(TEMPLATES_ROOT, 'serialized-content'), join(outRoot, 'serialized-content'), {
    recursive: true,
  });
  await cp(join(TEMPLATES_ROOT, 'module.template.json'), join(outRoot, 'module.template.json'));

  const modulePath = join(outRoot, 'module.template.json');
  await rename(modulePath, join(outRoot, `${systemName}.module.json`));

  const serializedRoot = join(outRoot, 'serialized-content');
  await renameNewCollectionPaths(serializedRoot, systemName);

  const files = (await walkFiles(outRoot)).filter((f) => f.endsWith('.yml') || f.endsWith('.json'));
  const allIds = new Set();
  const contents = new Map();

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    contents.set(file, text);
    for (const id of collectItemIds(text)) allIds.add(id);
  }

  const idMap = buildIdMap(allIds);
  console.log(`Remapping ${idMap.size} collection item IDs to new GUIDs.`);

  for (const [file, text] of contents) {
    let next = applyNameTokens(text, displayName, systemName, namespace);
    next = replaceGuids(next, idMap);
    await writeFile(file, next, 'utf8');
  }

  await verifyRequiredFiles(outRoot, systemName);

  const moduleFile = join(outRoot, `${systemName}.module.json`);
  try {
    execSync(`dotnet sitecore serialization validate --fix -i ${namespace}`, {
      cwd: outRoot,
      stdio: 'inherit',
    });
  } catch {
    console.warn('Validation reported issues — review output above.');
  }

  console.log('\nGenerated collection YAML (local files only — not yet in Sitecore CM):');
  console.log(`  ${relative(REPO_ROOT, outRoot)}`);
  console.log(`  ${relative(REPO_ROOT, moduleFile)}`);
  console.log('\nNext steps:');
  console.log(`  1. Review generated YAML under authoring/items/${folderName}/serialized-content/`);
  console.log(`  2. Push to Sitecore CM: dotnet sitecore serialization push -n production -i ${namespace}`);
  console.log('  3. Generate site YAML: node .cursor/skills/sitecore-yaml/generators/sitecore-new-site-yaml/scripts/Generate-SitecoreSite.mjs "Site Name" --collection "{display name}"');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
