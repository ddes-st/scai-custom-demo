import {
  toKebabItemName,
  toSpacedItemName,
  normalizeDataFolderSegments,
  proposeValidItemName,
} from "../../shared/naming";
import {
  componentCodePrefixFromHostSlug,
  sitecoreSpacedStemFromComponent,
  stripLeadingBrandSpacedLabel,
  toPascalCase,
} from "../../create-section-components/naming.mjs";
import {
  JSS_LINK_LIST_RENDERING,
  PLATFORM_LINK_LIST_COMPONENT_GQL,
  shouldUsePlatformLinkListRendering,
} from "../../shared/platform-link-list";
import {
  ICON_LINK_LIST_COMPONENT_GQL,
  iconLinkListGroupTemplatePath,
  shouldUseIconLinkListRendering,
} from "../../shared/icon-link-list";
import {
  IMAGE_LINK_LIST_COMPONENT_GQL,
  imageLinkListGroupTemplatePath,
  shouldUseImageLinkListRendering,
} from "../../shared/image-link-list";
import {
  buildChildItemTemplateComponentQuery,
  collectTemplateFieldRefs,
} from "../../shared/child-item-template-gql";
import { shouldPreferCompositeLinkList } from "../../shared/bq-env";
import type {
  ComponentTemplateDefinition,
  RenderingDatasourceLocation,
  RenderingDefinition,
} from "../types";

/**
 * Resolve site-scoped datasource picker location for the rendering façade.
 *
 * Preference order:
 * 1. Explicit `datasourceLocation` (same shape as `kind: "rendering"`)
 * 2. First `datasource.locations` entry with `scope: "site"` (legacy subfolder → folder[])
 * 3. Seed `content.location` folder under site Data
 * 4. Default `{ scope: "site", root: "data" }`
 */
export function resolveComponentDatasourceLocation(
  definition: ComponentTemplateDefinition,
): RenderingDatasourceLocation {
  if (definition.datasourceLocation) {
    return definition.datasourceLocation;
  }

  const siteLocation = definition.datasource?.locations?.find(
    (loc) => loc.scope === "site",
  );
  if (siteLocation?.subfolder?.trim()) {
    const folder = siteLocation.subfolder
      .split(/[/\\]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return { scope: "site", root: "data", folder };
  }

  if (definition.content?.location) {
    return {
      scope: "site",
      root: definition.content.location.root,
      folder: definition.content.location.folder,
    };
  }

  return { scope: "site", root: "data" };
}

/**
 * Map a `kind: "component"` definition onto a `RenderingDefinition` so the
 * component emitter can call `applyRenderingDefinition` unchanged.
 *
 * Standalone rendering / parameters / data emitters are not modified.
 *
 * Template leaf names and rendering Path leaves are unbranded spaced Title
 * Case (`Trust Metrics`, `Trust Metrics Folder`). The Sitecore `componentName`
 * field stays brand-prefixed kebab from `definitionKey` so it matches Content
 * SDK component-map / FE package keys.
 *
 * When location is `Data/Link Lists`, `Data/Icon Link Lists`, or
 * `Data/Image Link Lists`, datasource template + ComponentQuery are filled
 * from the matching shared constants (AI need not set them).
 *
 * When `model.childItemTemplate` is set (FAQ / tiles / recognition / badges),
 * synthesize ComponentQuery for parent fields + `children.results` unless the
 * definition already provides `componentGraphQLQuery`.
 */
export function mapComponentToRenderingDefinition(
  definition: ComponentTemplateDefinition,
): RenderingDefinition {
  const codePrefix =
    componentCodePrefixFromHostSlug(
      definition.siteSystem || definition.collectionSystem || "",
    ) || toPascalCase(definition.collectionSystem || "");

  const mapKey =
    toKebabItemName(definition.definitionKey) ||
    toKebabItemName(definition.name);
  if (!mapKey) {
    throw new Error(
      `component "${definition.definitionKey}": definitionKey/name must yield a kebab map key`,
    );
  }

  if (!String(definition.componentName || definition.displayName || definition.name || "").trim()) {
    throw new Error(
      `component "${definition.definitionKey}": componentName must be non-empty`,
    );
  }

  const displayName =
    definition.displayName?.trim() ||
    sitecoreSpacedStemFromComponent({
      componentName: definition.componentName,
      codePrefix,
    });

  // Project rendering Path leaf = component identity (unique per distinct TSX).
  // Never marketing displayName; never shared data-template names like "Link List".
  const fromComponent = sitecoreSpacedStemFromComponent({
    componentName: definition.componentName,
    codePrefix,
  });
  const spacedStem = proposeValidItemName(
    fromComponent || "unnamed-item",
    fromComponent || "unnamed-item",
  );
  if (!spacedStem) {
    throw new Error(
      `component "${definition.definitionKey}": could not derive Sitecore Path stem`,
    );
  }

  // Data templates may be shared across renderings (e.g. several Link List packages).
  // Keep pinned itemTemplate / folderTemplate names; do not overwrite with Path leaf.
  const itemNameRaw = definition.model?.itemTemplate?.name?.trim() || "";
  const fromModelRaw = itemNameRaw
    ? proposeValidItemName(itemNameRaw, itemNameRaw)
    : "";
  const fromModel = fromModelRaw
    ? stripLeadingBrandSpacedLabel(fromModelRaw, codePrefix)
    : "";
  const itemTemplateName = proposeValidItemName(
    (fromModel && fromModel.length <= 48 ? fromModel : "") || spacedStem,
    spacedStem,
  );

  const folderNameRaw = definition.model?.folderTemplate?.name?.trim() || "";
  const pinnedFolder = folderNameRaw
    ? proposeValidItemName(folderNameRaw, folderNameRaw)
    : "";
  const pinnedFolderSpaced = pinnedFolder
    ? stripLeadingBrandSpacedLabel(pinnedFolder, codePrefix)
    : "";
  const folderName = proposeValidItemName(
    pinnedFolderSpaced && pinnedFolderSpaced.length <= 56
      ? /folder$/i.test(pinnedFolderSpaced)
        ? pinnedFolderSpaced
        : `${pinnedFolderSpaced} Folder`
      : `${itemTemplateName} Folder`,
    `${itemTemplateName} Folder`,
  );

  const childNameRaw =
    definition.model?.childItemTemplate?.name?.trim() || "";
  const childSanitized = childNameRaw
    ? proposeValidItemName(childNameRaw, childNameRaw)
    : "";
  const childName = childSanitized
    ? proposeValidItemName(
        stripLeadingBrandSpacedLabel(childSanitized, codePrefix) ||
          childSanitized,
        childSanitized,
      )
    : undefined;

  const model = definition.model
    ? {
        ...definition.model,
        folderTemplate: {
          ...definition.model.folderTemplate,
          name: folderName,
        },
        itemTemplate: {
          ...definition.model.itemTemplate,
          name: itemTemplateName,
        },
        ...(definition.model.childItemTemplate
          ? {
              childItemTemplate: {
                ...definition.model.childItemTemplate,
                name: childName || definition.model.childItemTemplate.name,
              },
            }
          : {}),
      }
    : definition.model;

  const unbrandFolder = (folder: string[] | undefined | null) => {
    const spaced = normalizeDataFolderSegments(folder);
    if (!spaced?.length || !codePrefix) return spaced;
    return spaced.map(
      (seg) => stripLeadingBrandSpacedLabel(seg, codePrefix) || seg,
    );
  };

  const datasourceLocationRaw = resolveComponentDatasourceLocation(definition);
  const datasourceLocation = {
    ...datasourceLocationRaw,
    folder: unbrandFolder(datasourceLocationRaw.folder),
  };

  const renderingHints = {
    datasourceLocation,
    content: definition.content
      ? {
          ...definition.content,
          location: {
            ...definition.content.location,
            folder: unbrandFolder(definition.content.location?.folder),
          },
        }
      : definition.content,
  };
  const preferCompositeLinkList = shouldPreferCompositeLinkList(definition);
  const usePlatformLinkList =
    !preferCompositeLinkList &&
    shouldUsePlatformLinkListRendering(renderingHints);
  const useIconLinkList =
    !preferCompositeLinkList &&
    shouldUseIconLinkListRendering(renderingHints);
  const useImageLinkList =
    !preferCompositeLinkList &&
    shouldUseImageLinkListRendering(renderingHints);

  let datasourceTemplate = definition.datasourceTemplate;
  let componentGraphQLQuery = definition.componentGraphQLQuery;
  let parametersTemplateId = definition.parametersTemplateId;
  let datasourceLocationQuery: string | undefined;
  let pageEditorButtons: string | undefined;
  let addFieldEditorButton: string | number | boolean | undefined;
  let icon = definition.icon;
  if (usePlatformLinkList) {
    // Mirror live JSS XA LinkList Json Rendering fields (not group GUID / @@name).
    datasourceTemplate =
      definition.datasourceTemplate?.trim() ||
      JSS_LINK_LIST_RENDERING.datasourceTemplate;
    componentGraphQLQuery =
      definition.componentGraphQLQuery?.trim() ||
      PLATFORM_LINK_LIST_COMPONENT_GQL;
    parametersTemplateId =
      parametersTemplateId?.trim() ||
      JSS_LINK_LIST_RENDERING.parametersTemplateId;
    datasourceLocationQuery = JSS_LINK_LIST_RENDERING.datasourceLocation;
    pageEditorButtons =
      definition.pageEditorButtons?.trim() ||
      JSS_LINK_LIST_RENDERING.pageEditorButtons;
    addFieldEditorButton =
      definition.addFieldEditorButton ??
      JSS_LINK_LIST_RENDERING.addFieldEditorButton;
    icon = icon?.trim() || JSS_LINK_LIST_RENDERING.icon;
  } else if (useIconLinkList || useImageLinkList) {
    const collectionSystem = definition.collectionSystem?.trim();
    if (!collectionSystem) {
      throw new Error(
        `component "${definition.definitionKey}": collectionSystem is required for icon/image link list renderings`,
      );
    }
    datasourceTemplate = useIconLinkList
      ? iconLinkListGroupTemplatePath(collectionSystem)
      : imageLinkListGroupTemplatePath(collectionSystem);
    componentGraphQLQuery = useIconLinkList
      ? ICON_LINK_LIST_COMPONENT_GQL
      : IMAGE_LINK_LIST_COMPONENT_GQL;
  } else if (
    !componentGraphQLQuery?.trim() &&
    definition.model?.childItemTemplate
  ) {
    componentGraphQLQuery = buildChildItemTemplateComponentQuery({
      parentFields: collectTemplateFieldRefs(definition.model.itemTemplate),
      childFields: collectTemplateFieldRefs(definition.model.childItemTemplate),
    });
  }

  return {
    kind: "rendering",
    definitionKey: definition.definitionKey,
    // Branch + project rendering Path leaf: unbranded spaced Title Case.
    name: spacedStem,
    displayName,
    description: definition.description,
    // SCS componentName field must match Content SDK map keys (branded kebab).
    componentName: mapKey,
    collectionSystem: definition.collectionSystem,
    siteSystem: definition.siteSystem,
    model,
    datasourceLocation,
    parameters: definition.parameters,
    parametersTemplateId,
    renderingCssClass: definition.renderingCssClass,
    icon,
    openPropertiesAfterAdd:
      definition.openPropertiesAfterAdd ??
      definition.datasource?.openPropertiesAfterAdd,
    otherProperties: definition.otherProperties,
    cultures: definition.cultures,
    variants: definition.variants,
    placeholders: definition.placeholders,
    datasourceTemplate,
    componentGraphQLQuery,
    datasourceLocationQuery,
    pageEditorButtons,
    addFieldEditorButton,
  };
}

/**
 * Project Renderings / Headless Variants Path leaf for CM lookup.
 *
 * Create writes spaced Title Case from the unbranded `componentName` stem
 * (`Footer Quick Link List`). Shared data-template names (`Link List`) must
 * not become the Path leaf. FE `componentName` stays Pascal/kebab map keys.
 * Callers that resolve CM items by path must use this — never Pascal
 * `componentName` as the Path leaf.
 *
 * Pure / coded: same rules as create (`mapComponentToRenderingDefinition`);
 * no disk or cache.
 */
export function projectRenderingPathLeaf(
  def: ComponentTemplateDefinition | RenderingDefinition,
): string {
  if (def.kind === "component") {
    return mapComponentToRenderingDefinition(def).name.trim();
  }
  return String(def.name || "").trim();
}
