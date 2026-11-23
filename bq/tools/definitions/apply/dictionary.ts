import { primarySaiHandle, minVersionNumber } from "../../shared/sai-handle";
import { applyAuthoringItem } from "../../shared/authoring-apply-bridge";
import { resolveDictionaryDefinitionVersions, resolveDictionaryEntryVersions } from "../../shared/normalize-versions";
import path from "node:path";
import { ensureSystemLanguages } from "../../shared/ensure-languages";
import {
  DICTIONARY_ENTRY_TEMPLATE,
  DICTIONARY_FIELD_IDS,
  DICTIONARY_FOLDER_TEMPLATE,
} from "../../shared/dictionary-ids";
import type { ScsField } from "../../shared/provenance";
import {
  type ScsLanguageBlock,
  type ScsWriteStats,
  emptyWriteStats,
  mergeWriteStats,
  recordWrite
} from "../../shared/authoring-item-model";
import { proposeValidItemName } from "../../shared/naming";
import {
  getDictionaryRoot,
  getDictionaryScope,
  resolveDictionaryFolder,
  resolveDictionaryParentId,
} from "../../shared/scopes";
import {
  collectDescriptionLanguageFields,
  collectStandardFields,
  pickStandardFields,
} from "../../shared/standard-fields";
import {
  DICTIONARY_PHRASE_TRANSLATE_HINTS,
  buildMultiVersionLanguageBlocks,
} from "../../shared/localized-versions";
import { preserveOrDefaultSortOrderField } from "../../shared/sort-order";
import type {
  DictionaryEntry,
  DictionaryDefinition,
  DictionaryEntryVersionDef,
} from "../types";
import {
  buildLanguageBlocks,
  ensureFolderChain,
  mergeFields,
} from "./shared";

function primaryDefinitionVersion(definition: DictionaryDefinition) {
  const versions = resolveDictionaryDefinitionVersions(definition);
  const primary = minVersionNumber(versions);
  return versions.find((ver) => ver.version === primary)!;
}

function entryItemName(entry: DictionaryEntry): string {
  const raw = entry.name?.trim() || entry.key;
  return proposeValidItemName(raw, "dictionary-entry");
}

async function buildEntrySharedFields(
  entry: DictionaryEntry,
  index: number,
  sitecorePath: string,
): Promise<ScsField[]> {
  const standard = collectStandardFields(
    pickStandardFields(entry as unknown as Record<string, unknown>),
  );

  const shared: ScsField[] = [
    {
      id: DICTIONARY_FIELD_IDS.Key,
      hint: "Key",
      value: entry.key,
    },
  ];

  const sortOrderField = await preserveOrDefaultSortOrderField(
    sitecorePath,
    index,
    typeof entry.sortOrder === "number" ? entry.sortOrder : undefined,
  );
  if (sortOrderField) shared.push(sortOrderField);

  return mergeFields(shared, standard.shared);
}

function buildEntryVersionLanguageFields(
  ver: DictionaryEntryVersionDef,
): ScsField[] {
  return mergeFields(
    [
      {
        id: DICTIONARY_FIELD_IDS.Phrase,
        hint: "Phrase",
        value: ver.phrase,
      },
    ],
    collectDescriptionLanguageFields(ver.description, ver.shortDescription),
  );
}

async function buildEntryLanguages(
  entry: DictionaryEntry,
  cultures: string[],
  sourceCulture: string = "en",
  sitecorePath?: string,
): Promise<ScsLanguageBlock[]> {
  const versions = resolveDictionaryEntryVersions(entry);

  const seen = new Set<number>();
  for (const ver of versions) {
    if (!Number.isInteger(ver.version) || ver.version < 1) {
      throw new Error(
        `dictionary entry "${entry.key}" has invalid version ${ver.version}`,
      );
    }
    if (seen.has(ver.version)) {
      throw new Error(
        `dictionary entry "${entry.key}" repeats version ${ver.version}`,
      );
    }
    seen.add(ver.version);
  }

  // Single version: keep Phrase under Languages.Fields (unversioned) for YAML parity.
  if (versions.length === 1) {
    const languageFields = buildEntryVersionLanguageFields(versions[0]!);
    return buildLanguageBlocks(
      languageFields,
      [],
      cultures,
      sourceCulture,
    );
  }

  const enVersions: NonNullable<ScsLanguageBlock["versions"]> =
    versions.map((ver) => ({
      version: ver.version,
      versionFields: buildEntryVersionLanguageFields(ver),
    }));

  return buildMultiVersionLanguageBlocks({
    enVersions,
    cultures,
    translateHints: DICTIONARY_PHRASE_TRANSLATE_HINTS,
    sourceCulture,
    sitecorePath,
  });
}

/**
 * Emit dictionary entry YAML under:
 * `{scope}/{dictionaryRoot}/…/{location.folder}/…/{entryName}`
 *
 * When `cultures` is set, auto-translates `Phrase` and ensures language items.
 * Each entry's `versions[]` drives Sitecore numbered versions.
 */
export async function applyDictionaryDefinition(
  definition: DictionaryDefinition,
): Promise<ScsWriteStats> {
  const { location, entries, cultures = [], culture: sourceCulture = "en" } =
    definition;
  const definitionVersions = resolveDictionaryDefinitionVersions(definition);
  const seen = new Set<number>();
  for (const ver of definitionVersions) {
    if (!Number.isInteger(ver.version) || ver.version < 1) {
      throw new Error(
        `dictionary "${definition.name}" has invalid version ${ver.version}`,
      );
    }
    if (seen.has(ver.version)) {
      throw new Error(
        `dictionary "${definition.name}" repeats version ${ver.version}`,
      );
    }
    if (!ver.displayName?.trim()) {
      throw new Error(
        `dictionary "${definition.name}" v${ver.version} must declare displayName`,
      );
    }
    seen.add(ver.version);
  }

  const saiHandle = primarySaiHandle(
    definition.definitionKey,
    definitionVersions,
  );
  const primaryMeta = primaryDefinitionVersion(definition);
  const scope = getDictionaryScope(location.scope);
  const folder = resolveDictionaryFolder(
    location.scope,
    location.folder ?? [],
  );
  const dictionaryRootDepth = getDictionaryRoot(location.scope).folder.length;

  let stats = emptyWriteStats();

  if (cultures.length > 0) {
    stats = mergeWriteStats(stats, await ensureSystemLanguages(cultures));
  }

  const {
    parentId: folderParentId,
    parentSitecorePath,
    diskDir,
    stats: folderStats,
  } = await ensureFolderChain(scope, folder, saiHandle, {
    skipExistingRootDepth: dictionaryRootDepth,
    folderTemplate: DICTIONARY_FOLDER_TEMPLATE,
    sourceLanguage: sourceCulture,
    leafFolder:
      primaryMeta.description || primaryMeta.shortDescription
        ? {
            description: primaryMeta.description,
            shortDescription: primaryMeta.shortDescription,
          }
        : undefined,
  });
  stats = mergeWriteStats(stats, folderStats);

  const parentId = resolveDictionaryParentId(
    location.scope,
    folder,
    folderParentId,
  );

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]!;
    const itemName = entryItemName(entry);
    const entryYamlPath = path.join(diskDir, `${itemName}.yml`);
    const sitecorePath = `${parentSitecorePath}/${itemName}`;
    const languages = await buildEntryLanguages(
      entry,
      cultures,
      sourceCulture,
      sitecorePath,
    );

    recordWrite(
      stats,
      await applyAuthoringItem(entryYamlPath, {
        parent: parentId,
        template: DICTIONARY_ENTRY_TEMPLATE,
        path: sitecorePath,
        sharedFields: await buildEntrySharedFields(entry, index, sitecorePath),
        languages,
      }),
    );
  }

  return stats;
}
