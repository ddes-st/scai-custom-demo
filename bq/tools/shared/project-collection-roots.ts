/**
 * Ensure collection project roots under Templates / Renderings / Media via Authoring.
 * Does not require local SCS YAML for the collection folder item.
 */
import { ensureItemByPath } from "./authoring-items";
import { findItemByPath } from "./cm-sibling-lookup";
import {
  getProjectRenderingsSitecorePath,
  getProjectTemplatesSitecorePath,
} from "./data-placement";
import { MEDIA_FOLDER_TEMPLATE, MEDIA_LIBRARY_PROJECT_ROOT_ID } from "./system-ids";

/**
 * Template Folder under `/sitecore/templates/Project` (XM Cloud / XP).
 * Observed on Project/{collection} serialization roots.
 */
export const PROJECT_TEMPLATES_FOLDER_TEMPLATE =
  "77157d54-90c8-4014-9b9e-540d24e71d03";

/**
 * Folder under `/sitecore/layout/Renderings/Project`.
 * Observed on Project/{collection} serialization roots.
 */
export const PROJECT_RENDERINGS_FOLDER_TEMPLATE =
  "840d4a46-5503-49ec-bf9d-bd090946c63d";

export type ProjectCollectionRootKind = "templates" | "renderings" | "media";

export type EnsureProjectCollectionRootOptions = {
  kind: ProjectCollectionRootKind;
  collectionSystem: string;
  endpointName?: string;
};

const ensuredThisRun = new Map<string, string>();

export function clearProjectCollectionRootCache(): void {
  ensuredThisRun.clear();
}

function cacheKey(kind: ProjectCollectionRootKind, collectionSystem: string): string {
  return `${kind}:${collectionSystem.trim().toLowerCase()}`;
}

function childSitecorePath(
  kind: ProjectCollectionRootKind,
  collectionSystem: string,
): string {
  const system = collectionSystem.trim();
  if (kind === "templates") return getProjectTemplatesSitecorePath(system);
  if (kind === "renderings") return getProjectRenderingsSitecorePath(system);
  return `/sitecore/media library/Project/${system}`;
}

function parentSitecorePath(kind: ProjectCollectionRootKind): string {
  if (kind === "templates") return "/sitecore/templates/Project";
  if (kind === "renderings") return "/sitecore/layout/Renderings/Project";
  return "/sitecore/media library/Project";
}

function folderTemplateId(kind: ProjectCollectionRootKind): string {
  if (kind === "templates") return PROJECT_TEMPLATES_FOLDER_TEMPLATE;
  if (kind === "renderings") return PROJECT_RENDERINGS_FOLDER_TEMPLATE;
  return MEDIA_FOLDER_TEMPLATE;
}

/**
 * Ensure `/sitecore/.../Project/{collectionSystem}` exists and return its CM id.
 */
export async function ensureProjectCollectionRootId(
  options: EnsureProjectCollectionRootOptions,
): Promise<string> {
  const collectionSystem = options.collectionSystem.trim();
  if (!collectionSystem) {
    throw new Error(
      "[bq:apply] ensureProjectCollectionRootId requires collectionSystem",
    );
  }

  const key = cacheKey(options.kind, collectionSystem);
  const cached = ensuredThisRun.get(key);
  if (cached) return cached;

  const sitecorePath = childSitecorePath(options.kind, collectionSystem);
  const existing = await findItemByPath({
    path: sitecorePath,
    endpointName: options.endpointName,
  });
  if (existing?.itemId) {
    ensuredThisRun.set(key, existing.itemId);
    return existing.itemId;
  }

  let parentId: string | undefined;
  if (options.kind === "media") {
    parentId = MEDIA_LIBRARY_PROJECT_ROOT_ID;
  } else {
    const parent = await findItemByPath({
      path: parentSitecorePath(options.kind),
      endpointName: options.endpointName,
    });
    parentId = parent?.itemId;
  }
  if (!parentId) {
    throw new Error(
      `[bq:apply] Missing Authoring parent for ${options.kind} project root ` +
        `(looked up ${parentSitecorePath(options.kind)}). Cannot ensure ${sitecorePath}.`,
    );
  }

  const ensured = await ensureItemByPath({
    path: sitecorePath,
    parentId,
    templateId: folderTemplateId(options.kind),
    name: collectionSystem,
    endpointName: options.endpointName,
  });
  ensuredThisRun.set(key, ensured.itemId);
  console.log(
    `[bq:apply] ${options.kind} collection root "${collectionSystem}" ` +
      `${ensured.created ? "created" : "ensured"} via Authoring (${ensured.itemId})`,
  );
  return ensured.itemId;
}
