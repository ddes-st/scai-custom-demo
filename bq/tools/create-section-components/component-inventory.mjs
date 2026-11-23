/**
 * Host-level component inventory for create:sectioncomponents.
 * Written after section-registry merge; drives Phase A codegen.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SECTION_REGISTRY_DIR } from '../capture/lib/section-registry-paths.mjs';

export const COMPONENT_INVENTORY_FILE = 'component-inventory.json';

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function componentInventoryPath(projectRoot) {
  return path.join(projectRoot, COMPONENT_INVENTORY_FILE);
}

/**
 * Build inventory entries from the merge globalManifest.
 *
 * @param {{
 *   projectRoot: string,
 *   globalManifest: object,
 * }} opts
 * @returns {object}
 */
export function buildComponentInventory(opts) {
  const { projectRoot, globalManifest } = opts;
  const components = globalManifest?.components || {};
  /** @type {object[]} */
  const entries = [];

  for (const [id, entry] of Object.entries(components)) {
    const folderName = entry.folderName || id;
    const instances = Array.isArray(entry.instances) ? entry.instances : [];
    const canonical =
      entry.canonicalRef ||
      (instances.length
        ? {
            pageSlug: instances[0].pageSlug,
            sectionFolder: instances[0].sectionFolder,
            sourcePath: instances[0].sourcePath,
          }
        : null);

    entries.push({
      id,
      folderName,
      pageRole: entry.pageRole || entry.enrichStructurePayload?.pageRole || 'page',
      status: entry.definitionKey ? 'package-exists' : 'needs-codegen',
      definitionKey: entry.definitionKey || null,
      componentName: entry.componentName || null,
      contentHash: entry.contentHash || null,
      structureFingerprint: entry.structureFingerprint || null,
      contentFamilyId: entry.contentFamilyId || null,
      referenceTypeKeys: Array.isArray(entry.referenceTypeKeys)
        ? entry.referenceTypeKeys
        : [],
      canonicalEvidence: canonical
        ? {
            pageSlug: canonical.pageSlug || null,
            sectionFolder: canonical.sectionFolder || null,
            sourcePath:
              canonical.sourcePath ||
              (canonical.pageSlug && canonical.sectionFolder
                ? `${canonical.pageSlug}/sections/${canonical.sectionFolder}`
                : null),
          }
        : null,
      instances: instances.map((inst) => ({
        pageSlug: inst.pageSlug || null,
        sectionFolder: inst.sectionFolder || null,
        contentHash: inst.contentHash || null,
        pageRole: inst.pageRole || entry.pageRole || 'page',
        sourcePath: inst.sourcePath || null,
      })),
      registryPath: `${SECTION_REGISTRY_DIR}/${folderName}`,
    });
  }

  entries.sort((a, b) =>
    String(a.folderName).localeCompare(String(b.folderName)),
  );

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    projectRoot,
    host: globalManifest?.host || path.basename(projectRoot),
    stats: {
      uniqueComponents: entries.length,
      needsCodegen: entries.filter((e) => e.status === 'needs-codegen').length,
      packageExists: entries.filter((e) => e.status === 'package-exists').length,
    },
    components: entries,
  };
}

/**
 * @param {string} projectRoot
 * @param {object} globalManifest
 * @returns {Promise<object>}
 */
export async function writeComponentInventory(projectRoot, globalManifest) {
  const inventory = buildComponentInventory({ projectRoot, globalManifest });
  const outPath = componentInventoryPath(projectRoot);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  return inventory;
}

/**
 * @param {string} projectRoot
 * @returns {Promise<object|null>}
 */
export async function loadComponentInventory(projectRoot) {
  try {
    const raw = await readFile(componentInventoryPath(projectRoot), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Stamp definitionKey / status / referenceTypeKeys onto an inventory entry.
 *
 * @param {string} projectRoot
 * @param {{
 *   folderName: string,
 *   definitionKey?: string|null,
 *   componentName?: string|null,
 *   status?: string,
 *   referenceTypeKeys?: string[],
 * }} patch
 * @returns {Promise<object|null>}
 */
export async function patchComponentInventoryEntry(projectRoot, patch) {
  const inventory = await loadComponentInventory(projectRoot);
  if (!inventory?.components) return null;
  const folder = String(patch.folderName || '').trim();
  const entry = inventory.components.find((c) => c.folderName === folder);
  if (!entry) return inventory;
  if (patch.definitionKey != null) entry.definitionKey = patch.definitionKey;
  if (patch.componentName != null) entry.componentName = patch.componentName;
  if (patch.status) entry.status = patch.status;
  if (Array.isArray(patch.referenceTypeKeys)) {
    entry.referenceTypeKeys = patch.referenceTypeKeys;
  }
  inventory.updatedAt = new Date().toISOString();
  inventory.stats = {
    uniqueComponents: inventory.components.length,
    needsCodegen: inventory.components.filter((e) => e.status === 'needs-codegen')
      .length,
    packageExists: inventory.components.filter((e) => e.status === 'package-exists')
      .length,
  };
  await writeFile(
    componentInventoryPath(projectRoot),
    `${JSON.stringify(inventory, null, 2)}\n`,
    'utf8',
  );
  return inventory;
}

/**
 * Folder names that still need codegen according to inventory (fallback: all).
 * @param {object|null} inventory
 * @returns {string[]|null} null = use full registry list
 */
export function listInventoryFoldersNeedingCodegen(inventory) {
  if (!inventory?.components?.length) return null;
  return inventory.components
    .filter((c) => c.status === 'needs-codegen' || !c.definitionKey)
    .map((c) => c.folderName)
    .filter(Boolean);
}
