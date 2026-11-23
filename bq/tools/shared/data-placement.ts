import path from "node:path";
import { REPO_ROOT } from "./paths";
import {
  SITE_DATA_FOLDER_ID,
  SITE_HOME_ID,
} from "./system-ids";
import { getScope } from "./scopes";
import type { DataPlacement } from "../definitions/types";

/** Sitecore module folder under `authoring/items/`. */
export const BQ_DEMO_MODULE_NAME = "bq-demo";

/** Project collection system name (templates, renderings, media library). */
export const DEFAULT_PROJECT_COLLECTION = "build-quick-demos-and-proof-of-concepts";

/** Disk root for the bq-demo SCS module (`authoring/items/bq-demo/sai`). */
export function getSaiModuleDiskRoot(): string {
  return path.join(REPO_ROOT, "authoring", "items", BQ_DEMO_MODULE_NAME, "sai");
}

export type ResolvedDataPlacement = {
  /** Absolute disk directory for the placement root (Data or Home). */
  diskRoot: string;
  /** Sitecore path of the placement root (no trailing slash). */
  sitecorePath: string;
  /** Item ID of Data or Home. */
  rootItemId: string;
  /** Full folder segments under the site (includes Data/ or Home/). */
  folderFromSite: string[];
};

/** Optional override when content belongs to a non-default (non-bq-demo) site. */
export type DataPlacementSiteContext = {
  collectionSystem: string;
  siteSystem: string;
};

/** Disk root for a site content tree (`sites/content/{collection}/{site}/`). */
export function getSiteContentDiskRoot(
  collectionSystem: string,
  siteSystem: string,
): string {
  return path.join(
    getSaiModuleDiskRoot(),
    "sites",
    "content",
    collectionSystem,
    siteSystem,
  );
}

/**
 * Placeholder `rootItemId` for {@link resolveDataPlacementForSite}: never a real item id.
 * Callers must rebind Data/Home via `resolveItemIdByPath` (e.g. `prepareSiteContentFolder`).
 */
export const PROVISIONAL_SITE_ROOT_ITEM_ID =
  "00000000-0000-0000-0000-000000000000";

/**
 * Resolve `location` under a specific collection/site.
 * `rootItemId` is {@link PROVISIONAL_SITE_ROOT_ITEM_ID}; live root IDs come from
 * Authoring path lookup (callers must rebind via `resolveItemIdByPath`).
 */
export function resolveDataPlacementForSite(
  placement: DataPlacement,
  collectionSystem: string,
  siteSystem: string,
): ResolvedDataPlacement {
  const siteDisk = getSiteContentDiskRoot(collectionSystem, siteSystem);
  const rootSegment = placement.root === "home" ? "Home" : "Data";
  const sitecorePath = `/sitecore/content/${collectionSystem}/${siteSystem}/${rootSegment}`;
  return {
    diskRoot: path.join(siteDisk, rootSegment),
    sitecorePath,
    rootItemId: PROVISIONAL_SITE_ROOT_ITEM_ID,
    folderFromSite: [rootSegment, ...(placement.folder ?? [])],
  };
}

/**
 * Resolve `location` / field `source` placement under the site.
 * Pass `siteContext` for multi-site collections (e.g. axa/axa-be); omit to use
 * the legacy hard-coded bq-demo SCOPES.site root.
 * Prefer `resolveContentSiteContext` from `content-site-context.ts` when
 * collection and site systemNames may differ.
 */
export function resolveDataPlacement(
  placement: DataPlacement,
  siteContext?: DataPlacementSiteContext,
): ResolvedDataPlacement {
  if (siteContext) {
    return resolveDataPlacementForSite(
      placement,
      siteContext.collectionSystem,
      siteContext.siteSystem,
    );
  }

  const site = getScope("site");
  const rootSegment = placement.root === "home" ? "Home" : "Data";
  const folderFromSite = [rootSegment, ...(placement.folder ?? [])];

  return {
    diskRoot: path.join(site.diskRoot, rootSegment),
    sitecorePath: `${site.sitecorePath}/${rootSegment}`,
    rootItemId:
      placement.root === "home" ? SITE_HOME_ID : SITE_DATA_FOLDER_ID,
    folderFromSite,
  };
}

/**
 * Sitecore query Source for list fields.
 * `data` → `query:$site/Data/…/*` ; `home` → `query:$home/…/*`
 */
export function dataPlacementToQuerySource(placement: DataPlacement): string {
  const folder = placement.folder ?? [];
  if (placement.root === "home") {
    const rest = folder.length ? `/${folder.join("/")}` : "";
    return `query:$home${rest}/*`;
  }
  const rest = folder.length ? `/${folder.join("/")}` : "";
  return `query:$site/Data${rest}/*`;
}

/**
 * Collection root YAML (`templates/Project/{collection}.yml`).
 * Matches the bq-demo module include at `/sitecore/templates/Project`.
 */
export function getProjectTemplatesCollectionYamlPath(
  collectionSystem: string,
): string {
  return path.join(
    getSaiModuleDiskRoot(),
    "templates",
    "Project",
    `${collectionSystem}.yml`,
  );
}

/**
 * Disk directory for template items under a collection
 * (`templates/Project/{collection}/`).
 */
export function getProjectTemplatesDiskRoot(collectionSystem: string): string {
  return path.join(
    getSaiModuleDiskRoot(),
    "templates",
    "Project",
    collectionSystem,
  );
}

export function getProjectTemplatesSitecorePath(
  collectionSystem: string,
): string {
  return `/sitecore/templates/Project/${collectionSystem}`;
}

/**
 * Collection root YAML (`renderings/Project/{collection}.yml`).
 * Matches the bq-demo module include at `/sitecore/layout/Renderings/Project`.
 */
export function getProjectRenderingsCollectionYamlPath(
  collectionSystem: string,
): string {
  return path.join(
    getSaiModuleDiskRoot(),
    "renderings",
    "Project",
    `${collectionSystem}.yml`,
  );
}

/** Disk directory for rendering items (`renderings/Project/{collection}/`). */
export function getProjectRenderingsDiskDir(collectionSystem: string): string {
  return path.join(
    getSaiModuleDiskRoot(),
    "renderings",
    "Project",
    collectionSystem,
  );
}

export function getProjectRenderingsSitecorePath(
  collectionSystem: string,
): string {
  return `/sitecore/layout/Renderings/Project/${collectionSystem}`;
}

/**
 * Disk root for collection scaffolding under the `systemSettings` include
 * (`systemSettings/Project/{collection}/`).
 * Matches module path `/sitecore/system/settings/Project`.
 *
 * Long rule items may be hashed by SCS to `systemSettings/<16-hex>/Item.yml`
 * (handled by SCS path-length hashing).
 */
export function getScaffoldingActionsDiskRoot(
  collectionSystem: string,
): string {
  return path.join(
    getSaiModuleDiskRoot(),
    "systemSettings",
    "Project",
    collectionSystem,
  );
}

/** Sitecore path prefix for collection scaffolding settings folder. */
export function getScaffoldingCollectionSitecorePath(
  collectionSystem: string,
): string {
  return `/sitecore/system/Settings/Project/${collectionSystem}/${collectionSystem}`;
}

/** YAML for the collection scaffolding settings folder item. */
export function getScaffoldingCollectionYamlPath(
  collectionSystem: string,
): string {
  return path.join(
    getScaffoldingActionsDiskRoot(collectionSystem),
    `${collectionSystem}.yml`,
  );
}

/** Disk directory for per-rendering scaffolding rules (nested layout). */
export function getScaffoldingRulesDiskDir(collectionSystem: string): string {
  return path.join(
    getScaffoldingActionsDiskRoot(collectionSystem),
    collectionSystem,
  );
}
