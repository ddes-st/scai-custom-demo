import { primarySaiHandle, saiHandleFrom } from "../../shared/sai-handle";
import { applyAuthoringItem } from "../../shared/authoring-apply-bridge";
import {
  ensureItemTemplate,
  readItemFieldValue,
  updateItem,
} from "../../shared/authoring-items";
import { enumerationSourceValue } from "../../shared/enumeration-source";
import { resolveDataItemVersions } from "../../shared/normalize-versions";
import path from "node:path";
import {
  dataPlacementToQuerySource,
  DEFAULT_PROJECT_COLLECTION,
  getProjectTemplatesDiskRoot,
  getProjectTemplatesSitecorePath,
} from "../../shared/data-placement";
import { ensureProjectCollectionRootId } from "../../shared/project-collection-roots";
import { ensureSystemLanguages } from "../../shared/ensure-languages";
import { getCachedAuthoringPathId } from "../../shared/authoring-path-cache";
import { braceGuid } from "../../shared/ids";
import type { ScsField } from "../../shared/provenance";
import { resolveItemIdByPath } from "../../shared/resolve-item-id-by-path";
import {
  resolveSiteOrigin,
} from "../../shared/ensure-home-link-page";
import { resolveContentSiteContext } from "../../shared/content-site-context";
import {
  applySiteContentItems,
  prepareSiteContentFolder,
  type SiteContentFieldMeta,
} from "../../shared/site-content-items";
import {
  emptyWriteStats,
  mergeWriteStats,
  recordWrite,
  type ScsWriteStats
} from "../../shared/authoring-item-model";
import { getScope } from "../../shared/scopes";
import { standardValuesSortOrder } from "../../shared/sort-order";
import {
  collectStandardValueFields,
  applyTemplateSectionsAndFields,
} from "../../shared/apply-template-sections";
import {
  BASE_FOLDER_TEMPLATE,
  BASE_STANDARD_TEMPLATE,
  FIELD_IDS,
  TEMPLATE_BRANCH,
} from "../../shared/system-ids";
import type {
  DataDefinition,
  DataFieldDef,
  DataInsertOptions,
  DataTemplateDef,
} from "../types";
function dataSaiHandle(definition: DataDefinition): string {
  const versions = (definition.items ?? []).flatMap((item) =>
    resolveDataItemVersions(item),
  );
  if (!versions.length) {
    return saiHandleFrom(definition.definitionKey, 1);
  }
  return primarySaiHandle(definition.definitionKey, versions);
}

function dataContentMediaContext(definition: DataDefinition) {
  const handle = dataSaiHandle(definition);
  const collectionSystem =
    definition.collectionSystem ?? DEFAULT_PROJECT_COLLECTION;
  const siteContext = resolveContentSiteContext(collectionSystem, {
    siteSystemHint: definition.siteSystem,
  });
  const sourceCulture = definition.culture ?? "en";
  return {
    handle,
    folder: definition.location.folder ?? [definition.name],
    collectionSystem,
    label: `Data definition ${handle}`,
    siteSystem: siteContext?.siteSystem,
    siteOrigin: resolveSiteOrigin(undefined, {
      siteSystem: siteContext?.siteSystem,
    }),
    sourceLanguage: sourceCulture,
    culture: sourceCulture,
    cultures: definition.cultures ?? [],
  };
}

function resolveInsert(insert: DataInsertOptions | undefined): {
  items: boolean;
  folders: boolean;
} {
  return {
    items: insert?.items !== false,
    folders: insert?.folders !== false,
  };
}

async function applyTemplateGroupFolder(
  definition: DataDefinition,
  collectionSystem: string,
  stats: ScsWriteStats,
): Promise<{ groupId: string; groupDiskDir: string; groupSitecorePath: string }> {
  const groupName = definition.name;
  const templatesRoot = getProjectTemplatesDiskRoot(collectionSystem);
  const templatesPath = getProjectTemplatesSitecorePath(collectionSystem);
  const collectionParentId = await ensureProjectCollectionRootId({
    kind: "templates",
    collectionSystem,
  });
  const groupYaml = path.join(templatesRoot, `${groupName}.yml`);
  const groupSitecorePath = `${templatesPath}/${groupName}`;

  const applied = await applyAuthoringItem(groupYaml, {
    parent: collectionParentId,
    template: TEMPLATE_BRANCH,
    path: groupSitecorePath,
  });
  recordWrite(stats, applied);

  return {
    groupId: applied.itemId,
    groupDiskDir: path.join(templatesRoot, groupName),
    groupSitecorePath,
  };
}

/**
 * Ensure the template item exists on CM (via Authoring) with correct base
 * inheritance (`createItemTemplate` / `updateItemTemplate` `baseTemplates`).
 * Do not stamp `__Base template` via updateItem — Authoring ignores that for
 * these templates and leaves `baseTemplates` empty (no Standard Template →
 * no `__Display name` / other `__*` fields on content items).
 * Returns the live template id — never a minted GUID.
 */
async function ensureTemplateOnCm(opts: {
  def: DataTemplateDef;
  groupId: string;
  groupSitecorePath: string;
  baseTemplate: string;
  stats: ScsWriteStats;
}): Promise<string> {
  const { def, groupId, groupSitecorePath, baseTemplate, stats } = opts;
  const templatePath = `${groupSitecorePath}/${def.name}`;
  const sections = (def.sections ?? []).map((section) => ({
    name: section.name,
    fields: (section.fields ?? []).map((field) => ({
      name: field.name,
      type: field.type || "Single-Line Text",
    })),
  }));
  const ensured = await ensureItemTemplate({
    path: templatePath,
    parentId: groupId,
    name: def.name,
    sections,
    baseTemplates: [baseTemplate],
  });
  const templateId = ensured.itemId;
  recordWrite(stats, ensured.created ? "created" : "updated");
  return templateId;
}

async function emitOneTemplate(
  definition: DataDefinition,
  opts: {
    templateKey: "folder" | "item";
    def: DataTemplateDef;
    /** Live CM id from {@link ensureTemplateOnCm}. */
    templateId: string;
    groupDiskDir: string;
    groupSitecorePath: string;
    folderTemplateId: string;
    itemTemplateId: string;
    stats: ScsWriteStats;
  },
): Promise<{ templateId: string; fields: SiteContentFieldMeta[] }> {
  const {
    templateKey,
    def,
    templateId,
    groupDiskDir,
    groupSitecorePath,
    folderTemplateId,
    itemTemplateId,
    stats,
  } = opts;

  const templatePath = `${groupSitecorePath}/${def.name}`;
  const templateDiskDir = path.join(groupDiskDir, def.name);
  const stdValuesPath = path.join(templateDiskDir, "__Standard Values.yml");

  const handle = dataSaiHandle(definition);
  const { sectionSorts, fields: emittedFields } =
    await applyTemplateSectionsAndFields({
      handle,
      sections: def.sections ?? [],
      templateId,
      templateDiskDir,
      templateSitecorePath: templatePath,
      stats,
      // Omit def.name so renaming the item/folder template does not remint sections.
      sectionIdKey: (sectionName) =>
        `section:${templateKey}:${sectionName}`,
      fieldIdKey: (sectionName, fieldName) =>
        `field:${templateKey}:${sectionName}:${fieldName}`,
      resolveSource: (field) => {
        if (field.enumeration) {
          return {
            id: FIELD_IDS.TemplateFieldSource,
            value: enumerationSourceValue(field.enumeration, 1),
          };
        }
        return field.source
          ? {
              id: FIELD_IDS.TemplateFieldSource,
              value: dataPlacementToQuerySource(field.source),
            }
          : undefined;
      },
    });

  const stdShared: ScsField[] = [
    {
      id: FIELD_IDS.Sortorder,
      hint: "__Sortorder",
      value: standardValuesSortOrder(sectionSorts),
    },
  ];

  if (templateKey === "folder") {
    const insert = resolveInsert("insert" in def ? def.insert : undefined);
    const masters: string[] = [];
    if (insert.items) masters.push(braceGuid(itemTemplateId));
    if (insert.folders) masters.push(braceGuid(folderTemplateId));
    if (masters.length) {
      stdShared.push({
        id: FIELD_IDS.Masters,
        hint: "__Masters",
        // Multilist — Authoring GraphQL expects `|`-separated IDs.
        value: masters.join("|"),
      });
    }
  }

  const stdDefaults = await collectStandardValueFields(emittedFields, {
    honorShared: true,
    media: dataContentMediaContext(definition),
  });
  opts.stats.created += stdDefaults.stats.created;
  opts.stats.updated += stdDefaults.stats.updated;
  opts.stats.unchanged += stdDefaults.stats.unchanged;
  stdShared.push(...stdDefaults.shared);
  const stdVersion = stdDefaults.versioned;

  const stdApplied = await applyAuthoringItem(stdValuesPath, {
    parent: templateId,
    template: templateId,
    path: `${templatePath}/__Standard Values`,
    sharedFields: stdShared.length ? stdShared : undefined,
    ...(stdVersion.length
      ? {
          languages: [
            { language: "en", versionFields: stdVersion },
          ],
        }
      : {}),
  });
  recordWrite(stats, stdApplied);

  await updateItem({
    itemId: templateId,
    path: templatePath,
    fields: [
      {
        name: "__Standard values",
        value: braceGuid(stdApplied.itemId),
      },
    ],
  });

  return {
    templateId,
    fields: emittedFields.map((f) => ({
      ...f.field,
      id: f.id,
      sectionName: f.sectionName,
    })),
  };
}

async function ensureDataFolderMasters(
  folderTemplateId: string,
  stats: ScsWriteStats,
): Promise<void> {
  const site = getScope("site");
  const itemPath = `${site.sitecorePath}/Data`;
  const brace = braceGuid(folderTemplateId);

  // Prefer live CM / in-run cache — never invent a GUID for update.
  const cached = getCachedAuthoringPathId(itemPath);
  const resolved = cached
    ? { found: true as const, id: cached }
    : await resolveItemIdByPath({
        sitecorePath: itemPath,
        logPrefix: "[bq:apply:data-masters]",
      });
  if (!resolved.found || !resolved.id) {
    throw new Error(
      `[bq:apply:data-masters] Data folder missing on CM at ${itemPath}`,
    );
  }

  // Merge into the live __Masters value (treelist: pipe-delimited). If the read
  // fails (undefined), fall back to just the new template id.
  const existing = await readItemFieldValue({
    path: itemPath,
    fieldName: "__Masters",
  });
  const lines = (existing ?? "")
    .split(/[\r\n|]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.some((l) => l.toLowerCase() === brace.toLowerCase())) {
    lines.push(brace);
  }

  await updateItem({
    itemId: resolved.id,
    path: itemPath,
    fields: [{ name: "__Masters", value: lines.join("|") }],
  });
  recordWrite(stats, "updated");
}
/**
 * Emit data definition: Project templates (group + folder/item) + content under Data/Home.
 */
export async function applyDataDefinition(
  definition: DataDefinition,
): Promise<ScsWriteStats> {
  const collectionSystem = definition.collectionSystem ?? DEFAULT_PROJECT_COLLECTION;
  let stats = emptyWriteStats();
  const cultures = definition.cultures ?? [];

  if (cultures.length > 0) {
    stats = mergeWriteStats(stats, await ensureSystemLanguages(cultures));
  }

  const { groupId, groupDiskDir, groupSitecorePath } =
    await applyTemplateGroupFolder(definition, collectionSystem, stats);

  // Create both templates on CM first so folder __Masters can reference live ids.
  const folderTemplateId = await ensureTemplateOnCm({
    def: definition.model.folderTemplate,
    groupId,
    groupSitecorePath,
    baseTemplate: BASE_FOLDER_TEMPLATE,
    stats,
  });
  const itemTemplateId = await ensureTemplateOnCm({
    def: definition.model.itemTemplate,
    groupId,
    groupSitecorePath,
    baseTemplate: BASE_STANDARD_TEMPLATE,
    stats,
  });

  const folderResult = await emitOneTemplate(definition, {
    templateKey: "folder",
    def: definition.model.folderTemplate,
    templateId: folderTemplateId,
    groupDiskDir,
    groupSitecorePath,
    folderTemplateId,
    itemTemplateId,
    stats,
  });

  const itemResult = await emitOneTemplate(definition, {
    templateKey: "item",
    def: definition.model.itemTemplate,
    templateId: itemTemplateId,
    groupDiskDir,
    groupSitecorePath,
    folderTemplateId,
    itemTemplateId,
    stats,
  });

  if (definition.location.root === "data") {
    await ensureDataFolderMasters(folderResult.templateId, stats);
  }

  const handle = dataSaiHandle(definition);
  const folderMeta = definition.model.folderTemplate;
  const siteContext = resolveContentSiteContext(collectionSystem, {
    siteSystemHint: definition.siteSystem,
  });
  if (!siteContext) {
    throw new Error(
      `[bq:apply:data] ${handle}: could not resolve site context for collection "${collectionSystem}"` +
        (definition.siteSystem ? ` / site "${definition.siteSystem}"` : ""),
    );
  }
  const prepared = await prepareSiteContentFolder({
    label: `Data definition ${handle}`,
    location: definition.location,
    handle,
    folderTemplateId: folderResult.templateId,
    siteContext,
    sourceLanguage: definition.culture ?? "en",
    leafFolder:
      folderMeta.displayName ||
      folderMeta.description ||
      folderMeta.shortDescription
        ? {
            displayName: folderMeta.displayName,
            description: folderMeta.description,
            shortDescription: folderMeta.shortDescription,
          }
        : undefined,
  });
  stats = mergeWriteStats(stats, prepared.stats);

  const itemStats = await applySiteContentItems({
    items: definition.items ?? [],
    handle,
    label: `Data definition ${handle}`,
    parentId: prepared.leafId,
    parentSitecorePath: prepared.leafSitecorePath,
    diskDir: prepared.itemsDiskDir,
    itemTemplateId: itemResult.templateId,
    fields: itemResult.fields,
    cultures,
    media: dataContentMediaContext(definition),
  });
  stats = mergeWriteStats(stats, itemStats);

  return stats;
}
