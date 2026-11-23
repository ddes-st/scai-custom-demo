/**
 * Project Image Link Lists — parallel to platform Link Lists.
 * Child items have Link + Image (media).
 */
import path from "node:path";
import { applyAuthoringItem } from "./authoring-apply-bridge";
import { braceGuid, stableGuid } from "./ids";
import {
  getProjectTemplatesDiskRoot,
  getProjectTemplatesSitecorePath,
  DEFAULT_PROJECT_COLLECTION,
} from "./data-placement";
import type {
  DataFieldValue,
  DataImageValue,
  DataLinkValue,
} from "../definitions/types";
import {
  encodeGeneralLink,
  isUnderSiteHome,
  proposeValidItemName,
  type GeneralLinkInput,
} from "./naming";
import { materializeGeneralLinkXml } from "./ensure-home-link-page";
import {
  emptyWriteStats,
  mergeWriteStats,
  recordWrite,
  type ScsLanguageBlock,
  type ScsWriteStats
} from "./authoring-item-model";
import { ensureProjectCollectionRootId } from "./project-collection-roots";
import { updateItem } from "./authoring-items";
import {
  extractUrlFromSeedLink,
  getLinkListReuseIndex,
} from "./link-list-reuse";
import {
  buildLinkListTitleLanguageBlocks,
  translateLinkXmlForEmitCulture,
} from "./link-list-culture";
import { translateGeneralLinkXml } from "./site-content-items";

function linkListPathLeaf(name: string, parentSitecorePath: string): string {
  return proposeValidItemName(name, name || "unnamed-item", {
    forUrl: isUnderSiteHome(`${parentSitecorePath}/${name}`),
  });
}
import {
  normalizeCultureKey,
  resolveContentLanguages,
} from "./resolve-content-languages";
import { resolveSortOrder } from "./sort-order";
import {
  BASE_PAGE_CONTENT,
  BASE_STANDARD_TEMPLATE,
  DATA_SECTION,
  FIELD_DEFINITION,
  FIELD_IDS,
  TEMPLATE,
  TEMPLATE_BRANCH,
} from "./system-ids";
import { buildTemplateFieldSharedFields } from "./template-field-shared";
import { materializeImageFieldValue } from "../definitions/apply/media";
const HANDLE = "bq-image-link-list";

export type ImageLinkListIds = {
  groupTemplateId: string;
  linkTemplateId: string;
  titleFieldId: string;
  linkFieldId: string;
  imageFieldId: string;
  groupStdId: string;
  linkStdId: string;
  groupSectionId: string;
  linkSectionId: string;
};

/**
 * @deprecated Minted GUIDs — not CM identity. Authoring apply uses the live ids
 * returned by {@link ensureImageLinkListTemplates}.
 */
export function imageLinkListIds(collectionSystem: string): ImageLinkListIds {
  const ns = `${HANDLE}:${String(collectionSystem || "").trim()}`;
  return {
    groupTemplateId: stableGuid(ns, "group-template"),
    linkTemplateId: stableGuid(ns, "link-template"),
    titleFieldId: stableGuid(ns, "title-field"),
    linkFieldId: stableGuid(ns, "link-field"),
    imageFieldId: stableGuid(ns, "image-field"),
    groupStdId: stableGuid(ns, "group-std-values"),
    linkStdId: stableGuid(ns, "link-std-values"),
    groupSectionId: stableGuid(ns, "group-section-data"),
    linkSectionId: stableGuid(ns, "link-section-data"),
  };
}

/** @deprecated Global IDs collide across collections — use {@link imageLinkListIds}. */
export const IMAGE_LINK_LIST = {
  groupTemplateId: stableGuid(HANDLE, "group-template"),
  linkTemplateId: stableGuid(HANDLE, "link-template"),
  titleFieldId: stableGuid(HANDLE, "title-field"),
  linkFieldId: stableGuid(HANDLE, "link-field"),
  imageFieldId: stableGuid(HANDLE, "image-field"),
} as const;

export const IMAGE_LINK_LIST_COMPONENT_GQL = `query ImageLinkListQuery($datasource: String!, $language: String!) {
  datasource: item(path: $datasource, language: $language) {
    children(first: 90) {
      results {
        link: field(name: "Link") {
          jsonValue
        }
        image: field(name: "Image") {
          jsonValue
        }
      }
    }
    field(name: "Title") {
      title: jsonValue
    }
  }
}`;

/** Datasource Template path for a collection's Image Link List group template. */
export function imageLinkListGroupTemplatePath(collectionSystem: string): string {
  return `/sitecore/templates/Project/${collectionSystem}/Image Link List/Image Link List`;
}

/** @deprecated Prefer {@link imageLinkListGroupTemplatePath} (collection-scoped). */
export const IMAGE_LINK_LIST_GROUP_TEMPLATE_BRACE = `{${IMAGE_LINK_LIST.groupTemplateId.toUpperCase()}}`;

export type ImageLinkListItemDef = {
  name: string;
  fields?: Record<string, DataFieldValue>;
  children?: ImageLinkListItemDef[];
};

function isLinkObject(value: unknown): value is DataLinkValue {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DataLinkValue).url === "string"
  );
}

function isImageObject(value: unknown): value is DataImageValue {
  return typeof value === "object" && value !== null;
}

async function encodeLinkValue(
  raw: DataFieldValue | undefined,
  linkHome?: {
    collectionSystem?: string;
    siteSystem?: string;
    siteOrigin?: string | null;
    sourceLanguage?: string | null;
    cultures?: string[] | null;
  },
): Promise<{ value: string; stats: ScsWriteStats }> {
  const empty = emptyWriteStats();
  if (raw === undefined || raw === null) return { value: "", stats: empty };
  if (
    linkHome?.collectionSystem &&
    linkHome?.siteSystem &&
    (typeof raw === "string" || isLinkObject(raw))
  ) {
    if (typeof raw === "string" && raw.trim().startsWith("<link")) {
      return { value: raw.trim(), stats: empty };
    }
    return materializeGeneralLinkXml(
      typeof raw === "string" ? raw : (raw as GeneralLinkInput),
      {
        collectionSystem: linkHome.collectionSystem,
        siteSystem: linkHome.siteSystem,
        siteOrigin: linkHome.siteOrigin,
        sourceLanguage: linkHome.sourceLanguage,
        cultures: linkHome.cultures ?? undefined,
      },
    );
  }
  if (typeof raw === "string") {
    return { value: encodeGeneralLink(raw), stats: empty };
  }
  if (isLinkObject(raw)) {
    return { value: encodeGeneralLink(raw as GeneralLinkInput), stats: empty };
  }
  return { value: "", stats: empty };
}

/**
 * Group Title from seeds. Explicit `Title: ""` stays empty; only fall back to
 * item `name` when neither Title nor Heading is present on the seed.
 */
function resolveGroupTitle(
  fields: Record<string, DataFieldValue> | undefined,
  itemName: string,
): string {
  if (!fields) return itemName;
  if (Object.prototype.hasOwnProperty.call(fields, "Title")) {
    const raw = fields.Title;
    return typeof raw === "string" ? raw : "";
  }
  if (Object.prototype.hasOwnProperty.call(fields, "Heading")) {
    const raw = fields.Heading;
    return typeof raw === "string" ? raw : "";
  }
  return itemName;
}

async function buildCultureTitleBlocks(
  titleSource: string,
  cultures: string[],
  sourceCulture: string = "en",
  englishTitleHint?: string | null,
  titleFieldId?: string,
): Promise<ScsLanguageBlock[]> {
  return buildLinkListTitleLanguageBlocks({
    titleSource,
    cultures,
    sourceCulture,
    titleFieldId: titleFieldId || IMAGE_LINK_LIST.titleFieldId,
    englishTitleHint,
  });
}

async function buildCultureChildBlocks(
  linkXmlSource: string,
  imageXml: string,
  cultures: string[],
  sourceCulture: string = "en",
  ids?: Pick<ImageLinkListIds, "linkFieldId" | "imageFieldId">,
): Promise<ScsLanguageBlock[]> {
  const linkFieldId = ids?.linkFieldId || IMAGE_LINK_LIST.linkFieldId;
  const imageFieldId = ids?.imageFieldId || IMAGE_LINK_LIST.imageFieldId;
  const { sourceCulture: src, emitCultures } = resolveContentLanguages({
    culture: sourceCulture,
    cultures,
  });
  const srcKey = normalizeCultureKey(src).toLowerCase();
  const blocks: ScsLanguageBlock[] = [];
  for (const lang of emitCultures) {
    const isSource = normalizeCultureKey(lang).toLowerCase() === srcKey;
    const linkXml = isSource
      ? linkXmlSource
      : await translateLinkXmlForEmitCulture(
          linkXmlSource,
          lang,
          src,
          translateGeneralLinkXml,
        );
    blocks.push({
      language: lang,
      versions: [
        {
          version: 1,
          versionFields: [
            {
              id: linkFieldId,
              hint: "Link",
              value: linkXml,
              multiline: true,
            },
            {
              id: imageFieldId,
              hint: "Image",
              value: imageXml,
              multiline: true,
            },
          ],
        },
      ],
    });
  }
  return blocks;
}

async function writeFieldItem(options: {
  stats: ScsWriteStats;
  parentId: string;
  sitecorePath: string;
  diskPath: string;
  type: string;
  sortOrder: number;
}): Promise<string> {
  const applied = await applyAuthoringItem(options.diskPath, {
    parent: options.parentId,
    template: FIELD_DEFINITION,
    path: options.sitecorePath,
    sharedFields: buildTemplateFieldSharedFields({
      type: options.type,
      sortOrder: options.sortOrder,
    }),
  });
  recordWrite(options.stats, applied);
  return applied.itemId;
}

/**
 * Ensure Image Link List templates on CM. Returns live Authoring ids (not minted
 * GUIDs) for template/field/section items — use these for parenting and field ids.
 */
export async function ensureImageLinkListTemplates(
  collectionSystem: string,
): Promise<{ stats: ScsWriteStats; ids: ImageLinkListIds }> {
  const stats = emptyWriteStats();
  const templatesRoot = getProjectTemplatesDiskRoot(collectionSystem);
  const templatesPath = getProjectTemplatesSitecorePath(collectionSystem);
  const collectionParentId = await ensureProjectCollectionRootId({
    kind: "templates",
    collectionSystem,
  });
  const folderName = "Image Link List";
  const folderYaml = path.join(templatesRoot, `${folderName}.yml`);
  const folderSitecorePath = `${templatesPath}/${folderName}`;
  const folderDisk = path.join(templatesRoot, folderName);

  const folderWrite = await applyAuthoringItem(folderYaml, {
    parent: collectionParentId,
    template: TEMPLATE_BRANCH,
    path: folderSitecorePath,
  });
  recordWrite(stats, folderWrite);
  const folderId = folderWrite.itemId;

  const baseTemplates = `${BASE_STANDARD_TEMPLATE}\r\n${BASE_PAGE_CONTENT}`;

  const groupName = "Image Link List";
  const groupYaml = path.join(folderDisk, `${groupName}.yml`);
  const groupPath = `${folderSitecorePath}/${groupName}`;
  const groupDisk = path.join(folderDisk, groupName);
  const groupStdYaml = path.join(groupDisk, "__Standard Values.yml");

  // Group template (no __Standard values / __Masters yet — patched after children exist).
  const groupWrite = await applyAuthoringItem(groupYaml, {
    parent: folderId,
    template: TEMPLATE,
    path: groupPath,
    sharedFields: [
      {
        id: FIELD_IDS.BaseTemplate,
        hint: "__Base template",
        value: baseTemplates,
      },
    ],
  });
  recordWrite(stats, groupWrite);
  const groupTemplateId = groupWrite.itemId;

  const groupStdWrite = await applyAuthoringItem(groupStdYaml, {
    parent: groupTemplateId,
    template: groupTemplateId,
    path: `${groupPath}/__Standard Values`,
  });
  recordWrite(stats, groupStdWrite);
  const groupStdId = groupStdWrite.itemId;

  const groupSectionWrite = await applyAuthoringItem(
    path.join(groupDisk, "Data.yml"),
    {
      parent: groupTemplateId,
      template: DATA_SECTION,
      path: `${groupPath}/Data`,
      sharedFields: [
        {
          id: FIELD_IDS.Sortorder,
          hint: "__Sortorder",
          value: 100,
        },
      ],
    },
  );
  recordWrite(stats, groupSectionWrite);
  const groupSectionId = groupSectionWrite.itemId;
  const titleFieldId = await writeFieldItem({
    stats,
    parentId: groupSectionId,
    sitecorePath: `${groupPath}/Data/Title`,
    diskPath: path.join(groupDisk, "Data", "Title.yml"),
    type: "Single-Line Text",
    sortOrder: 100,
  });

  const linkName = "Image Link";
  const linkYaml = path.join(folderDisk, `${linkName}.yml`);
  const linkPath = `${folderSitecorePath}/${linkName}`;
  const linkDisk = path.join(folderDisk, linkName);
  const linkStdYaml = path.join(linkDisk, "__Standard Values.yml");

  const linkWrite = await applyAuthoringItem(linkYaml, {
    parent: folderId,
    template: TEMPLATE,
    path: linkPath,
    sharedFields: [
      {
        id: FIELD_IDS.BaseTemplate,
        hint: "__Base template",
        value: baseTemplates,
      },
    ],
  });
  recordWrite(stats, linkWrite);
  const linkTemplateId = linkWrite.itemId;

  const linkStdWrite = await applyAuthoringItem(linkStdYaml, {
    parent: linkTemplateId,
    template: linkTemplateId,
    path: `${linkPath}/__Standard Values`,
  });
  recordWrite(stats, linkStdWrite);
  const linkStdId = linkStdWrite.itemId;

  const linkSectionWrite = await applyAuthoringItem(
    path.join(linkDisk, "Data.yml"),
    {
      parent: linkTemplateId,
      template: DATA_SECTION,
      path: `${linkPath}/Data`,
      sharedFields: [
        {
          id: FIELD_IDS.Sortorder,
          hint: "__Sortorder",
          value: 100,
        },
      ],
    },
  );
  recordWrite(stats, linkSectionWrite);
  const linkSectionId = linkSectionWrite.itemId;
  const linkFieldId = await writeFieldItem({
    stats,
    parentId: linkSectionId,
    sitecorePath: `${linkPath}/Data/Link`,
    diskPath: path.join(linkDisk, "Data", "Link.yml"),
    type: "General Link",
    sortOrder: 100,
  });
  const imageFieldId = await writeFieldItem({
    stats,
    parentId: linkSectionId,
    sitecorePath: `${linkPath}/Data/Image`,
    diskPath: path.join(linkDisk, "Data", "Image.yml"),
    type: "Image",
    sortOrder: 200,
  });

  // Patch cross-references now that live ids exist.
  await updateItem({
    itemId: groupTemplateId,
    path: groupPath,
    fields: [
      { name: "__Standard values", value: braceGuid(groupStdId) },
      { name: "__Masters", value: braceGuid(linkTemplateId) },
    ],
  });
  await updateItem({
    itemId: linkTemplateId,
    path: linkPath,
    fields: [{ name: "__Standard values", value: braceGuid(linkStdId) }],
  });

  return {
    stats,
    ids: {
      groupTemplateId,
      linkTemplateId,
      titleFieldId,
      linkFieldId,
      imageFieldId,
      groupStdId,
      linkStdId,
      groupSectionId,
      linkSectionId,
    },
  };
}

export async function applyImageLinkListTree(options: {
  items: ImageLinkListItemDef[];
  handle: string;
  label: string;
  parentId: string;
  parentSitecorePath: string;
  diskDir: string;
  cultures: string[];
  collectionSystem: string;
  siteSystem?: string;
  siteOrigin?: string | null;
  sourceLanguage?: string | null;
}): Promise<ScsWriteStats> {
  const ensured = await ensureImageLinkListTemplates(options.collectionSystem);
  const ids = ensured.ids;
  let stats = mergeWriteStats(emptyWriteStats(), ensured.stats);
  const linkHome = {
    collectionSystem: options.collectionSystem,
    siteSystem: options.siteSystem,
    siteOrigin: options.siteOrigin,
    sourceLanguage: options.sourceLanguage,
    cultures: options.cultures,
  };
  const sourceCulture = options.sourceLanguage || "en";

  const reuse = getLinkListReuseIndex(options.parentSitecorePath, "Image Link Lists");

  async function emitGroup(
    item: ImageLinkListItemDef,
    parentId: string,
    parentSitecorePath: string,
    diskDir: string,
    groupIndex: number,
  ): Promise<void> {
    const titleEn = resolveGroupTitle(item.fields, item.name);
    const englishName = linkListPathLeaf(item.name, parentSitecorePath);
    const reuseHit = await reuse.resolveGroup({
      name: englishName,
      title: titleEn.trim() ? titleEn : undefined,
      parentSitecorePath,
    });

    let sitecorePath = `${parentSitecorePath}/${englishName}`;
    let resolvedParentId = parentId;
    let pathLeaf = englishName;

    if (reuseHit) {
      resolvedParentId = reuseHit.parentId;
      sitecorePath = reuseHit.sitecorePath;
      pathLeaf =
        sitecorePath.split("/").filter(Boolean).pop() || englishName;
      console.log(
        `[bq:apply:content] ${options.label}: reusing Image Link List group "${pathLeaf}" → ${sitecorePath} (${reuseHit.reason}, ${reuseHit.id})`,
      );
    }
    const itemYamlPath = path.join(diskDir, `${pathLeaf}.yml`);

    const languages = await buildCultureTitleBlocks(
      titleEn,
      options.cultures,
      sourceCulture,
      titleEn.trim() ? englishName : null,
      ids.titleFieldId,
    );

    const groupWrite = await applyAuthoringItem(itemYamlPath, {
      parent: resolvedParentId,
      template: ids.groupTemplateId,
      path: sitecorePath,
      sharedFields: [
        {
          id: FIELD_IDS.Sortorder,
          hint: "__Sortorder",
          value: resolveSortOrder(undefined, groupIndex),
        },
      ],
      languages,
    });
    recordWrite(stats, groupWrite);
    const itemId = groupWrite.itemId;

    await reuse.registerEmitted({
      id: itemId,
      yamlPath: itemYamlPath,
      sitecorePath,
      parentId: resolvedParentId,
      isGroup: true,
      titles: [titleEn, englishName, item.name],
    });

    if (!item.children?.length) return;

    const groupLeaf = sitecorePath.split("/").filter(Boolean).pop() || englishName;
    const childDir = path.join(diskDir, groupLeaf);
    const keepYamlPaths: string[] = [];
    for (let childIndex = 0; childIndex < item.children.length; childIndex += 1) {
      const child = item.children[childIndex]!;
      const childYaml = await emitLinkChild(
        child,
        itemId,
        sitecorePath,
        childDir,
        childIndex,
      );
      if (childYaml) keepYamlPaths.push(childYaml);
    }
    reuse.pruneOrphanChildren({
      childDir,
      keepYamlPaths,
      label: options.label,
    });
  }

  async function emitLinkChild(
    item: ImageLinkListItemDef,
    parentId: string,
    parentSitecorePath: string,
    diskDir: string,
    childIndex: number,
  ): Promise<string | undefined> {
    const seedUrl = extractUrlFromSeedLink(item.fields?.Link);
    const englishName = linkListPathLeaf(item.name, parentSitecorePath);
    const reuseHit = await reuse.resolveChild({
      name: englishName,
      linkUrl: seedUrl,
      parentSitecorePath,
    });

    let sitecorePath = `${parentSitecorePath}/${englishName}`;
    let resolvedParentId = parentId;
    let pathLeaf = englishName;

    if (reuseHit) {
      resolvedParentId = reuseHit.parentId;
      sitecorePath = reuseHit.sitecorePath;
      pathLeaf =
        sitecorePath.split("/").filter(Boolean).pop() || englishName;
      console.log(
        `[bq:apply:content] ${options.label}: reusing Image Link List link "${pathLeaf}" → ${sitecorePath} (${reuseHit.reason}, ${reuseHit.id})`,
      );
    }
    const itemYamlPath = path.join(diskDir, `${pathLeaf}.yml`);

    const linkResult = await encodeLinkValue(item.fields?.Link, linkHome);
    stats = mergeWriteStats(stats, linkResult.stats);
    const linkXml = linkResult.value;

    let imageXml = "";
    const imageRaw = item.fields?.Image;
    if (imageRaw !== undefined && imageRaw !== null && imageRaw !== "") {
      if (typeof imageRaw === "string" || isImageObject(imageRaw)) {
        const materialized = await materializeImageFieldValue(
          imageRaw as string | DataImageValue,
          {
            handle: options.handle,
            folder: ["Image Link Lists"],
            itemName: `${englishName}-Image`,
            collectionSystem:
              options.collectionSystem || DEFAULT_PROJECT_COLLECTION,
            siteName: options.siteSystem,
            sourceLanguage: options.sourceLanguage || sourceCulture,
            label: `${options.label}: Image on "${englishName}"`,
          },
        );
        imageXml = materialized.value;
        stats = mergeWriteStats(stats, materialized.stats);
      }
    }

    const languages = await buildCultureChildBlocks(
      linkXml,
      imageXml,
      options.cultures,
      sourceCulture,
      ids,
    );

    const linkWrite = await applyAuthoringItem(itemYamlPath, {
      parent: resolvedParentId,
      template: ids.linkTemplateId,
      path: sitecorePath,
      sharedFields: [
        {
          id: FIELD_IDS.Sortorder,
          hint: "__Sortorder",
          value: resolveSortOrder(undefined, childIndex),
        },
      ],
      languages,
    });
    recordWrite(stats, linkWrite);
    const itemId = linkWrite.itemId;

    await reuse.registerEmitted({
      id: itemId,
      yamlPath: itemYamlPath,
      sitecorePath,
      parentId: resolvedParentId,
      isGroup: false,
      linkUrls: [seedUrl, extractUrlFromSeedLink(linkXml)].filter(
        (u): u is string => Boolean(u),
      ),
    });
    return itemYamlPath;
  }

  for (let groupIndex = 0; groupIndex < options.items.length; groupIndex += 1) {
    const item = options.items[groupIndex]!;
    try {
      await emitGroup(
        item,
        options.parentId,
        options.parentSitecorePath,
        options.diskDir,
        groupIndex,
      );
    } catch (err) {
      console.warn(
        `[bq:apply:content] ${options.label}: failed image link-list item "${item.name}": ${
          err instanceof Error ? err.message : err
        } (continuing)`,
      );
    }
  }

  return stats;
}

export function isImageLinkListsFolder(folder?: string[] | null): boolean {
  const f = folder ?? [];
  return f.length === 1 && f[0] === "Image Link Lists";
}

export function shouldApplyImageLinkList(content: {
  location?: { folder?: string[] };
}): boolean {
  return isImageLinkListsFolder(content.location?.folder);
}

export function shouldUseImageLinkListRendering(definition: {
  datasourceLocation?: { folder?: string[] };
  content?: { location?: { folder?: string[] } };
}): boolean {
  if (definition.content && shouldApplyImageLinkList(definition.content)) {
    return true;
  }
  return isImageLinkListsFolder(definition.datasourceLocation?.folder);
}
