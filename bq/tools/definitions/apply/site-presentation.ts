/**
 * Emit Available Renderings / Partial Design / Home layout from site-presentation definitions.
 *
 * Authoring-first: every item is resolved by Sitecore path (CM / in-run cache) and
 * written through Authoring GraphQL. No SCS item YAML is read, patched, created or deleted.
 * (BQ definition meta JSON under `.bq/definitions` may still be written.)
 */
import path from "node:path";
import fs from "node:fs";
import { applyAuthoringItem } from "../../shared/authoring-apply-bridge";
import {
  addItemVersion,
  readItemFieldValue,
  updateItem,
} from "../../shared/authoring-items";
import { deleteCmItemById } from "../../shared/cm-delete-item";
import { braceGuid, canonicalItemId, stableGuid, toScsYamlGuid } from "../../shared/ids";
import { resolveItemIdByPath } from "../../shared/resolve-item-id-by-path";
import { saiHandleFrom } from "../../shared/sai-handle";
import { encodeFieldNamesParam } from "./variants";
import {
  applyPageTemplateBindings,
  ensureProjectPageTemplate,
} from "./page-template";
import { getProjectRenderingsSitecorePath } from "../../shared/data-placement";
import { projectRenderingPathLeaf } from "./component-to-rendering";
import { BQ_DEFINITIONS_DIR } from "../../shared/paths";
import {
  emptyWriteStats,
  recordWrite,
  type ScsWriteStats,
  mergeWriteStats
} from "../../shared/authoring-item-model";
import type {
  Definition,
  DefinitionThumbnail,
  SitePresentationDefinition,
} from "../types";
import {
  toBasePlaceholderKey,
  toSystemName,
} from "../../shared/naming";
import { ensureSystemLanguages } from "../../shared/ensure-languages";
import { resolveContentLanguages } from "../../shared/resolve-content-languages";
import {
  DEFAULT_HOME_PAGE_TEMPLATE,
  ensureHomePageFromRoute,
} from "../../shared/ensure-home-link-page";
import {
  ensurePartialDesignThumbnailFromCapture,
  normalizeDefinitionThumbnail,
} from "../../shared/site-thumbnail-from-capture";
import { buildLanguageBlocks } from "./shared";
import { FIELD_IDS } from "../../shared/system-ids";
import {
  expectsDatasource,
  formatDatasourceLookupFailure,
  resolveDatasourceByPath,
} from "./datasource-resolve";

/**
 * OOTB / scaffold chrome renderings that must not remain in owned Available
 * Renderings groups (esp. Navigation) once Project components are present.
 * Blueprint Navigation.yml: Navigation + Link list.
 */
export const OOTB_NAVIGATION_CHROME_RENDERING_IDS = new Set([
  "1deb067f0bb1405e94f52abb537a6160", // Navigation
  "4956263d11954d6e931b800ea625ff6f", // Link list
]);

/** Strip known OOTB Navigation chrome ids from a multilist (canonical 32-hex). */
export function stripOotbNavigationChromeIds(ids: string[]): string[] {
  return (ids || []).filter((id) => {
    const c = canonicalItemId(id);
    return c && !OOTB_NAVIGATION_CHROME_RENDERING_IDS.has(c);
  });
}

/**
 * True when layout XML still references OOTB Navigation (scaffold leftover).
 * Used to refuse leaving Header/Footer partials in a broken chrome state.
 */
export function layoutXmlContainsOotbNavigation(xml: string): boolean {
  const raw = String(xml || "");
  if (!raw) return false;
  return /1DEB067F-0BB1-405E-94F5-2ABB537A6160/i.test(raw);
}

/** Headless Partial Design content item template (Sites API / showcase). */
const PARTIAL_DESIGN_TEMPLATE_ID = "fd2059fd-6043-4dfe-8c04-e2437ce87634";
/** Partial Designs folder under site Presentation. */
const PARTIAL_DESIGNS_FOLDER_TEMPLATE_ID =
  "117a5396-b136-47d0-9f13-8e4148f01b68";
/** Signature shared field on Partial Design items. */
const FIELD_PARTIAL_SIGNATURE = "55faae90-3bba-4f7f-96fe-13c3f40055ff";
/** Layout field on pages. */
const FIELD_RENDERINGS = "f1a1fe9e-a60c-4ddb-a3a0-bb5b29fe732e";
/** PartialDesigns multilist on Page Design items. */
const FIELD_PARTIAL_DESIGNS = "0966b999-0d0e-4278-acc9-9da69d461fe6";
/** Page Design item template. */
const PAGE_DESIGN_TEMPLATE_ID = "1105b8f8-1e00-426b-bf1f-c840742d827b";
/** Default device in XM Cloud / JSS layouts. */
const DEVICE_DEFAULT = "{FE5D7FDF-89C0-4D99-9AA3-B5FBD009C9F3}";
/** Headless Layout assigned on the device. Edge drops presentation that has no layout item. */
const HEADLESS_LAYOUT = "{96E5F4BA-A2CF-4A4C-A4E7-64DA88226362}";
const LOG_PREFIX = "[bq:apply:site-presentation]";

export type CmAlignLookupOptions = {
  endpointName?: string;
  lookupPath?: (sitecorePath: string) => Promise<string | undefined>;
  skipCm?: boolean;
};

/**
 * Site identity for Sitecore path building (`/sitecore/content/{collection}/{site}`)
 * plus optional CM lookup knobs (tests / offline).
 */
export type PresentationSiteContext = {
  collectionSystem: string;
  siteSystem: string;
  cmAlign?: CmAlignLookupOptions;
};

function siteContentRoot(site: PresentationSiteContext): string {
  return `/sitecore/content/${site.collectionSystem}/${site.siteSystem}`;
}

/** Resolve a Sitecore path to a live item id (cache → CM). `null` when missing. */
async function resolvePathId(
  site: PresentationSiteContext,
  sitecorePath: string,
): Promise<string | null> {
  const resolved = await resolveItemIdByPath({
    sitecorePath,
    endpointName: site.cmAlign?.endpointName,
    lookupPath: site.cmAlign?.lookupPath,
    skipCm: site.cmAlign?.skipCm,
    logPrefix: LOG_PREFIX,
  });
  return resolved.found ? resolved.id : null;
}

/**
 * Resolve `Presentation/Partial Designs` by Sitecore path; create it under the live
 * Presentation folder id (via Authoring) when missing.
 */
export async function ensurePartialDesignsFolderParent(options: {
  collectionSystem: string;
  siteSystem: string;
  /** Retained for call-site compat — ids are no longer minted from handles. */
  handle?: string;
} & CmAlignLookupOptions): Promise<{ id: string; stats: ScsWriteStats }> {
  const stats = emptyWriteStats();
  const site: PresentationSiteContext = {
    collectionSystem: options.collectionSystem,
    siteSystem: options.siteSystem,
    cmAlign: {
      endpointName: options.endpointName,
      lookupPath: options.lookupPath,
      skipCm: options.skipCm,
    },
  };
  const presentationPath = `${siteContentRoot(site)}/Presentation`;
  const partialsPath = `${presentationPath}/Partial Designs`;

  const existingId = await resolvePathId(site, partialsPath);
  if (existingId) {
    return { id: existingId, stats };
  }

  const presentationId = await resolvePathId(site, presentationPath);
  if (!presentationId) {
    throw new Error(
      `${LOG_PREFIX} Presentation folder missing in CM at ${presentationPath} (cannot create Partial Designs)`,
    );
  }

  const applied = await applyAuthoringItem(
    `partial-designs-folder:${partialsPath}`,
    {
      parent: presentationId,
      template: PARTIAL_DESIGNS_FOLDER_TEMPLATE_ID,
      path: partialsPath,
    },
    { endpointName: options.endpointName },
  );
  recordWrite(stats, applied);
  return { id: applied.itemId, stats };
}

type PagePresentationEntry = NonNullable<
  NonNullable<SitePresentationDefinition["pages"]>[string]
>;

type HomeRenderingEntry = NonNullable<PagePresentationEntry["renderings"]>[number];

type ResolvedHomeChild = {
  definitionKey: string;
  datasourceItem?: string;
  /** Parent dynamic placeholder base key override (e.g. footer-navigation). */
  placeholder?: string;
  /** Headless variant export name; omit / Default → no FieldNames. */
  variant?: string;
  /** Capture / author HTML id → RenderingIdentifier in s:par. */
  renderingIdentifier?: string;
  renderingId: string | null;
  datasourceId: string | null;
  /** Headless Variant item GUID when non-Default variant is set. */
  fieldNamesId?: string | null;
  uid: string;
  /** Assigned when this child has nested grandchildren (composite-in-composite). */
  dynamicPlaceholderId?: number;
  /** Placeholder base key from this child's definition (no dynId suffix). */
  childPlaceholderKey?: string | null;
  resolvedChildren?: ResolvedHomeChild[];
};

type ResolvedHomeRendering = HomeRenderingEntry & {
  renderingId: string | null;
  datasourceId: string | null;
  /** Headless Variant item GUID when a non-Default variant is set on the root. */
  fieldNamesId?: string | null;
  uid: string;
  /** Assigned when this entry has nested children (dynamic placeholder parent). */
  dynamicPlaceholderId?: number;
  /** Parent placeholder base key from the component definition (no dynId suffix). */
  childPlaceholderKey?: string | null;
  resolvedChildren?: ResolvedHomeChild[];
};

type ResolvedNodeForAssert = {
  definitionKey: string;
  renderingId: string | null;
  resolvedChildren?: ResolvedNodeForAssert[];
};

function collectMissingNestedRenderingIds(
  nodes: ResolvedNodeForAssert[],
  parentPath: string,
): string[] {
  const missing: string[] = [];
  for (const node of nodes) {
    const path = parentPath
      ? `${parentPath} → ${node.definitionKey}`
      : node.definitionKey;
    if (!node.renderingId) {
      missing.push(path);
    }
    if (node.resolvedChildren?.length) {
      missing.push(
        ...collectMissingNestedRenderingIds(node.resolvedChildren, path),
      );
    }
  }
  return missing;
}

/**
 * Fail closed when presentation wiring cannot resolve rendering item IDs.
 * Prevents emitting a thinner Home layout than the presentation definition.
 * Walks the full nested composite tree.
 */
export function assertResolvedPageRenderingsComplete(
  pageKey: string,
  collectionSystem: string,
  resolved: ResolvedNodeForAssert[],
  expectedParentCount: number,
): void {
  const missingRenderingIds = resolved.filter((r) => !r.renderingId);
  if (missingRenderingIds.length) {
    const detail = missingRenderingIds.map((r) => r.definitionKey).join(", ");
    throw new Error(
      `[bq:apply:site-presentation] ${pageKey}: ${missingRenderingIds.length} wired rendering(s) have no rendering item id ` +
        `(collection "${collectionSystem}"): ${detail}. ` +
        `Refusing to emit a thinner __Renderings layout — generate component/rendering definitions first.`,
    );
  }
  const missingChildRenderingIds = resolved.flatMap((r) =>
    collectMissingNestedRenderingIds(
      r.resolvedChildren || [],
      r.definitionKey,
    ),
  );
  if (missingChildRenderingIds.length) {
    throw new Error(
      `[bq:apply:site-presentation] ${pageKey}: ${missingChildRenderingIds.length} nested child rendering(s) have no rendering item id: ` +
        `${missingChildRenderingIds.join("; ")}. ` +
        `Refusing to emit incomplete layout.`,
    );
  }
  if (resolved.length !== expectedParentCount) {
    throw new Error(
      `[bq:apply:site-presentation] ${pageKey}: layout parent count ${resolved.length} !== presentation renderings ${expectedParentCount}`,
    );
  }
}

export async function applySitePresentationDefinition(
  definition: SitePresentationDefinition,
  registry: Map<string, Definition>,
  cmAlign?: CmAlignLookupOptions,
): Promise<ScsWriteStats> {
  let stats = emptyWriteStats();
  const siteSystem = toSystemName(definition.siteSystem);
  const collectionSystem = toSystemName(definition.collectionSystem);
  const site: PresentationSiteContext = {
    collectionSystem,
    siteSystem,
    cmAlign,
  };
  const siteRoot = siteContentRoot(site);
  const endpointName = cmAlign?.endpointName;

  // Available Renderings groups (merge Project ids; strip OOTB Navigation chrome)
  for (const [group, keys] of Object.entries(definition.availableRenderings || {})) {
    if (!keys?.length) continue;
    const groupPath = `${siteRoot}/Presentation/Available Renderings/${group}`;
    const groupId = await resolvePathId(site, groupPath);
    if (!groupId) {
      console.warn(
        `${LOG_PREFIX} Available Renderings group missing in CM: ${groupPath}`,
      );
      continue;
    }
    const renderingIds: string[] = [];
    for (const key of keys) {
      const id = await resolveRenderingId(key, registry, site);
      if (id) renderingIds.push(id);
    }
    if (!renderingIds.length) continue;
    try {
      const existingRaw = await readItemFieldValue({
        path: groupPath,
        fieldName: "Renderings",
        endpointName,
      });
      if (existingRaw === undefined) {
        console.warn(
          `${LOG_PREFIX} could not read Renderings on ${groupPath}; skipping merge (refusing to overwrite)`,
        );
        continue;
      }
      const existing = parseMultilistIds(existingRaw);
      const stripOotb =
        String(group).trim().toLowerCase() === "navigation" ||
        existing.some((id) => OOTB_NAVIGATION_CHROME_RENDERING_IDS.has(id));
      const cleanedExisting = stripOotb
        ? stripOotbNavigationChromeIds(existing)
        : existing;
      const merged = mergeMultilistIds(cleanedExisting, renderingIds);
      const same =
        merged.length === existing.length &&
        merged.every((id, i) => id === existing[i]);
      if (same) {
        recordWrite(stats, "unchanged");
        continue;
      }
      await updateItem({
        itemId: groupId,
        path: groupPath,
        endpointName,
        fields: [
          { name: "Renderings", value: merged.map(braceGuid).join("|") },
        ],
      });
      recordWrite(stats, "updated");
      if (cleanedExisting.length < existing.length) {
        console.log(
          `${LOG_PREFIX} Available Renderings/${group}: stripped OOTB Navigation chrome ` +
            `(${existing.length - cleanedExisting.length}) + merged Project ids`,
        );
      }
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} failed to patch ${groupPath}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // Partial Designs: resolve/create by display name; write Signature + __Renderings
  const handle = saiHandleFrom(definition.definitionKey, 1);
  const partialsFolderSitecore = `${siteRoot}/Presentation/Partial Designs`;
  const parentFolder = await ensurePartialDesignsFolderParent({
    collectionSystem,
    siteSystem,
    handle,
    endpointName: cmAlign?.endpointName,
    lookupPath: cmAlign?.lookupPath,
    skipCm: cmAlign?.skipCm,
  });
  stats = mergeWriteStats(stats, parentFolder.stats);
  const parentId = parentFolder.id;
  const siteCultures = resolvePresentationCultures(definition, registry);
  if (siteCultures.length) {
    stats = mergeWriteStats(
      stats,
      await ensureSystemLanguages(
        siteCultures.filter((c) => c.toLowerCase() !== "en"),
      ),
    );
  }
  const { emitCultures } = resolveContentLanguages({
    culture: "en",
    cultures: siteCultures,
  });
  const emittedPartialIds: string[] = [];

  for (const partial of definition.partialDesigns || []) {
    const displayName =
      partial.signature.charAt(0).toUpperCase() + partial.signature.slice(1);
    const partialSitecore = `${partialsFolderSitecore}/${displayName}`;

    let nextDynId = 1;
    const resolvedRoots: ResolvedHomeRendering[] = [];

    const siblingDefs = partial.siblingsBefore || [];
    for (let sIndex = 0; sIndex < siblingDefs.length; sIndex++) {
      const sibling = siblingDefs[sIndex]!;
      const siblingResolved = await resolvePartialRootEntry({
        definitionKey: sibling.definitionKey,
        placeholder: partial.placeholder,
        datasourceItem: sibling.datasourceItem,
        renderingIdentifier: sibling.renderingIdentifier,
        children: sibling.children || [],
        signature: partial.signature,
        rootIndex: sIndex,
        handle,
        registry,
        site,
        nextDynId,
      });
      nextDynId = siblingResolved.nextDynId;
      if (siblingResolved.entry.renderingId) {
        resolvedRoots.push(siblingResolved.entry);
      }
    }

    const mainResolved = await resolvePartialRootEntry({
      definitionKey: partial.definitionKey,
      placeholder: partial.placeholder,
      datasourceItem: partial.datasourceItem,
      renderingIdentifier: partial.renderingIdentifier,
      children: partial.children || [],
      signature: partial.signature,
      rootIndex: siblingDefs.length,
      handle,
      registry,
      site,
      nextDynId,
    });
    nextDynId = mainResolved.nextDynId;
    const renderingId = mainResolved.entry.renderingId;
    if (renderingId) {
      resolvedRoots.push(mainResolved.entry);
    }

    const sharedFields: Array<{ id: string; hint: string; value: string }> = [
      {
        id: FIELD_PARTIAL_SIGNATURE,
        hint: "Signature",
        value: partial.signature,
      },
    ];

    if (resolvedRoots.length) {
      const renderingsXml = buildHomeRenderingsXml(resolvedRoots);
      if (layoutXmlContainsOotbNavigation(renderingsXml)) {
        throw new Error(
          `${LOG_PREFIX} Partial Design "${displayName}" __Renderings still references OOTB Navigation ` +
            `(1DEB067F…). Refusing to leave scaffold chrome on ${partialSitecore}.`,
        );
      }
      sharedFields.push({
        id: FIELD_RENDERINGS,
        hint: "__Renderings",
        value: renderingsXml,
      });
    }

    // Match CM / SitecoreAI: descriptive text lives in unversioned __Display name
    // (field b5e02ad9…). Never write that GUID as "__Long description".
    const rootKeys = resolvedRoots.map((r) => r.definitionKey).join(" + ");
    const displayLabel = `Partial for ${partial.placeholder}; rendering ${rootKeys || partial.definitionKey}${renderingId ? ` (${braceGuid(renderingId)})` : ""}`;
    const languages = await buildLanguageBlocks(
      [
        {
          id: FIELD_IDS.DisplayName,
          hint: "__Display name",
          value: displayLabel,
        },
      ],
      [],
      emitCultures,
      "en",
    );

    const writeResult = await applyAuthoringItem(
      `partial-design:${partialSitecore}`,
      {
        parent: parentId,
        template: PARTIAL_DESIGN_TEMPLATE_ID,
        path: partialSitecore,
        sharedFields,
        languages,
      },
      { endpointName },
    );
    recordWrite(stats, writeResult);
    const id = writeResult.itemId;
    emittedPartialIds.push(id);
    if (renderingId) {
      console.log(
        `${LOG_PREFIX} ${writeResult.write} Partial Design "${displayName}"` +
          ` (signature=${partial.signature}) __Renderings → ${partialSitecore}`,
      );
    }

    await maybeEnsurePartialDesignThumbnail({
      collectionSystem,
      siteSystem,
      signature: partial.signature,
      thumbnail: normalizeDefinitionThumbnail(
        partial.thumbnail,
        partial.thumbnailCaptureRel,
      ),
      partialSitecorePath: partialSitecore,
      partialItemId: id,
      cmAlign,
    });

    await pruneScaffoldPartialDataFolder({
      partialSitecorePath: partialSitecore,
      endpointName,
    });
  }

  // Wire Page Designs/Default PartialDesigns to the live partial IDs.
  if (emittedPartialIds.length) {
    stats = mergeWriteStats(
      stats,
      await ensureDefaultPageDesignPartials({
        site,
        partialIds: emittedPartialIds,
        cultures: emitCultures,
      }),
    );
  }

  // Always map Project/{collection}/Page (or fallback) → Default, plus any
  // explicit pageTemplateIds from presentation.pages.
  const pages = definition.pages || {};
  const pageTemplateIds = new Set<string>();
  const ensuredTemplates = new Map<
    string,
    { templateId: string; templatePath: string }
  >();
  for (const [pageKey, pageDef] of Object.entries(pages)) {
    const tid = pageDef?.pageTemplateId?.replace(/[{}]/g, "").trim().toLowerCase();
    if (tid) pageTemplateIds.add(tid);
    const templateName = pageDef?.pageTemplate?.name?.trim();
    if (!templateName) continue;
    const ensuredTemplate = await ensureProjectPageTemplate({
      collectionSystem,
      name: templateName,
      endpointName,
    });
    ensuredTemplates.set(pageKey, ensuredTemplate);
    pageTemplateIds.add(canonicalItemId(ensuredTemplate.templateId));
  }
  const projectPageId = await resolvePathId(
    site,
    `/sitecore/templates/Project/${collectionSystem}/Page`,
  );
  pageTemplateIds.add(
    canonicalItemId(projectPageId || DEFAULT_HOME_PAGE_TEMPLATE),
  );
  stats = mergeWriteStats(
    stats,
    await ensurePageDesignTemplateMappings({
      site,
      pageTemplateIds: [...pageTemplateIds].filter(Boolean),
    }),
  );

  for (const [pageKey, pageDef] of Object.entries(pages)) {
    if (!pageDef?.renderings?.length) continue;
    const isHome = pageKey === "home";
    const routePath = isHome
      ? "/"
      : String(pageDef.routePath || `/${pageKey}`).replace(/\/+$/, "") ||
        `/${pageKey}`;
    const uidPrefix = isHome ? "home-r" : `page-r:${pageKey}`;

    let nextDynId = 1;
    const resolved: ResolvedHomeRendering[] = [];
    for (let index = 0; index < pageDef.renderings.length; index++) {
      const entry = pageDef.renderings[index]!;
      const renderingId = await resolveRenderingId(
        entry.definitionKey,
        registry,
        site,
      );
      const datasourceId =
        entry.datasourceItem === "$page"
          ? null
          : await resolveDatasourceId(entry, registry, site, pageKey);
      const fieldNamesId = await resolveChildFieldNamesId(
        { definitionKey: entry.definitionKey, variant: entry.variant },
        registry,
        site,
      );
      const childDefs = entry.children || [];
      const { parentPhKeys, childPlaceholderKey } =
        childDefs.length > 0
          ? requireParentPlaceholderHost(
              entry.definitionKey,
              registry,
              childDefs.length,
              pageKey,
            )
          : { parentPhKeys: [] as string[], childPlaceholderKey: null };
      const dynamicPlaceholderId =
        childDefs.length > 0 && childPlaceholderKey ? nextDynId++ : undefined;
      let resolvedChildren: ResolvedHomeChild[] = [];
      if (childDefs.length > 0 && childPlaceholderKey) {
        const nested = await resolvePresentationChildren({
          children: childDefs,
          parentDefinitionKey: entry.definitionKey,
          parentPhKeys,
          uidSeed: `${uidPrefix}:${entry.definitionKey}:${index}`,
          handle,
          registry,
          site,
          nextDynId,
          logContext: pageKey,
        });
        resolvedChildren = nested.resolvedChildren;
        nextDynId = nested.nextDynId;
      }
      resolved.push({
        ...entry,
        renderingId,
        datasourceId,
        fieldNamesId,
        uid: braceGuid(
          stableGuid(handle, `${uidPrefix}:${entry.definitionKey}:${index}`),
        ),
        dynamicPlaceholderId,
        childPlaceholderKey,
        resolvedChildren,
      });
    }

    // Resolve the page by Sitecore path (no page YAML on disk required).
    let pageSitecorePath = `${siteRoot}/Home`;
    let pageId: string | null;
    if (isHome) {
      pageId = await resolvePathId(site, pageSitecorePath);
    } else {
      const ensured = await ensureHomePageFromRoute({
        collectionSystem,
        siteSystem,
        pathname: routePath,
        leafDisplayName: pageDef.navigationTitle || pageKey,
        sourceLanguage: "en",
        cultures: siteCultures,
        handleKey: saiHandleFrom(`${definition.definitionKey}:${pageKey}`, 1),
        leafTemplateId:
          ensuredTemplates.get(pageKey)?.templateId || pageDef.pageTemplateId,
        endpointName: cmAlign?.endpointName,
        lookupPath: cmAlign?.lookupPath,
        skipCm: cmAlign?.skipCm,
      });
      if (!ensured) {
        console.warn(
          `${LOG_PREFIX} could not ensure secondary page "${pageKey}" (${routePath})`,
        );
        continue;
      }
      stats = mergeWriteStats(stats, ensured.stats);
      pageSitecorePath = ensured.sitecorePath;
      pageId = ensured.itemId;
    }
    if (!pageId) {
      console.warn(
        `${LOG_PREFIX} page missing in CM for "${pageKey}": ${pageSitecorePath}`,
      );
      continue;
    }

    for (const row of resolved) {
      if (row.datasourceItem === "$page") row.datasourceId = pageId;
    }

    assertResolvedPageRenderingsComplete(
      pageKey,
      collectionSystem,
      resolved,
      pageDef.renderings.length,
    );
    const withRendering = resolved;
    if (withRendering.length) {
      // Custom page templates only keep a route on Edge when the item layout
      // assigns the headless layout and leaves component XML to the page design.
      const layoutXml = pageDef.pageTemplate
        ? `<r xmlns:xsd="http://www.w3.org/2001/XMLSchema"><d id="${DEVICE_DEFAULT}" l="${HEADLESS_LAYOUT}" /></r>`
        : buildHomeRenderingsXml(withRendering);
      try {
        await updateItem({
          itemId: pageId,
          path: pageSitecorePath,
          endpointName,
          fields: [{ name: "__Renderings", value: layoutXml }],
        });
        recordWrite(stats, "updated");
        console.log(
          `${LOG_PREFIX} updated ${isHome ? "Home" : pageKey} __Renderings (${withRendering.length} rendering(s)) → ${pageSitecorePath}`,
        );
      } catch (err) {
        console.warn(
          `${LOG_PREFIX} failed to patch ${pageSitecorePath}: ${err instanceof Error ? err.message : err}`,
        );
      }
      const boundTemplate = ensuredTemplates.get(pageKey);
      if (boundTemplate && pageDef.pageTemplate) {
        try {
          const standardValuesLayoutXml = pageDef.pageTemplate
            ? layoutXml
            : buildHomeRenderingsXml(
                withRendering.map((row) => ({ ...row, datasourceId: null })),
              );
          stats = mergeWriteStats(
            stats,
            await applyPageTemplateBindings({
              collectionSystem,
              siteSystem,
              templateId: boundTemplate.templateId,
              templatePath: boundTemplate.templatePath,
              insertOnlyUnder: pageDef.pageTemplate.insertOnlyUnder || [],
              fields: pageDef.fields,
              pageId,
              pagePath: pageSitecorePath,
              standardValuesLayoutXml,
              endpointName,
            }),
          );
        } catch (err) {
          console.warn(
            `${LOG_PREFIX} page template bindings for ${pageSitecorePath}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    // BQ definition meta dump (JSON under .bq/definitions — not an SCS item file).
    const pageMeta = path.join(
      BQ_DEFINITIONS_DIR,
      "presentation",
      collectionSystem,
      siteSystem,
      `_bq-${pageKey}-renderings-${definition.definitionKey}.json`,
    );
    try {
      fs.mkdirSync(path.dirname(pageMeta), { recursive: true });
      fs.writeFileSync(
        pageMeta,
        `${JSON.stringify(
          {
            kind: isHome
              ? "site-presentation-home"
              : "site-presentation-page",
            pageKey,
            routePath,
            definitionKey: definition.definitionKey,
            renderings: resolved.map((r) => ({
              definitionKey: r.definitionKey,
              placeholder: r.placeholder,
              datasourceItem: r.datasourceItem,
              renderingId: r.renderingId,
              datasourceId: r.datasourceId,
              uid: r.uid,
              dynamicPlaceholderId: r.dynamicPlaceholderId,
              childPlaceholderKey: r.childPlaceholderKey,
              children: (r.resolvedChildren || []).map((c) => ({
                definitionKey: c.definitionKey,
                datasourceItem: c.datasourceItem,
                renderingId: c.renderingId,
                datasourceId: c.datasourceId,
                uid: c.uid,
              })),
            })),
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    } catch {
      /* ignore */
    }
  }

  return stats;
}

/** Pipe/newline-separated multilist raw value → canonical (32-hex lowercase) ids. */
function parseMultilistIds(raw: string): string[] {
  return String(raw || "")
    .split(/[|\r\n]+/)
    .map((part) => canonicalItemId(part.trim()))
    .filter(Boolean);
}

/** Union preserving existing order, then appending new ids (canonical, de-duped). */
function mergeMultilistIds(existing: string[], additions: string[]): string[] {
  const out = [...existing];
  const seen = new Set(existing);
  for (const id of additions) {
    const canonical = canonicalItemId(id);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

/**
 * When create stamps `thumbnail` (or deprecated thumbnailCaptureRel) and
 * BQ_CAPTURE_PAGE_DIR is set for relative paths, crop/upload onto Header/Footer
 * Partial Design `__Thumbnail`. No conversion-scan fallback.
 */
async function maybeEnsurePartialDesignThumbnail(options: {
  collectionSystem: string;
  siteSystem: string;
  signature: string;
  thumbnail?: DefinitionThumbnail;
  partialSitecorePath: string;
  partialItemId?: string;
  cmAlign?: CmAlignLookupOptions;
}): Promise<void> {
  const signature = String(options.signature || "")
    .trim()
    .toLowerCase();
  if (signature !== "header" && signature !== "footer") return;
  const thumbnail = normalizeDefinitionThumbnail(options.thumbnail);
  if (!thumbnail) return;
  const capturePageDir = process.env.BQ_CAPTURE_PAGE_DIR?.trim();
  if (thumbnail.path && !path.isAbsolute(thumbnail.path) && !capturePageDir) {
    console.warn(
      `[bq:apply:partial-thumbnail] skip ${signature}: BQ_CAPTURE_PAGE_DIR unset (relative path)`,
    );
    return;
  }

  try {
    const result = await ensurePartialDesignThumbnailFromCapture({
      collectionSystem: options.collectionSystem,
      siteSystem: options.siteSystem,
      capturePageDir,
      thumbnail,
      partialSitecorePath: options.partialSitecorePath,
      partialItemId: options.partialItemId,
      signature,
      endpointName: options.cmAlign?.endpointName,
      lookupPath: options.cmAlign?.lookupPath,
      skipCm: options.cmAlign?.skipCm,
    });
    if (result.skipped) {
      console.warn(
        `[bq:apply:partial-thumbnail] skip ${signature}: ${result.skipped}`,
      );
      return;
    }
    console.log(
      `[bq:apply:partial-thumbnail] ${signature} → ${result.mediaPath} (${result.width}x${result.height})`,
    );
  } catch (err) {
    console.warn(
      `[bq:apply:partial-thumbnail] ${signature}: ${err instanceof Error ? err.message : err} (continuing)`,
    );
  }
}

/**
 * Sites API scaffolds Partial Designs/{Header|Footer}/Data (often with Title).
 * After BQ emits Header/Footer __Renderings, delete that leftover Data folder.
 */
async function pruneScaffoldPartialDataFolder(options: {
  partialSitecorePath: string;
  endpointName?: string;
}): Promise<void> {
  const dataPath = `${options.partialSitecorePath.replace(/\/+$/, "")}/Data`;
  try {
    const resolved = await resolveItemIdByPath({
      sitecorePath: dataPath,
      endpointName: options.endpointName,
      logPrefix: `${LOG_PREFIX} prune-data`,
    });
    if (!resolved.found) return;
    const result = await deleteCmItemById({
      itemId: resolved.id,
      endpointName: options.endpointName,
    });
    if (result.ok) {
      console.log(`${LOG_PREFIX} pruned scaffold ${dataPath}`);
    } else {
      console.warn(
        `${LOG_PREFIX} failed to prune ${dataPath}: ${result.error || "unknown"}`,
      );
    }
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} prune ${dataPath}: ${err instanceof Error ? err.message : err} (continuing)`,
    );
  }
}

type PresentationChildDef = NonNullable<
  NonNullable<SitePresentationDefinition["partialDesigns"]>[number]["children"]
>[number];

/**
 * Recursively resolve presentation children (composites-in-composites).
 * Assigns DynamicPlaceholderId when a node has children and declares placeholders.
 * Fail closed if children exist but parent placeholders are empty.
 */
async function resolvePresentationChildren(opts: {
  children: PresentationChildDef[];
  parentDefinitionKey: string;
  parentPhKeys: string[];
  uidSeed: string;
  handle: string;
  registry: Map<string, Definition>;
  site: PresentationSiteContext;
  nextDynId: number;
  logContext: string;
}): Promise<{ resolvedChildren: ResolvedHomeChild[]; nextDynId: number }> {
  const {
    children,
    parentDefinitionKey,
    parentPhKeys,
    uidSeed,
    handle,
    registry,
    site,
    logContext,
  } = opts;
  let nextDynId = opts.nextDynId;
  const resolvedChildren: ResolvedHomeChild[] = [];

  for (let cIndex = 0; cIndex < children.length; cIndex++) {
    const child = children[cIndex]!;
    const childRenderingId = await resolveRenderingId(
      child.definitionKey,
      registry,
      site,
    );
    const childDatasourceId = await resolveDatasourceId(
      {
        definitionKey: child.definitionKey,
        placeholder: "",
        datasourceItem: child.datasourceItem,
      },
      registry,
      site,
      `${logContext} → ${parentDefinitionKey}`,
    );
    const fieldNamesId = await resolveChildFieldNamesId(child, registry, site);
    const alignedPh = alignChildPlaceholderToParent(
      child.placeholder?.trim() || undefined,
      parentPhKeys,
    );
    if (
      child.placeholder?.trim() &&
      alignedPh &&
      alignedPh !== child.placeholder.trim()
    ) {
      console.warn(
        `[bq:apply:site-presentation] remapped nested placeholder "${child.placeholder}" → "${alignedPh}"` +
          ` under "${parentDefinitionKey}" (${logContext}; parent keys: ${parentPhKeys.join(", ")})`,
      );
    }

    const grandDefs = child.children || [];
    const { parentPhKeys: childPhKeys, childPlaceholderKey } =
      grandDefs.length > 0
        ? requireParentPlaceholderHost(
            child.definitionKey,
            registry,
            grandDefs.length,
            logContext,
          )
        : { parentPhKeys: [] as string[], childPlaceholderKey: null };
    let childDynId: number | undefined;
    let grandchildren: ResolvedHomeChild[] = [];
    if (grandDefs.length > 0 && childPlaceholderKey) {
      childDynId = nextDynId++;
      const nested = await resolvePresentationChildren({
        children: grandDefs,
        parentDefinitionKey: child.definitionKey,
        parentPhKeys: childPhKeys,
        uidSeed: `${uidSeed}:child:${child.definitionKey}:${cIndex}`,
        handle,
        registry,
        site,
        nextDynId,
        logContext,
      });
      grandchildren = nested.resolvedChildren;
      nextDynId = nested.nextDynId;
    }

    resolvedChildren.push({
      definitionKey: child.definitionKey,
      datasourceItem: child.datasourceItem,
      placeholder: alignedPh,
      variant: child.variant,
      renderingIdentifier: child.renderingIdentifier?.trim() || undefined,
      renderingId: childRenderingId,
      datasourceId: childDatasourceId,
      fieldNamesId,
      uid: braceGuid(
        stableGuid(
          handle,
          `${uidSeed}:child:${child.definitionKey}:${cIndex}`,
        ),
      ),
      dynamicPlaceholderId: childDynId,
      childPlaceholderKey,
      resolvedChildren: grandchildren,
    });
  }

  return { resolvedChildren, nextDynId };
}

/**
 * Resolve one Partial Design root rendering (optional nested children).
 * Used for both the primary parent and `siblingsBefore` roots on the same placeholder.
 */
async function resolvePartialRootEntry(opts: {
  definitionKey: string;
  placeholder: string;
  datasourceItem?: string;
  renderingIdentifier?: string;
  children?: PresentationChildDef[];
  signature: string;
  rootIndex: number;
  handle: string;
  registry: Map<string, Definition>;
  site: PresentationSiteContext;
  nextDynId: number;
}): Promise<{ entry: ResolvedHomeRendering; nextDynId: number }> {
  const {
    definitionKey,
    placeholder,
    datasourceItem,
    renderingIdentifier,
    children = [],
    signature,
    rootIndex,
    handle,
    registry,
    site,
  } = opts;
  let nextDynId = opts.nextDynId;

  const renderingId = await resolveRenderingId(
    definitionKey,
    registry,
    site,
  );
  const datasourceId = await resolveDatasourceId(
    {
      definitionKey,
      placeholder,
      datasourceItem,
    },
    registry,
    site,
    `partial "${signature}"`,
  );

  const { parentPhKeys, childPlaceholderKey } =
    children.length > 0
      ? requireParentPlaceholderHost(
          definitionKey,
          registry,
          children.length,
          `partial "${signature}"`,
        )
      : { parentPhKeys: [] as string[], childPlaceholderKey: null };
  const dynamicPlaceholderId =
    children.length > 0 && childPlaceholderKey ? nextDynId++ : undefined;

  let resolvedChildren: ResolvedHomeChild[] = [];
  if (children.length > 0 && childPlaceholderKey) {
    const nested = await resolvePresentationChildren({
      children,
      parentDefinitionKey: definitionKey,
      parentPhKeys,
      uidSeed: `partial-r:${signature}:${definitionKey}:${rootIndex}`,
      handle,
      registry,
      site,
      nextDynId,
      logContext: `partial "${signature}"`,
    });
    resolvedChildren = nested.resolvedChildren;
    nextDynId = nested.nextDynId;
  }

  return {
    nextDynId,
    entry: {
      definitionKey,
      placeholder,
      datasourceItem,
      renderingIdentifier: renderingIdentifier?.trim() || undefined,
      renderingId,
      datasourceId,
      uid: braceGuid(
        stableGuid(
          handle,
          `partial-r:${signature}:${definitionKey}:${rootIndex}`,
        ),
      ),
      dynamicPlaceholderId,
      childPlaceholderKey,
      resolvedChildren,
    },
  };
}

/**
 * Resolve a rendering item id from CM by Sitecore path
 * (`/sitecore/layout/Renderings/Project/{collection}/{name}`). Never mints an id:
 * returns `null` when the rendering is missing so completeness asserts fail closed.
 */
async function resolveRenderingId(
  definitionKey: string,
  registry: Map<string, Definition>,
  site: PresentationSiteContext,
): Promise<string | null> {
  const def = registry.get(definitionKey);
  if (!def || (def.kind !== "component" && def.kind !== "rendering")) return null;
  const folder = getProjectRenderingsSitecorePath(site.collectionSystem);
  const names = [
    projectRenderingPathLeaf(def),
    def.kind === "component" ? def.componentName : "",
    def.name,
  ]
    .map((name) => String(name || "").trim())
    .filter(Boolean);
  for (const name of [...new Set(names)]) {
    const id = await resolvePathId(site, `${folder}/${name}`);
    if (id) return id;
  }
  return null;
}

/**
 * Resolve datasource GUID from component content seed (first item or named override)
 * by Sitecore path under `/sitecore/content/{collection}/{site}/Data|Home/…`.
 * Never invents an id. Uses spaced folders + English Path names (same as content emit).
 * Fail closed (citing the Sitecore path) when a datasource is expected but missing in CM.
 */
async function resolveDatasourceId(
  entry: HomeRenderingEntry,
  registry: Map<string, Definition>,
  site: PresentationSiteContext,
  logContext = "",
): Promise<string | null> {
  const def = registry.get(entry.definitionKey);
  if (!def || (def.kind !== "component" && def.kind !== "rendering")) {
    return null;
  }

  const itemName =
    String(entry.datasourceItem || "").trim() ||
    def.content?.items?.[0]?.name ||
    def.content?.versions?.[0]?.items?.[0]?.name ||
    "";
  const mustBind = expectsDatasource(def, entry.datasourceItem);
  if (!itemName) {
    return null;
  }

  const hit = await resolveDatasourceByPath({
    collectionSystem: site.collectionSystem,
    siteSystem: site.siteSystem,
    def,
    datasourceItem: entry.datasourceItem || itemName,
    ...site.cmAlign,
  });
  if (hit?.itemId) {
    return hit.itemId;
  }

  if (mustBind) {
    throw new Error(
      formatDatasourceLookupFailure({
        definitionKey: entry.definitionKey,
        itemName,
        collectionSystem: site.collectionSystem,
        siteSystem: site.siteSystem,
        def,
      }) + (logContext ? ` (${logContext})` : ""),
    );
  }
  return null;
}

/** All placeholder base keys declared on a parent component/rendering definition. */
function resolveParentPlaceholderKeys(
  definitionKey: string,
  registry: Map<string, Definition>,
): string[] {
  const def = registry.get(definitionKey);
  if (!def || (def.kind !== "component" && def.kind !== "rendering")) return [];
  const list = Array.isArray(def.placeholders) ? def.placeholders : [];
  const out: string[] = [];
  for (const ph of list) {
    const key = toBasePlaceholderKey(String(ph?.key || "").trim());
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/**
 * Fail closed when nesting children under a parent that cannot host them.
 * Distinguishes missing registry definition from empty placeholders[].
 */
function requireParentPlaceholderHost(
  definitionKey: string,
  registry: Map<string, Definition>,
  childCount: number,
  context: string,
): { parentPhKeys: string[]; childPlaceholderKey: string } {
  const def = registry.get(definitionKey);
  if (!def || (def.kind !== "component" && def.kind !== "rendering")) {
    throw new Error(
      `[bq:apply:site-presentation] ${context}: rendering "${definitionKey}" has ` +
        `${childCount} nested child(ren) but its definition is missing or not loaded — ` +
        `refusing to skip. Ensure the component package exists and is registered.`,
    );
  }
  const parentPhKeys = resolveParentPlaceholderKeys(definitionKey, registry);
  const childPlaceholderKey = parentPhKeys[0] ?? null;
  if (!childPlaceholderKey) {
    throw new Error(
      `[bq:apply:site-presentation] ${context}: rendering "${definitionKey}" has ` +
        `${childCount} nested child(ren) but parent placeholders are empty — ` +
        `refusing to skip. Declare placeholders on the parent definition ` +
        `(matching AppPlaceholder bases in TSX).`,
    );
  }
  return { parentPhKeys, childPlaceholderKey };
}

/**
 * Align child placeholder override to a key the parent actually declares.
 * Legacy codegen wrote `footer-nav` while AppPlaceholder/definition use `footer-navigation`.
 */
function alignChildPlaceholderToParent(
  childPlaceholder: string | undefined,
  parentKeys: string[],
): string | undefined {
  const child = String(childPlaceholder || "").trim();
  if (!child) return undefined;
  if (!parentKeys.length) return child;
  if (parentKeys.includes(child)) return child;
  if (child === "footer-nav" && parentKeys.includes("footer-navigation")) {
    return "footer-navigation";
  }
  if (
    child === "footer-navigation" &&
    parentKeys.includes("footer-nav") &&
    !parentKeys.includes("footer-navigation")
  ) {
    return "footer-nav";
  }
  // Fail closed: do not write children into placeholder keys the parent never declares
  // (FE AppPlaceholder will not mount them → empty chrome / orphan layout rows).
  throw new Error(
    `[bq:apply:site-presentation] nested child placeholder "${child}" is not declared on parent ` +
      `(keys: [${parentKeys.join(", ")}]) — refusing to write orphan layout rows. ` +
      `Align presentation children.placeholder to parent placeholders[].key (and AppPlaceholder bases).`,
  );
}

/** Join layout `s:par` segments (omit empties). */
function joinRenderingParams(parts: Array<string | null | undefined>): string {
  return parts.map((p) => String(p || "").trim()).filter(Boolean).join("&");
}

function encodeRenderingIdentifierParam(id: string | undefined | null): string {
  const v = String(id || "").trim();
  if (!v) return "";
  return `RenderingIdentifier=${encodeURIComponent(v)}`;
}

type FlatRenderingRow = {
  uid: string;
  renderingId: string;
  datasourceId: string | null;
  placeholder: string;
  /** Always set — empty string when no DynamicPlaceholderId / FieldNames / id. */
  params: string;
};

/**
 * Flatten a resolved child tree into layout rows with chained s:ph paths.
 * Exported for unit tests (depth-2+ composites).
 */
export function flattenResolvedChildrenToRows(
  children: ResolvedHomeChild[],
  parentPhPath: string,
  parentDynId: number | undefined,
  parentDefaultPhKey: string | null | undefined,
): FlatRenderingRow[] {
  const flat: FlatRenderingRow[] = [];
  if (parentDynId == null) return flat;

  for (const child of children) {
    if (!child.renderingId) continue;
    const childBase =
      toBasePlaceholderKey(child.placeholder || "") || parentDefaultPhKey;
    if (!childBase) continue;
    const childPh = `${parentPhPath}/${childBase}-${parentDynId}`;
    const childParams = joinRenderingParams([
      child.dynamicPlaceholderId != null
        ? `DynamicPlaceholderId=${child.dynamicPlaceholderId}`
        : "",
      child.fieldNamesId ? encodeFieldNamesParam(child.fieldNamesId) : "",
      encodeRenderingIdentifierParam(child.renderingIdentifier),
    ]);
    flat.push({
      uid: child.uid,
      renderingId: child.renderingId,
      datasourceId: child.datasourceId,
      placeholder: childPh,
      params: childParams,
    });
    if (child.resolvedChildren?.length && child.dynamicPlaceholderId != null) {
      flat.push(
        ...flattenResolvedChildrenToRows(
          child.resolvedChildren,
          childPh,
          child.dynamicPlaceholderId,
          child.childPlaceholderKey,
        ),
      );
    }
  }
  return flat;
}

/** Build __Renderings XML from resolved page/partial roots (supports nested composites). */
export function buildHomeRenderingsXml(entries: ResolvedHomeRendering[]): string {
  const flat: FlatRenderingRow[] = [];

  for (const entry of entries) {
    if (!entry.renderingId) continue;
    const parentPh = entry.placeholder || "headless-main";
    const parentPhPath = parentPh.startsWith("/") ? parentPh : parentPh;
    const params = joinRenderingParams([
      entry.dynamicPlaceholderId != null
        ? `DynamicPlaceholderId=${entry.dynamicPlaceholderId}`
        : "",
      entry.fieldNamesId ? encodeFieldNamesParam(entry.fieldNamesId) : "",
      encodeRenderingIdentifierParam(entry.renderingIdentifier),
    ]);
    flat.push({
      uid: entry.uid,
      renderingId: entry.renderingId,
      datasourceId: entry.datasourceId,
      placeholder: parentPh,
      params,
    });
    flat.push(
      ...flattenResolvedChildrenToRows(
        entry.resolvedChildren || [],
        `/${parentPhPath}`,
        entry.dynamicPlaceholderId,
        entry.childPlaceholderKey,
      ),
    );
  }

  const lines: string[] = [
    `<r xmlns:p="p" xmlns:s="s"`,
    `  p:p="1">`,
    `  <d`,
    `    id="${DEVICE_DEFAULT}"`,
    `    l="${HEADLESS_LAYOUT}">`,
  ];

  for (let i = 0; i < flat.length; i++) {
    const entry = flat[i]!;
    const attrs: string[] = [`uid="${entry.uid}"`];
    if (i === 0) {
      attrs.push(`p:before="*"`);
    } else if (i === flat.length - 1) {
      attrs.push(`p:after="*[1=2]"`);
    } else {
      const prev = flat[i - 1]!.uid;
      attrs.push(`p:after="r[@uid='${prev}']"`);
    }
    if (entry.datasourceId) {
      attrs.push(`s:ds="${braceGuid(entry.datasourceId)}"`);
    }
    attrs.push(`s:id="${braceGuid(entry.renderingId)}"`);
    attrs.push(`s:par="${entry.params.replace(/&/g, "&amp;")}"`);
    attrs.push(`s:ph="${entry.placeholder}"`);

    lines.push(`    <r`);
    for (let a = 0; a < attrs.length; a++) {
      const suffix = a === attrs.length - 1 ? " />" : "";
      lines.push(`      ${attrs[a]}${suffix}`);
    }
  }

  lines.push(`  </d>`, `</r>`);
  return lines.join("\n");
}

/**
 * Resolve FieldNames GUID for a nested presentation child when `variant` is
 * set to a non-Default headless variant name. Resolved from CM at
 * `…/Presentation/Headless Variants/{Component}/{Variant}` (no id minting).
 */
async function resolveChildFieldNamesId(
  child: { definitionKey: string; variant?: string },
  registry: Map<string, Definition>,
  site: PresentationSiteContext,
): Promise<string | null> {
  const variantName = child.variant?.trim();
  if (!variantName || variantName.toLowerCase() === "default") return null;

  const def = registry.get(child.definitionKey);
  if (!def || (def.kind !== "component" && def.kind !== "rendering")) {
    console.warn(
      `${LOG_PREFIX} variant "${variantName}" on unknown rendering "${child.definitionKey}" — omitting FieldNames`,
    );
    return null;
  }
  const branchName = projectRenderingPathLeaf(def);
  if (!branchName) return null;

  const variantPath = `${siteContentRoot(site)}/Presentation/Headless Variants/${branchName}/${variantName}`;
  const id = await resolvePathId(site, variantPath);
  if (!id) {
    console.warn(
      `${LOG_PREFIX} could not resolve FieldNames for "${child.definitionKey}" variant "${variantName}" (missing in CM: ${variantPath})`,
    );
  }
  return id;
}

/**
 * @deprecated Pure YAML-text helper (no file I/O); unused by Authoring apply.
 * Kept for `bumpPageDesignItemRevisions` tests.
 */
function upsertSharedFieldQuoted(
  yamlText: string,
  fieldId: string,
  hint: string,
  value: string,
): string {
  const block = `- ID: "${fieldId}"
  Hint: ${hint}
  Value: ${JSON.stringify(value)}`;
  if (yamlText.includes(`ID: "${fieldId}"`)) {
    let next = yamlText.replace(
      new RegExp(
        `- ID: "${fieldId}"[\\s\\S]*?(?=\\n- ID:|\\nLanguages:)`,
        "i",
      ),
      `${block}\n`,
    );
    if (!/^SharedFields:/m.test(next) && next.includes("Languages:")) {
      next = next.replace(
        new RegExp(`(^|\\n)(- ID: "${fieldId}")`, "i"),
        `$1SharedFields:\n$2`,
      );
    }
    return next;
  }
  if (yamlText.includes("Languages:")) {
    if (/^SharedFields:/m.test(yamlText)) {
      return yamlText.replace("Languages:", `${block}\nLanguages:`);
    }
    return yamlText.replace(
      "Languages:",
      `SharedFields:\n${block}\nLanguages:`,
    );
  }
  if (yamlText.includes("SharedFields:")) {
    return yamlText.replace("SharedFields:", `SharedFields:\n${block}`);
  }
  return `${yamlText.trimEnd()}\nSharedFields:\n${block}\n`;
}

function resolvePresentationCultures(
  definition: SitePresentationDefinition,
  registry: Map<string, Definition>,
): string[] {
  const seen = new Set<string>();
  const add = (c: string) => {
    const t = String(c || "").trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
  };

  for (const c of definition.cultures || []) add(c);

  for (const def of registry.values()) {
    if (def.kind === "site") {
      if (
        toSystemName(def.systemName || def.name) !==
        toSystemName(definition.siteSystem)
      ) {
        continue;
      }
      for (const c of def.api?.languages || []) add(c);
      continue;
    }
    if (def.kind !== "component") continue;
    if (
      toSystemName((def as { siteSystem?: string }).siteSystem || "") !==
      toSystemName(definition.siteSystem)
    ) {
      continue;
    }
    const content = (def as { content?: { culture?: string; cultures?: string[] } })
      .content;
    if (content?.culture) add(content.culture);
    for (const c of content?.cultures || []) add(c);
  }

  return [...seen];
}

/**
 * Ensure custom page templates (e.g. News Article) are mapped to Default page
 * design. Without TemplatesMapping, Edge/layout returns 404 for those items.
 * Resolves Page Designs + Default by Sitecore path and updates via Authoring.
 */
async function ensurePageDesignTemplateMappings(options: {
  site: PresentationSiteContext;
  pageTemplateIds: string[];
}): Promise<ScsWriteStats> {
  const stats = emptyWriteStats();
  const { site } = options;
  const endpointName = site.cmAlign?.endpointName;
  const designsPath = `${siteContentRoot(site)}/Presentation/Page Designs`;
  const folderId = await resolvePathId(site, designsPath);
  const defaultCmId = await resolvePathId(site, `${designsPath}/Default`);
  if (!folderId || !defaultCmId) {
    console.warn(
      `${LOG_PREFIX} Page Designs folder/Default missing in CM (${designsPath}) — skip TemplatesMapping`,
    );
    return stats;
  }
  const defaultId = toScsYamlGuid(defaultCmId).toUpperCase();

  const existingRaw = await readItemFieldValue({
    path: designsPath,
    fieldName: "TemplatesMapping",
    endpointName,
  });
  if (existingRaw === undefined) {
    console.warn(
      `${LOG_PREFIX} could not read TemplatesMapping on ${designsPath} — skip (refusing to overwrite)`,
    );
    return stats;
  }

  const pairs = new Map<string, string>();
  const safeDecode = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const decodedOnce = safeDecode(existingRaw);
  for (const part of decodedOnce.split(/[&|]/).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = safeDecode(part.slice(0, eq))
      .replace(/[{}]/g, "")
      .toUpperCase();
    const val = safeDecode(part.slice(eq + 1))
      .replace(/[{}]/g, "")
      .toUpperCase();
    if (key && val) pairs.set(key, val);
  }

  let changed = false;
  for (const tid of options.pageTemplateIds) {
    const key = toScsYamlGuid(tid).toUpperCase();
    if (!key || pairs.get(key) === defaultId) continue;
    pairs.set(key, defaultId);
    changed = true;
  }
  if (!changed || !pairs.size) return stats;

  const encoded = [...pairs.entries()]
    .map(
      ([templateId, designId]) =>
        `%7b${templateId}%7d%3d%257B${designId}%257D`,
    )
    .join("&");

  try {
    await updateItem({
      itemId: folderId,
      path: designsPath,
      endpointName,
      fields: [{ name: "TemplatesMapping", value: encoded }],
    });
    recordWrite(stats, "updated");
    console.log(
      `${LOG_PREFIX} Page Designs TemplatesMapping → ${pairs.size} template(s)`,
    );
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} failed to patch TemplatesMapping: ${err instanceof Error ? err.message : err}`,
    );
  }
  return stats;
}

/**
 * Prefer presentation-emitted partial IDs in definition order (cookie → header →
 * footer), then append non-emitted CM extras (e.g. Metadata) so scaffold extras
 * survive. Reorders emitted ids when CM had Footer|Header|Cookie frozen.
 */
export function reconcilePageDesignPartialIds(
  emittedIds: string[],
  existingIds: string[],
): { ids: string[]; changed: boolean } {
  const emitted = (emittedIds || [])
    .map((id) => String(id || "").replace(/[{}]/g, "").trim().toLowerCase())
    .filter(Boolean);
  const existing = (existingIds || [])
    .map((id) => String(id || "").replace(/[{}]/g, "").trim().toLowerCase())
    .filter(Boolean);
  const emittedSet = new Set(emitted);
  const extras = existing.filter((id) => id && !emittedSet.has(id));
  const ids = [...emitted, ...extras];
  const same =
    ids.length === existing.length && ids.every((id, i) => id === existing[i]);
  return { ids, changed: !same };
}

/** Sitecore version-field timestamp: YYYYMMDDTHHMMSSZ (UTC). */
export function formatSitecoreUtcTimestamp(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
  );
}

/**
 * Upsert a version field under every Languages/Version Fields list.
 * When `nextValue` is a function, each occurrence gets a fresh value (per-lang
 * __Revision). When a string, every occurrence shares that value (__Updated).
 */
/**
 * Replace/insert a version field under every Languages/Version Fields list.
 *
 * Important: the Value line must be consumed in full (`Value:[^\r\n]*\r?\n`).
 * A previous pattern used `Value:.*?\r?\n?` — because the newline was optional,
 * the engine could stop immediately after `Value:` and leave the old value as
 * an orphan line (SCS: "Invalid YAML map value"). That broke Page Designs/Default
 * on every create:sectioncomponents / presentation bump.
 */
function upsertVersionFieldEverywhere(
  yamlText: string,
  fieldId: string,
  hint: string,
  nextValue: string | (() => string),
  options: { quoted: boolean },
): string {
  const resolve = (): string =>
    typeof nextValue === "function" ? nextValue() : nextValue;
  const formatValue = (raw: string) =>
    options.quoted ? JSON.stringify(raw) : raw;
  const fieldBlock = (indent: string, value: string) =>
    `${indent}- ID: "${fieldId}"\n` +
    `${indent}  Hint: ${hint}\n` +
    `${indent}  Value: ${formatValue(value)}`;

  // Require the remainder of the Hint/Value lines (no optional trailing newline
  // after an empty `.*?`) so old values cannot be left as orphan map entries.
  const existingRe = new RegExp(
    `^([ \\t]*)- ID: "${fieldId}"\\r?\\n` +
      `(?:[ \\t]+Hint:[^\\r\\n]*\\r?\\n)?` +
      `(?:[ \\t]+Value:[^\\r\\n]*\\r?\\n)`,
    "gim",
  );
  if (existingRe.test(yamlText)) {
    existingRe.lastIndex = 0;
    return yamlText.replace(existingRe, (_m, indent: string) => {
      return `${fieldBlock(indent, resolve())}\n`;
    });
  }

  return yamlText.replace(
    /(^[ \t]+Fields:\r?\n)([\s\S]*?)(?=^[ \t]+- Version:|^[ \t]*- Language:|^Languages:|\Z)/gm,
    (full, header: string, body: string) => {
      if (new RegExp(`ID:\\s*"${fieldId}"`, "i").test(body)) {
        return full;
      }
      const indentMatch = body.match(/^([ \t]+)- ID:/m);
      const indent = indentMatch?.[1] || "    ";
      const trimmed = body.replace(/\s*$/, "");
      const sep = !trimmed || trimmed.endsWith("\n") ? "" : "\n";
      return `${header}${trimmed}${sep}${fieldBlock(indent, resolve())}\n`;
    },
  );
}

/** True when bump/patch left a bare quoted GUID or timestamp as a YAML map value. */
export function hasOrphanScsYamlMapValues(yamlText: string): boolean {
  return /(?:^|\n)[ \t]+(?:"[0-9a-f-]{36}"|\d{8}T\d{6}Z)[ \t]*(?:\r?\n|$)/i.test(
    yamlText,
  );
}

/**
 * Mint new __Shared revision + per-language __Revision GUIDs and set __Updated
 * to now so SCS pushes an Update even when PartialDesigns IDs are unchanged.
 */
export function bumpPageDesignItemRevisions(
  yamlText: string,
  options?: {
    now?: Date;
    newGuid?: () => string;
  },
): string {
  const newGuid = options?.newGuid ?? (() => crypto.randomUUID());
  const stamp = formatSitecoreUtcTimestamp(options?.now ?? new Date());
  let text = upsertSharedFieldQuoted(
    yamlText,
    FIELD_IDS.SharedRevision,
    "__Shared revision",
    newGuid(),
  );
  text = upsertVersionFieldEverywhere(
    text,
    FIELD_IDS.Revision,
    "__Revision",
    () => newGuid(),
    { quoted: true },
  );
  text = upsertVersionFieldEverywhere(
    text,
    FIELD_IDS.Updated,
    "__Updated",
    stamp,
    { quoted: false },
  );
  return text;
}

/**
 * Wire Page Designs/Default PartialDesigns to the emitted partial ids.
 * Resolves the Page Designs folder + Default item by Sitecore path; creates Default
 * under the live folder id when missing, otherwise updates the multilist via Authoring.
 */
async function ensureDefaultPageDesignPartials(options: {
  site: PresentationSiteContext;
  partialIds: string[];
  /** Site cultures that need a version shell on Page Designs/Default (`en` always). */
  cultures?: string[];
}): Promise<ScsWriteStats> {
  const stats = emptyWriteStats();
  const { site } = options;
  const endpointName = site.cmAlign?.endpointName;
  const designsPath = `${siteContentRoot(site)}/Presentation/Page Designs`;
  const defaultPath = `${designsPath}/Default`;
  const { emitCultures } = resolveContentLanguages({
    culture: "en",
    cultures: options.cultures || [],
  });

  const folderId = await resolvePathId(site, designsPath);
  if (!folderId) {
    console.warn(
      `${LOG_PREFIX} Page Designs folder missing in CM (${designsPath}) — skip PartialDesigns wiring`,
    );
    return stats;
  }

  const emitted = options.partialIds
    .map((id) => canonicalItemId(id))
    .filter(Boolean);
  if (!emitted.length) return stats;

  const existingRaw = await readItemFieldValue({
    path: defaultPath,
    fieldName: "PartialDesigns",
    endpointName,
  });
  const existingIds = parseMultilistIds(existingRaw ?? "");
  const { ids: partialIdsToWrite, changed } = reconcilePageDesignPartialIds(
    emitted,
    existingIds,
  );
  const partialValue = partialIdsToWrite.map(braceGuid).join("|");

  const defaultLanguages = await buildLanguageBlocks(
    [
      {
        id: FIELD_IDS.DisplayName,
        hint: "__Display name",
        value: "Default",
      },
    ],
    [],
    emitCultures,
    "en",
  );

  const defaultId = await resolvePathId(site, defaultPath);
  if (!defaultId) {
    const created = await applyAuthoringItem(
      `page-design:${defaultPath}`,
      {
        parent: folderId,
        template: PAGE_DESIGN_TEMPLATE_ID,
        path: defaultPath,
        sharedFields: [
          {
            id: FIELD_PARTIAL_DESIGNS,
            hint: "PartialDesigns",
            value: partialValue,
          },
        ],
        languages: defaultLanguages,
      },
      { endpointName },
    );
    recordWrite(stats, created);
    console.log(
      `${LOG_PREFIX} created Page Designs/Default with ${partialIdsToWrite.length} partial(s) ` +
        `(cultures: ${emitCultures.join(", ")})`,
    );
    return stats;
  }

  // Ensure a version exists for every site culture (shared PartialDesigns stay shared).
  for (const lang of emitCultures) {
    if (String(lang).toLowerCase() === "en") continue;
    try {
      await addItemVersion({
        itemId: defaultId,
        language: lang,
        endpointName,
      });
    } catch (err) {
      // Already has a version — ignore; real failures are logged.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists|version already/i.test(msg)) {
        console.warn(
          `${LOG_PREFIX} addItemVersion Page Designs/Default (${lang}): ${msg}`,
        );
      }
    }
  }

  if (!changed) {
    recordWrite(stats, "unchanged");
    console.log(
      `${LOG_PREFIX} Page Designs/Default PartialDesigns already match emit (${partialIdsToWrite.length})`,
    );
    return stats;
  }

  if (existingIds.length) {
    console.log(
      `${LOG_PREFIX} Page Designs/Default PartialDesigns reconcile: ` +
        `${existingIds.join("|")} → ${partialIdsToWrite.join("|")}`,
    );
  }
  try {
    await updateItem({
      itemId: defaultId,
      path: defaultPath,
      endpointName,
      fields: [{ name: "PartialDesigns", value: partialValue }],
    });
    recordWrite(stats, "updated");
    console.log(
      `${LOG_PREFIX} Page Designs/Default PartialDesigns → ${partialIdsToWrite.length} partial(s)`,
    );
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} failed to patch Page Designs/Default: ${err instanceof Error ? err.message : err}`,
    );
  }
  return stats;
}
