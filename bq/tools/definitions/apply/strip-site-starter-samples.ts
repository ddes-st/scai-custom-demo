/**
 * XM Cloud site-template starter pages/datasources (About, Home/Data samples,
 * Home `__Renderings`) used to be stripped from the local YAML tree after Sites
 * API create + ser pull. Authoring apply has no YAML tree, so stripping is a
 * logged no-op; remove starter content on CM via Authoring if it is unwanted.
 */

/** Default Home/Data sample datasources from the XM Cloud site template. */
export const STARTER_HOME_DATA_ITEM_NAMES = [
  "Image 1",
  "PromoLeft",
  "PromoRight",
  "Text 1",
  "Text 2",
] as const;

/**
 * No-op under Authoring apply — never touches disk.
 * @returns Always an empty list (nothing was removed or cleared).
 */
export function stripXmCloudSiteStarterSamples(opts: {
  collectionSystem: string;
  siteSystem: string;
  /** @deprecated Ignored — Authoring apply has no site YAML tree. */
  siteDiskRoot?: string;
  log?: (msg: string) => void;
}): string[] {
  const log = opts.log || ((msg: string) => console.log(msg));
  log(
    `  · skip strip starter samples for ${opts.collectionSystem}/${opts.siteSystem} (Authoring apply; no YAML)`,
  );
  return [];
}

/**
 * True when this site emit should strip starter samples (fresh create / first local tree).
 */
export function shouldStripXmCloudSiteStarterSamples(opts: {
  action: string;
  localSiteMissingBeforePull: boolean;
  skipPull?: boolean;
}): boolean {
  if (opts.skipPull) return false;
  const action = String(opts.action || "").toLowerCase();
  return action === "created" || Boolean(opts.localSiteMissingBeforePull);
}
