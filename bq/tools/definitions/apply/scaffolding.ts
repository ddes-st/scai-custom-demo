import { applyAuthoringItem } from "../../shared/authoring-apply-bridge";
import path from "node:path";
import { braceGuid } from "../../shared/ids";
import {
  getScaffoldingCollectionSitecorePath,
  getScaffoldingRulesDiskDir,
} from "../../shared/data-placement";
import { pluralComponentName } from "../../shared/naming";
import type { ScsItem } from "../../shared/authoring-item-model";
import {
  emptyWriteStats,
  recordWrite,
  type ScsWriteStats
} from "../../shared/authoring-item-model";
import {
  FIELD_IDS,
  INSERT_OPTIONS_LOCATION,
  INSERT_OPTIONS_RULE,
  SCAFFOLDING_PROJECT_SETTINGS,
} from "../../shared/system-ids";
import { ensureExistingOrCreateItem } from "../../shared/ensure-existing-or-create";
import { resolveItemIdByPathWithRewrite } from "../../shared/resolve-item-id-by-path";

/** Trim whitespace on each Sitecore path segment. */
function sanitizeSitecorePath(sitecorePath: string): string {
  return sitecorePath
    .split("/")
    .map((segment) => segment.trim())
    .join("/");
}

export type ScaffoldingCollectionParent = {
  parentId: string;
  parentSitecorePath: string;
  rulesDiskDir: string;
};

/**
 * Ensure the collection scaffolding settings folder exists.
 * Creates `{collection}.yml` when missing; reuses existing ID + Path when present.
 * CM-aligns Project/{collection} root + nested settings folder before mint.
 */
export async function ensureScaffoldingCollectionParent(options: {
  collectionSystem: string;
  handle: string;
  endpointName?: string;
  lookupPath?: (sitecorePath: string) => Promise<string | undefined>;
  skipCm?: boolean;
}): Promise<ScaffoldingCollectionParent & { stats: ScsWriteStats }> {
  const { collectionSystem, handle } = options;
  const defaultSitecorePath =
    getScaffoldingCollectionSitecorePath(collectionSystem);
  const rulesDiskDir = getScaffoldingRulesDiskDir(collectionSystem);
  let stats = emptyWriteStats();

  const projectFolderSitecore = `/sitecore/system/Settings/Project/${collectionSystem}`;
  let projectFolderResolved = await resolveItemIdByPathWithRewrite({
    sitecorePath: projectFolderSitecore,
    endpointName: options.endpointName,
    lookupPath: options.lookupPath,
    skipCm: options.skipCm,
    logPrefix: "[bq:apply:scaffolding]",
  });
  if (!projectFolderResolved.found) {
    throw new Error(
      `[bq:apply:scaffolding] Project settings folder missing on CM: ${projectFolderSitecore}`,
    );
  }

  const collectionResolved = await resolveItemIdByPathWithRewrite({
    sitecorePath: defaultSitecorePath,
    endpointName: options.endpointName,
    lookupPath: options.lookupPath,
    skipCm: options.skipCm,
    logPrefix: "[bq:apply:scaffolding]",
  });

  let parentId: string;
  if (collectionResolved.found) {
    parentId = collectionResolved.id;
  } else {
    const ensured = await ensureExistingOrCreateItem({
      // Label only — Authoring apply does not read/write YAML at this path.
      yamlPath: defaultSitecorePath,
      defaultSitecorePath,
      preferDiskPathOnReuse: true,
      handle,
      idKey: `scaffolding-collection:${collectionSystem}`,
      create: () => ({
        parent: projectFolderResolved.id!,
        template: SCAFFOLDING_PROJECT_SETTINGS,
        path: defaultSitecorePath,
        sharedFields: [
          {
            id: FIELD_IDS.Sortorder,
            hint: "__Sortorder",
            value: 100,
          },
        ],
      }),
    });
    stats = ensured.stats;
    parentId = ensured.itemId;
  }

  return {
    parentId,
    parentSitecorePath: sanitizeSitecorePath(defaultSitecorePath),
    rulesDiskDir,
    stats,
  };
}

/** Emit `Add {Name}s Data Item` scaffolding insert-options rule. */
export async function applyScaffoldingInsertOptionsRule(options: {
  renderingName: string;
  folderTemplateId: string;
  handle: string;
  /** @deprecated Ignored — Authoring create assigns the live id. */
  insertOptionsId?: string;
  scaffolding: ScaffoldingCollectionParent;
}): Promise<ScsWriteStats> {
  const stats = emptyWriteStats();
  const plural = pluralComponentName(options.renderingName);
  const ruleName = `Add ${plural} Data Item`;
  const relPath = `${ruleName}.yml`;
  const filePath = path.join(options.scaffolding.rulesDiskDir, relPath);
  const sitecorePath = `${options.scaffolding.parentSitecorePath}/${ruleName}`;

  const item: ScsItem = {
    parent: options.scaffolding.parentId,
    template: INSERT_OPTIONS_RULE,
    path: sitecorePath,
    sharedFields: [
      {
        id: FIELD_IDS.InsertOptionsLocation,
        hint: "Location",
        value: INSERT_OPTIONS_LOCATION,
      },
      {
        id: FIELD_IDS.InsertOptionsName,
        hint: "Name",
        value: options.renderingName,
      },
      {
        id: FIELD_IDS.InsertOptionsTemplate,
        hint: "Template",
        value: braceGuid(options.folderTemplateId),
      },
    ],
  };

  recordWrite(stats, await applyAuthoringItem(filePath, item));
  return stats;
}
