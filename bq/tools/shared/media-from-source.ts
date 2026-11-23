import { randomUUID } from "node:crypto";
import { applyAuthoringItem } from "./authoring-apply-bridge";
import { updateItem, uploadMedia } from "./authoring-items";
import { resolveItemIdByPath } from "./resolve-item-id-by-path";
import { cacheAuthoringPathId } from "./authoring-path-cache";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { stableGuid, toAuthoringGuid } from "./ids";
import { resolveEnglishItemName } from "./english-item-name";
import { proposeValidItemName } from "./naming";
import { type ScsField } from "./provenance";
import { isEnglishCulture } from "./resolve-content-languages";
import {
  bracedMediaLibraryFieldValue,
  clearMediaFolderCmIdCache,
  resolveMediaFolderId,
} from "./resolve-media-folder-id";
import {
  emptyWriteStats,
  mergeWriteStats,
  recordWrite,
  type ScsLanguageBlock,
  type ScsWriteStats,
} from "./authoring-item-model";
import { STANDARD_FIELDS } from "./standard-fields";
import {
  MEDIA_FIELD_IDS,
  MEDIA_FOLDER_TEMPLATE,
  MEDIA_LIBRARY_PROJECT_ROOT_ID,
  MEDIA_TEMPLATES,
} from "./system-ids";
import { resolveSiteOrigin } from "./ensure-home-link-page";

/** Total URL download attempts (1 initial + retries). */
const MEDIA_DOWNLOAD_ATTEMPTS = 3;
/** Backoff before attempt 2 and 3 (ms). */
const MEDIA_DOWNLOAD_BACKOFF_MS = [250, 500] as const;

const DISPLAY_NAME_FIELD = STANDARD_FIELDS.displayName;
/**
 * BQ-only shared field on media items (not a Sitecore template field).
 * Stored so cross-folder reuse can match by sourceKey after folder renames.
 */
export const BQ_MEDIA_SOURCE_KEY_FIELD_ID =
  "b9e5c4a1-2d3f-4a5b-8c6d-7e8f9a0b1c2d";
export const BQ_MEDIA_SOURCE_KEY_HINT = "BQ Source Key";

const DEFAULT_COLLECTION = "build-quick-demos-and-proof-of-concepts";
const DEFAULT_SITE = "bq-demo";

/**
 * When true, URL media that already exists on CM is re-downloaded and re-uploaded (Blob/Alt refresh).
 * Default off — reuse by sourceKey/path skips rewrite.
 */
export function isMediaForceRefresh(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const v = String(env?.BQ_MEDIA_FORCE_REFRESH || "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** One info line per ensureMediaFromSource call (plus console.warn for real problems). */
function logMediaEnsureSummary(
  outcome: "reused" | "wrote" | "relocated",
  sitecoreItemPath: string,
  totalMs: number,
): void {
  console.log(
    `[bq:apply:media] ${outcome} ${sitecoreItemPath} (${totalMs}ms)`,
  );
}

/** In-run memo: same CDN/source reused across many image fields. */
let mediaEnsureMemo: Map<string, EnsureMediaResult> | null = null;

function getMediaEnsureMemo(): Map<string, EnsureMediaResult> {
  if (!mediaEnsureMemo) mediaEnsureMemo = new Map();
  return mediaEnsureMemo;
}

// EnsureMediaResult is declared below; TS allows type-only forward refs.

/**
 * Clear ensure memo + CM folder id cache (call at start of definitions:generate).
 */
export function clearMediaEnsureCaches(): void {
  mediaEnsureMemo = null;
  clearMediaFolderCmIdCache();
}

/**
 * In-run memo is folder-agnostic: first placement of a sourceKey wins;
 * later callers (other datasource folders) reuse that mediaId/path.
 */
function mediaEnsureMemoKey(
  collectionSystem: string,
  siteName: string,
  sourceKey: string,
): string {
  return `${collectionSystem}|${siteName}|${sourceKey}`;
}

/** Definition-friendly media input (URL, base64, or SVG markup — no Sitecore XML). */
export type MediaSourceInput = {
  /** HTTP(S) URL — emitter downloads bytes and uploads media via Authoring. */
  url?: string;
  /** Raw base64, optionally with `data:…;base64,` prefix. */
  base64?: string;
  /**
   * Raw SVG markup — UTF-8 encoded to Blob as `image/svg+xml`.
   * Mutually exclusive with `url` / `base64`.
   */
  svgMarkup?: string;
  /** Image Alt (Image-family media only). */
  alt?: string;
  /** Media Title (e.g. PDF). */
  title?: string;
  /** Sitecore media item name (default derived from URL / context). */
  name?: string;
  extension?: string;
};

/** @deprecated Prefer `MediaSourceInput`. */
export type MediaImageInput = MediaSourceInput;

export type EnsureMediaOptions = {
  /** Folder segments under the site media root (e.g. `["Authors"]`). */
  folder?: string[];
  /** Fallback item name when not provided on the input. */
  itemName?: string;
  /** Namespace for stable GUIDs (definition handle). */
  handle: string;
  collectionSystem?: string;
  siteName?: string;
  /**
   * Capture page / site origin (e.g. `https://www.menzis.nl`) for joining
   * root-relative media URLs. Falls back to `resolveSiteOrigin` via `siteName`.
   */
  siteOrigin?: string | null;
  /**
   * Capture / site source culture (e.g. nl-NL). Used to translate Path to
   * English and write `__Display name` on that culture.
   */
  sourceLanguage?: string | null;
  /** Authoring endpoint for CM path lookup (media folder align). */
  endpointName?: string;
  /** Injected CM path → id lookup for tests. */
  lookupPath?: (sitecorePath: string) => Promise<string | undefined>;
  /** Skip CM align (offline / unit tests without mock). */
  skipCmMediaFolderAlign?: boolean;
};

export type EnsureMediaResult = {
  mediaId: string;
  sitecorePath: string;
  stats: ScsWriteStats;
  /** Resolved media profile (extension / template / image eligibility). */
  profile: MediaProfile;
  /** Resolved Alt written to media (when image-family). */
  alt?: string;
};

export type MediaProfile = {
  extension: string;
  mime: string;
  templateId: string;
  includeDimensions: boolean;
  supportAlt: boolean;
  supportTitle: boolean;
  isImageFieldEligible: boolean;
};

function mediaLibrarySitecorePath(
  collectionSystem: string,
  siteName: string,
): string {
  return `/sitecore/media library/Project/${collectionSystem}/${siteName}`;
}

function sanitizeMediaItemName(name: string): string {
  return proposeValidItemName(
    name
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/\.+$/, "")
      .slice(0, 100),
    "media",
  );
}

/**
 * English Sitecore Path leaf + capture-language DisplayName for media items.
 * Path is always English Title Case; DisplayName keeps the original label.
 */
export async function resolveMediaEnglishItemName(
  rawName: string,
  sourceLanguage?: string | null,
): Promise<{ englishName: string; displayName: string }> {
  const displayName =
    sanitizeMediaItemName(String(rawName || "").trim() || "media") || "media";
  const sourceCulture = String(sourceLanguage || "").trim() || "en";
  const english = await resolveEnglishItemName(displayName, {
    sourceLanguage: sourceCulture,
  });
  return {
    englishName: sanitizeMediaItemName(english) || displayName,
    displayName,
  };
}

function mediaDisplayNameLanguageBlocks(opts: {
  englishName: string;
  displayName: string;
  sourceLanguage?: string | null;
  versionFields?: ScsField[];
}): ScsLanguageBlock[] {
  const englishName = opts.englishName;
  const displayName = opts.displayName || englishName;
  const sourceCulture = String(opts.sourceLanguage || "").trim() || "en";
  const versionFields = opts.versionFields;

  const enBlock: ScsLanguageBlock = {
    language: "en",
    languageFields: [
      {
        id: DISPLAY_NAME_FIELD.id,
        hint: DISPLAY_NAME_FIELD.hint,
        value: englishName,
      },
    ],
    versionFields: versionFields?.length ? versionFields : undefined,
  };

  if (isEnglishCulture(sourceCulture)) {
    return [enBlock];
  }

  const sourceDisplay =
    displayName.trim() && displayName.trim() !== englishName.trim()
      ? displayName.trim()
      : displayName.trim() || englishName;

  return [
    enBlock,
    {
      language: sourceCulture,
      languageFields: [
        {
          id: DISPLAY_NAME_FIELD.id,
          hint: DISPLAY_NAME_FIELD.hint,
          value: sourceDisplay,
        },
      ],
    },
  ];
}

async function applyMediaDisplayNames(opts: {
  mediaId: string;
  englishName: string;
  displayName: string;
  sourceLanguage?: string | null;
  endpointName?: string;
}): Promise<void> {
  const englishName = opts.englishName;
  const displayName = opts.displayName || englishName;
  const sourceCulture = String(opts.sourceLanguage || "").trim() || "en";
  const fieldName = DISPLAY_NAME_FIELD.hint || "__Display name";

  await updateItem({
    itemId: opts.mediaId,
    language: "en",
    fields: [{ name: fieldName, value: englishName }],
    endpointName: opts.endpointName,
  }).catch(() => undefined);

  if (!isEnglishCulture(sourceCulture)) {
    await updateItem({
      itemId: opts.mediaId,
      language: sourceCulture,
      fields: [
        {
          name: fieldName,
          value: displayName.trim() || englishName,
        },
      ],
      endpointName: opts.endpointName,
    }).catch(() => undefined);
  }
}

function parseDataUrl(raw: string): { base64: string; mime?: string } | null {
  const match = raw.match(
    /^data:([a-z0-9.+/-]+)?;base64,([A-Za-z0-9+/=\s]+)$/i,
  );
  if (!match) return null;
  return {
    mime: match[1]?.toLowerCase(),
    base64: match[2]!.replace(/\s+/g, ""),
  };
}

function isProbablyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) || value.trim().startsWith("//");
}

function isProbablyBase64(value: string): boolean {
  const trimmed = value.trim();
  if (/^data:[a-z0-9.+/-]+;base64,/i.test(trimmed)) return true;
  const compact = trimmed.replace(/\s+/g, "");
  if (compact.length < 32) return false;
  if (compact.includes("\\") || compact.includes("://")) return false;
  if (!/^[A-Za-z0-9+/]+=*$/.test(compact)) return false;
  if (compact.length < 64 && !/[+/=]/.test(compact)) return false;
  return true;
}

/** Prefer magic-byte sniff when extension/mime are unknown. */
function sniffMediaExtension(bytes: Buffer): string | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (
    bytes.length >= 6 &&
    bytes.toString("ascii", 0, 3) === "GIF" &&
    bytes[3] === 0x38
  ) {
    return "gif";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  // ISO BMFF (AVIF / HEIC): ftyp box + brand
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 4, 8) === "ftyp"
  ) {
    const brands = bytes.toString("ascii", 8, Math.min(bytes.length, 64));
    if (/avif|avis/i.test(brands)) return "avif";
  }
  if (bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-") {
    return "pdf";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
  ) {
    const head = bytes.subarray(0, Math.min(bytes.length, 2048)).toString("utf8");
    if (head.includes("word/")) return "docx";
    return "zip";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    return "doc";
  }
  const head = bytes.subarray(0, Math.min(bytes.length, 256)).toString("utf8");
  if (/^\s*<svg[\s>]/i.test(head)) return "svg";
  return undefined;
}

function extensionFromMime(mime: string | undefined): string | undefined {
  switch ((mime ?? "").toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "image/svg+xml":
      return "svg";
    case "application/pdf":
      return "pdf";
    case "application/zip":
    case "application/x-zip-compressed":
      return "zip";
    case "application/msword":
      return "doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "text/plain":
      return "txt";
    default:
      return undefined;
  }
}

function mimeFromExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "zip":
      return "application/x-zip-compressed";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

/**
 * Resolve Sitecore media template + field shape from extension.
 * Mirrors Media Library Samples under bq-demo/Samples.
 */
export function resolveMediaProfile(extension: string): MediaProfile {
  const raw = extension.replace(/^\./, "").toLowerCase();
  const ext = raw === "jpeg" ? "jpg" : raw;

  switch (ext) {
    case "jpg":
    case "png":
    case "gif":
      return {
        extension: ext,
        mime: mimeFromExtension(ext),
        templateId: MEDIA_TEMPLATES.Image,
        includeDimensions: true,
        supportAlt: true,
        supportTitle: false,
        isImageFieldEligible: true,
      };
    case "svg":
      return {
        extension: "svg",
        mime: mimeFromExtension("svg"),
        templateId: MEDIA_TEMPLATES.Image,
        includeDimensions: false,
        supportAlt: true,
        supportTitle: false,
        isImageFieldEligible: true,
      };
    case "webp":
      return {
        extension: "webp",
        mime: mimeFromExtension("webp"),
        templateId: MEDIA_TEMPLATES.Webp,
        includeDimensions: true,
        supportAlt: true,
        supportTitle: false,
        isImageFieldEligible: true,
      };
    case "avif":
      // Sitecore has no AVIF template — convert to JPEG before write (see normalizeRasterBytes).
      return {
        extension: "avif",
        mime: mimeFromExtension("avif"),
        templateId: MEDIA_TEMPLATES.Image,
        includeDimensions: true,
        supportAlt: true,
        supportTitle: false,
        isImageFieldEligible: true,
      };
    case "pdf":
      return {
        extension: "pdf",
        mime: mimeFromExtension("pdf"),
        templateId: MEDIA_TEMPLATES.Pdf,
        includeDimensions: false,
        supportAlt: false,
        supportTitle: true,
        isImageFieldEligible: false,
      };
    case "zip":
      return {
        extension: "zip",
        mime: mimeFromExtension("zip"),
        templateId: MEDIA_TEMPLATES.Zip,
        includeDimensions: false,
        supportAlt: false,
        supportTitle: false,
        isImageFieldEligible: false,
      };
    case "doc":
      return {
        extension: "doc",
        mime: mimeFromExtension("doc"),
        templateId: MEDIA_TEMPLATES.Doc,
        includeDimensions: false,
        supportAlt: false,
        supportTitle: false,
        isImageFieldEligible: false,
      };
    case "docx":
      return {
        extension: "docx",
        mime: mimeFromExtension("docx"),
        templateId: MEDIA_TEMPLATES.Docx,
        includeDimensions: false,
        supportAlt: false,
        supportTitle: false,
        isImageFieldEligible: false,
      };
    case "txt":
      return {
        extension: "txt",
        mime: mimeFromExtension("txt"),
        templateId: MEDIA_TEMPLATES.File,
        includeDimensions: false,
        supportAlt: false,
        supportTitle: false,
        isImageFieldEligible: false,
      };
    default:
      return {
        extension: ext || "bin",
        mime: mimeFromExtension(ext),
        templateId: MEDIA_TEMPLATES.File,
        includeDimensions: false,
        supportAlt: false,
        supportTitle: false,
        isImageFieldEligible: false,
      };
  }
}

/**
 * Unwrap Next.js image optimizer URLs (`/_next/image?url=…`) to the underlying
 * asset URL so media leaf names / extensions / sourceKeys stay unique per image.
 * Relative `url` query values resolve against the optimizer origin.
 */
export function resolveMediaSourceUrl(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    const pathNorm = u.pathname.replace(/\/+$/, "") || "/";
    if (!/\/_next\/image$/i.test(pathNorm)) return raw;
    const inner = u.searchParams.get("url");
    if (!inner) return raw;
    return new URL(inner, u.origin).toString();
  } catch {
    return raw;
  }
}

function extensionFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(resolveMediaSourceUrl(url)).pathname;
    const ext = path.extname(pathname).replace(/^\./, "").toLowerCase();
    if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return ext;
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Derive Sitecore media item leaf name from a URL (unwraps `/_next/image` first). */
export function nameFromUrl(url: string): string | undefined {
  try {
    const u = new URL(resolveMediaSourceUrl(url));
    const seedMatch = u.pathname.match(/\/seed\/([^/]+)/i);
    if (seedMatch?.[1]) return sanitizeMediaItemName(seedMatch[1]);
    const base = path.basename(u.pathname);
    const withoutExt = base.replace(/\.[^.]+$/, "");
    if (withoutExt) {
      return sanitizeMediaItemName(decodeURIComponent(withoutExt));
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Unwrap `/_next/image` optimizer URLs, then strip CDN format negotiation params
 * that force AVIF/WebP instead of the path extension.
 */
export function normalizeCdnMediaUrl(url: string): string {
  try {
    const u = new URL(resolveMediaSourceUrl(url));
    for (const key of [...u.searchParams.keys()]) {
      if (/^(savif|swebp)$/i.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url || "").trim());
}

/**
 * Upgrade protocol-relative / root-relative media URLs to absolute HTTPS URLs
 * using the capture site origin. Absolute http(s) URLs pass through
 * {@link normalizeCdnMediaUrl}.
 */
export function absolutizeMediaDownloadUrl(
  url: string,
  siteOrigin?: string | null,
): string {
  const raw = String(url || "").trim();
  if (!raw) return raw;
  let candidate = raw.startsWith("//") ? `https:${raw}` : raw;
  if (isAbsoluteHttpUrl(candidate)) {
    return normalizeCdnMediaUrl(candidate);
  }
  const origin = String(siteOrigin || "").trim();
  if (origin) {
    try {
      const base = isAbsoluteHttpUrl(origin)
        ? origin
        : `https://${origin.replace(/^\/+/, "")}`;
      return normalizeCdnMediaUrl(new URL(candidate, base).href);
    } catch {
      return candidate;
    }
  }
  return candidate;
}

function isRetryableMediaHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a media URL with up to {@link MEDIA_DOWNLOAD_ATTEMPTS} attempts.
 * Retries network failures and HTTP 408 / 429 / 5xx; other 4xx fail immediately.
 * @param opts.sleep — injectable delay (tests pass a no-op).
 */
export async function fetchMediaUrlWithRetries(
  url: string,
  opts: { sleep?: (ms: number) => Promise<void> } = {},
): Promise<Response> {
  const sleep = opts.sleep || sleepMs;
  let lastFailure: Error | undefined;
  for (let attempt = 1; attempt <= MEDIA_DOWNLOAD_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": "BQ-definitions-generate/1.0",
          Accept: "image/jpeg,image/png,image/webp,image/svg+xml,*/*;q=0.1",
        },
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      lastFailure = new Error(
        `Failed to download media (network): ${url}: ${detail}`,
      );
      if (attempt < MEDIA_DOWNLOAD_ATTEMPTS) {
        await sleep(MEDIA_DOWNLOAD_BACKOFF_MS[attempt - 1] ?? 500);
        continue;
      }
      throw lastFailure;
    }
    if (response.ok) return response;
    lastFailure = new Error(
      `Failed to download media (${response.status}): ${url}`,
    );
    if (
      attempt < MEDIA_DOWNLOAD_ATTEMPTS &&
      isRetryableMediaHttpStatus(response.status)
    ) {
      await sleep(MEDIA_DOWNLOAD_BACKOFF_MS[attempt - 1] ?? 500);
      continue;
    }
    throw lastFailure;
  }
  throw (
    lastFailure ||
    new Error(`Failed to download media (network): ${url}: exhausted retries`)
  );
}

/**
 * Whether an existing media item's BQ Source Key may be reused for `currentSourceKey`.
 * Both empty → compatible; otherwise require exact equality.
 */
export function mediaSourceKeysCompatible(
  existingSourceKey: string | undefined | null,
  currentSourceKey: string | undefined | null,
): boolean {
  const a = String(existingSourceKey || "").trim();
  const b = String(currentSourceKey || "").trim();
  if (!a && !b) return true;
  return a === b;
}

/**
 * Pick a leaf-name index hit only when sourceKey matches (never first unrelated `image.yml`).
 * @param {{ filePath: string, id: string, sourceKey?: string }}[] leafHits
 */
export function pickMediaLeafHitBySourceKey(
  leafHits: Array<{ filePath: string; id: string; sourceKey?: string }>,
  sourceKey: string,
  preferredDiskDir: string,
): { filePath: string; id: string } | undefined {
  const matching = (leafHits || []).filter((h) =>
    mediaSourceKeysCompatible(h.sourceKey, sourceKey),
  );
  if (!matching.length) return undefined;
  const preferred = preferredDiskDir
    ? matching.find((h) => h.filePath.startsWith(preferredDiskDir))
    : undefined;
  const pick = preferred || matching[0];
  return pick ? { filePath: pick.filePath, id: pick.id } : undefined;
}

/**
 * Prefer bytes/Content-Type over URL path extension when they disagree.
 */
function resolveMediaExtension(opts: {
  inputExtension?: string;
  url?: string;
  mime?: string;
  bytes?: Buffer;
}): string {
  if (opts.inputExtension?.trim()) {
    return opts.inputExtension.replace(/^\./, "").toLowerCase();
  }
  const sniffed = opts.bytes ? sniffMediaExtension(opts.bytes) : undefined;
  const fromMime = extensionFromMime(opts.mime);
  const fromUrl = opts.url ? extensionFromUrl(opts.url) : undefined;
  if (sniffed) return sniffed;
  if (fromMime) return fromMime;
  if (fromUrl) return fromUrl;
  // Soft-fail / empty bytes: prefer image template over generic bin
  return opts.url ? "jpg" : "bin";
}

/**
 * Convert AVIF (unsupported in Sitecore media templates) to JPEG via sharp.
 */
async function normalizeRasterBytes(
  bytes: Buffer,
  ext: string,
): Promise<{ bytes: Buffer; extension: string }> {
  if (ext !== "avif") return { bytes, extension: ext };
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(bytes).jpeg({ quality: 90 }).toBuffer();
    return { bytes: out, extension: "jpg" };
  } catch (err) {
    console.warn(
      `[bq:apply:media] AVIF→JPEG conversion failed (${err instanceof Error ? err.message : err}); storing AVIF bytes`,
    );
    return { bytes, extension: ext };
  }
}

function bqSourceKeySharedField(sourceKey: string): ScsField {
  return {
    id: BQ_MEDIA_SOURCE_KEY_FIELD_ID,
    hint: BQ_MEDIA_SOURCE_KEY_HINT,
    value: sourceKey,
  };
}

/**
 * Patch MediaLibrary / SharedMediaLibrary on BQ-owned collection content YAML.
 */
export async function syncCollectionMediaLibraryFields(
  collectionSystem: string,
  ids: {
    mediaLibraryId?: string;
    sharedMediaLibraryId?: string;
  },
): Promise<{ updated: boolean; file?: string }> {
  const collectionContentPath = `/sitecore/content/${collectionSystem}`;
  const fields: Array<{ name: string; value: string }> = [];
  if (ids.mediaLibraryId) {
    fields.push({
      name: "MediaLibrary",
      value: bracedMediaLibraryFieldValue(ids.mediaLibraryId),
    });
  }
  if (ids.sharedMediaLibraryId) {
    fields.push({
      name: "SharedMediaLibrary",
      value: bracedMediaLibraryFieldValue(ids.sharedMediaLibraryId),
    });
  }
  if (!fields.length) return { updated: false };

  // Authoring path resolve — collection content item may not exist yet.
  const resolved = await resolveItemIdByPath({
    sitecorePath: collectionContentPath,
    logPrefix: "[bq:apply:media]",
  });
  if (!resolved.found) return { updated: false };

  await updateItem({
    itemId: resolved.id,
    path: collectionContentPath,
    fields,
  });
  console.log(
    `[bq:apply:media] aligned collection MediaLibrary fields → ${collectionContentPath}`,
  );
  return { updated: true, file: collectionContentPath };
}

async function resolveAndWriteMediaFolder(opts: {
  sitecorePath: string;
  parentId: string;
  stats: ScsWriteStats;
  endpointName?: string;
  lookupPath?: (sitecorePath: string) => Promise<string | undefined>;
  skipCm?: boolean;
}): Promise<string> {
  const resolved = await resolveMediaFolderId({
    sitecorePath: opts.sitecorePath,
    endpointName: opts.endpointName,
    lookupPath: opts.lookupPath,
    skipCm: opts.skipCm,
    logPrefix: "[bq:apply:media]",
  });

  if (resolved.found) {
    return resolved.id;
  }

  const applied = await applyAuthoringItem({
    parent: opts.parentId,
    template: MEDIA_FOLDER_TEMPLATE,
    path: opts.sitecorePath,
  });
  recordWrite(opts.stats, applied);
  return applied.itemId;
}

/**
 * Ensure Project/{collection} → {site} → folder chain on CM (Authoring).
 * CM path lookup first; missing folders are created under the live parent id.
 */
export async function ensureMediaFolderChain(
  opts: {
    collectionSystem: string;
    siteName: string;
    folder: string[];
    handle: string;
    endpointName?: string;
    lookupPath?: (sitecorePath: string) => Promise<string | undefined>;
    skipCm?: boolean;
  },
  stats: ScsWriteStats,
): Promise<{ parentId: string; sitecorePath: string }> {
  const cm = {
    endpointName: opts.endpointName,
    lookupPath: opts.lookupPath,
    skipCm: opts.skipCm,
  };

  const collectionSitecore = `/sitecore/media library/Project/${opts.collectionSystem}`;
  const resolvedCollectionId = await resolveAndWriteMediaFolder({
    sitecorePath: collectionSitecore,
    parentId: MEDIA_LIBRARY_PROJECT_ROOT_ID,
    stats,
    ...cm,
  });

  const siteSitecore = mediaLibrarySitecorePath(
    opts.collectionSystem,
    opts.siteName,
  );
  let parentId = await resolveAndWriteMediaFolder({
    sitecorePath: siteSitecore,
    parentId: resolvedCollectionId,
    stats,
    ...cm,
  });

  // Align SharedMediaLibrary when the shared folder is the site folder or CM owns it.
  const sharedSitecore = `/sitecore/media library/Project/${opts.collectionSystem}/shared`;
  const sharedResolved = await resolveMediaFolderId({
    sitecorePath: sharedSitecore,
    endpointName: opts.endpointName,
    lookupPath: opts.lookupPath,
    skipCm: opts.skipCm,
    logPrefix: "[bq:apply:media]",
  });
  let sharedId: string | undefined;
  if (opts.siteName === "shared") {
    sharedId = parentId;
  } else if (sharedResolved.found) {
    sharedId = sharedResolved.id;
  }

  await syncCollectionMediaLibraryFields(opts.collectionSystem, {
    mediaLibraryId: resolvedCollectionId,
    sharedMediaLibraryId: sharedId,
  });

  let sitecorePath = siteSitecore;
  for (const segment of opts.folder) {
    const name = sanitizeMediaItemName(segment);
    sitecorePath = `${sitecorePath}/${name}`;
    parentId = await resolveAndWriteMediaFolder({
      sitecorePath,
      parentId,
      stats,
      ...cm,
    });
  }

  return { parentId, sitecorePath };
}
function assertSingleMediaSource(
  input: MediaSourceInput,
  label = "Media value",
): void {
  const sources = [
    input.url?.trim() ? "url" : undefined,
    input.base64?.trim() ? "base64" : undefined,
    input.svgMarkup?.trim() ? "svgMarkup" : undefined,
  ].filter(Boolean);
  if (sources.length === 0) {
    throw new Error(`${label} requires \`url\`, \`base64\`, or \`svgMarkup\``);
  }
  if (sources.length > 1) {
    throw new Error(
      `${label} must not mix sources (${sources.join(", ")}); use exactly one`,
    );
  }
}

function encodeSvgMarkup(svgMarkup: string): {
  bytes: Buffer;
  sourceKey: string;
} {
  const trimmed = svgMarkup.trim();
  if (!trimmed) {
    throw new Error("Media svgMarkup value is empty");
  }
  if (!/<svg[\s>]/i.test(trimmed)) {
    throw new Error(
      "Media svgMarkup must contain an <svg> root element",
    );
  }
  const bytes = Buffer.from(trimmed, "utf8");
  return {
    bytes,
    sourceKey: `svgMarkup:${stableGuid("media-svg", trimmed)}`,
  };
}

/**
 * Load media bytes from url / base64 / svgMarkup.
 * URL sources are absolutized against `siteOrigin` and fetched with retries.
 */
export async function loadMediaBytes(
  input: MediaSourceInput,
  opts: {
    siteOrigin?: string | null;
    /** Injectable backoff for {@link fetchMediaUrlWithRetries} (tests). */
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<{ bytes: Buffer; mime?: string; sourceKey: string }> {
  assertSingleMediaSource(input);

  if (input.svgMarkup?.trim()) {
    const { bytes, sourceKey } = encodeSvgMarkup(input.svgMarkup);
    return { bytes, mime: "image/svg+xml", sourceKey };
  }

  if (input.base64) {
    const dataUrl = parseDataUrl(input.base64);
    const raw = dataUrl?.base64 ?? input.base64.replace(/\s+/g, "");
    if (!raw) {
      throw new Error("Media base64 value is empty");
    }
    const bytes = Buffer.from(raw, "base64");
    if (bytes.length === 0) {
      throw new Error("Media base64 value decoded to empty bytes");
    }
    return {
      bytes,
      mime: dataUrl?.mime,
      sourceKey: `base64:${stableGuid("media-b64", raw)}`,
    };
  }

  if (input.url) {
    const url = absolutizeMediaDownloadUrl(input.url, opts.siteOrigin);
    if (!isAbsoluteHttpUrl(url)) {
      throw new Error(
        `Failed to download media (network): ${url}: Failed to parse URL from ${url}`,
      );
    }
    const response = await fetchMediaUrlWithRetries(url, {
      sleep: opts.sleep,
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim();
    return { bytes, mime, sourceKey: `url:${url}` };
  }

  throw new Error("Media value requires `url`, `base64`, or `svgMarkup`");
}

/** True when a URL fetch failed (HTTP/network) — soft-fail path may omit Blob. */
export function isMediaDownloadFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.startsWith("Failed to download media");
}

function mediaSourceKeyFromInput(
  input: MediaSourceInput,
  siteOrigin?: string | null,
): string {
  if (input.url?.trim()) {
    return `url:${absolutizeMediaDownloadUrl(input.url, siteOrigin)}`;
  }
  if (input.base64?.trim()) {
    return `base64:${stableGuid("media-b64", input.base64)}`;
  }
  if (input.svgMarkup?.trim()) {
    return `svgMarkup:${stableGuid("media-svg", input.svgMarkup)}`;
  }
  return `unknown:${stableGuid("media", JSON.stringify(input))}`;
}

/**
 * Normalize definition media values into a structured input.
 * - string URL → `{ url }`
 * - string base64 / data-URL → `{ base64 }`
 * - object `{ url }` / `{ base64 }` / `{ svgMarkup }` → as-is
 * - already Sitecore `<image …>` → `"passthrough"`
 */
export function normalizeMediaImageInput(
  raw: string | MediaSourceInput,
): MediaSourceInput | "passthrough" {
  if (typeof raw !== "string") {
    const url = raw.url?.trim() || undefined;
    const base64 = raw.base64?.trim() || undefined;
    const svgMarkup = raw.svgMarkup?.trim() || undefined;
    return { ...raw, url, base64, svgMarkup };
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("<image")) return "passthrough";
  if (isProbablyUrl(trimmed)) return { url: trimmed };
  if (isProbablyBase64(trimmed)) return { base64: trimmed };
  return { url: trimmed };
}

export function encodeImageFieldXml(mediaId: string, alt?: string): string {
  // Sitecore Pages / Image fields expect braced uppercase dashed GUIDs.
  const id = toAuthoringGuid(mediaId);
  return `<image mediaid="${id}"${alt ? ` alt="${alt.replace(/"/g, "&quot;")}"` : ""} />`;
}

/**
 * Download or decode media and create/update it on CM via Authoring
 * (`uploadMedia` for Blob bytes); returns the live `mediaId`.
 *
 * Template + fields depend on detected extension (jpg/svg/webp/pdf/zip/doc/…).
 * URL sources already present at the target Sitecore path are reused (no
 * download) unless `BQ_MEDIA_FORCE_REFRESH` is set; inline base64 / SVG
 * payloads always re-upload.
 *
 * URL download failures (HTTP/network) soft-fail: reuse the existing CM item if
 * present, otherwise create a media item **without** Blob so generate continues.
 */
export async function ensureMediaFromSource(
  input: MediaSourceInput,
  options: EnsureMediaOptions,
): Promise<EnsureMediaResult> {
  const collectionSystem = options.collectionSystem ?? DEFAULT_COLLECTION;
  const siteName = options.siteName ?? DEFAULT_SITE;
  const siteOrigin =
    resolveSiteOrigin(options.siteOrigin, { siteSystem: siteName }) ||
    undefined;
  const stats = emptyWriteStats();
  const ensureStarted = Date.now();

  const hasInlinePayload = Boolean(
    input.base64?.trim() || input.svgMarkup?.trim(),
  );
  if (
    input.svgMarkup?.trim() &&
    input.extension &&
    input.extension.replace(/^\./, "").toLowerCase() !== "svg"
  ) {
    throw new Error(
      `Media svgMarkup requires extension "svg" (got "${input.extension}")`,
    );
  }

  assertSingleMediaSource(input);

  const downloadUrl = input.url?.trim()
    ? absolutizeMediaDownloadUrl(input.url, siteOrigin)
    : undefined;
  let sourceKey = mediaSourceKeyFromInput(input, siteOrigin);
  const folderSegments = (options.folder ?? []).map((segment) =>
    sanitizeMediaItemName(segment),
  );
  const memoKey = mediaEnsureMemoKey(collectionSystem, siteName, sourceKey);
  const memoHit = getMediaEnsureMemo().get(memoKey);
  const seedAlt = input.alt?.trim() || "";
  if (memoHit && !isMediaForceRefresh()) {
    // Re-run when a new seed alt must be written (memo may predate the patch).
    const memoAlt = String(memoHit.alt || "").trim();
    if (!seedAlt || seedAlt === memoAlt) {
      logMediaEnsureSummary(
        "reused",
        memoHit.sitecorePath || sourceKey.slice(0, 64),
        Date.now() - ensureStarted,
      );
      return { ...memoHit, stats: emptyWriteStats() };
    }
  }

  // Resolve names/paths before any download so we can skip-rewrite first.
  let ext = input.svgMarkup?.trim()
    ? "svg"
    : resolveMediaExtension({
        inputExtension: input.extension,
        url: downloadUrl || input.url,
      });
  let profile = resolveMediaProfile(ext);
  const rawItemName =
    input.name ||
    (downloadUrl ? nameFromUrl(downloadUrl) : undefined) ||
    (input.url ? nameFromUrl(input.url) : undefined) ||
    options.itemName ||
    (hasInlinePayload
      ? `inline-${stableGuid(options.handle, sourceKey).slice(0, 8)}`
      : "media");
  const { englishName: itemName, displayName: itemDisplayName } =
    await resolveMediaEnglishItemName(rawItemName, options.sourceLanguage);

  let sitecoreFolderPath = mediaLibrarySitecorePath(collectionSystem, siteName);
  for (const segment of folderSegments) {
    sitecoreFolderPath = `${sitecoreFolderPath}/${segment}`;
  }
  const sitecoreItemPath = `${sitecoreFolderPath}/${itemName}`;
  const forceRefresh = isMediaForceRefresh();

  const rememberResult = (result: EnsureMediaResult): EnsureMediaResult => {
    getMediaEnsureMemo().set(memoKey, { ...result, stats: emptyWriteStats() });
    return result;
  };

  const lookupExistingMediaId = async (): Promise<string | undefined> => {
    const existing = await resolveItemIdByPath({
      sitecorePath: sitecoreItemPath,
      endpointName: options.endpointName,
      lookupPath: options.lookupPath,
      skipCm: options.skipCmMediaFolderAlign,
      logPrefix: "[bq:apply:media]",
    });
    return existing.found ? existing.id : undefined;
  };

  const ensureChainForWrite = () =>
    ensureMediaFolderChain(
      {
        collectionSystem,
        siteName,
        folder: folderSegments,
        handle: options.handle,
        endpointName: options.endpointName,
        lookupPath: options.lookupPath,
        skipCm: options.skipCmMediaFolderAlign,
      },
      stats,
    );

  // Fast path: URL media already on CM at this path — no download / AI alt.
  if (!hasInlinePayload && !forceRefresh && input.url?.trim()) {
    const existingId = await lookupExistingMediaId();
    if (existingId) {
      logMediaEnsureSummary(
        "reused",
        sitecoreItemPath,
        Date.now() - ensureStarted,
      );
      return rememberResult({
        mediaId: existingId,
        sitecorePath: sitecoreItemPath,
        stats,
        profile,
        alt: input.alt?.trim() || undefined,
      });
    }
  }

  let bytes: Buffer | null = null;
  let mime: string | undefined;
  let downloadFailed = false;
  let downloadErrorMessage = "";

  try {
    const loaded = await loadMediaBytes(input, { siteOrigin });
    bytes = loaded.bytes;
    mime = loaded.mime;
    sourceKey = loaded.sourceKey;
  } catch (err) {
    if (!input.url?.trim() || hasInlinePayload || !isMediaDownloadFailure(err)) {
      throw err;
    }
    downloadFailed = true;
    downloadErrorMessage = err instanceof Error ? err.message : String(err);
  }

  // Re-key memo if loadMediaBytes normalized sourceKey (same for URL).
  const memoKeyAfterLoad = mediaEnsureMemoKey(
    collectionSystem,
    siteName,
    sourceKey,
  );

  ext = input.svgMarkup?.trim()
    ? "svg"
    : resolveMediaExtension({
        inputExtension: input.extension,
        url: input.url,
        mime,
        bytes: bytes ?? undefined,
      });

  if (bytes) {
    const normalized = await normalizeRasterBytes(bytes, ext);
    bytes = normalized.bytes;
    ext = normalized.extension;
    if (ext === "jpg") mime = "image/jpeg";
  }

  profile = resolveMediaProfile(ext);

  // Soft-fail: keep going without Blob when URL download fails.
  if (downloadFailed || !bytes) {
    const existingId = await lookupExistingMediaId();
    console.warn(
      `[bq:apply:media] ${downloadErrorMessage || "Media bytes unavailable"} — ` +
        (existingId
          ? `reusing existing media without refresh: ${sitecoreItemPath}`
          : `emitting media item without Blob: ${sitecoreItemPath}`),
    );
    if (existingId) {
      logMediaEnsureSummary(
        "reused",
        sitecoreItemPath,
        Date.now() - ensureStarted,
      );
      return rememberResult({
        mediaId: existingId,
        sitecorePath: sitecoreItemPath,
        stats,
        profile,
        alt: input.alt?.trim() || undefined,
      });
    }

    const chain = await ensureChainForWrite();
    const versionFields: ScsField[] = [];
    const alt = input.alt?.trim() || "";
    if (profile.supportAlt && alt) {
      versionFields.push({
        id: MEDIA_FIELD_IDS.Alt,
        hint: "Alt",
        value: alt,
      });
    }
    if (profile.supportTitle) {
      const title = input.title?.trim() || alt;
      if (title) {
        versionFields.push({
          id: MEDIA_FIELD_IDS.Title,
          hint: "Title",
          value: title,
        });
      }
    }

    const sharedFields: ScsField[] = [
      {
        id: MEDIA_FIELD_IDS.MimeType,
        hint: "Mime Type",
        value: profile.mime,
      },
      {
        id: MEDIA_FIELD_IDS.Extension,
        hint: "Extension",
        value: profile.extension,
      },
      bqSourceKeySharedField(sourceKey),
    ];

    const applied = await applyAuthoringItem({
      parent: chain.parentId,
      template: profile.templateId,
      path: sitecoreItemPath,
      sharedFields,
      languages: mediaDisplayNameLanguageBlocks({
        englishName: itemName,
        displayName: itemDisplayName,
        sourceLanguage: options.sourceLanguage,
        versionFields: versionFields.length ? versionFields : undefined,
      }),
    });
    recordWrite(stats, applied);
    logMediaEnsureSummary("wrote", sitecoreItemPath, Date.now() - ensureStarted);
    return rememberResult({
      mediaId: applied.itemId,
      sitecorePath: sitecoreItemPath,
      stats: mergeWriteStats(emptyWriteStats(), stats),
      profile,
      alt: alt || undefined,
    });
  }

  // Rewrite path — resolve alt only when writing (seed / AI).
  let resolvedAlt = "";
  if (profile.supportAlt) {
    const { resolveMediaAlt } = await import("./media-alt");
    const altResult = await resolveMediaAlt({
      alt: input.alt,
      url: input.url,
      bytes,
      mime: profile.mime,
      itemName,
    });
    resolvedAlt = altResult.alt;
  }

  // Ensure the folder chain exists before upload creates the item under it.
  await ensureChainForWrite();

  // Authoring uploadMedia (binary) — do not push Blob via updateItem.
  const mediaRelPath = sitecoreItemPath
    .replace(/^\/sitecore\/media library\//i, "")
    .replace(/^\/+/, "");
  const tmpExt = profile.extension ? `.${profile.extension}` : "";
  const tmpFile = path.join(
    os.tmpdir(),
    `bq-media-${randomUUID()}${tmpExt}`,
  );
  fs.writeFileSync(tmpFile, bytes);
  let mediaId: string;
  try {
    const uploaded = await uploadMedia({
      itemPath: mediaRelPath,
      filePath: tmpFile,
      alt: profile.supportAlt ? resolvedAlt || undefined : undefined,
      overwriteExisting: true,
      sitecorePath: sitecoreItemPath,
      endpointName: options.endpointName,
    });
    if (!uploaded.itemId) {
      throw new Error(
        `[bq:apply:media] uploadMedia returned no itemId for ${sitecoreItemPath}`,
      );
    }
    mediaId = uploaded.itemId;
    cacheAuthoringPathId(sitecoreItemPath, mediaId);
    recordWrite(stats, uploaded.created ? "created" : "updated");
    await applyMediaDisplayNames({
      mediaId,
      englishName: itemName,
      displayName: itemDisplayName,
      sourceLanguage: options.sourceLanguage,
      endpointName: options.endpointName,
    });
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }
  logMediaEnsureSummary("wrote", sitecoreItemPath, Date.now() - ensureStarted);

  const result = {
    mediaId,
    sitecorePath: sitecoreItemPath,
    stats: mergeWriteStats(emptyWriteStats(), stats),
    profile,
    alt: resolvedAlt || undefined,
  };
  getMediaEnsureMemo().set(memoKeyAfterLoad, {
    ...result,
    stats: emptyWriteStats(),
  });
  return result;
}