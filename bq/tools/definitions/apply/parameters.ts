import path from "node:path";
import { applyAuthoringItem } from "../../shared/authoring-apply-bridge";
import { braceGuid } from "../../shared/ids";
import { enumerationSourceValue } from "../../shared/enumeration-source";
import { saiHandleFrom } from "../../shared/sai-handle";
import {
  dataPlacementToQuerySource,
  DEFAULT_PROJECT_COLLECTION,
  getProjectTemplatesDiskRoot,
  getProjectTemplatesSitecorePath,
} from "../../shared/data-placement";
import { ensureProjectCollectionRootId } from "../../shared/project-collection-roots";
import type { ScsField } from "../../shared/provenance";
import { standardValuesSortOrder } from "../../shared/sort-order";
import {
  collectStandardValueFields,
  applyTemplateSectionsAndFields,
  templateSectionIconSharedFields,
} from "../../shared/apply-template-sections";
import {
  emptyWriteStats,
  mergeWriteStats,
  recordWrite,
  type ScsWriteStats
} from "../../shared/authoring-item-model";
import {
  BASE_PAGE_CONTENT,
  BASE_RENDERING_PARAMS_COMMON,
  BASE_RENDERING_PARAMS_SXA,
  BASE_RENDERING_PARAMS_STYLING,
  FIELD_IDS,
  PLACEHOLDER_KEYS,
  TEMPLATE,
  TEMPLATE_BRANCH,
} from "../../shared/system-ids";
import { ensureExistingOrCreateItem } from "../../shared/ensure-existing-or-create";
import { updateItem } from "../../shared/authoring-items";
import type {
  DataFieldDef,
  ParametersDefinition,
  ParametersModelDef,
} from "../types";

const PARAMETERS_SAI_VERSION = 1;

const RENDERING_PARAMS_BASES = [
  BASE_RENDERING_PARAMS_SXA,
  BASE_RENDERING_PARAMS_STYLING,
  BASE_PAGE_CONTENT,
  BASE_RENDERING_PARAMS_COMMON,
].join("\n");

export type ParametersBranchParent = {
  parentId: string;
  parentSitecorePath: string;
  branchDiskDir: string;
  /** True when the parent YAML was written in this call. */
  created: boolean;
};

function fieldSourceSharedFields(field: DataFieldDef): ScsField[] {
  if (field.enumeration) {
    return [
      {
        id: FIELD_IDS.TemplateFieldSource,
        hint: "Source",
        value: enumerationSourceValue(field.enumeration, PARAMETERS_SAI_VERSION),
      },
    ];
  }
  if (field.source) {
    return [
      {
        id: FIELD_IDS.TemplateFieldSource,
        hint: "Source",
        value: dataPlacementToQuerySource(field.source),
      },
    ];
  }
  return [];
}

/**
 * Ensure the template branch parent folder exists under the project collection.
 * Creates `{name}.yml` only when missing; otherwise reuses the existing item ID.
 * When reusing, the path is still tracked on the emit manifest so prune does not
 * delete the parent and leave orphan children (SCS integrity failure).
 */
export async function ensureParametersBranchParent(options: {
  name: string;
  collectionSystem: string;
  handle: string;
  /** Stable ID key when creating (default: branch placeholder). */
  idKey?: string;
}): Promise<ParametersBranchParent & { stats: ScsWriteStats }> {
  const { name, collectionSystem, handle } = options;
  const templatesRoot = getProjectTemplatesDiskRoot(collectionSystem);
  const templatesSitecorePath = getProjectTemplatesSitecorePath(collectionSystem);
  const collectionId = await ensureProjectCollectionRootId({
    kind: "templates",
    collectionSystem,
  });

  const parentSitecorePath = `${templatesSitecorePath}/${name}`;
  const branchDiskDir = path.join(templatesRoot, name);

  const ensured = await ensureExistingOrCreateItem({
    // Label only — Authoring apply does not read/write YAML at this path.
    yamlPath: parentSitecorePath,
    defaultSitecorePath: parentSitecorePath,
    preferDiskPathOnReuse: false,
    handle,
    idKey: options.idKey ?? PLACEHOLDER_KEYS.branch,
    create: () => ({
      parent: collectionId,
      template: TEMPLATE_BRANCH,
      path: parentSitecorePath,
      sharedFields: [
        { id: FIELD_IDS.Sortorder, hint: "__Sortorder", value: 100 },
      ],
    }),
  });

  return {
    parentId: ensured.itemId,
    parentSitecorePath: ensured.itemSitecorePath,
    branchDiskDir,
    created: ensured.created,
    stats: ensured.stats,
  };
}

export type ApplyParametersTemplateResult = {
  parametersTemplateId: string;
  parametersStdValuesId: string;
  stats: ScsWriteStats;
};

/**
 * Emit `{branchName} Parameters` template + sections/fields + __Standard Values
 * under an existing branch parent.
 */
export async function applyParametersTemplate(options: {
  handle: string;
  branchName: string;
  parentId: string;
  parentSitecorePath: string;
  branchDiskDir: string;
  model: ParametersModelDef;
  collectionSystem?: string;
}): Promise<ApplyParametersTemplateResult> {
  const {
    handle,
    branchName,
    parentId,
    parentSitecorePath,
    branchDiskDir,
    model,
  } = options;
  const collectionSystem =
    options.collectionSystem ?? DEFAULT_PROJECT_COLLECTION;

  let stats = emptyWriteStats();
  const parametersName = `${branchName} Parameters`;
  const parametersSitecorePath = `${parentSitecorePath}/${parametersName}`;
  const parametersDiskDir = path.join(branchDiskDir, parametersName);

  const write = async (relPath: string, item: Parameters): Promise<string> => {
    const filePath = path.join(branchDiskDir, relPath);
    const applied = await applyAuthoringItem(filePath, item);
    recordWrite(stats, applied);
    return applied.itemId;
  };

  type Parameters = {
    parent: string;
    template: string;
    path: string;
    sharedFields?: ScsField[];
    languageFields?: ScsField[];
    versionFields?: ScsField[];
    languages?: Array<{
      language: string;
      languageFields?: ScsField[];
      versionFields?: ScsField[];
    }>;
  };

  // Create template first (no __Standard values yet — patch after std values exist).
  let liveParametersTemplateId = await write(`${parametersName}.yml`, {
    parent: parentId,
    template: TEMPLATE,
    path: parametersSitecorePath,
    sharedFields: [
      {
        id: FIELD_IDS.Icon,
        hint: "__Icon",
        value: "Office/32x32/window_star.png",
      },
      {
        id: FIELD_IDS.BaseTemplate,
        hint: "__Base template",
        value: RENDERING_PARAMS_BASES,
        multiline: true,
      },
    ],
  });

  const sections = model.sections ?? [];
  const { sectionSorts, fields: emittedFields } =
    await applyTemplateSectionsAndFields({
      handle,
      sections,
      templateId: liveParametersTemplateId,
      templateDiskDir: parametersDiskDir,
      templateSitecorePath: parametersSitecorePath,
      stats,
      sectionIdKey: (sectionName) => `section:parameters:${sectionName}`,
      fieldIdKey: (sectionName, fieldName) =>
        `field:${sectionName}:${fieldName}`,
      sectionExtraSharedFields: () => templateSectionIconSharedFields(),
      resolveSource: (field) => {
        const sourceField = fieldSourceSharedFields(field)[0];
        return sourceField
          ? { id: sourceField.id, value: String(sourceField.value) }
          : undefined;
      },
    });

  const { shared: stdShared, versioned: stdVersion, stats: stdStats } =
    await collectStandardValueFields(emittedFields, {
      honorShared: true,
      media: {
        handle,
        folder: [branchName, parametersName],
        collectionSystem,
        label: `Parameters ${parametersName} std values`,
      },
    });
  stats = mergeWriteStats(stats, stdStats);

  const liveParametersStdValuesId = await write(
    `${parametersName}/__Standard Values.yml`,
    {
      parent: liveParametersTemplateId,
      template: liveParametersTemplateId,
      path: `${parametersSitecorePath}/__Standard Values`,
      sharedFields: [
        {
          id: FIELD_IDS.Icon,
          hint: "__Icon",
          value: "Office/32x32/window_star.png",
        },
        {
          id: FIELD_IDS.Sortorder,
          hint: "__Sortorder",
          value: standardValuesSortOrder(sectionSorts, 100),
        },
        ...stdShared,
      ],
      ...(stdVersion.length
        ? { languages: [{ language: "en", versionFields: stdVersion }] }
        : {}),
    },
  );

  await updateItem({
    itemId: liveParametersTemplateId,
    path: parametersSitecorePath,
    fields: [
      {
        name: "__Standard values",
        value: braceGuid(liveParametersStdValuesId),
      },
    ],
  });

  return {
    parametersTemplateId: liveParametersTemplateId,
    parametersStdValuesId: liveParametersStdValuesId,
    stats,
  };
}

/** Emit a standalone `kind: "parameters"` definition. */
export async function applyParametersDefinition(
  definition: ParametersDefinition,
): Promise<ScsWriteStats> {
  const collectionSystem =
    definition.collectionSystem ?? DEFAULT_PROJECT_COLLECTION;
  const handle = saiHandleFrom(definition.definitionKey, PARAMETERS_SAI_VERSION);
  const name = definition.name.trim();
  if (!name) {
    throw new Error(
      `parameters "${definition.definitionKey}": name must be non-empty`,
    );
  }

  let stats = emptyWriteStats();
  const parent = await ensureParametersBranchParent({
    name,
    collectionSystem,
    handle,
    idKey: `branch:${name}`,
  });
  stats = mergeWriteStats(stats, parent.stats);

  const emitted = await applyParametersTemplate({
    handle,
    branchName: name,
    parentId: parent.parentId,
    parentSitecorePath: parent.parentSitecorePath,
    branchDiskDir: parent.branchDiskDir,
    model: definition.model,
    collectionSystem,
  });
  return mergeWriteStats(stats, emitted.stats);
}
