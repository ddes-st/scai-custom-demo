/**
 * After Sites API create + ser pull: crop capture desktop-clean.png to 320×177,
 * emit under media-library/.../System/{hex}/, and wire Home + Site root
 * __Thumbnail / __AutoThumbnails (Sites UI uses the Site item).
 *
 * CLI:
 *   npx tsx tools/shared/site-thumbnail-from-capture.ts \
 *     --collection=axabe --site=axabe \
 *     --capture=.bq/captures/www-axa-be/www-axa-be--nl-particulieren
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { updateItem } from "./authoring-items";
import { braceGuid } from "./ids";
import { ensureMediaFromSource } from "./media-from-source";
import { sanitizeSingleLineText } from "./naming";
import { REPO_ROOT } from "./paths";
import {
  resolveItemIdByPath,
  type ResolveItemIdByPathOptions,
} from "./resolve-item-id-by-path";
import { STANDARD_FIELDS } from "./standard-fields";
import type { DefinitionThumbnail } from "../definitions/types";

const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 177;

/** Re-export for callers that only import from this module. */
export type { DefinitionThumbnail };

/**
 * Normalize definition thumbnail: prefer `thumbnail`, else one-release
 * deprecated `thumbnailCaptureRel` → `{ path }`.
 */
export function normalizeDefinitionThumbnail(
  thumbnail?: DefinitionThumbnail | null,
  deprecatedCaptureRel?: string | null,
): DefinitionThumbnail | undefined {
  if (
    thumbnail &&
    (String(thumbnail.path || "").trim() ||
      String(thumbnail.url || "").trim() ||
      String(thumbnail.base64 || "").trim())
  ) {
    return {
      ...(thumbnail.path ? { path: String(thumbnail.path).trim() } : {}),
      ...(thumbnail.url ? { url: String(thumbnail.url).trim() } : {}),
      ...(thumbnail.base64 ? { base64: String(thumbnail.base64).trim() } : {}),
      ...(thumbnail.alt != null ? { alt: String(thumbnail.alt) } : {}),
      ...(thumbnail.name != null ? { name: String(thumbnail.name) } : {}),
    };
  }
  const rel = String(deprecatedCaptureRel || "")
    .trim()
    .replace(/\\/g, "/");
  if (rel) return { path: rel };
  return undefined;
}

function stripDataUrlBase64(raw: string): string {
  const s = String(raw || "").trim();
  const m = s.match(/^data:[^;]+;base64,(.+)$/i);
  return m ? m[1]! : s;
}

/**
 * Resolve a thumbnail `path` to an absolute filesystem path.
 * Relative paths join under `capturePageDir` (BQ_CAPTURE_PAGE_DIR).
 * Absolute paths are used as-is. Rejects `..` escapes when relative.
 */
export function resolveDefinitionThumbnailPath(
  capturePageDir: string | undefined,
  thumbPath: string,
): string | null {
  const raw = String(thumbPath || "")
    .trim()
    .replace(/\\/g, "/");
  if (!raw) return null;
  if (path.isAbsolute(raw) || /^[A-Za-z]:\//.test(raw)) {
    return path.normalize(raw);
  }
  if (raw.includes("..")) return null;
  const pageDir = String(capturePageDir || "").trim();
  if (!pageDir) return null;
  const resolvedDir = resolveCapturePageDir(pageDir);
  return path.join(resolvedDir, ...raw.replace(/^\.\//, "").split("/").filter(Boolean));
}

/**
 * Resolve definition thumbnail bytes. Order: base64 → url → path.
 */
export async function resolveDefinitionThumbnailBytes(
  thumbnail: DefinitionThumbnail | undefined | null,
  options?: { capturePageDir?: string },
): Promise<{ buffer: Buffer } | { skipped: string }> {
  const thumb = normalizeDefinitionThumbnail(thumbnail);
  if (!thumb) return { skipped: "missing thumbnail" };

  if (thumb.base64) {
    try {
      const buffer = Buffer.from(stripDataUrlBase64(thumb.base64), "base64");
      if (!buffer.length) return { skipped: "empty base64 thumbnail" };
      return { buffer };
    } catch {
      return { skipped: "invalid base64 thumbnail" };
    }
  }

  if (thumb.url) {
    const url = String(thumb.url).trim();
    if (!/^https?:\/\//i.test(url)) {
      return { skipped: `invalid thumbnail url: ${url}` };
    }
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "bq-site-thumbnail/1.0" },
      });
      if (!response.ok) {
        return { skipped: `thumbnail url HTTP ${response.status}: ${url}` };
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) return { skipped: `empty thumbnail url body: ${url}` };
      return { buffer };
    } catch (err) {
      return {
        skipped: `thumbnail url fetch failed: ${err instanceof Error ? err.message : err}`,
      };
    }
  }

  if (thumb.path) {
    const abs = resolveDefinitionThumbnailPath(
      options?.capturePageDir,
      thumb.path,
    );
    if (!abs) {
      return {
        skipped: options?.capturePageDir
          ? `invalid thumbnail path: ${thumb.path}`
          : `thumbnail path requires capturePageDir: ${thumb.path}`,
      };
    }
    if (!fs.existsSync(abs)) {
      return {
        skipped: `missing screenshot: ${path.relative(REPO_ROOT, abs)}`,
      };
    }
    return { buffer: fs.readFileSync(abs) };
  }

  return { skipped: "thumbnail has no path|url|base64" };
}

const THUMBNAIL_FIELD = STANDARD_FIELDS.thumbnail;
const AUTO_THUMBNAILS_FIELD = STANDARD_FIELDS.autoThumbnails;

export type EnsureSiteThumbnailOptions = {
  collectionSystem: string;
  siteSystem: string;
  /**
   * Absolute or repo-relative path to the capture page dir.
   * Used when `thumbnail.path` is relative, and as fallback desktop-clean.png.
   */
  capturePageDir?: string;
  /**
   * Preferred thumbnail source from the site definition.
   * When unset, falls back to `{capturePageDir}/screenshots/desktop-clean.png`.
   */
  thumbnail?: DefinitionThumbnail;
} & ThumbnailCmLookupOptions;

/** CM lookup knobs (tests / offline) forwarded to {@link resolveItemIdByPath}. */
export type ThumbnailCmLookupOptions = Pick<
  ResolveItemIdByPathOptions,
  "endpointName" | "lookupPath" | "skipCm"
>;

export type EnsureSiteThumbnailResult = {
  skipped?: string;
  /** Sitecore path of the Home item. */
  homePath?: string;
  /** Sitecore path of the Site root item. */
  sitePath?: string;
  siteSkipped?: string;
  mediaId?: string;
  mediaPath?: string;
  width?: number;
  height?: number;
};

function resolveCapturePageDir(capturePageDir: string): string {
  if (path.isAbsolute(capturePageDir)) return capturePageDir;
  return path.resolve(REPO_ROOT, capturePageDir);
}

/** Sitecore path of the site Home item. */
function homeSitecorePath(collectionSystem: string, siteSystem: string): string {
  return `/sitecore/content/${collectionSystem}/${siteSystem}/Home`;
}

/** Sitecore path of the site root item. */
function siteSitecorePath(collectionSystem: string, siteSystem: string): string {
  return `/sitecore/content/${collectionSystem}/${siteSystem}`;
}

/** Sitecore System thumbnail folder segments from an item GUID. */
export function systemThumbnailFolderSegments(
  itemId: string,
): { folder: string[]; itemName: string; idNoDashes: string } {
  const idNoDashes = itemId.replace(/[{}-]/g, "").toUpperCase();
  if (idNoDashes.length < 4) {
    throw new Error(`Invalid item id for System thumbnail path: ${itemId}`);
  }
  return {
    folder: [
      "System",
      idNoDashes[0]!,
      idNoDashes[1]!,
      idNoDashes[2]!,
      idNoDashes[3]!,
    ],
    itemName: `thumbnail_${idNoDashes}`,
    idNoDashes,
  };
}

/**
 * Resize to width 320 (keep aspect), then crop the top 177px.
 * Accepts a filesystem path or raw image bytes.
 */
export async function cropDesktopCleanToSiteThumbnail(
  pngPathOrBuffer: string | Buffer,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const resized = sharp(pngPathOrBuffer).resize({ width: THUMB_WIDTH });
  const meta = await resized.metadata();
  const resizedHeight = meta.height ?? 0;
  const cropHeight = Math.min(THUMB_HEIGHT, resizedHeight || THUMB_HEIGHT);
  const buffer = await resized
    .extract({
      left: 0,
      top: 0,
      width: THUMB_WIDTH,
      height: cropHeight,
    })
    .png()
    .toBuffer();
  return { buffer, width: THUMB_WIDTH, height: cropHeight };
}

/**
 * Upsert a SharedFields entry by field ID. Preserves the rest of the YAML.
 */
export function upsertSharedFieldInYaml(
  yaml: string,
  field: { id: string; hint: string },
  value: string,
  options?: { multiline?: boolean },
): { yaml: string; changed: boolean } {
  const normalized = yaml.replace(/\r\n/g, "\n");
  const id = field.id.toLowerCase();
  // Unless caller opted into multiline `|`, collapse line breaks so we never
  // emit illegal bare `Value: Men\nzis…` continuations (or unintended `|` blocks
  // for Name/Description).
  const wantsMultiline = Boolean(options?.multiline);
  const valueToWrite =
    !wantsMultiline && /[\r\n\u2028\u2029]/.test(value)
      ? sanitizeSingleLineText(value)
      : value;
  const multiline = wantsMultiline || valueToWrite.includes("\n");

  const sharedMatch = normalized.match(
    /^SharedFields:\n([\s\S]*?)(?=^Languages:|^---|\z)/m,
  );
  if (!sharedMatch) {
    // Insert SharedFields before Languages if present, else after header
    const fieldBlock = formatSharedFieldBlock(field, valueToWrite, multiline);
    if (/^Languages:/m.test(normalized)) {
      return {
        yaml: normalized.replace(
          /^Languages:/m,
          `SharedFields:\n${fieldBlock}Languages:`,
        ),
        changed: true,
      };
    }
    return {
      yaml: `${normalized.replace(/\n*$/, "\n")}SharedFields:\n${fieldBlock}`,
      changed: true,
    };
  }

  const sharedBody = sharedMatch[1] ?? "";
  const lines = sharedBody.split("\n");
  const out: string[] = [];
  let i = 0;
  let found = false;
  let changed = false;

  while (i < lines.length) {
    const line = lines[i]!;
    const idMatch = line.match(/^(\s*)- ID: "([^"]+)"\s*$/);
    if (!idMatch || idMatch[1]!.length > 2 || idMatch[2]!.toLowerCase() !== id) {
      out.push(line);
      i += 1;
      continue;
    }

    found = true;
    // Skip existing field block
    i += 1;
    while (i < lines.length) {
      const next = lines[i]!;
      if (/^\s*- ID: "/.test(next) && !/^\s{4,}- ID: "/.test(next)) break;
      if (/^Languages:/.test(next)) break;
      if (next === "" && i + 1 < lines.length && /^Languages:/.test(lines[i + 1]!)) {
        break;
      }
      // End of shared field entries when we hit a non-indented structural key
      if (/^[A-Za-z]/.test(next) && !/^\s/.test(next)) break;
      i += 1;
    }

    const block = formatSharedFieldBlock(field, valueToWrite, multiline).replace(
      /\n$/,
      "",
    );
    for (const bl of block.split("\n")) out.push(bl);
    changed = true;
  }

  if (!found) {
    const block = formatSharedFieldBlock(field, valueToWrite, multiline).replace(
      /\n$/,
      "",
    );
    // Prepend after SharedFields: so thumbnail is near the top (matches existing Home)
    const inserted = [block, ...out.filter((l, idx) => !(idx === 0 && l === ""))];
    const newBody = `${inserted.join("\n")}${inserted.length ? "\n" : ""}`;
    const next = normalized.replace(
      /^SharedFields:\n([\s\S]*?)(?=^Languages:|^---|\z)/m,
      `SharedFields:\n${newBody}`,
    );
    return { yaml: next, changed: true };
  }

  const newBody = `${out.join("\n")}${out.length && !out[out.length - 1] ? "" : out.length ? "\n" : ""}`;
  // Normalize trailing newline in body
  const bodyClean = out.join("\n");
  const suffix = bodyClean.endsWith("\n") || bodyClean === "" ? "" : "\n";
  const next = normalized.replace(
    /^SharedFields:\n([\s\S]*?)(?=^Languages:|^---|\z)/m,
    `SharedFields:\n${bodyClean}${suffix}`,
  );
  return { yaml: next, changed };
}

function formatSharedFieldBlock(
  field: { id: string; hint: string },
  value: string,
  multiline: boolean,
): string {
  if (multiline) {
    const indented = value
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n");
    return `- ID: "${field.id}"\n  Hint: ${field.hint}\n  Value: |\n${indented}\n`;
  }
  // Non-multiline must stay a single scalar — never bare LF continuations.
  const safe = /[\r\n\u2028\u2029]/.test(value)
    ? sanitizeSingleLineText(value)
    : value;
  return `- ID: "${field.id}"\n  Hint: ${field.hint}\n  Value: ${safe}\n`;
}

/**
 * Patch __Thumbnail (+ clear __AutoThumbnails) on an item via Authoring updateItem.
 */
async function patchThumbnailFieldsViaAuthoring(options: {
  itemId: string;
  sitecorePath: string;
  mediaId: string;
  endpointName?: string;
}): Promise<void> {
  const mediaRef = `<image mediaid="${braceGuid(options.mediaId)}" />`;
  await updateItem({
    itemId: options.itemId,
    path: options.sitecorePath,
    endpointName: options.endpointName,
    fields: [
      { name: THUMBNAIL_FIELD.hint, value: mediaRef },
      // Unchecked checkbox: empty value (checked uses "1")
      { name: AUTO_THUMBNAILS_FIELD.hint, value: "" },
    ],
  });
}

export type EnsurePartialDesignThumbnailOptions = {
  collectionSystem: string;
  siteSystem: string;
  /** Absolute or repo-relative path to the capture page dir (for relative `path`). */
  capturePageDir?: string;
  /** Preferred thumbnail from the partial definition. */
  thumbnail?: DefinitionThumbnail;
  /**
   * @deprecated Prefer `thumbnail: { path }`. Still accepted as `{ path }`.
   */
  thumbnailCaptureRel?: string;
  /** Sitecore path of the Partial Design (e.g. `…/Presentation/Partial Designs/Header`). */
  partialSitecorePath: string;
  /** Live CM id when the caller just wrote the item (skips path lookup). */
  partialItemId?: string;
  /** Partial Design signature (`header` | `footer`). */
  signature: string;
} & ThumbnailCmLookupOptions;

export type EnsurePartialDesignThumbnailResult = {
  skipped?: string;
  mediaId?: string;
  mediaPath?: string;
  sitecorePath?: string;
  width?: number;
  height?: number;
};

/**
 * Resolve a capture-page-relative PNG to an absolute path under the capture page dir.
 * Relative paths only (legacy helper). Prefer {@link resolveDefinitionThumbnailPath}.
 */
export function resolvePartialThumbnailPngPath(
  capturePageDir: string,
  thumbnailCaptureRel: string,
): string | null {
  const rel = String(thumbnailCaptureRel || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
  if (!rel || path.isAbsolute(rel) || rel.includes("..")) return null;
  return resolveDefinitionThumbnailPath(capturePageDir, rel);
}

/**
 * Crop/upload thumbnail bytes and patch Partial Design `__Thumbnail`.
 * Requires `thumbnail` (or deprecated `thumbnailCaptureRel`) — no conversion discovery.
 */
export async function ensurePartialDesignThumbnailFromCapture(
  options: EnsurePartialDesignThumbnailOptions,
): Promise<EnsurePartialDesignThumbnailResult> {
  const collectionSystem = options.collectionSystem.trim().toLowerCase();
  const siteSystem = options.siteSystem.trim().toLowerCase();
  const signature = String(options.signature || "")
    .trim()
    .toLowerCase();
  const partialSitecorePath = String(options.partialSitecorePath || "").trim();
  const thumb = normalizeDefinitionThumbnail(
    options.thumbnail,
    options.thumbnailCaptureRel,
  );

  if (!thumb) {
    return { skipped: "missing thumbnail stamp" };
  }
  if (signature !== "header" && signature !== "footer") {
    return { skipped: `signature not header/footer: ${signature || "(empty)"}` };
  }
  if (!partialSitecorePath) {
    return { skipped: "missing partialSitecorePath" };
  }

  const capturePageDir =
    options.capturePageDir?.trim() ||
    process.env.BQ_CAPTURE_PAGE_DIR?.trim() ||
    "";
  const resolved = await resolveDefinitionThumbnailBytes(thumb, {
    capturePageDir: capturePageDir || undefined,
  });
  if ("skipped" in resolved) {
    return { skipped: resolved.skipped };
  }

  let partialId = String(options.partialItemId || "").trim();
  if (!partialId) {
    const found = await resolveItemIdByPath({
      sitecorePath: partialSitecorePath,
      endpointName: options.endpointName,
      lookupPath: options.lookupPath,
      skipCm: options.skipCm,
      logPrefix: "[bq:apply:partial-thumbnail]",
    });
    if (!found.found) {
      return {
        skipped: `Partial Design not found in CM at ${partialSitecorePath}`,
      };
    }
    partialId = found.id;
  }

  const { folder, itemName } = systemThumbnailFolderSegments(partialId);
  const { buffer, width, height } = await cropDesktopCleanToSiteThumbnail(
    resolved.buffer,
  );

  const handle = `site-partial-thumbnail:${collectionSystem}:${siteSystem}:${signature}`;
  const media = await ensureMediaFromSource(
    {
      base64: buffer.toString("base64"),
      extension: "png",
      name: itemName,
      alt: thumb.alt || `${siteSystem} ${signature} partial thumbnail`,
    },
    {
      handle,
      collectionSystem,
      siteName: siteSystem,
      folder,
      itemName,
    },
  );

  await patchThumbnailFieldsViaAuthoring({
    itemId: partialId,
    sitecorePath: partialSitecorePath,
    mediaId: media.mediaId,
    endpointName: options.endpointName,
  });

  return {
    mediaId: media.mediaId,
    mediaPath: media.sitecorePath,
    sitecorePath: partialSitecorePath,
    width,
    height,
  };
}

/**
 * Ensure site Home + Site root thumbnail from definition `thumbnail` or
 * capture `screenshots/desktop-clean.png` fallback.
 * Sites UI reads __Thumbnail on the Site item; Home is patched for Content Editor.
 */
export async function ensureSiteThumbnailFromCapture(
  options: EnsureSiteThumbnailOptions,
): Promise<EnsureSiteThumbnailResult> {
  const collectionSystem = options.collectionSystem.trim().toLowerCase();
  const siteSystem = options.siteSystem.trim().toLowerCase();
  const capturePageDirRaw = String(options.capturePageDir || "").trim();
  const capturePageDir = capturePageDirRaw
    ? resolveCapturePageDir(capturePageDirRaw)
    : "";
  const homePath = homeSitecorePath(collectionSystem, siteSystem);
  const sitePath = siteSitecorePath(collectionSystem, siteSystem);
  const cmLookup: ThumbnailCmLookupOptions = {
    endpointName: options.endpointName,
    lookupPath: options.lookupPath,
    skipCm: options.skipCm,
  };

  const thumb =
    normalizeDefinitionThumbnail(options.thumbnail) ||
    (capturePageDir
      ? ({ path: "screenshots/desktop-clean.png" } satisfies DefinitionThumbnail)
      : undefined);

  const resolved = await resolveDefinitionThumbnailBytes(thumb, {
    capturePageDir: capturePageDir || undefined,
  });
  if ("skipped" in resolved) {
    return { skipped: resolved.skipped };
  }

  const home = await resolveItemIdByPath({
    sitecorePath: homePath,
    ...cmLookup,
    logPrefix: "[bq:apply:site-thumbnail]",
  });
  if (!home.found) {
    return { skipped: `Home not found in CM at ${homePath}` };
  }
  const homeId = home.id;

  const { folder, itemName } = systemThumbnailFolderSegments(homeId);
  const { buffer, width, height } = await cropDesktopCleanToSiteThumbnail(
    resolved.buffer,
  );

  const handle = `site-thumbnail:${collectionSystem}:${siteSystem}`;
  const media = await ensureMediaFromSource(
    {
      base64: buffer.toString("base64"),
      extension: "png",
      name: itemName,
      alt: thumb?.alt || `${siteSystem} site thumbnail`,
    },
    {
      handle,
      collectionSystem,
      siteName: siteSystem,
      folder,
      itemName,
    },
  );

  await patchThumbnailFieldsViaAuthoring({
    itemId: homeId,
    sitecorePath: homePath,
    mediaId: media.mediaId,
    endpointName: options.endpointName,
  });

  let sitePathOut: string | undefined;
  let siteSkipped: string | undefined;
  const site = await resolveItemIdByPath({
    sitecorePath: sitePath,
    ...cmLookup,
    logPrefix: "[bq:apply:site-thumbnail]",
  });
  if (site.found) {
    await patchThumbnailFieldsViaAuthoring({
      itemId: site.id,
      sitecorePath: sitePath,
      mediaId: media.mediaId,
      endpointName: options.endpointName,
    });
    sitePathOut = sitePath;
  } else {
    siteSkipped = `site root not found in CM at ${sitePath}`;
  }

  return {
    homePath,
    sitePath: sitePathOut,
    siteSkipped,
    mediaId: media.mediaId,
    mediaPath: media.sitecorePath,
    width,
    height,
  };
}

function parseArgs(argv: string[]): EnsureSiteThumbnailOptions {
  let collectionSystem = "";
  let siteSystem = "";
  let capturePageDir = "";
  for (const arg of argv) {
    if (arg.startsWith("--collection=")) {
      collectionSystem = arg.slice("--collection=".length);
    } else if (arg.startsWith("--site=")) {
      siteSystem = arg.slice("--site=".length);
    } else if (arg.startsWith("--capture=")) {
      capturePageDir = arg.slice("--capture=".length);
    }
  }
  if (!collectionSystem || !siteSystem || !capturePageDir) {
    throw new Error(
      "Usage: site-thumbnail-from-capture.ts --collection=… --site=… --capture=…",
    );
  }
  return { collectionSystem, siteSystem, capturePageDir };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const result = await ensureSiteThumbnailFromCapture(opts);
  if (result.skipped) {
    console.warn(`[bq:apply:site-thumbnail] skip: ${result.skipped}`);
    process.exitCode = 0;
    return;
  }
  console.log(
    `[bq:apply:site-thumbnail] ${opts.collectionSystem}/${opts.siteSystem} → ${result.mediaPath} (${result.width}x${result.height})`,
  );
  console.log(`[bq:apply:site-thumbnail] Home: ${result.homePath}`);
  if (result.sitePath) {
    console.log(`[bq:apply:site-thumbnail] Site: ${result.sitePath}`);
  }
  if (result.siteSkipped) {
    console.warn(`[bq:apply:site-thumbnail] Site skip: ${result.siteSkipped}`);
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
