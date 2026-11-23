#!/usr/bin/env node
/**
 * Generates Sitecore rendering + template branch YAML for a headless Next.js component.
 * Does NOT create items in Sitecore CM — run dotnet sitecore serialization push after generation.
 *
 * Usage:
 *   node .cursor/skills/sitecore-yaml/generators/sitecore-new-rendering-yaml/scripts/Generate-SitecoreRendering.mjs "ComponentName" --collection "Collection Display Name"
 *   node ...Generate-SitecoreRendering.mjs "ComponentName" --collection "Company Name" --fields fields.json
 */
import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(__dirname, '..');
const TEMPLATES_ROOT = join(SKILL_ROOT, 'templates');
const REPO_ROOT = process.cwd();

const TEMPLATE_COMPONENT = 'NewComponent';
const TEMPLATE_BRANCH = 'NewComponent Templates';
const TEMPLATE_COLLECTION = 'new-collection';

const UUID_RE =
  /\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}?/g;

const FIELD_DEF_TEMPLATE = '455a3e98-a627-4b40-8035-e683a0331ac7';
const DATA_SECTION_TEMPLATE = 'e269fbb5-3750-427a-9149-7aa950b49301';

const PLACEHOLDER_IDS = {
  branch: 'a1000002-0002-4000-8000-000000000002',
  datasource: 'a1000003-0003-4000-8000-000000000003',
  dataSection: 'a1000004-0004-4000-8000-000000000004',
  datasourceStdValues: 'a1000005-0005-4000-8000-000000000005',
  folder: 'a1000006-0006-4000-8000-000000000006',
  folderStdValues: 'a1000007-0007-4000-8000-000000000007',
  parameters: 'a1000008-0008-4000-8000-000000000008',
  parametersStdValues: 'a1000009-0009-4000-8000-000000000009',
  rendering: 'a1000001-0001-4000-8000-000000000001',
};

function parseArgs(argv) {
  const args = { dryRun: false, collection: null, componentName: null, fieldsPath: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--collection') args.collection = argv[++i];
    else if (argv[i] === '--fields') args.fieldsPath = argv[++i];
    else if (!argv[i].startsWith('--')) args.componentName = argv[i];
  }
  if (!args.componentName || !args.collection) {
    console.error(
      'Usage: node Generate-SitecoreRendering.mjs "ComponentName" --collection "Collection Display Name" [--fields fields.json] [--dry-run]',
    );
    process.exit(1);
  }
  if (!/^[A-Z][A-Za-z0-9]*$/.test(args.componentName)) {
    console.error('Component name must be PascalCase (e.g. CookieBanner, FullBleedHeroBannerSection).');
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

function pluralComponentName(name) {
  return `${name}s`;
}

async function walkFiles(dir, acc = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) await walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

async function findCollectionSystem(collectionFolder) {
  for (const name of await readdir(collectionFolder)) {
    if (name.endsWith('.module.json')) return name.replace(/\.module\.json$/, '');
  }
  throw new Error(`No *.module.json found in ${collectionFolder}`);
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
    if (toSystemName(ent.name) === toSystemName(collectionInput)) {
      return join(itemsRoot, ent.name);
    }
  }
  throw new Error(`Collection folder not found for "${collectionInput}". Expected authoring/items/{Collection}/`);
}

async function readYamlItemId(filePath) {
  const text = await readFile(filePath, 'utf8');
  const m = text.match(/^ID: "([0-9a-fA-F-]{36})"/m);
  if (!m) throw new Error(`Could not read ID from ${filePath}`);
  return m[1].toLowerCase();
}

async function readCollectionBridgeIds(collectionFolder, collectionSystem) {
  const root = join(collectionFolder, 'serialized-content');
  return {
    templatesProject: await readYamlItemId(join(root, 'templates', `${collectionSystem}.yml`)),
    renderingsFolder: await readYamlItemId(join(root, 'renderings', `${collectionSystem}.yml`)),
    projectSettingsFolder: await readYamlItemId(
      join(root, 'project-settings', collectionSystem, `${collectionSystem}.yml`),
    ),
  };
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
    if (hadBrace) return `{${next.toUpperCase()}}`;
    return next;
  });
}

function applyPathTokens(relativePath, componentName, branchName, collectionSystem) {
  let path = relativePath;
  path = path.replaceAll(`${TEMPLATE_BRANCH}.yml`, `${branchName}.yml`);
  path = path.replaceAll(`${TEMPLATE_BRANCH}/`, `${branchName}/`);
  path = path.replaceAll(`${TEMPLATE_BRANCH}\\`, `${branchName}\\`);
  path = path.replaceAll(`${TEMPLATE_COMPONENT} Folder`, `${componentName} Folder`);
  path = path.replaceAll(`${TEMPLATE_COMPONENT} Parameters`, `${componentName} Parameters`);
  path = path.replaceAll(`${TEMPLATE_COMPONENT}/`, `${componentName}/`);
  path = path.replaceAll(`${TEMPLATE_COMPONENT}\\`, `${componentName}\\`);
  path = path.replaceAll(`${TEMPLATE_COMPONENT}.yml`, `${componentName}.yml`);
  path = path.replaceAll(
    `Add ${pluralComponentName(TEMPLATE_COMPONENT)} Data Item.yml`,
    `Add ${pluralComponentName(componentName)} Data Item.yml`,
  );
  path = path.replaceAll(TEMPLATE_COLLECTION, collectionSystem);
  return path;
}

function applyContentTokens(text, componentName, branchName, collectionSystem, bridge) {
  const plural = pluralComponentName(componentName);
  return text
    .replaceAll(TEMPLATE_COMPONENT, componentName)
    .replaceAll(TEMPLATE_BRANCH, branchName)
    .replaceAll(TEMPLATE_COLLECTION, collectionSystem)
    .replaceAll('Add NewComponents Data Item', `Add ${plural} Data Item`)
    .replaceAll('__COLLECTION_TEMPLATES_PROJECT_ID__', bridge.templatesProject)
    .replaceAll('__COLLECTION_RENDERINGS_FOLDER_ID__', bridge.renderingsFolder)
    .replaceAll('__COLLECTION_PROJECT_SETTINGS_FOLDER_ID__', bridge.projectSettingsFolder)
    .replaceAll('{TEMPLATE_DATASOURCE_ID}', `{${PLACEHOLDER_IDS.datasource.toUpperCase()}}`)
    .replaceAll('{TEMPLATE_FOLDER_ID}', `{${PLACEHOLDER_IDS.folder.toUpperCase()}}`)
    .replaceAll('{TEMPLATE_DATASOURCE_STDVALUES_ID}', `{${PLACEHOLDER_IDS.datasourceStdValues.toUpperCase()}}`)
    .replaceAll('{TEMPLATE_FOLDER_STDVALUES_ID}', `{${PLACEHOLDER_IDS.folderStdValues.toUpperCase()}}`)
    .replaceAll('{TEMPLATE_PARAMETERS_ID}', `{${PLACEHOLDER_IDS.parameters.toUpperCase()}}`)
    .replaceAll('{TEMPLATE_PARAMETERS_STDVALUES_ID}', `{${PLACEHOLDER_IDS.parametersStdValues.toUpperCase()}}`);
}

function buildFieldYaml({ name, title, type, sort, parentId, collectionSystem, branchName, componentName, sectionName }) {
  const fieldId = randomUUID().toLowerCase();
  const path = `/sitecore/templates/Project/${collectionSystem}/${branchName}/${componentName}/${sectionName}/${name}`;
  return {
    id: fieldId,
    yaml: `---
ID: "${fieldId}"
Parent: "${parentId}"
Template: "${FIELD_DEF_TEMPLATE}"
Path: "${path}"
SharedFields:
- ID: "ab162cc0-dc80-4abf-8871-998ee5d7ba32"
  Hint: Type
  Value: "${type}"
- ID: "ba3f86a2-4a1c-4d78-b63d-91c2779c1b5e"
  Hint: __Sortorder
  Value: ${sort}
Languages:
- Language: en
  Fields:
  - ID: "19a69332-a23e-4e70-8d16-b2640cb24cc8"
    Hint: Title
    Value: ${title}
  Versions:
  - Version: 1
    Fields:
    - ID: "25bed78c-4957-4165-998a-ca1b52f67497"
      Hint: __Created
      Value: 20260101T120000Z
    - ID: "5dd74568-4d4b-44c1-b513-0af5f4cda34f"
      Hint: __Created by
      Value: |
        sitecore\\Admin
`,
  };
}

function buildSectionYaml({ name, parentId, collectionSystem, branchName, componentName }) {
  const sectionId = randomUUID().toLowerCase();
  const path = `/sitecore/templates/Project/${collectionSystem}/${branchName}/${componentName}/${name}`;
  return {
    id: sectionId,
    yaml: `---
ID: "${sectionId}"
Parent: "${parentId}"
Template: "${DATA_SECTION_TEMPLATE}"
Path: "${path}"
SharedFields:
- ID: "06d5295c-ed2f-4a54-9bf2-26228d113318"
  Hint: __Icon
  Value: Office/32x32/window_dialog.png
Languages:
- Language: en
  Versions:
  - Version: 1
    Fields:
    - ID: "25bed78c-4957-4165-998a-ca1b52f67497"
      Hint: __Created
      Value: 20260101T120000Z
    - ID: "5dd74568-4d4b-44c1-b513-0af5f4cda34f"
      Hint: __Created by
      Value: |
        sitecore\\Admin
`,
  };
}

async function loadFieldsSpec(fieldsPath) {
  const raw = JSON.parse(await readFile(fieldsPath, 'utf8'));
  if (Array.isArray(raw)) return { sections: [{ name: 'Data', fields: raw }] };
  if (raw.sections) return raw;
  if (raw.fields) return { sections: [{ name: 'Data', fields: raw.fields }] };
  throw new Error('fields.json must be an array, or { fields: [...] }, or { sections: [{ name, fields }] }');
}

async function main() {
  const { componentName, collection, fieldsPath, dryRun } = parseArgs(process.argv);
  const collectionFolder = await resolveCollectionFolder(collection);
  const collectionFolderName = collectionFolder.split(/[/\\]/).pop();
  const collectionSystem = await findCollectionSystem(collectionFolder);
  const branchName = `${componentName} Templates`;
  const serializedRoot = join(collectionFolder, 'serialized-content');
  const namespace = `${collectionSystem}-scs`;

  const renderingOut = join(serializedRoot, 'renderings', collectionSystem, `${componentName}.yml`);
  try {
    await access(renderingOut);
    throw new Error(`Rendering already exists: ${relative(REPO_ROOT, renderingOut)}`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const bridge = await readCollectionBridgeIds(collectionFolder, collectionSystem);

  console.log(`Component:             ${componentName}`);
  console.log(`Template branch:       ${branchName}`);
  console.log(`Collection:            ${collectionFolderName} (${collectionSystem})`);
  console.log(`SCS namespace:         ${namespace}`);

  if (dryRun) {
    console.log('Dry run — no files written.');
    return;
  }

  const templateFiles = await walkFiles(TEMPLATES_ROOT);
  const staged = [];

  for (const src of templateFiles) {
    if (!src.endsWith('.yml')) continue;
    const rel = relative(TEMPLATES_ROOT, src);
    const destRel = applyPathTokens(rel, componentName, branchName, collectionSystem);
    let content = await readFile(src, 'utf8');
    content = applyContentTokens(content, componentName, branchName, collectionSystem, bridge);
    staged.push({ destRel, content });
  }

  const allIds = new Set();
  for (const { content } of staged) {
    for (const id of collectItemIds(content)) allIds.add(id);
  }

  const idMap = buildIdMap(allIds);
  console.log(`Remapping ${idMap.size} component item IDs to new GUIDs.`);

  for (const entry of staged) {
    entry.content = replaceGuids(entry.content, idMap);
    const destParts = entry.destRel.split(/[/\\]/);
    const outPath = join(serializedRoot, ...destParts);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, entry.content, 'utf8');
  }

  if (fieldsPath) {
    const spec = await loadFieldsSpec(fieldsPath);
    const datasourceId = idMap.get(PLACEHOLDER_IDS.datasource);
    const defaultDataSectionId = idMap.get(PLACEHOLDER_IDS.dataSection);
    const sectionIds = new Map([['Data', defaultDataSectionId]]);

    for (const section of spec.sections) {
      if (section.name === 'Data') continue;
      const built = buildSectionYaml({
        name: section.name,
        parentId: datasourceId,
        collectionSystem,
        branchName,
        componentName,
      });
      sectionIds.set(section.name, built.id);
      const sectionYml = join(
        serializedRoot,
        'templates',
        collectionSystem,
        branchName,
        componentName,
        `${section.name}.yml`,
      );
      await mkdir(dirname(sectionYml), { recursive: true });
      await writeFile(sectionYml, built.yaml, 'utf8');
    }

    let sort = 100;
    for (const section of spec.sections) {
      const parentId = sectionIds.get(section.name);
      const sectionDir = join(
        serializedRoot,
        'templates',
        collectionSystem,
        branchName,
        componentName,
        section.name,
      );
      await mkdir(sectionDir, { recursive: true });
      for (const field of section.fields) {
        const built = buildFieldYaml({
          name: field.name,
          title: field.title ?? field.name,
          type: field.type ?? 'Single-Line Text',
          sort: field.sort ?? sort,
          parentId,
          collectionSystem,
          branchName,
          componentName,
          sectionName: section.name,
        });
        sort += 100;
        await writeFile(join(sectionDir, `${field.name}.yml`), built.yaml, 'utf8');
      }
    }
    console.log(`Added fields from ${fieldsPath}`);
  }

  try {
    execSync(`dotnet sitecore serialization validate --fix -i ${namespace}`, {
      cwd: collectionFolder,
      stdio: 'inherit',
    });
  } catch {
    console.warn('Validation reported issues — review output above.');
  }

  console.log('\nGenerated rendering YAML (local files only — not yet in Sitecore CM):');
  console.log(`  ${relative(REPO_ROOT, join(serializedRoot, 'renderings', collectionSystem, `${componentName}.yml`))}`);
  console.log(`  ${relative(REPO_ROOT, join(serializedRoot, 'templates', collectionSystem, `${branchName}.yml`))}`);
  console.log(`  ${relative(REPO_ROOT, join(serializedRoot, 'project-settings', collectionSystem, collectionSystem, `Add ${pluralComponentName(componentName)} Data Item.yml`))}`);
  console.log('\nNext steps:');
  console.log('  1. Add template fields under Data/ (or pass --fields fields.json)');
  console.log('  2. Register TSX in component-map with matching componentName');
  console.log(`  3. Push: dotnet sitecore serialization push -n production -i ${namespace}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
