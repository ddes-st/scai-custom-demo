/**
 * @deprecated Import from `./section-registry-paths.mjs` instead.
 * Re-exports for backward compatibility.
 */
export {
  SECTION_REGISTRY_DIR,
  SECTION_REGISTRY_AI_DIR,
  SECTION_REGISTRY_DIR as SHARED_SECTIONS_DIR,
  SECTION_REGISTRY_AI_DIR as SHARED_SECTIONS_AI_DIR,
  LEGACY_SHARED_SECTIONS_DIR,
  LEGACY_SHARED_SECTIONS_AI_DIR,
  LEGACY_SECTIONS_DIR as LEGACY_SHARED_SECTIONS_DIR_OLDEST,
  HOST_NON_PAGE_DIRS,
  folderNameFromCmsName,
  resolveSectionRegistryRoot,
  resolveSectionRegistryRoot as resolveSharedSectionsRoot,
  resolveSectionRegistryAiRoot,
  resolveSectionRegistryAiRoot as resolveSharedSectionsAiRoot,
  sectionRegistryRootPath,
  sectionRegistryRootPath as sharedSectionsRootPath,
  registryComponentDir,
  registryComponentDir as sharedComponentDir,
  registryPath,
  registryPath as sharedRegistryPath,
  pageSectionSourcePath,
  resolveRegistryInstanceDir,
  getRegistrySection,
  isHostNonPageDir,
} from './section-registry-paths.mjs';
