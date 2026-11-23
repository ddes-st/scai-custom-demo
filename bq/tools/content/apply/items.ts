import { resolveComponentContentVersions } from "../../shared/normalize-versions";
import { primarySaiHandle } from "../../shared/sai-handle";
import { normalizeDataFolderSegments } from "../../shared/naming";
import {
  definitionChildDatasourceTemplateId,
  definitionDatasourceTemplateId,
  definitionFieldId,
  definitionFolderTemplateId,
} from "../../definitions/apply/component";
import { mapComponentToRenderingDefinition } from "../../definitions/apply/component-to-rendering";
import { ensureSystemLanguages } from "../../shared/ensure-languages";
import { DEFAULT_PROJECT_COLLECTION } from "../../shared/data-placement";
import { resolveContentSiteContext } from "../../shared/content-site-context";
import { COMPONENTS_ROOT } from "../../shared/paths";
import { retirePriorFoldersIfChangedForComponent } from "../../shared/retire-prior-content-media-folders";
import {
  buildFieldMetaFromModel,
  applySiteContentItemTree,
  prepareSiteContentFolder,
} from "../../shared/site-content-items";
import {
  applyPlatformLinkListTree,
  shouldApplyPlatformLinkList,
} from "../../shared/platform-link-list";
import {
  applyIconLinkListTree,
  shouldApplyIconLinkList,
} from "../../shared/icon-link-list";
import {
  applyImageLinkListTree,
  shouldApplyImageLinkList,
} from "../../shared/image-link-list";
import { shouldPreferCompositeLinkList } from "../../shared/bq-env";
import {
  resolveSiteOrigin,
  resolveSourceLanguage,
} from "../../shared/ensure-home-link-page";
import { resolveContentLanguages } from "../../shared/resolve-content-languages";
import {
  emptyWriteStats,
  mergeWriteStats,
  type ScsWriteStats,
} from "../../shared/authoring-item-model";
import { SITE_FOLDER_TEMPLATE } from "../../definitions/apply/shared";
import { resolveItemIdByPath } from "../../shared/resolve-item-id-by-path";
import type {
  ComponentContentDefinition,
  ComponentContentSeed,
} from "../types";
import type { ComponentTemplateDefinition } from "../../definitions/types";

/**
 * Live Project template id from Authoring path (in-run cache / CM).
 * Never use serialized YAML IDs — Authoring create does not ForceId.
 *
 * Branch must match rendering emit (`mapComponentToRenderingDefinition` →
 * unbranded spaced Title Case, e.g. `Content Block`), not Pascal `componentName`
 * (`MenzisContentBlock`) — otherwise content apply looks under the wrong path.
 */
async function resolveContentTemplateId(opts: {
  collectionSystem: string;
  /** Template branch under Project/{collection} — same as rendering `name`. */
  templateBranch: string | undefined;
  templateLeafName: string | undefined;
  fallbackId?: string;
}): Promise<string> {
  const leaf = String(opts.templateLeafName || "").trim();
  const branch = String(opts.templateBranch || "").trim();
  if (!leaf || !branch || !opts.collectionSystem) {
    throw new Error(
      `[bq:apply:content] cannot resolve template (collection=${opts.collectionSystem} branch=${opts.templateBranch} leaf=${opts.templateLeafName})`,
    );
  }
  const sitecorePath = `/sitecore/templates/Project/${opts.collectionSystem}/${branch}/${leaf}`;
  const resolved = await resolveItemIdByPath({
    sitecorePath,
    logPrefix: "[bq:apply:content-template]",
  });
  if (!resolved.found || !resolved.id) {
    throw new Error(
      `[bq:apply:content] template missing on CM at ${sitecorePath} (emit rendering first)`,
    );
  }
  void opts.fallbackId;
  return resolved.id;
}

function linkHomeEmitExtras(options: {
  collectionSystem: string;
  siteSystem?: string | null;
}): {
  collectionSystem: string;
  siteSystem?: string;
  siteOrigin?: string;
  sourceLanguage: string;
} {
  const siteSystem = options.siteSystem?.trim() || undefined;
  return {
    collectionSystem: options.collectionSystem,
    siteSystem,
    siteOrigin: resolveSiteOrigin(undefined, { siteSystem }),
    sourceLanguage: resolveSourceLanguage(undefined, { siteSystem }),
  };
}

/**
 * Emit seed content from a component definition's optional `content` block.
 */
export async function applyComponentTemplateContent(
  definition: ComponentTemplateDefinition,
): Promise<ScsWriteStats> {
  if (!definition.content) {
    return emptyWriteStats();
  }
  return applyComponentContent(
    toComponentContentDefinition(definition.definitionKey, definition.content),
    definition,
  );
}

function toComponentContentDefinition(
  definitionKey: string,
  seed: ComponentContentSeed,
): ComponentContentDefinition {
  return {
    kind: "component-content",
    definitionKey,
    ...seed,
    location: {
      ...seed.location,
      folder: normalizeDataFolderSegments(seed.location?.folder) ?? seed.location?.folder,
    },
  };
}

/**
 * Emit component seed content under the site tree.
 * Field metadata comes from the paired component definition (`model`);
 * item emit supports media, cultures, and Sitecore versions like data definitions.
 */
export async function applyComponentContent(
  content: ComponentContentDefinition,
  componentDefinition: ComponentTemplateDefinition,
): Promise<ScsWriteStats> {
  const versions = resolveComponentContentVersions(content);
  const saiHandle = primarySaiHandle(content.definitionKey, versions);
  const minVer = Math.min(...versions.map((v) => v.version));
  const ver = versions.find((v) => v.version === minVer) ?? versions[0]!;
  const cultures = content.cultures ?? [];
  const sourceCulture = content.culture ?? "en";
  const label = `component-content "${content.definitionKey}"`;

  let stats = emptyWriteStats();
  const { emitCultures } = resolveContentLanguages({
    culture: sourceCulture,
    cultures,
  });
  if (emitCultures.some((c) => c.toLowerCase() !== "en")) {
    stats = mergeWriteStats(
      stats,
      await ensureSystemLanguages(
        emitCultures.filter((c) => c.toLowerCase() !== "en"),
      ),
    );
  }

  const collectionSystem =
    componentDefinition.collectionSystem ?? DEFAULT_PROJECT_COLLECTION;
  const siteContext = resolveContentSiteContext(collectionSystem, {
    siteSystemHint: componentDefinition.siteSystem,
  });
  const siteSystem =
    siteContext?.siteSystem ?? componentDefinition.siteSystem ?? "";
  const linkHome = {
    ...linkHomeEmitExtras({
      collectionSystem,
      siteSystem,
    }),
    sourceLanguage: sourceCulture,
    cultures,
  };

  // Same-component folder rename: drop prior Data/media YAML before writing.
  if (componentDefinition.componentName && siteSystem) {
    retirePriorFoldersIfChangedForComponent({
      collectionSystem,
      siteSystem,
      componentName: componentDefinition.componentName,
      newContentFolder: content.location?.folder ?? null,
      componentsRoot: COMPONENTS_ROOT,
    });
  }

  const preferCompositeLinkList =
    shouldPreferCompositeLinkList(componentDefinition);
  const usePlatformLinkList =
    !preferCompositeLinkList && shouldApplyPlatformLinkList(content);
  const useIconLinkList =
    !preferCompositeLinkList && shouldApplyIconLinkList(content);
  const useImageLinkList =
    !preferCompositeLinkList && shouldApplyImageLinkList(content);
  const useSharedLinkListFolder =
    usePlatformLinkList || useIconLinkList || useImageLinkList;
  // Same unbranded spaced branch + leaf names as applyRenderingDefinition.
  const renderingFacade = mapComponentToRenderingDefinition(componentDefinition);
  const templateBranch = renderingFacade.name;
  const folderMeta =
    renderingFacade.model?.folderTemplate ??
    componentDefinition.model.folderTemplate;
  const folderTemplateFallback = definitionFolderTemplateId(saiHandle);
  const folderTemplateId = useSharedLinkListFolder
    ? SITE_FOLDER_TEMPLATE
    : await resolveContentTemplateId({
        collectionSystem,
        templateBranch,
        templateLeafName: folderMeta?.name,
        fallbackId: folderTemplateFallback,
      });
  const prepared = await prepareSiteContentFolder({
    label,
    location: content.location,
    handle: saiHandle,
    // Shared link-list folders live under site Data/* — do not rewrite with
    // a component-specific folder template.
    folderTemplateId,
    siteContext,
    skipExistingRootDepth: useSharedLinkListFolder
      ? (content.location.folder ?? []).length
      : undefined,
    sourceLanguage: sourceCulture,
    leafFolder:
      !useSharedLinkListFolder &&
      (folderMeta.displayName ||
        folderMeta.description ||
        folderMeta.shortDescription)
        ? {
            displayName: folderMeta.displayName,
            description: folderMeta.description,
            shortDescription: folderMeta.shortDescription,
          }
        : undefined,
  });
  stats = mergeWriteStats(stats, prepared.stats);

  if (usePlatformLinkList) {
    const itemStats = await applyPlatformLinkListTree({
      items: ver.items,
      handle: saiHandle,
      label,
      parentId: prepared.leafId,
      parentSitecorePath: prepared.leafSitecorePath,
      diskDir: prepared.itemsDiskDir,
      ...linkHome,
    });
    return mergeWriteStats(stats, itemStats);
  }

  if (useIconLinkList) {
    const itemStats = await applyIconLinkListTree({
      items: ver.items,
      handle: saiHandle,
      label,
      parentId: prepared.leafId,
      parentSitecorePath: prepared.leafSitecorePath,
      diskDir: prepared.itemsDiskDir,
      ...linkHome,
    });
    return mergeWriteStats(stats, itemStats);
  }

  if (useImageLinkList) {
    const itemStats = await applyImageLinkListTree({
      items: ver.items,
      handle: saiHandle,
      label,
      parentId: prepared.leafId,
      parentSitecorePath: prepared.leafSitecorePath,
      diskDir: prepared.itemsDiskDir,
      ...linkHome,
    });
    return mergeWriteStats(stats, itemStats);
  }

  const itemTemplateModel =
    renderingFacade.model?.itemTemplate ??
    componentDefinition.model.itemTemplate;
  const fields = buildFieldMetaFromModel(
    itemTemplateModel.sections,
    (section, fieldName) => definitionFieldId(saiHandle, section, fieldName),
  );

  const childItemTemplate =
    renderingFacade.model?.childItemTemplate ??
    componentDefinition.model.childItemTemplate;
  const childFields = childItemTemplate
    ? buildFieldMetaFromModel(
        childItemTemplate.sections,
        (section, fieldName) => definitionFieldId(saiHandle, section, fieldName),
      )
    : undefined;

  const itemTemplateFallback = definitionDatasourceTemplateId(saiHandle);
  const itemTemplateId = await resolveContentTemplateId({
    collectionSystem,
    templateBranch,
    templateLeafName: itemTemplateModel?.name,
    fallbackId: itemTemplateFallback,
  });
  const childTemplateFallback = childItemTemplate
    ? definitionChildDatasourceTemplateId(saiHandle)
    : "";
  const childItemTemplateId =
    childItemTemplate && childFields
      ? await resolveContentTemplateId({
          collectionSystem,
          templateBranch,
          templateLeafName: childItemTemplate.name,
          fallbackId: childTemplateFallback,
        })
      : undefined;
  const itemStats = await applySiteContentItemTree({
    items: ver.items,
    handle: saiHandle,
    label,
    parentId: prepared.leafId,
    parentSitecorePath: prepared.leafSitecorePath,
    diskDir: prepared.itemsDiskDir,
    itemTemplateId,
    fields,
    ...(childItemTemplate && childFields && childItemTemplateId
      ? {
          childItemTemplateId,
          childFields,
        }
      : {}),
    cultures,
    media: {
      handle: saiHandle,
      folder: content.location.folder ?? [],
      collectionSystem,
      label,
      siteSystem: linkHome.siteSystem,
      siteOrigin: linkHome.siteOrigin,
      sourceLanguage: linkHome.sourceLanguage,
      culture: sourceCulture,
      cultures,
    },
  });
  stats = mergeWriteStats(stats, itemStats);

  // Flat link lists are owned by dedicated LinkList packages under Data/Link Lists
  // (no dual-write from parent Multi-LineText JSON bags / content.linkLists).

  return stats;
}
