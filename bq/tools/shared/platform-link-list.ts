/**
 * Sitecore platform Link List templates (Foundation / Experience Edge).
 * Match authoring samples under Data/Link Lists/Axa (+ Jobs children).
 */
import path from "node:path";
import { applyAuthoringItem } from "./authoring-apply-bridge";
import type { DataFieldValue, DataLinkValue } from "../definitions/types";
import {
  encodeGeneralLink,
  isUnderSiteHome,
  proposeValidItemName,
  type GeneralLinkInput,
} from "./naming";
import { materializeGeneralLinkXml } from "./ensure-home-link-page";
import type { ScsField } from "./provenance";
import {
  emptyWriteStats,
  mergeWriteStats,
  recordWrite,
  type ScsLanguageBlock,
  type ScsWriteStats
} from "./authoring-item-model";
import {
  extractUrlFromSeedLink,
  getLinkListReuseIndex,
} from "./link-list-reuse";
import {
  buildLinkListTitleLanguageBlocks,
  translateLinkXmlForEmitCulture,
} from "./link-list-culture";
import {
  normalizeCultureKey,
  resolveContentLanguages,
} from "./resolve-content-languages";
import { translateGeneralLinkXml } from "./site-content-items";
import { resolveSortOrder } from "./sort-order";
import { FIELD_IDS } from "./system-ids";

/** Path leaf from definition name — no apply-time re-translate (idempotent). */
function linkListPathLeaf(name: string, parentSitecorePath: string): string {
  return proposeValidItemName(name, name || "unnamed-item", {
    forUrl: isUnderSiteHome(`${parentSitecorePath}/${name}`),
  });
}

export const PLATFORM_LINK_LIST = {
  /** Link List (group) */
  groupTemplateId: "60c9ac62-4227-443e-8980-92c97e483832",
  /** Link (child under a link list) */
  linkTemplateId: "6f108e3c-5d57-42f8-a910-c22920269b0a",
  /** Title on group */
  titleFieldId: "dc9aaee9-fc44-458d-a9fb-bac61d8b0234",
  /** Link on child */
  linkFieldId: "68c2a603-f98e-42a3-be2d-dd70598c2a63",
  /** Branch used by CM-created Link List items */
  branchId: "f2490b61-7d7d-4bbf-8cf6-3b355fdf4ce4",
} as const;

/** Default ComponentQuery for Title + child Links (JSS LinkList shape; hardcoded — do not read on-disk LinkList.yml). */
export const PLATFORM_LINK_LIST_COMPONENT_GQL = `query LinkListQuery($datasource: String!, $language: String!) {
  datasource: item(path: $datasource, language: $language) {
    children(first: 90) {
      results {
        field(name: "Link") {
          link: jsonValue
        }
      }
    }
    field(name: "Title") {
      title: jsonValue
    }
  }
}`;

/**
 * Json Rendering shared field "ComponentQuery" (JSS Experience Accelerator).
 * Hardcoded GUID — do not depend on authoring sample YAML being present.
 */
export const COMPONENT_GRAPHQL_QUERY_FIELD_ID =
  "17bb046a-a32a-41b3-8315-81217947611b";

export type PlatformLinkListItemDef = {
  name: string;
  fields?: Record<string, DataFieldValue>;
  children?: PlatformLinkListItemDef[];
};

function isLinkObject(value: unknown): value is DataLinkValue {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DataLinkValue).url === "string"
  );
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
 * Group Title from seeds. Explicit `Title: ""` / `Heading: ""` stays empty
 * (untitled footer columns). Only fall back to item `name` when neither key
 * is present on the seed.
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
): Promise<ScsLanguageBlock[]> {
  return buildLinkListTitleLanguageBlocks({
    titleSource,
    cultures,
    sourceCulture,
    titleFieldId: PLATFORM_LINK_LIST.titleFieldId,
    englishTitleHint,
  });
}

async function buildCultureLinkBlocks(
  linkXmlSource: string,
  cultures: string[],
  sourceCulture: string = "en",
): Promise<ScsLanguageBlock[]> {
  const { sourceCulture: src, emitCultures } = resolveContentLanguages({
    culture: sourceCulture,
    cultures,
  });
  const srcKey = normalizeCultureKey(src).toLowerCase();
  const blocks: ScsLanguageBlock[] = [];
  for (const lang of emitCultures) {
    const isSource = normalizeCultureKey(lang).toLowerCase() === srcKey;
    const value = isSource
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
              id: PLATFORM_LINK_LIST.linkFieldId,
              hint: "Link",
              value,
              multiline: true,
            },
          ],
        },
      ],
    });
  }
  return blocks;
}

/**
 * Emit Link List groups + children using platform templates/field IDs.
 */
export async function applyPlatformLinkListTree(options: {
  items: PlatformLinkListItemDef[];
  handle: string;
  label: string;
  parentId: string;
  parentSitecorePath: string;
  diskDir: string;
  cultures: string[];
  collectionSystem?: string;
  siteSystem?: string;
  siteOrigin?: string | null;
  sourceLanguage?: string | null;
}): Promise<ScsWriteStats> {
  let stats = emptyWriteStats();
  const linkHome = {
    collectionSystem: options.collectionSystem,
    siteSystem: options.siteSystem,
    siteOrigin: options.siteOrigin,
    sourceLanguage: options.sourceLanguage,
    cultures: options.cultures,
  };
  const sourceCulture = options.sourceLanguage || "en";

  const reuse = getLinkListReuseIndex(options.parentSitecorePath, "Link Lists");

  async function emitGroup(
    item: PlatformLinkListItemDef,
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
        `[bq:apply:content] ${options.label}: reusing Link List group "${pathLeaf}" → ${sitecorePath} (${reuseHit.reason}, ${reuseHit.id})`,
      );
    }
    const itemYamlPath = path.join(diskDir, `${pathLeaf}.yml`);

    const languages = await buildCultureTitleBlocks(
      titleEn,
      options.cultures,
      sourceCulture,
      // Never invent a Title from the path name when the seed Title is empty.
      titleEn.trim() ? englishName : null,
    );

    const groupWrite = await applyAuthoringItem(itemYamlPath, {
      parent: resolvedParentId,
      template: PLATFORM_LINK_LIST.groupTemplateId,
      path: sitecorePath,
      branchId: PLATFORM_LINK_LIST.branchId,
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

    // Children live under the resolved group's on-disk folder (may differ from seed name).
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
    // Children may all land in hash folders — do not leave an empty GroupName/.
  }

  async function emitLinkChild(
    item: PlatformLinkListItemDef,
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
        `[bq:apply:content] ${options.label}: reusing Link List link "${pathLeaf}" → ${sitecorePath} (${reuseHit.reason}, ${reuseHit.id})`,
      );
    }
    const itemYamlPath = path.join(diskDir, `${pathLeaf}.yml`);

    const linkResult = await encodeLinkValue(item.fields?.Link, linkHome);
    stats = mergeWriteStats(stats, linkResult.stats);
    const languages = await buildCultureLinkBlocks(
      linkResult.value,
      options.cultures,
      sourceCulture,
    );

    const linkWrite = await applyAuthoringItem(itemYamlPath, {
      parent: resolvedParentId,
      template: PLATFORM_LINK_LIST.linkTemplateId,
      path: sitecorePath,
      branchId: PLATFORM_LINK_LIST.branchId,
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
      linkUrls: [seedUrl, extractUrlFromSeedLink(linkResult.value)].filter(
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
        `[bq:apply:content] ${options.label}: failed platform link-list item "${item.name}": ${
          err instanceof Error ? err.message : err
        } (continuing)`,
      );
    }
  }

  return stats;
}

/** True when content should use platform Link List templates. */
export function shouldApplyPlatformLinkList(content: {
  platform?: string;
  location?: { folder?: string[] };
}): boolean {
  if (content.platform === "link-list") return true;
  return isLinkListsFolder(content.location?.folder);
}

/** Site Data folder reserved for platform Link Lists. */
export function isLinkListsFolder(folder?: string[] | null): boolean {
  const f = folder ?? [];
  return f.length === 1 && f[0] === "Link Lists";
}

/**
 * Component/rendering should use platform Link List datasource template + GraphQL.
 * Driven by `folder: ["Link Lists"]` (legacy `content.platform: "link-list"` still honored).
 */
export function shouldUsePlatformLinkListRendering(definition: {
  datasourceLocation?: { folder?: string[] };
  content?: { platform?: string; location?: { folder?: string[] } };
}): boolean {
  if (definition.content && shouldApplyPlatformLinkList(definition.content)) {
    return true;
  }
  return isLinkListsFolder(definition.datasourceLocation?.folder);
}

/** Braced group template GUID (content/item templates — not Json Rendering DS Template). */
export const PLATFORM_LINK_LIST_GROUP_TEMPLATE_BRACE =
  `{${PLATFORM_LINK_LIST.groupTemplateId.toUpperCase()}}`;

/**
 * JSS Experience Accelerator LinkList Json Rendering field values
 * (`/sitecore/layout/Renderings/Feature/JSS Experience Accelerator/Navigation/LinkList`).
 * Hardcoded from live CM — do not re-fetch on generate.
 */
export const JSS_LINK_LIST_RENDERING = {
  /** Datasource Template = JSS Link List branch (not group GUID). */
  datasourceTemplate:
    "/sitecore/templates/Branches/Feature/JSS Experience Accelerator/Navigation/Link List",
  /**
   * Datasource Location uses Link List Folder templatename (not @@name='Link Lists').
   */
  datasourceLocation:
    "query:$site/*[@@name='Data']/*[@@templatename='Link List Folder']|query:$sharedSites/*[@@name='Data']/*[@@templatename='Link List Folder']",
  /** JSS Navigation LinkList parameters template. */
  parametersTemplateId: "{33C9207E-3B04-4606-8EF5-4CA99A97C776}",
  /** core Insert + Manage items (Multilist SharedField, `|`-separated). */
  pageEditorButtons:
    "{31A3A929-C599-4DD3-91A6-F4A9487CC8B7}|{587F8FBD-E38F-4E2B-8DE4-1F474D9DDD00}",
  addFieldEditorButton: "0",
  icon: "SXA_MDI/16x16/Link-List.png",
} as const;

