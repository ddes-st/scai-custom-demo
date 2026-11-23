/**
 * Media-folder ID resolve — thin re-export of shared path-identity helper.
 */
export {
  bracedGuidFieldValue as bracedMediaLibraryFieldValue,
  clearItemIdByPathCmCache as clearMediaFolderCmIdCache,
  resolveItemIdByPath as resolveMediaFolderId,
  type ResolveItemIdByPathOptions as ResolveMediaFolderIdOptions,
  type ResolveItemIdByPathResult as ResolveMediaFolderIdResult,
} from "./resolve-item-id-by-path";
