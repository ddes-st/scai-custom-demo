/**
 * Resolve Sitecore item IDs: in-run path cache → CM path lookup.
 * No GUID minting — callers create when missing and use the API-returned id.
 */
import {
  cacheAuthoringPathId,
  getCachedAuthoringPathId,
} from "./authoring-path-cache";
import { findItemByPath } from "./cm-sibling-lookup";
import { canonicalItemId, toScsYamlGuid } from "./ids";
import { logIdResolve } from "./id-resolve-log";

/** Process-lifetime CM path → id (empty string = looked up, not found). */
const cmPathIdCache = new Map<string, string>();

export function clearItemIdByPathCmCache(): void {
  cmPathIdCache.clear();
}

export type ResolveItemIdByPathOptions = {
  sitecorePath: string;
  endpointName?: string;
  /** Injected for tests — skip live CM. */
  lookupPath?: (sitecorePath: string) => Promise<string | undefined>;
  /** Skip CM (offline / tests). */
  skipCm?: boolean;
  logPrefix?: string;
};

export type ResolveItemIdByPathResult =
  | {
      found: true;
      id: string;
      source: "cm" | "cache";
      diskId: undefined;
      cmId: string;
      remappedFromDisk: false;
    }
  | {
      found: false;
      id?: undefined;
      source: "missing";
      diskId: undefined;
      cmId: undefined;
      remappedFromDisk: false;
    };

async function lookupCmId(
  sitecorePath: string,
  opts: Pick<
    ResolveItemIdByPathOptions,
    "endpointName" | "lookupPath" | "skipCm"
  >,
  logPrefix: string,
): Promise<string | undefined> {
  if (opts.skipCm) return undefined;
  const key = sitecorePath.trim().toLowerCase();
  if (!key) return undefined;
  if (cmPathIdCache.has(key)) {
    const cached = cmPathIdCache.get(key)!;
    return cached || undefined;
  }

  let cmId: string | undefined;
  try {
    if (opts.lookupPath) {
      cmId = await opts.lookupPath(sitecorePath);
    } else {
      const hit = await findItemByPath({
        path: sitecorePath,
        endpointName: opts.endpointName,
      });
      cmId = hit?.itemId;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `${logPrefix} CM path lookup failed for ${sitecorePath}: ${msg.slice(0, 160)}`,
    );
    cmPathIdCache.set(key, "");
    return undefined;
  }

  const canonical = cmId ? canonicalItemId(cmId) || cmId : "";
  cmPathIdCache.set(key, canonical);
  if (canonical) cacheAuthoringPathId(sitecorePath, canonical);
  return canonical || undefined;
}

/**
 * cache → CM. No mint — use {@link found} false and create via Authoring.
 */
export async function resolveItemIdByPath(
  opts: ResolveItemIdByPathOptions,
): Promise<ResolveItemIdByPathResult> {
  const sitecorePath = String(opts.sitecorePath || "").trim();
  const logPrefix = opts.logPrefix || "[bq:apply]";

  const cached = getCachedAuthoringPathId(sitecorePath);
  if (cached) {
    logIdResolve({
      prefix: logPrefix,
      sitecorePath,
      source: "cache",
      id: toScsYamlGuid(cached),
      detail: "(in-run path cache)",
    });
    return {
      found: true,
      id: cached,
      source: "cache",
      diskId: undefined,
      cmId: cached,
      remappedFromDisk: false,
    };
  }

  const cmStarted = Date.now();
  const cmId = await lookupCmId(sitecorePath, opts, logPrefix);
  const cmMs = Date.now() - cmStarted;

  if (cmId) {
    logIdResolve({
      prefix: logPrefix,
      sitecorePath,
      source: "cm",
      id: toScsYamlGuid(cmId),
      ms: cmMs,
    });
    return {
      found: true,
      id: cmId,
      source: "cm",
      diskId: undefined,
      cmId,
      remappedFromDisk: false,
    };
  }

  logIdResolve({
    prefix: logPrefix,
    sitecorePath,
    source: "missing",
    id: "",
    detail: "(create via Authoring)",
  });
  return {
    found: false,
    source: "missing",
    diskId: undefined,
    cmId: undefined,
    remappedFromDisk: false,
  };
}

/** Braced uppercase GUID for SharedFields Values (e.g. MediaLibrary). */
export function bracedGuidFieldValue(id: string): string {
  const dashed = toScsYamlGuid(id);
  return `{${dashed.toUpperCase()}}`;
}

/**
 * Alias kept for call-site compat — same as resolveItemIdByPath (no disk rewrite).
 */
export async function resolveItemIdByPathWithRewrite(
  opts: ResolveItemIdByPathOptions,
): Promise<ResolveItemIdByPathResult> {
  return resolveItemIdByPath(opts);
}
