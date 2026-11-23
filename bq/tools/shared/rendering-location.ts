import type { RenderingDatasourceLocation } from "../definitions/types";

function rootSegmentName(root: RenderingDatasourceLocation["root"]): string {
  return root === "home" ? "Home" : "Data";
}

function scopeQuery(
  scopePrefix: "$site" | "$sharedSites",
  location: RenderingDatasourceLocation,
  folderTemplateName: string,
): string {
  const rootName = rootSegmentName(location.root);
  const templatePredicate = `/*[@@templatename='${folderTemplateName.replace(/'/g, "''")}']`;
  // Picker query is root → folder template only (no intermediate @@name folder segments).
  // datasourceLocation.folder still drives content disk paths elsewhere.
  return `query:${scopePrefix}/*[@@name='${rootName}']${templatePredicate}`;
}

/**
 * Build the rendering `Datasource Location` query for site-scoped pickers.
 * Always emits `$site` and `$sharedSites` arms joined by `|`.
 */
export function buildRenderingDatasourceLocationQuery(
  location: RenderingDatasourceLocation,
  folderTemplateName: string,
): string {
  if (location.scope !== "site") {
    throw new Error(
      `Unsupported datasourceLocation.scope "${location.scope as string}" — only "site" is supported`,
    );
  }
  const siteQuery = scopeQuery("$site", location, folderTemplateName);
  const sharedQuery = scopeQuery("$sharedSites", location, folderTemplateName);
  return `${siteQuery}|${sharedQuery}`;
}

/**
 * Datasource Location query that walks named Data folder segments
 * (e.g. `Data/Link Lists`) — used when Datasource Template is a platform GUID.
 */
export function buildNamedFolderDatasourceLocationQuery(
  location: RenderingDatasourceLocation,
): string {
  if (location.scope !== "site") {
    throw new Error(
      `Unsupported datasourceLocation.scope "${location.scope as string}" — only "site" is supported`,
    );
  }
  const rootName = rootSegmentName(location.root);
  const folder = location.folder ?? [];
  const nameChain = folder
    .map((segment) => `/*[@@name='${segment.replace(/'/g, "''")}']`)
    .join("");
  const siteQuery = `query:$site/*[@@name='${rootName}']${nameChain}`;
  const sharedQuery = `query:$sharedSites/*[@@name='${rootName}']${nameChain}`;
  return `${siteQuery}|${sharedQuery}`;
}
