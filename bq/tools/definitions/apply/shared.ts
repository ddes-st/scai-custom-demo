import { applyAuthoringItem } from "../../shared/authoring-apply-bridge";
import path from "node:path";
import type { ScsField } from "../../shared/provenance";
import {
  type ScsLanguageBlock,
  type ScsWriteStats,
  emptyWriteStats,
  recordWrite
} from "../../shared/authoring-item-model";
import type { ScopeDefinition } from "../../shared/scopes";
import {
  collectDescriptionLanguageFields,
} from "../../shared/standard-fields";
import { FIELD_IDS } from "../../shared/system-ids";
import { translateText } from "../../shared/translate";
import {
  normalizeCultureKey,
  resolveContentLanguages,
} from "../../shared/resolve-content-languages";
import { resolveEnglishItemName } from "../../shared/english-item-name";
import { normalizeDataFolderSegments } from "../../shared/naming";
import { resolveItemIdByPathWithRewrite } from "../../shared/resolve-item-id-by-path";

/**
 * Generic Sitecore folder template (site content folders).
 * Use the platform Folder template — some XM Cloud tenants reject the legacy
 * `1de1154b-…` Node/folder GUID with ChangeTemplateItemCommand "did not exist".
 */
export const SITE_FOLDER_TEMPLATE = "a87a00b1-e6db-45ab-8b54-636fec3b5523";

export function mergeFields(...groups: ScsField[][]): ScsField[] {
  const byId = new Map<string, ScsField>();
  for (const group of groups) {
    for (const field of group) {
      byId.set(field.id.toLowerCase(), field);
    }
  }
  return [...byId.values()];
}

export async function translateFields(
  fields: ScsField[],
  culture: string,
  sourceCulture: string = "en",
  _options?: {
    /** Retained for call-site compatibility; field scope no longer affects translation. */
    fieldScope?: "language" | "version";
  },
): Promise<ScsField[]> {
  const out: ScsField[] = [];
  for (const field of fields) {
    const value = String(field.value);
    if (!value.trim()) {
      out.push(field);
      continue;
    }
    // General Link XML: translate text attribute only
    if (/^\s*<link\b/i.test(value) && /\btext="/i.test(value)) {
      const textMatch = value.match(/\btext="([^"]*)"/i);
      const originalText = textMatch?.[1] ?? "";
      if (originalText.trim()) {
        // translateText unwraps &quot; / wrapping quotes before cache lookup
        const translated = await translateText(
          originalText,
          culture,
          sourceCulture,
        );
        out.push({
          ...field,
          value: value.replace(
            /\btext="[^"]*"/i,
            `text="${translated.replace(/"/g, "&quot;")}"`,
          ),
        });
        continue;
      }
    }
    out.push({
      ...field,
      value: await translateText(value, culture, sourceCulture),
    });
  }
  return out;
}

export async function buildLanguageBlocks(
  sourceLanguage: ScsField[],
  sourceVersion: ScsField[],
  cultures: string[],
  sourceCulture: string = "en",
  /** @deprecated Ignored — Authoring apply does not read YAML. */
  _existingYamlPath?: string,
): Promise<ScsLanguageBlock[]> {
  const { sourceCulture: src, emitCultures } = resolveContentLanguages({
    culture: sourceCulture,
    cultures,
  });
  const srcKey = normalizeCultureKey(src).toLowerCase();

  const blocks: ScsLanguageBlock[] = [];

  for (const lang of emitCultures) {
    const isSource = normalizeCultureKey(lang).toLowerCase() === srcKey;
    if (isSource) {
      blocks.push({
        language: lang,
        languageFields: sourceLanguage.length ? sourceLanguage : undefined,
        versionFields: sourceVersion.length ? sourceVersion : undefined,
      });
      continue;
    }
    blocks.push({
      language: lang,
      languageFields: sourceLanguage.length
        ? await translateFields(sourceLanguage, lang, src, {
            fieldScope: "language",
          })
        : undefined,
      versionFields: sourceVersion.length
        ? await translateFields(sourceVersion, lang, src, {
            fieldScope: "version",
          })
        : undefined,
    });
  }

  return blocks;
}

/**
 * Ensure each folder segment exists as a Sitecore folder item (Authoring API).
 * Skip rewriting segments that already exist within `skipExistingRootDepth`
 * (e.g. pre-existing `Dictionary` / `Enums` roots).
 * Segment names are forced to English Sitecore item names.
 *
 * `diskDir` is a synthetic path.join of segments for call-site labels only —
 * nothing is read from or written to disk.
 */
export async function ensureFolderChain(
  scope: ScopeDefinition,
  folder: string[],
  handle: string,
  options: {
    skipExistingRootDepth?: number;
    folderTemplate?: string;
    /** Capture/source culture for translating non-English folder segments. */
    sourceLanguage?: string | null;
    /** Applied to the deepest folder segment when metadata props are set. */
    leafFolder?: {
      displayName?: string;
      description?: string;
      shortDescription?: string;
    };
    endpointName?: string;
    lookupPath?: (sitecorePath: string) => Promise<string | undefined>;
    skipCm?: boolean;
  } = {},
): Promise<{
  parentId: string;
  parentSitecorePath: string;
  diskDir: string;
  stats: ScsWriteStats;
}> {
  const skipExistingRootDepth = options.skipExistingRootDepth ?? 0;
  const folderTemplate = options.folderTemplate ?? SITE_FOLDER_TEMPLATE;
  const sourceLanguage = options.sourceLanguage?.trim() || "en";
  const stats = emptyWriteStats();
  let parentId = scope.rootItemId.toLowerCase();
  let sitecorePath = scope.sitecorePath;
  let diskDir = scope.diskRoot;

  const normalizedFolder = normalizeDataFolderSegments(folder) ?? folder;
  const englishFolder: string[] = [];
  for (const raw of normalizedFolder) {
    englishFolder.push(
      await resolveEnglishItemName(raw, {
        sourceLanguage,
        structuralFolder: true,
      }),
    );
  }

  for (let i = 0; i < englishFolder.length; i++) {
    const segment = englishFolder[i]!;
    void handle;
    const expectedPath = `${sitecorePath}/${segment}`;
    const cmResolved = await resolveItemIdByPathWithRewrite({
      sitecorePath: expectedPath,
      endpointName: options.endpointName,
      lookupPath: options.lookupPath,
      skipCm: options.skipCm,
      logPrefix: "[bq:apply:folder]",
    });
    const reused =
      cmResolved.found &&
      (cmResolved.source === "cm" || cmResolved.source === "cache");
    let folderId = cmResolved.found ? cmResolved.id : undefined;

    sitecorePath = expectedPath;

    const isLeaf = i === englishFolder.length - 1;
    const leafHasMetadata =
      Boolean(options.leafFolder?.displayName?.trim()) ||
      Boolean(options.leafFolder?.description?.trim()) ||
      Boolean(options.leafFolder?.shortDescription?.trim());
    const skipLeafMetadataOnly =
      reused &&
      i < skipExistingRootDepth &&
      !(isLeaf && leafHasMetadata);

    const leafLanguageFields: ScsField[] = [];
    if (!skipLeafMetadataOnly && isLeaf && options.leafFolder?.displayName?.trim()) {
      leafLanguageFields.push({
        id: FIELD_IDS.DisplayName,
        hint: "__Display name",
        value: options.leafFolder.displayName.trim(),
      });
    }
    if (!skipLeafMetadataOnly && isLeaf && options.leafFolder) {
      leafLanguageFields.push(
        ...collectDescriptionLanguageFields(
          options.leafFolder.description,
          options.leafFolder.shortDescription,
        ),
      );
    }

    if (skipLeafMetadataOnly && folderId) {
      parentId = folderId;
      diskDir = path.join(diskDir, segment);
      continue;
    }

    // Create/update under the live parent — no client-supplied GUID.
    const folderApplied = await applyAuthoringItem({
      parent: parentId,
      template: folderTemplate,
      path: sitecorePath,
      sharedFields: [
        {
          id: FIELD_IDS.Sortorder,
          hint: "__Sortorder",
          value: 100,
        },
      ],
      ...(leafLanguageFields.length
        ? {
            languages: [
              {
                language: "en",
                languageFields: leafLanguageFields,
              },
            ],
          }
        : {}),
    });
    recordWrite(stats, folderApplied);
    folderId = folderApplied.itemId;

    if (!folderId) {
      throw new Error(
        `[bq:apply:folder] failed to ensure folder at ${sitecorePath}`,
      );
    }
    parentId = folderId;
    diskDir = path.join(diskDir, segment);
  }

  return { parentId, parentSitecorePath: sitecorePath, diskDir, stats };
}
