import { saiHandleFrom } from "../../shared/sai-handle";
import {
  assertSingleImageSource,
  sitecoreGuidFromRef,
  sitecorePathFromRef,
} from "../../shared/definition-ref";
import {
  encodeImageFieldXml,
  ensureMediaFromSource,
  normalizeMediaImageInput,
  type EnsureMediaOptions,
  type EnsureMediaResult,
  type MediaSourceInput,
} from "../../shared/media-from-source";
import { requireMediaDefinition } from "../../shared/media-registry";
import { resolveItemIdByPath } from "../../shared/resolve-item-id-by-path";
import {
  emptyWriteStats,
  type ScsWriteStats,
} from "../../shared/authoring-item-model";
import { DEFAULT_PROJECT_COLLECTION } from "../../shared/data-placement";
import type { DataImageValue, MediaDefinition } from "../types";

const MEDIA_SAI_VERSION = 1;

export type MaterializeImageOptions = {
  /** Fallback handle when the value is inline (not a media definitionKey ref). */
  handle: string;
  folder?: string[];
  itemName?: string;
  collectionSystem?: string;
  siteName?: string;
  /** Capture page / site origin for root-relative media URLs. */
  siteOrigin?: string | null;
  /** Capture / site source culture for English Path + DisplayName. */
  sourceLanguage?: string | null;
  label: string;
};

function mediaEnsureOptions(
  definition: MediaDefinition,
): EnsureMediaOptions & { input: MediaSourceInput } {
  const name = definition.name.trim();
  if (!name) {
    throw new Error(`media "${definition.definitionKey}": name must be non-empty`);
  }

  const collectionSystem =
    definition.location?.collectionSystem ??
    definition.collectionSystem ??
    DEFAULT_PROJECT_COLLECTION;

  return {
    handle: saiHandleFrom(definition.definitionKey, MEDIA_SAI_VERSION),
    folder: definition.location?.folder ?? [],
    itemName: name,
    collectionSystem,
    siteName: definition.location?.siteName,
    input: {
      url: definition.url,
      base64: definition.base64,
      svgMarkup: definition.svgMarkup,
      alt: definition.alt,
      title: definition.title,
      name,
      extension: definition.extension,
    },
  };
}

/**
 * Ensure media-library YAML for a standalone `kind: "media"` definition.
 */
export async function ensureMediaFromDefinition(
  definition: MediaDefinition,
): Promise<EnsureMediaResult> {
  const { input, ...options } = mediaEnsureOptions(definition);
  return ensureMediaFromSource(input, options);
}

/**
 * Emit a standalone media definition (media library item + Blob).
 */
export async function applyMediaDefinition(
  definition: MediaDefinition,
): Promise<ScsWriteStats> {
  const result = await ensureMediaFromDefinition(definition);
  return result.stats;
}

/**
 * Shared Image-field materialization for field defaults / content values.
 * Tagged sources (exactly one): url | base64 | svgMarkup | path | guid | definitionKey.
 * Also accepts string URL/base64 and Sitecore `<image>` passthrough.
 */
export async function materializeImageFieldValue(
  raw: string | DataImageValue,
  options: MaterializeImageOptions,
): Promise<{ value: string; stats: ScsWriteStats; mediaId?: string }> {
  if (typeof raw === "object" && raw !== null) {
    const record = raw as Record<string, unknown>;
    const source = assertSingleImageSource(record, options.label);

    if (source === "definitionKey") {
      const key = String(raw.definitionKey).trim();
      const def = requireMediaDefinition(key, options.label);
      const result = await ensureMediaFromDefinition(def);
      if (!result.profile.isImageFieldEligible) {
        throw new Error(
          `${options.label}: definitionKey "${key}" is not an image ` +
            `(extension "${result.profile.extension}"); Sitecore Image fields require image media`,
        );
      }
      const alt = raw.alt?.trim() || def.alt || result.alt;
      return {
        value: encodeImageFieldXml(result.mediaId, alt),
        stats: result.stats,
        mediaId: result.mediaId,
      };
    }

    if (source === "path") {
      const mediaPath = sitecorePathFromRef({ path: String(raw.path) });
      const resolvedMedia = await resolveItemIdByPath({
        sitecorePath: mediaPath,
        logPrefix: "[bq:apply:media]",
      });
      if (!resolvedMedia.found) {
        throw new Error(
          `${options.label}: media path not found on CM: ${mediaPath}`,
        );
      }
      const mediaId = resolvedMedia.id;
      return {
        value: encodeImageFieldXml(mediaId, raw.alt),
        stats: emptyWriteStats(),
        mediaId,
      };
    }

    if (source === "guid") {
      const mediaId = sitecoreGuidFromRef({ guid: String(raw.guid) });
      return {
        value: encodeImageFieldXml(mediaId, raw.alt),
        stats: emptyWriteStats(),
        mediaId,
      };
    }

    // url | base64 | svgMarkup → ensure media from source
    const result = await ensureMediaFromSource(
      {
        url: source === "url" ? raw.url : undefined,
        base64: source === "base64" ? raw.base64 : undefined,
        svgMarkup: source === "svgMarkup" ? raw.svgMarkup : undefined,
        alt: raw.alt,
        name: raw.name,
        extension: raw.extension,
      },
      {
        handle: options.handle,
        folder: options.folder ?? [],
        itemName: options.itemName,
        collectionSystem: options.collectionSystem ?? DEFAULT_PROJECT_COLLECTION,
        siteName: options.siteName,
        siteOrigin: options.siteOrigin,
        sourceLanguage: options.sourceLanguage,
      },
    );

    if (!result.profile.isImageFieldEligible) {
      throw new Error(
        `${options.label}: resolved media is not an image ` +
          `(extension "${result.profile.extension}"); Sitecore Image fields require image media`,
      );
    }

    return {
      value: encodeImageFieldXml(result.mediaId, raw.alt?.trim() || result.alt),
      stats: result.stats,
      mediaId: result.mediaId,
    };
  }

  const normalized = normalizeMediaImageInput(raw as string | MediaSourceInput);
  if (normalized === "passthrough") {
    return { value: String(raw), stats: emptyWriteStats() };
  }

  const result = await ensureMediaFromSource(normalized, {
    handle: options.handle,
    folder: options.folder ?? [],
    itemName: options.itemName,
    collectionSystem: options.collectionSystem ?? DEFAULT_PROJECT_COLLECTION,
    siteName: options.siteName,
    siteOrigin: options.siteOrigin,
    sourceLanguage: options.sourceLanguage,
  });

  if (!result.profile.isImageFieldEligible) {
    throw new Error(
      `${options.label}: resolved media is not an image ` +
        `(extension "${result.profile.extension}"); Sitecore Image fields require image media`,
    );
  }

  return {
    value: encodeImageFieldXml(result.mediaId, normalized.alt?.trim() || result.alt),
    stats: result.stats,
    mediaId: result.mediaId,
  };
}
