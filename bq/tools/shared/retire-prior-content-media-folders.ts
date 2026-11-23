/**
 * Scoped delete of prior Data + media-library YAML trees when a component
 * renames or moves content/media folders — so dead local trees do not linger.
 */
import fs from "node:fs";
import path from "node:path";
import { getSaiModuleDiskRoot } from "./data-placement";
import { normalizeDataFolderSegments } from "./naming";

/** Default media site leaf under Project/{collection}/ (matches ensureMediaFromSource). */
export const DEFAULT_MEDIA_SITE_NAME = "bq-demo";

export type RetirePriorContentMediaFoldersOptions = {
  collectionSystem: string;
  siteSystem: string;
  /** Prior folder paths under site Data/Home (each path is segments). */
  priorContentFolderPaths?: string[][];
  /** Prior folder paths under media-library/Project/{collection}/{mediaSite}. */
  priorMediaFolderPaths?: string[][];
  /** Do not delete these content paths (new destination). */
  keepContentFolderPaths?: string[][];
  /** Do not delete these media paths (new destination). */
  keepMediaFolderPaths?: string[][];
  /** Content root under the site (`data` default). */
  contentRoot?: "data" | "home";
  /** Media library site leaf (defaults to `siteSystem`, then legacy `bq-demo`). */
  mediaSiteName?: string;
  dryRun?: boolean;
  /** Override SAI module root (tests). */
  saiModuleDiskRoot?: string;
};

export type RetirePriorContentMediaFoldersResult = {
  removed: string[];
  skippedKeep: string[];
  skippedMissing: string[];
};

/** Stable key for comparing folder segment arrays. */
export function folderPathKey(segments: string[] | null | undefined): string {
  const norm = normalizeDataFolderSegments(segments ?? undefined) ?? [];
  return norm
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean)
    .join("/");
}

/**
 * Parse each `folder: […]` array in definition TS as its own path.
 */
export function extractFolderPathsFromDefinitionTs(
  definitionTs: string | null | undefined,
): string[][] {
  const text = String(definitionTs || "");
  const out: string[][] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/folder\s*:\s*\[([^\]]*)\]/g)) {
    const segs = [...m[1].matchAll(/["']([^"']+)["']/g)].map((q) => q[1]);
    const key = folderPathKey(segs);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalizeDataFolderSegments(segs) ?? segs);
  }
  return out;
}

/**
 * Normalize capture-meta mediaFolders / contentFolders into path arrays.
 * - contentFolders: string[][] (preferred)
 * - mediaFolders: string[] of top-level segment names → one path each
 */
export function folderPathsFromCaptureMeta(meta: {
  contentFolders?: unknown;
  mediaFolders?: unknown;
} | null | undefined): {
  contentFolderPaths: string[][];
  mediaFolderPaths: string[][];
} {
  const contentFolderPaths: string[][] = [];
  const mediaFolderPaths: string[][] = [];
  const seenContent = new Set<string>();
  const seenMedia = new Set<string>();

  const pushContent = (segs: string[]) => {
    const key = folderPathKey(segs);
    if (!key || seenContent.has(key)) return;
    seenContent.add(key);
    contentFolderPaths.push(normalizeDataFolderSegments(segs) ?? segs);
  };
  const pushMedia = (segs: string[]) => {
    const key = folderPathKey(segs);
    if (!key || seenMedia.has(key)) return;
    seenMedia.add(key);
    mediaFolderPaths.push(normalizeDataFolderSegments(segs) ?? segs);
  };

  const rawContent = meta?.contentFolders;
  if (Array.isArray(rawContent)) {
    for (const entry of rawContent) {
      if (Array.isArray(entry)) {
        pushContent(entry.map((s) => String(s || "").trim()).filter(Boolean));
      } else if (typeof entry === "string" && entry.trim()) {
        pushContent([entry.trim()]);
      }
    }
  }

  const rawMedia = meta?.mediaFolders;
  if (Array.isArray(rawMedia)) {
    for (const entry of rawMedia) {
      if (typeof entry === "string" && entry.trim()) {
        pushMedia([entry.trim()]);
        // Legacy: mediaFolders also mirrors content folder names
        if (!Array.isArray(rawContent) || rawContent.length === 0) {
          pushContent([entry.trim()]);
        }
      }
    }
  }

  return { contentFolderPaths, mediaFolderPaths };
}

function keepKeySet(paths: string[][] | undefined): Set<string> {
  const set = new Set<string>();
  for (const p of paths || []) {
    const key = folderPathKey(p);
    if (key) set.add(key);
  }
  return set;
}

/**
 * Remove a folder item tree: `{diskRoot}/{seg…}/` dir + leaf `{…}/{leaf}.yml`.
 */
export function removeSerializedFolderTree(
  diskRoot: string,
  segments: string[],
  options?: { dryRun?: boolean },
): string[] {
  const norm = normalizeDataFolderSegments(segments) ?? segments;
  if (!norm.length || !diskRoot) return [];

  const removed: string[] = [];
  const dryRun = Boolean(options?.dryRun);
  const leafDir = path.join(diskRoot, ...norm);
  const leafYml = `${leafDir}.yml`;
  const leafYaml = `${leafDir}.yaml`;

  for (const candidate of [leafDir, leafYml, leafYaml]) {
    if (!fs.existsSync(candidate)) continue;
    removed.push(candidate);
    if (!dryRun) {
      fs.rmSync(candidate, { recursive: true, force: true });
    }
  }

  return removed;
}

/** PascalCase / spaced name → kebab file leaf (matches create-section-components). */
export function toPackageKebabName(name: string): string {
  return String(name || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * Load capture-meta next to a component package under `src/components/{host}/`.
 */
export function readCaptureMetaNearComponent(options: {
  componentsRoot: string;
  componentName: string;
  hostCandidates: Array<string | null | undefined>;
}): {
  meta: { contentFolders?: unknown; mediaFolders?: unknown } | null;
  metaPath: string | null;
  hostSlug: string | null;
} {
  const componentName = String(options.componentName || "").trim();
  const kebab = toPackageKebabName(componentName);
  if (!componentName || !kebab) {
    return { meta: null, metaPath: null, hostSlug: null };
  }
  const tried = new Set<string>();
  for (const host of options.hostCandidates) {
    const hostSlug = String(host || "").trim();
    if (!hostSlug || tried.has(hostSlug)) continue;
    tried.add(hostSlug);
    const metaPath = path.join(
      options.componentsRoot,
      hostSlug,
      componentName,
      `${kebab}.capture-meta.json`,
    );
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
        contentFolders?: unknown;
        mediaFolders?: unknown;
      };
      return { meta, metaPath, hostSlug };
    } catch {
      return { meta: null, metaPath, hostSlug };
    }
  }
  return { meta: null, metaPath: null, hostSlug: null };
}

/**
 * If capture-meta records prior folders that differ from the new definition
 * location, delete those prior Data/media YAML trees before emit writes.
 */
export function retirePriorFoldersIfChangedForComponent(options: {
  collectionSystem: string;
  siteSystem: string;
  componentName: string;
  /** New content.location.folder (keep). */
  newContentFolder?: string[] | null;
  componentsRoot: string;
  dryRun?: boolean;
  saiModuleDiskRoot?: string;
}): RetirePriorContentMediaFoldersResult | null {
  const collectionSystem = String(options.collectionSystem || "").trim();
  const siteSystem = String(options.siteSystem || "").trim();
  if (!collectionSystem || !siteSystem) return null;

  const { meta } = readCaptureMetaNearComponent({
    componentsRoot: options.componentsRoot,
    componentName: options.componentName,
    hostCandidates: [siteSystem, collectionSystem],
  });
  if (!meta) return null;

  const prior = folderPathsFromCaptureMeta(meta);
  const keepPath =
    normalizeDataFolderSegments(options.newContentFolder ?? undefined) ??
    (options.newContentFolder || []);
  const keepPaths = keepPath.length ? [keepPath] : [];

  const priorKeys = new Set(
    [...prior.contentFolderPaths, ...prior.mediaFolderPaths].map(folderPathKey),
  );
  const keepKeys = new Set(keepPaths.map(folderPathKey));
  let needsRetire = false;
  for (const key of priorKeys) {
    if (key && !keepKeys.has(key)) {
      needsRetire = true;
      break;
    }
  }
  if (!needsRetire) return null;

  const result = retirePriorContentAndMediaFolders({
    collectionSystem,
    siteSystem,
    mediaSiteName: siteSystem,
    priorContentFolderPaths: prior.contentFolderPaths,
    priorMediaFolderPaths: prior.mediaFolderPaths,
    keepContentFolderPaths: keepPaths,
    keepMediaFolderPaths: keepPaths,
    dryRun: options.dryRun,
    saiModuleDiskRoot: options.saiModuleDiskRoot,
  });
  if (result.removed.length) {
    console.warn(
      `[bq:apply:content] retired prior content/media YAML for ${options.componentName} (${result.removed.length} path(s))`,
    );
  }
  return result;
}

/**
 * Delete prior content + media YAML trees that are not in the keep set.
 */
export function retirePriorContentAndMediaFolders(
  options: RetirePriorContentMediaFoldersOptions,
): RetirePriorContentMediaFoldersResult {
  const collectionSystem = String(options.collectionSystem || "").trim();
  const siteSystem = String(options.siteSystem || "").trim();
  const removed: string[] = [];
  const skippedKeep: string[] = [];
  const skippedMissing: string[] = [];

  if (!collectionSystem || !siteSystem) {
    return { removed, skippedKeep, skippedMissing };
  }

  const dryRun = Boolean(options.dryRun);
  const saiRoot = options.saiModuleDiskRoot || getSaiModuleDiskRoot();
  const contentRootName = options.contentRoot === "home" ? "Home" : "Data";
  const siteDisk = path.join(
    saiRoot,
    "sites",
    "content",
    collectionSystem,
    siteSystem,
  );
  const contentDiskRoot = path.join(siteDisk, contentRootName);

  const mediaSite = String(
    options.mediaSiteName || options.siteSystem || DEFAULT_MEDIA_SITE_NAME,
  ).trim();
  const mediaDiskRoot = path.join(
    saiRoot,
    "media-library",
    "Project",
    collectionSystem,
    mediaSite,
  );

  const keepContent = keepKeySet(options.keepContentFolderPaths);
  const keepMedia = keepKeySet(options.keepMediaFolderPaths);

  const retireList = (
    paths: string[][] | undefined,
    diskRoot: string,
    keep: Set<string>,
  ) => {
    for (const segs of paths || []) {
      const key = folderPathKey(segs);
      if (!key) continue;
      if (keep.has(key)) {
        skippedKeep.push(`${diskRoot}::${key}`);
        continue;
      }
      const hit = removeSerializedFolderTree(diskRoot, segs, { dryRun });
      if (hit.length) removed.push(...hit);
      else skippedMissing.push(`${diskRoot}::${key}`);
    }
  };

  retireList(options.priorContentFolderPaths, contentDiskRoot, keepContent);
  retireList(options.priorMediaFolderPaths, mediaDiskRoot, keepMedia);

  return { removed, skippedKeep, skippedMissing };
}
