import { toItemSystemName } from "../blueprints/clone-blueprint";
import {
  createSitesApiContext,
  findCollectionByName,
  resolveSiteTemplateId,
  syncSiteViaApi,
} from "./sites-api";
import { ensureCollectionViaApi } from "./collection";
import type { SiteDefinition } from "../types";
import { emptyWriteStats, type ScsWriteStats } from "../../shared/authoring-item-model";
import { getActiveSitesApiOwnedLedger } from "../../shared/sites-api-owned-state";
import { resolvePreviousSystemNameFromOwnedState } from "../../shared/sites-api-orphan-prune";
import { ensureMediaFolderChain } from "../../shared/media-from-source";
import { ensureSiteThumbnailFromCapture } from "../../shared/site-thumbnail-from-capture";
import { sanitizeSingleLineText } from "../../shared/naming";
import { saiHandleFrom } from "../../shared/sai-handle";

export function resolveSiteSystemName(
  definition: Pick<SiteDefinition, "name" | "systemName">,
): string {
  return (
    definition.systemName?.trim() || toItemSystemName(definition.name)
  ).trim();
}

/** When create:sectioncomponents sets BQ_CAPTURE_PAGE_DIR or the site def has `thumbnail`, wire Home/Site `__Thumbnail`. */
export async function maybeEnsureSiteThumbnailFromCaptureEnv(
  collectionSystem: string,
  siteSystem: string,
  thumbnail?: SiteDefinition["thumbnail"],
): Promise<void> {
  const capturePageDir = process.env.BQ_CAPTURE_PAGE_DIR?.trim();
  if (!capturePageDir && !thumbnail) return;

  console.log("\n▶ Site thumbnail from capture");
  try {
    const result = await ensureSiteThumbnailFromCapture({
      collectionSystem,
      siteSystem,
      capturePageDir,
      thumbnail,
    });
    if (result.skipped) {
      console.warn(`[bq:apply:site-thumbnail] skip: ${result.skipped}`);
      return;
    }
    console.log(
      `[bq:apply:site-thumbnail] ${collectionSystem}/${siteSystem} → ${result.mediaPath} (${result.width}x${result.height})`,
    );
    console.log(`[bq:apply:site-thumbnail] Home: ${result.homePath}`);
  } catch (err) {
    console.warn(
      `[bq:apply:site-thumbnail] ${err instanceof Error ? err.message : err} (continuing)`,
    );
  }
}

async function resolveSiteCollectionForApi(
  definition: SiteDefinition,
  ctx: Awaited<ReturnType<typeof createSitesApiContext>>,
): Promise<{
  collectionSystem: string;
  collectionId?: string;
  createCollectionInline?: {
    name: string;
    displayName: string;
    description?: string;
  };
  collectionStats: ScsWriteStats;
}> {
  if ("collectionSystem" in definition && definition.collectionSystem) {
    const systemName = definition.collectionSystem.trim();
    if (!systemName) {
      throw new Error(
        `[site:${definition.definitionKey}] collectionSystem must be non-empty`,
      );
    }

    const ensured = await ensureCollectionViaApi({
      name: systemName,
      systemName,
      api: definition.api,
    });
    return {
      collectionSystem: systemName,
      collectionId: ensured.remoteId,
      collectionStats: ensured.stats,
    };
  }

  if ("collection" in definition && definition.collection) {
    const inline = definition.collection;
    const systemName = (
      inline.systemName?.trim() || toItemSystemName(inline.name)
    ).trim();
    const remote = await findCollectionByName(ctx, systemName);
    if (remote?.id) {
      return {
        collectionSystem: systemName,
        collectionId: remote.id.replace(/[{}]/g, ""),
        collectionStats: emptyWriteStats(),
      };
    }
    return {
      collectionSystem: systemName,
      createCollectionInline: {
        name: systemName,
        displayName: sanitizeSingleLineText(inline.name),
        description: inline.description
          ? sanitizeSingleLineText(inline.description)
          : undefined,
      },
      collectionStats: emptyWriteStats(),
    };
  }

  throw new Error(
    `[site:${definition.definitionKey}] Provide collectionSystem (existing) or collection (create/reuse).`,
  );
}

export async function applySiteDefinition(
  definition: SiteDefinition,
): Promise<ScsWriteStats> {
  const siteSystem = resolveSiteSystemName(definition);
  const siteName = sanitizeSingleLineText(definition.name);
  const siteDescription =
    sanitizeSingleLineText(definition.description) ||
    `${siteName} description`;

  const previousSystemName = resolvePreviousSystemNameFromOwnedState({
    kind: "site",
    definitionKey: definition.definitionKey,
    systemName: siteSystem,
    explicit: definition.previousSystemName,
  });

  const collectionSystemHint =
    "collectionSystem" in definition && definition.collectionSystem
      ? definition.collectionSystem.trim()
      : "collection" in definition && definition.collection
        ? (
            definition.collection.systemName?.trim() ||
            toItemSystemName(definition.collection.name)
          ).trim()
        : "";

  const ctx = await createSitesApiContext(definition.api);

  const {
    collectionSystem,
    collectionId,
    createCollectionInline,
    collectionStats,
  } = await resolveSiteCollectionForApi(definition, ctx);

  const templateId = await resolveSiteTemplateId(ctx, {
    templateId: definition.api?.templateId,
    templateName: definition.api?.templateName,
  });

  if (!collectionId && !createCollectionInline) {
    throw new Error(
      `[site:${definition.definitionKey}] Remote collection "${collectionSystem}" not found. ` +
        `Create it first (collection definition) or use inline collection.`,
    );
  }

  console.log(
    `[bq:definitions:generate] site "${collectionSystem}/${siteSystem}" → Sites API`,
  );

  // Sites API: `language` (default) must appear in `languages`. Always keep `en`.
  const siteLanguage = definition.api?.language?.trim() || "en";
  const siteLanguages = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (raw: string | undefined) => {
      const t = String(raw || "").trim();
      if (!t) return;
      const key = t.toLowerCase();
      const value = key === "en" || key.startsWith("en-") ? "en" : t;
      if (seen.has(value.toLowerCase())) return;
      seen.add(value.toLowerCase());
      out.push(value);
    };
    add("en");
    add(siteLanguage);
    for (const l of definition.api?.languages || []) add(l);
    return out;
  })();

  const result = await syncSiteViaApi(ctx, {
    siteName: siteSystem,
    displayName: siteName,
    description: siteDescription,
    previousSystemName,
    language: siteLanguage === "en" || siteLanguage.toLowerCase().startsWith("en-")
      ? "en"
      : siteLanguage,
    languages: siteLanguages,
    templateId,
    hostName: definition.api?.hostName,
    collectionId,
    collectionName: createCollectionInline?.name,
    collectionDisplayName: createCollectionInline?.displayName,
    collectionDescription: createCollectionInline?.description,
    brandKitId: definition.api?.brandKitId,
  });

  getActiveSitesApiOwnedLedger()?.trackSite(definition.definitionKey, {
    systemName: siteSystem,
    collectionSystem,
    id: result.site?.id?.replace(/[{}]/g, "") || undefined,
  });

  console.log(
    `[bq:definitions:generate] site "${collectionSystem}/${siteSystem}" via Sites API (${result.action})`,
  );

  const mediaFolderStats = emptyWriteStats();
  await ensureMediaFolderChain(
    {
      collectionSystem,
      siteName: siteSystem,
      folder: [],
      handle: saiHandleFrom(`media-site:${collectionSystem}/${siteSystem}`, 1),
    },
    mediaFolderStats,
  );
  console.log(
    `[bq:definitions:generate] ensured media library Project/${collectionSystem}/${siteSystem}`,
  );

  await maybeEnsureSiteThumbnailFromCaptureEnv(
    collectionSystem,
    siteSystem,
    definition.thumbnail,
  );

  return collectionStats;
}

/** Sites API–managed trees — no local YAML prune roots. */
export function getSitePruneRoots(_definition: SiteDefinition): string[] {
  return [];
}

export function emptySiteStats(): ScsWriteStats {
  return emptyWriteStats();
}
