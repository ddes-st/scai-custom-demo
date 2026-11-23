import { primarySaiHandle, minVersionNumber } from "../../shared/sai-handle";
import { applyAuthoringItem } from "../../shared/authoring-apply-bridge";
import { resolveEnumerationConstantVersions, resolveEnumerationListVersions } from "../../shared/normalize-versions";
import path from "node:path";
import { ensureSystemLanguages } from "../../shared/ensure-languages";
import { SYSTEM_SYSTEM_ROOT_ID } from "../../shared/dictionary-ids";
import type { ScsField } from "../../shared/provenance";
import {
  type ScsLanguageBlock,
  type ScsWriteStats,
  emptyWriteStats,
  mergeWriteStats,
  recordWrite
} from "../../shared/authoring-item-model";
import {
  ENUMERATION_SYSTEM_DISK_ROOT,
  getEnumerationsRoot,
  getEnumerationScope,
  resolveEnumerationFolder,
} from "../../shared/scopes";
import {
  collectDescriptionLanguageFields,
  collectStandardFields,
  pickStandardFields,
} from "../../shared/standard-fields";
import {
  ENUM_FIELD_IDS,
  ENUMERATION,
  ENUMERATION_VALUE,
  FIELD_IDS,
} from "../../shared/system-ids";
import {
  ENUM_DISPLAY_TRANSLATE_HINTS,
  buildMultiVersionLanguageBlocks,
} from "../../shared/localized-versions";
import { preserveOrDefaultSortOrderField } from "../../shared/sort-order";
import type {
  EnumerationDefinition,
  EnumerationConstant,
  EnumerationListVersionDef,
  EnumerationValueVersionDef,
} from "../types";
import {
  buildLanguageBlocks,
  ensureFolderChain,
  mergeFields,
  SITE_FOLDER_TEMPLATE,
} from "./shared";

type DisplayNameVersion = EnumerationListVersionDef | EnumerationValueVersionDef;

function assertDisplayNameVersions(
  versions: DisplayNameVersion[] | undefined,
  label: string,
): asserts versions is DisplayNameVersion[] {
  if (!versions?.length) {
    throw new Error(
      `${label} must declare versions: [{ version, displayName }]`,
    );
  }

  const seen = new Set<number>();
  for (const ver of versions) {
    if (!Number.isInteger(ver.version) || ver.version < 1) {
      throw new Error(`${label} has invalid version ${ver.version}`);
    }
    if (seen.has(ver.version)) {
      throw new Error(`${label} repeats version ${ver.version}`);
    }
    if (!ver.displayName?.trim()) {
      throw new Error(`${label} v${ver.version} must declare displayName`);
    }
    seen.add(ver.version);
  }
}

function buildListSharedFields(
  definition: EnumerationDefinition,
  saiHandle: string,
  listVersions: EnumerationListVersionDef[],
): ScsField[] {
  const standard = collectStandardFields(
    pickStandardFields(definition as unknown as Record<string, unknown>),
  );

  const listShared: ScsField[] = [
    {
      id: ENUM_FIELD_IDS.ScaiHandle,
      hint: "Scai Handle",
      value: saiHandle,
    },
  ];

  // Shared `Default` comes from the primary (lowest) list version.
  const primaryDefault = listVersions.find(
    (ver) => ver.version === minVersionNumber(listVersions),
  )?.default;
  if (primaryDefault) {
    listShared.push({
      id: ENUM_FIELD_IDS.Default,
      hint: "Default",
      value: primaryDefault,
    });
  }

  return mergeFields(listShared, standard.shared);
}

async function buildValueSharedFields(
  value: EnumerationConstant,
  index: number,
  sitecorePath: string,
): Promise<ScsField[]> {
  const standard = collectStandardFields(
    pickStandardFields(value as unknown as Record<string, unknown>),
  );

  const valueShared: ScsField[] = [];

  const sortOrderField = await preserveOrDefaultSortOrderField(
    sitecorePath,
    index,
    typeof value.sortOrder === "number" ? value.sortOrder : undefined,
  );
  if (sortOrderField) valueShared.push(sortOrderField);

  valueShared.push({
    id: ENUM_FIELD_IDS.Value,
    hint: "Value",
    value: value.name,
  });

  return mergeFields(valueShared, standard.shared);
}

function buildDisplayNameVersionLanguageFields(
  ver: DisplayNameVersion,
  extraLanguageFields: ScsField[] = [],
): ScsField[] {
  return mergeFields(
    extraLanguageFields,
    [
      {
        id: FIELD_IDS.DisplayName,
        hint: "__Display name",
        value: ver.displayName,
      },
    ],
    collectDescriptionLanguageFields(ver.description, ver.shortDescription),
  );
}

async function buildDisplayNameLanguages(
  versions: DisplayNameVersion[],
  cultures: string[],
  extraLanguageFields: ScsField[] = [],
  sourceCulture: string = "en",
  sitecorePath?: string,
): Promise<ScsLanguageBlock[]> {
  // Single version: keep __Display name under Languages.Fields (unversioned).
  if (versions.length === 1) {
    const languageFields = buildDisplayNameVersionLanguageFields(
      versions[0]!,
      extraLanguageFields,
    );
    return buildLanguageBlocks(languageFields, [], cultures, sourceCulture);
  }

  const enVersions: NonNullable<ScsLanguageBlock["versions"]> = versions.map(
    (ver) => ({
      version: ver.version,
      versionFields: buildDisplayNameVersionLanguageFields(
        ver,
        // Standard language fields (if any) only on the first numbered version.
        ver.version === Math.min(...versions.map((v) => v.version))
          ? extraLanguageFields
          : [],
      ),
    }),
  );

  return await buildMultiVersionLanguageBlocks({
    enVersions,
    cultures,
    translateHints: ENUM_DISPLAY_TRANSLATE_HINTS,
    sourceCulture,
    sitecorePath,
  });
}

async function buildListLanguages(
  definition: EnumerationDefinition,
  cultures: string[],
  sourceCulture: string = "en",
  sitecorePath?: string,
): Promise<ScsLanguageBlock[]> {
  const listVersions = resolveEnumerationListVersions(definition);
  assertDisplayNameVersions(
    listVersions,
    `enumeration "${definition.name}"`,
  );

  const standard = collectStandardFields(
    pickStandardFields(definition as unknown as Record<string, unknown>),
  );

  return await buildDisplayNameLanguages(
    listVersions,
    cultures,
    standard.language,
    sourceCulture,
    sitecorePath,
  );
}

async function buildValueLanguages(
  value: EnumerationConstant,
  cultures: string[],
  sourceCulture: string = "en",
  sitecorePath?: string,
): Promise<ScsLanguageBlock[]> {
  const versions = resolveEnumerationConstantVersions(value);
  assertDisplayNameVersions(
    versions,
    `enumeration constant "${value.name}"`,
  );
  return await buildDisplayNameLanguages(
    versions,
    cultures,
    [],
    sourceCulture,
    sitecorePath,
  );
}

async function ensureSystemEnumsRoot(handle: string): Promise<{
  enumsFolderId: string;
  stats: ScsWriteStats;
}> {
  const yamlPath = path.join(ENUMERATION_SYSTEM_DISK_ROOT, "Enums.yml");
  const stats = emptyWriteStats();
  const applied = await applyAuthoringItem(yamlPath, {
    parent: SYSTEM_SYSTEM_ROOT_ID,
    template: SITE_FOLDER_TEMPLATE,
    path: "/sitecore/system/Enums",
    sharedFields: [
      {
        id: FIELD_IDS.Sortorder,
        hint: "__Sortorder",
        value: 100,
      },
    ],
  });
  recordWrite(stats, applied);
  const enumsFolderId = applied.itemId;

  return { enumsFolderId, stats };
}

/**
 * Emit enumeration list + value YAML under:
 * `{scope}/{enumerationsRoot}/…/{location.folder}/…/{name}`
 */
export async function applyEnumerationDefinition(
  definition: EnumerationDefinition,
): Promise<ScsWriteStats> {
  const { location, name, constants, cultures = [], culture: sourceCulture = "en" } =
    definition;
  const listVersions = resolveEnumerationListVersions(definition);
  assertDisplayNameVersions(
    listVersions,
    `enumeration "${definition.name}"`,
  );
  const saiHandle = primarySaiHandle(
    definition.definitionKey,
    listVersions,
  );
  const baseScope = getEnumerationScope(location.scope);
  const folder = resolveEnumerationFolder(
    location.scope,
    location.folder ?? [],
  );
  const enumerationsRootDepth = getEnumerationsRoot(location.scope).folder
    .length;

  let stats = emptyWriteStats();

  if (cultures.length > 0) {
    stats = mergeWriteStats(stats, await ensureSystemLanguages(cultures));
  }

  let scope = baseScope;
  if (location.scope === "system") {
    const { enumsFolderId, stats: enumsRootStats } =
      await ensureSystemEnumsRoot(saiHandle);
    stats = mergeWriteStats(stats, enumsRootStats);
    scope = {
      ...baseScope,
      rootItemId: enumsFolderId,
    };
  }

  const {
    parentId,
    parentSitecorePath,
    diskDir,
    stats: folderStats,
  } = await ensureFolderChain(scope, folder, saiHandle, {
    skipExistingRootDepth: enumerationsRootDepth,
    sourceLanguage: sourceCulture,
  });
  stats = mergeWriteStats(stats, folderStats);

  const listSitecorePath = `${parentSitecorePath}/${name}`;
  const listYamlPath = path.join(diskDir, `${name}.yml`);
  const listLanguages = await buildListLanguages(
    definition,
    cultures,
    sourceCulture,
    listSitecorePath,
  );

  const listWrite = await applyAuthoringItem(listYamlPath, {
    parent: parentId,
    template: ENUMERATION,
    path: listSitecorePath,
    sharedFields: buildListSharedFields(definition, saiHandle, listVersions),
    languages: listLanguages,
  });
  recordWrite(stats, listWrite);
  const listId = listWrite.itemId;

  const valueDir = path.join(diskDir, name);

  for (let index = 0; index < constants.length; index++) {
    const value = constants[index]!;
    const valueSitecorePath = `${listSitecorePath}/${value.name}`;
    const valueYamlPath = path.join(valueDir, `${value.name}.yml`);
    const valueLanguages = await buildValueLanguages(
      value,
      cultures,
      sourceCulture,
      valueSitecorePath,
    );

    recordWrite(
      stats,
      await applyAuthoringItem(valueYamlPath, {
        parent: listId,
        template: ENUMERATION_VALUE,
        path: valueSitecorePath,
        sharedFields: await buildValueSharedFields(
          value,
          index,
          valueSitecorePath,
        ),
        languages: valueLanguages,
      }),
    );
  }

  return stats;
}
