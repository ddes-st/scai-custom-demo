/**
 * Host-level section registry paths under `.bq/captures/{host}/`.
 * Catalog of unique layout components (not "shared by every page").
 * Distinct from page-local `{pageSlug}/sections/section-NN/`.
 */
import { access, cp, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

/** Current registry folder at host root. */
export const SECTION_REGISTRY_DIR = 'section-registry';
/** Optional AI clustering registry. */
export const SECTION_REGISTRY_AI_DIR = 'section-registry-ai';
/** Previous registry name (renamed to section-registry/). */
export const LEGACY_SHARED_SECTIONS_DIR = 'shared-sections';
/** Previous AI registry name. */
export const LEGACY_SHARED_SECTIONS_AI_DIR = 'shared-sections-ai';
/** Oldest heuristic registry. */
export const LEGACY_SECTIONS_DIR = 'sections';
/** Oldest AI clustering registry. */
export const LEGACY_AI_SECTIONS_DIR = 'ai-sections';

/** @deprecated use SECTION_REGISTRY_DIR */
export const SHARED_SECTIONS_DIR = SECTION_REGISTRY_DIR;
/** @deprecated use SECTION_REGISTRY_AI_DIR */
export const SHARED_SECTIONS_AI_DIR = SECTION_REGISTRY_AI_DIR;

/** Host-root dirs that are not page captures. */
export const HOST_NON_PAGE_DIRS = new Set([
  SECTION_REGISTRY_DIR,
  SECTION_REGISTRY_AI_DIR,
  LEGACY_SHARED_SECTIONS_DIR,
  LEGACY_SHARED_SECTIONS_AI_DIR,
  LEGACY_SECTIONS_DIR,
  LEGACY_AI_SECTIONS_DIR,
  'sections2',
]);

/** Registry folder from cmsName (PascalCase → kebab). */
export function folderNameFromCmsName(cmsName) {
  return String(cmsName || 'Section')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function isNonEmptyDir(p) {
  try {
    if (!(await stat(p)).isDirectory()) return false;
    const names = await readdir(p);
    return names.length > 0;
  } catch {
    return false;
  }
}

/**
 * @param {string} from
 * @param {string} to
 * @param {string} labelFrom
 * @param {string} labelTo
 */
async function migrateDir(from, to, labelFrom, labelTo) {
  await mkdir(path.dirname(to), { recursive: true });
  try {
    await rename(from, to);
  } catch {
    await cp(from, to, { recursive: true, force: true });
    await rm(from, { recursive: true, force: true });
  }
  console.log(`  … migrated host registry ${labelFrom}/ → ${labelTo}/`);
}

/**
 * Resolve (and migrate legacy) host section-registry root.
 * Prefers section-registry/; migrates shared-sections/ then sections/.
 * @param {string} projectRoot
 * @returns {Promise<{ sectionRegistryRoot: string, sharedSectionsRoot: string, migratedFromLegacy: boolean }>}
 */
export async function resolveSectionRegistryRoot(projectRoot) {
  const registryRoot = path.join(projectRoot, SECTION_REGISTRY_DIR);
  const sharedLegacy = path.join(projectRoot, LEGACY_SHARED_SECTIONS_DIR);
  const oldestLegacy = path.join(projectRoot, LEGACY_SECTIONS_DIR);

  if (await isNonEmptyDir(registryRoot)) {
    return {
      sectionRegistryRoot: registryRoot,
      sharedSectionsRoot: registryRoot,
      migratedFromLegacy: false,
    };
  }

  if (await isNonEmptyDir(sharedLegacy)) {
    await migrateDir(
      sharedLegacy,
      registryRoot,
      LEGACY_SHARED_SECTIONS_DIR,
      SECTION_REGISTRY_DIR,
    );
    return {
      sectionRegistryRoot: registryRoot,
      sharedSectionsRoot: registryRoot,
      migratedFromLegacy: true,
    };
  }

  if (await isNonEmptyDir(oldestLegacy)) {
    await migrateDir(oldestLegacy, registryRoot, LEGACY_SECTIONS_DIR, SECTION_REGISTRY_DIR);
    return {
      sectionRegistryRoot: registryRoot,
      sharedSectionsRoot: registryRoot,
      migratedFromLegacy: true,
    };
  }

  await mkdir(registryRoot, { recursive: true });
  return {
    sectionRegistryRoot: registryRoot,
    sharedSectionsRoot: registryRoot,
    migratedFromLegacy: false,
  };
}

/** @deprecated use resolveSectionRegistryRoot */
export async function resolveSharedSectionsRoot(projectRoot) {
  return resolveSectionRegistryRoot(projectRoot);
}

/**
 * Resolve AI clustering registry root (section-registry-ai/).
 * @param {string} projectRoot
 */
export async function resolveSectionRegistryAiRoot(projectRoot) {
  const aiRoot = path.join(projectRoot, SECTION_REGISTRY_AI_DIR);
  const sharedAi = path.join(projectRoot, LEGACY_SHARED_SECTIONS_AI_DIR);
  const oldestAi = path.join(projectRoot, LEGACY_AI_SECTIONS_DIR);

  if (await isNonEmptyDir(aiRoot)) return aiRoot;

  if (await isNonEmptyDir(sharedAi)) {
    await migrateDir(
      sharedAi,
      aiRoot,
      LEGACY_SHARED_SECTIONS_AI_DIR,
      SECTION_REGISTRY_AI_DIR,
    );
    return aiRoot;
  }

  if (await isNonEmptyDir(oldestAi)) {
    await migrateDir(oldestAi, aiRoot, LEGACY_AI_SECTIONS_DIR, SECTION_REGISTRY_AI_DIR);
    return aiRoot;
  }

  return aiRoot;
}

/** @deprecated use resolveSectionRegistryAiRoot */
export async function resolveSharedSectionsAiRoot(projectRoot) {
  return resolveSectionRegistryAiRoot(projectRoot);
}

/**
 * @param {string} projectRoot
 */
export function sectionRegistryRootPath(projectRoot) {
  return path.join(projectRoot, SECTION_REGISTRY_DIR);
}

/** @deprecated */
export function sharedSectionsRootPath(projectRoot) {
  return sectionRegistryRootPath(projectRoot);
}

/**
 * @param {string} projectRoot
 * @param {string} componentFolder
 */
export function registryComponentDir(projectRoot, componentFolder) {
  return path.join(projectRoot, SECTION_REGISTRY_DIR, componentFolder);
}

/** @deprecated */
export function sharedComponentDir(projectRoot, componentFolder) {
  return registryComponentDir(projectRoot, componentFolder);
}

/**
 * Relative registry path from host root (posix).
 * @param {string} componentFolder
 */
export function registryPath(componentFolder) {
  return `${SECTION_REGISTRY_DIR}/${componentFolder}`;
}

/** @deprecated */
export function sharedRegistryPath(componentFolder) {
  return registryPath(componentFolder);
}

/**
 * Build a page-section sourcePath relative to host root.
 * @param {string} pageSlug
 * @param {string} sectionFolder
 */
export function pageSectionSourcePath(pageSlug, sectionFolder) {
  return `${pageSlug}/sections/${sectionFolder}`;
}

/**
 * Resolve an instances.json / canonicalRef entry to an absolute page section dir.
 * @param {string} projectRoot — host capture root
 * @param {{ sourcePath?: string, pageSlug?: string, sectionFolder?: string, sourceFolder?: string }} ref
 * @returns {string | null}
 */
export function resolveRegistryInstanceDir(projectRoot, ref) {
  if (!ref || !projectRoot) return null;
  const sourcePath = String(ref.sourcePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (sourcePath) {
    return path.join(projectRoot, ...sourcePath.split('/'));
  }
  const pageSlug = ref.pageSlug;
  const sectionFolder = ref.sectionFolder || ref.sourceFolder;
  if (pageSlug && sectionFolder) {
    return path.join(projectRoot, pageSlug, 'sections', sectionFolder);
  }
  return null;
}

/**
 * Read-compat: prefer registrySection, fall back to sharedSection.
 * @param {object | null | undefined} info
 */
export function getRegistrySection(info) {
  if (!info || typeof info !== 'object') return null;
  return info.registrySection || info.sharedSection || null;
}

/**
 * Whether a path looks like a host non-page directory name.
 * @param {string} name
 */
export function isHostNonPageDir(name) {
  return HOST_NON_PAGE_DIRS.has(name);
}
