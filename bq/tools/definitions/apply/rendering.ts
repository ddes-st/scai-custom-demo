import path from "node:path";
import { applyAuthoringItem } from "../../shared/authoring-apply-bridge";
import { updateItem } from "../../shared/authoring-items";
import { braceGuid, stableGuid } from "../../shared/ids";
import { isParametersModelDef } from "../../shared/definition-ref";
import { saiHandleFrom } from "../../shared/sai-handle";
import {
  normalizeDataFolderSegments,
  pluralComponentName,
  toKebabItemName,
  toSystemName,
} from "../../shared/naming";
import {
  collectStandardValueFields,
  applyTemplateSectionsAndFields,
  templateSectionIconSharedFields,
} from "../../shared/apply-template-sections";
import { standardValuesSortOrder } from "../../shared/sort-order";
import { buildRenderingDatasourceLocationQuery, buildNamedFolderDatasourceLocationQuery } from "../../shared/rendering-location";
import {
  COMPONENT_GRAPHQL_QUERY_FIELD_ID,
} from "../../shared/platform-link-list";
import {
  DEFAULT_PROJECT_COLLECTION,
  getProjectRenderingsDiskDir,
  getProjectRenderingsSitecorePath,
  getProjectTemplatesDiskRoot,
} from "../../shared/data-placement";
import { ensureProjectCollectionRootId } from "../../shared/project-collection-roots";
import {
  type ScsField,
  type ScsItem,
  type ScsWriteStats,
  emptyWriteStats,
  mergeWriteStats,
  recordWrite
} from "../../shared/authoring-item-model";
import {
  BASE_PAGE_CONTENT,
  BASE_STANDARD_TEMPLATE,
  FIELD_IDS,
  JSON_RENDERING,
  PLACEHOLDER_KEYS,
  TEMPLATE,
} from "../../shared/system-ids";
import type { Definition, RenderingDefinition } from "../types";
import {
  applyParametersTemplate,
  ensureParametersBranchParent,
} from "./parameters";
import {
  resolveParametersTemplateReference,
  validateRenderingParametersSources,
} from "./parameters-ref";
import {
  applyScaffoldingInsertOptionsRule,
  ensureScaffoldingCollectionParent,
} from "./scaffolding";
import { applyRenderingVariants } from "./variants-ref";
import { buildLanguageBlocks } from "./shared";
import {
  applyRenderingPlaceholders,
} from "./placeholders";

const RENDERING_SAI_VERSION = 1;

/**
 * Media folder for datasource / child-datasource __Standard Values Image fields.
 * Prefer content-style `datasourceLocation.folder` (same as data emit) so shared
 * URLs do not relocate between component-branch paths and site Data folders.
 */
export function mediaFolderForDatasourceStdValues(
  definition: RenderingDefinition,
  branchName: string,
  itemTemplateName: string,
): string[] {
  const fromLocation =
    normalizeDataFolderSegments(definition.datasourceLocation?.folder) ?? [];
  return fromLocation.length ? fromLocation : [branchName, itemTemplateName];
}

/** Live CM ids filled as each item is ensured (no provisional mint). */
type LiveIds = {
  rendering?: string;
  datasource?: string;
  datasourceStdValues?: string;
  childDatasource?: string;
  childDatasourceStdValues?: string;
  folder?: string;
  folderStdValues?: string;
};

function fieldId(
  handle: string,
  section: string,
  fieldName: string,
): string {
  return stableGuid(handle, `field:${section}:${fieldName}`);
}

function buildOtherProperties(definition: RenderingDefinition): string {
  const merged: Record<string, string | boolean> = {
    IsRenderingsWithDynamicPlaceholders: true,
    ...(definition.otherProperties ?? {}),
  };
  if (merged.IsRenderingsWithDynamicPlaceholders === false) {
    delete merged.IsRenderingsWithDynamicPlaceholders;
  }
  return Object.entries(merged)
    .map(([key, value]) => `${key}=${value}`)
    .join(";");
}

/**
 * Rendering item SharedFields in SCS pull order.
 * RenderingCssClass (when set) sits between Open Properties and __Icon —
 * same slot as the former `splice(4, 0, …)`.
 */
function buildRenderingSharedFields(options: {
  componentName: string;
  datasourceTemplatePath: string;
  datasourceLocation: string;
  openPropertiesAfterAdd: number;
  icon: string;
  otherProperties: string;
  renderingCssClass?: string;
  parametersTemplateId?: string;
  placeholderSettingIds?: string[];
  componentGraphQLQuery?: string;
  pageEditorButtons?: string;
  addFieldEditorButton?: string | number | boolean;
}): ScsField[] {
  const fields: ScsField[] = [
    {
      id: FIELD_IDS.ComponentName,
      hint: "componentName",
      value: options.componentName,
    },
    {
      id: FIELD_IDS.DatasourceTemplate,
      hint: "Datasource Template",
      value: options.datasourceTemplatePath,
    },
    {
      id: FIELD_IDS.DatasourceLocation,
      hint: "Datasource Location",
      value: options.datasourceLocation,
    },
    {
      id: FIELD_IDS.OpenPropertiesAfterAdd,
      hint: "Open Properties after Add",
      value: options.openPropertiesAfterAdd,
    },
  ];

  if (options.renderingCssClass?.trim()) {
    fields.push({
      id: FIELD_IDS.RenderingCssClass,
      hint: "RenderingCssClass",
      value: options.renderingCssClass.trim(),
    });
  }

  fields.push(
    {
      id: FIELD_IDS.Icon,
      hint: "__Icon",
      value: options.icon,
    },
    {
      id: FIELD_IDS.OtherProperties,
      hint: "OtherProperties",
      value: options.otherProperties,
    },
  );

  if (options.parametersTemplateId) {
    fields.push({
      id: FIELD_IDS.ParametersTemplate,
      hint: "Parameters Template",
      value: options.parametersTemplateId.startsWith("{")
        ? options.parametersTemplateId
        : braceGuid(options.parametersTemplateId),
    });
  }

  if (options.placeholderSettingIds?.length) {
    // Layout Service Placeholders is a TreeList — Authoring GraphQL needs `|`.
    fields.push({
      id: FIELD_IDS.Placeholders,
      hint: "Placeholders",
      value: options.placeholderSettingIds.map(braceGuid).join("|"),
    });
  }

  if (options.componentGraphQLQuery?.trim()) {
    fields.push({
      id: COMPONENT_GRAPHQL_QUERY_FIELD_ID,
      hint: "ComponentQuery",
      value: options.componentGraphQLQuery.trim(),
      multiline: true,
    });
  }

  if (options.pageEditorButtons?.trim()) {
    // Page Editor Buttons multilist — keep `|` for Authoring GraphQL.
    const buttons = options.pageEditorButtons
      .trim()
      .split(/[\r\n|]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join("|");
    fields.push({
      id: FIELD_IDS.PageEditorButtons,
      hint: "Page Editor Buttons",
      value: buttons,
    });
  }

  if (options.addFieldEditorButton !== undefined && options.addFieldEditorButton !== null) {
    const raw = options.addFieldEditorButton;
    const value =
      typeof raw === "boolean" ? (raw ? "1" : "0") : String(raw).trim() || "0";
    fields.push({
      id: FIELD_IDS.AddFieldEditorButton,
      hint: "AddFieldEditorButton",
      value,
    });
  }

  return fields;
}

export async function applyRenderingDefinition(
  definition: RenderingDefinition,
  registry: Map<string, Definition>,
): Promise<ScsWriteStats> {
  validateRenderingParametersSources(definition);

  if (!definition.model?.folderTemplate || !definition.model?.itemTemplate) {
    throw new Error(
      `rendering "${definition.definitionKey}" must declare model: { folderTemplate, itemTemplate }`,
    );
  }

  const { folderTemplate, itemTemplate, childItemTemplate } = definition.model;
  const saiHandle = saiHandleFrom(definition.definitionKey, RENDERING_SAI_VERSION);
  const branchName = definition.name.trim();
  if (!branchName) {
    throw new Error(`rendering "${definition.definitionKey}": name must be non-empty`);
  }

  // Sitecore componentName must match Content SDK map keys (kebab file names).
  // Branch / YAML path stay as `name` (often PascalCase for components).
  const componentName =
    toKebabItemName(definition.definitionKey) ||
    toKebabItemName(definition.componentName?.trim() || "") ||
    toKebabItemName(branchName);
  if (!componentName) {
    throw new Error(
      `rendering "${definition.definitionKey}": could not derive kebab componentName`,
    );
  }
  const collectionSystem = toSystemName(
    definition.collectionSystem ?? DEFAULT_PROJECT_COLLECTION,
  );
  let itemTemplateName = itemTemplate.name;
  let folderTemplateName = folderTemplate.name;
  let childItemTemplateName = childItemTemplate?.name?.trim() || undefined;
  let stats = emptyWriteStats();

  const renderingsCollectionId = await ensureProjectCollectionRootId({
    kind: "renderings",
    collectionSystem,
  });

  const templatesDiskDir = getProjectTemplatesDiskRoot(collectionSystem);
  const renderingsDiskDir = getProjectRenderingsDiskDir(collectionSystem);
  const renderingsSitecorePath =
    getProjectRenderingsSitecorePath(collectionSystem);

  const branch = await ensureParametersBranchParent({
    name: branchName,
    collectionSystem,
    handle: saiHandle,
    idKey: "branch",
  });
  stats = mergeWriteStats(stats, branch.stats);

  const ids: LiveIds = {};
  const branchId = branch.parentId;
  const branchSitecorePath = branch.parentSitecorePath;

  const writeTemplate = async (
    relPath: string,
    item: ScsItem,
  ): Promise<string> => {
    const filePath = path.join(templatesDiskDir, relPath);
    const applied = await applyAuthoringItem(filePath, item);
    recordWrite(stats, applied);
    return applied.itemId;
  };

  const writeRendering = async (
    relPath: string,
    item: ScsItem,
  ): Promise<string> => {
    const filePath = path.join(renderingsDiskDir, relPath);
    const applied = await applyAuthoringItem(filePath, item);
    recordWrite(stats, applied);
    return applied.itemId;
  };

  const itemIcon =
    definition.icon?.trim() || "Office/32x32/window_dialog.png";

  // Create datasource template without __Standard values — patch after std exists.
  ids.datasource = await writeTemplate(`${branchName}/${itemTemplateName}.yml`, {
    parent: branchId,
    template: TEMPLATE,
    path: `${branchSitecorePath}/${itemTemplateName}`,
    sharedFields: [
      {
        id: FIELD_IDS.Icon,
        hint: "__Icon",
        value: itemIcon,
      },
      {
        id: FIELD_IDS.BaseTemplate,
        hint: "__Base template",
        value: `${BASE_STANDARD_TEMPLATE}\n${BASE_PAGE_CONTENT}`,
        multiline: true,
      },
      { id: FIELD_IDS.Sortorder, hint: "__Sortorder", value: 100 },
    ],
  });

  const itemTemplateDiskDir = path.join(branch.branchDiskDir, itemTemplateName);
  const { sectionSorts, fields: emittedFields } =
    await applyTemplateSectionsAndFields({
      handle: saiHandle,
      sections: itemTemplate.sections ?? [],
      templateId: ids.datasource,
      templateDiskDir: itemTemplateDiskDir,
      templateSitecorePath: `${branchSitecorePath}/${itemTemplateName}`,
      stats,
      sectionIdKey: (sectionName) => `section:datasource:${sectionName}`,
      fieldIdKey: (sectionName, fieldName) =>
        `field:${sectionName}:${fieldName}`,
      sectionExtraSharedFields: () => templateSectionIconSharedFields(itemIcon),
    });

  const stdDefaults = await collectStandardValueFields(emittedFields, {
    honorShared: false,
    media: {
      handle: saiHandle,
      folder: mediaFolderForDatasourceStdValues(
        definition,
        branchName,
        itemTemplateName,
      ),
      collectionSystem,
      label: `Rendering ${branchName} datasource std values`,
    },
  });
  stats = mergeWriteStats(stats, stdDefaults.stats);

  // Child template first when present so __Masters can use the live id.
  if (childItemTemplate && childItemTemplateName) {
    const childIcon =
      definition.icon?.trim() || "Office/32x32/window_dialog.png";
    ids.childDatasource = await writeTemplate(
      `${branchName}/${childItemTemplateName}.yml`,
      {
        parent: branchId,
        template: TEMPLATE,
        path: `${branchSitecorePath}/${childItemTemplateName}`,
        sharedFields: [
          {
            id: FIELD_IDS.Icon,
            hint: "__Icon",
            value: childIcon,
          },
          {
            id: FIELD_IDS.BaseTemplate,
            hint: "__Base template",
            value: `${BASE_STANDARD_TEMPLATE}\n${BASE_PAGE_CONTENT}`,
            multiline: true,
          },
          { id: FIELD_IDS.Sortorder, hint: "__Sortorder", value: 150 },
        ],
      },
    );

    const childTemplateDiskDir = path.join(
      branch.branchDiskDir,
      childItemTemplateName,
    );
    const { sectionSorts: childSectionSorts, fields: childEmittedFields } =
      await applyTemplateSectionsAndFields({
        handle: saiHandle,
        sections: childItemTemplate.sections ?? [],
        templateId: ids.childDatasource,
        templateDiskDir: childTemplateDiskDir,
        templateSitecorePath: `${branchSitecorePath}/${childItemTemplateName}`,
        stats,
        sectionIdKey: (sectionName) =>
          `section:childDatasource:${sectionName}`,
        fieldIdKey: (sectionName, fieldName) =>
          `field:childDatasource:${sectionName}:${fieldName}`,
        sectionExtraSharedFields: () =>
          templateSectionIconSharedFields(childIcon),
      });

    const childStdDefaults = await collectStandardValueFields(
      childEmittedFields,
      {
        honorShared: false,
        media: {
          handle: saiHandle,
          folder: mediaFolderForDatasourceStdValues(
            definition,
            branchName,
            childItemTemplateName,
          ),
          collectionSystem,
          label: `Rendering ${branchName} child datasource std values`,
        },
      },
    );
    stats = mergeWriteStats(stats, childStdDefaults.stats);

    ids.childDatasourceStdValues = await writeTemplate(
      `${branchName}/${childItemTemplateName}/__Standard Values.yml`,
      {
        parent: ids.childDatasource,
        template: ids.childDatasource,
        path: `${branchSitecorePath}/${childItemTemplateName}/__Standard Values`,
        sharedFields: [
          {
            id: FIELD_IDS.Icon,
            hint: "__Icon",
            value: childIcon,
          },
          {
            id: FIELD_IDS.Sortorder,
            hint: "__Sortorder",
            value: standardValuesSortOrder(childSectionSorts),
          },
        ],
        versionFields: childStdDefaults.versioned,
      },
    );

    await updateItem({
      itemId: ids.childDatasource,
      path: `${branchSitecorePath}/${childItemTemplateName}`,
      fields: [
        {
          name: "__Standard values",
          value: braceGuid(ids.childDatasourceStdValues),
        },
      ],
    });
  }

  const datasourceStdShared: ScsField[] = [
    {
      id: FIELD_IDS.Icon,
      hint: "__Icon",
      value: itemIcon,
    },
    {
      id: FIELD_IDS.Sortorder,
      hint: "__Sortorder",
      value: standardValuesSortOrder(sectionSorts),
    },
  ];
  if (ids.childDatasource) {
    datasourceStdShared.push({
      id: FIELD_IDS.Masters,
      hint: "__Masters",
      value: braceGuid(ids.childDatasource),
    });
  }

  ids.datasourceStdValues = await writeTemplate(
    `${branchName}/${itemTemplateName}/__Standard Values.yml`,
    {
      parent: ids.datasource,
      template: ids.datasource,
      path: `${branchSitecorePath}/${itemTemplateName}/__Standard Values`,
      sharedFields: datasourceStdShared,
      versionFields: stdDefaults.versioned,
    },
  );

  await updateItem({
    itemId: ids.datasource,
    path: `${branchSitecorePath}/${itemTemplateName}`,
    fields: [
      {
        name: "__Standard values",
        value: braceGuid(ids.datasourceStdValues),
      },
    ],
  });

  const folderIcon = "Office/32x32/folder_window.png";

  ids.folder = await writeTemplate(`${branchName}/${folderTemplateName}.yml`, {
    parent: branchId,
    template: TEMPLATE,
    path: `${branchSitecorePath}/${folderTemplateName}`,
    sharedFields: [
      {
        id: FIELD_IDS.Icon,
        hint: "__Icon",
        value: folderIcon,
      },
    ],
  });

  ids.folderStdValues = await writeTemplate(
    `${branchName}/${folderTemplateName}/__Standard Values.yml`,
    {
      parent: ids.folder,
      template: ids.folder,
      path: `${branchSitecorePath}/${folderTemplateName}/__Standard Values`,
      sharedFields: [
        {
          id: FIELD_IDS.Icon,
          hint: "__Icon",
          value: folderIcon,
        },
        { id: FIELD_IDS.Sortorder, hint: "__Sortorder", value: 100 },
        {
          id: FIELD_IDS.Masters,
          hint: "__Masters",
          value: `${braceGuid(ids.datasource!)}\n${braceGuid(ids.folder!)}`,
          multiline: true,
        },
      ],
    },
  );

  await updateItem({
    itemId: ids.folder,
    path: `${branchSitecorePath}/${folderTemplateName}`,
    fields: [
      {
        name: "__Standard values",
        value: braceGuid(ids.folderStdValues),
      },
    ],
  });

  let parametersTemplateId = await resolveParametersTemplateReference({
    definition,
    registry,
    collectionSystem,
  });

  if (!parametersTemplateId) {
    const parametersEmit = await applyParametersTemplate({
      handle: saiHandle,
      branchName,
      parentId: branchId,
      parentSitecorePath: branchSitecorePath,
      branchDiskDir: branch.branchDiskDir,
      model: isParametersModelDef(definition.parameters)
        ? definition.parameters
        : { sections: [] },
      collectionSystem,
    });
    stats = mergeWriteStats(stats, parametersEmit.stats);
    parametersTemplateId = parametersEmit.parametersTemplateId;
  }

  const openProps = definition.openPropertiesAfterAdd ? 1 : 0;
  const datasourceTemplateOverride = definition.datasourceTemplate?.trim();
  const datasourceLocation =
    definition.datasourceLocationQuery?.trim() ||
    (datasourceTemplateOverride
      ? buildNamedFolderDatasourceLocationQuery(definition.datasourceLocation)
      : buildRenderingDatasourceLocationQuery(
          definition.datasourceLocation,
          folderTemplateName,
        ));
  const datasourceTemplatePath = datasourceTemplateOverride
    ? datasourceTemplateOverride.startsWith("{") ||
      datasourceTemplateOverride.startsWith("/")
      ? datasourceTemplateOverride
      : braceGuid(datasourceTemplateOverride)
    : `${branchSitecorePath}/${itemTemplateName}`;
  const otherProperties = buildOtherProperties(definition);

  const renderingYamlPath = path.join(renderingsDiskDir, `${branchName}.yml`);
  const phEmit = await applyRenderingPlaceholders(
    definition,
    registry,
    undefined,
    renderingYamlPath,
  );
  stats = mergeWriteStats(stats, phEmit.stats);

  const renderingSharedFields = buildRenderingSharedFields({
    componentName,
    datasourceTemplatePath,
    datasourceLocation,
    openPropertiesAfterAdd: openProps,
    icon: definition.icon ?? "Office/32x32/window_star.png",
    otherProperties,
    renderingCssClass: definition.renderingCssClass,
    parametersTemplateId,
    placeholderSettingIds: phEmit.placeholderSettingIds,
    componentGraphQLQuery: definition.componentGraphQLQuery,
    pageEditorButtons: definition.pageEditorButtons,
    addFieldEditorButton: definition.addFieldEditorButton,
  });

  const renderingLanguages =
    definition.cultures?.length && definition.displayName
      ? await buildLanguageBlocks(
          [
            {
              id: FIELD_IDS.DisplayName,
              hint: "__Display name",
              value: definition.displayName,
            },
          ],
          [],
          definition.cultures,
          definition.cultures?.[0] ?? "en",
          renderingYamlPath,
        )
      : undefined;

  ids.rendering = await writeRendering(`${branchName}.yml`, {
    parent: renderingsCollectionId,
    template: JSON_RENDERING,
    path: `${renderingsSitecorePath}/${branchName}`,
    sharedFields: renderingSharedFields,
    ...(renderingLanguages ? { languages: renderingLanguages } : {}),
  });

  const scaffoldingParent = await ensureScaffoldingCollectionParent({
    collectionSystem,
    handle: saiHandle,
  });
  stats = mergeWriteStats(stats, scaffoldingParent.stats);

  stats = mergeWriteStats(
    stats,
    await applyScaffoldingInsertOptionsRule({
      renderingName: branchName,
      folderTemplateId: ids.folder!,
      handle: saiHandle,
      scaffolding: scaffoldingParent,
    }),
  );

  stats = mergeWriteStats(
    stats,
    await applyRenderingVariants({
      definition,
      // Headless Variants folders stay on branch name (Pascal for components).
      componentName: branchName,
      handle: saiHandle,
      registry,
    }),
  );

  return stats;
}

export function definitionFieldId(
  definitionHandle: string,
  section: string,
  fieldName: string,
): string {
  return fieldId(definitionHandle, section, fieldName);
}

export function definitionDatasourceTemplateId(definitionHandle: string): string {
  return stableGuid(definitionHandle, PLACEHOLDER_KEYS.datasource);
}

export function definitionChildDatasourceTemplateId(
  definitionHandle: string,
): string {
  return stableGuid(definitionHandle, PLACEHOLDER_KEYS.childDatasource);
}

export function definitionFolderTemplateId(definitionHandle: string): string {
  return stableGuid(definitionHandle, PLACEHOLDER_KEYS.folder);
}

export function renderingPluralName(name: string): string {
  return pluralComponentName(name);
}
