import path from "node:path";
import { applyAuthoringItem } from "../../shared/authoring-apply-bridge";
import type { ScsField } from "../../shared/provenance";
import { getScope } from "../../shared/scopes";
import {
  getSiteContentDiskRoot,
  type DataPlacementSiteContext,
} from "../../shared/data-placement";
import { resolveContentSiteContext } from "../../shared/content-site-context";
import { resolveItemIdByPath } from "../../shared/resolve-item-id-by-path";
import {
  emptyWriteStats,
  recordWrite,
  type ScsWriteStats
} from "../../shared/authoring-item-model";
import {
  FIELD_IDS,
  HEADLESS_VARIANTS_FOLDER_TEMPLATE,
  HEADLESS_VARIANTS_ROOT_ID,
  HEADLESS_VARIANT_TEMPLATE,
} from "../../shared/system-ids";
import type { VariantsDefinition } from "../types";

type CmLookupOptions = {
  endpointName?: string;
  lookupPath?: (sitecorePath: string) => Promise<string | undefined>;
  skipCm?: boolean;
};

export function getHeadlessVariantsDiskDir(): string {
  return path.join(
    getScope("site").diskRoot,
    "Presentation",
    "Headless Variants",
  );
}

export function getHeadlessVariantsSitecorePath(): string {
  return `${getScope("site").sitecorePath}/Presentation/Headless Variants`;
}

export type HeadlessVariantsPaths = {
  /** Synthetic disk-style label (path.join of segments) — not read or written. */
  diskDir: string;
  sitecorePath: string;
};

export type HeadlessVariantsRoots = HeadlessVariantsPaths & {
  /** Parent ID for component variant folders (site Headless Variants root). */
  rootId: string;
};

type HeadlessVariantsRootOptions = {
  collectionSystem?: string;
  siteSystem?: string;
  siteContext?: DataPlacementSiteContext;
};

function resolveSiteContextFromOptions(
  options?: HeadlessVariantsRootOptions,
): DataPlacementSiteContext | undefined {
  return (
    options?.siteContext ??
    (options?.collectionSystem
      ? resolveContentSiteContext(options.collectionSystem, {
          siteSystemHint: options.siteSystem,
        })
      : undefined)
  );
}

/**
 * Sync Headless Variants path labels for a site (or legacy bq-demo scope).
 * No item ids — use {@link resolveHeadlessVariantsRoots} for the CM parent id.
 */
export function resolveHeadlessVariantsPaths(
  options?: HeadlessVariantsRootOptions,
): HeadlessVariantsPaths {
  const siteContext = resolveSiteContextFromOptions(options);
  if (siteContext) {
    const siteDisk = getSiteContentDiskRoot(
      siteContext.collectionSystem,
      siteContext.siteSystem,
    );
    return {
      diskDir: path.join(siteDisk, "Presentation", "Headless Variants"),
      sitecorePath: `/sitecore/content/${siteContext.collectionSystem}/${siteContext.siteSystem}/Presentation/Headless Variants`,
    };
  }
  return {
    diskDir: getHeadlessVariantsDiskDir(),
    sitecorePath: getHeadlessVariantsSitecorePath(),
  };
}

/**
 * Resolve Headless Variants roots for a site (or legacy bq-demo scope).
 * `rootId` comes from a CM path lookup; falls back to the platform
 * {@link HEADLESS_VARIANTS_ROOT_ID} constant when the path is not found.
 */
export async function resolveHeadlessVariantsRoots(
  options?: HeadlessVariantsRootOptions & CmLookupOptions,
): Promise<HeadlessVariantsRoots> {
  const paths = resolveHeadlessVariantsPaths(options);
  const resolved = await resolveItemIdByPath({
    sitecorePath: paths.sitecorePath,
    endpointName: options?.endpointName,
    lookupPath: options?.lookupPath,
    skipCm: options?.skipCm,
    logPrefix: "[bq:apply:variants]",
  });
  return {
    ...paths,
    rootId: resolved.found ? resolved.id : HEADLESS_VARIANTS_ROOT_ID,
  };
}

/**
 * Resolve a Headless Variant item GUID for layout `FieldNames` via CM path
 * lookup (site Presentation first, then legacy scope). Returns null when the
 * variant does not exist — no minted fallback.
 */
export async function resolveHeadlessVariantId(
  options: {
    componentName: string;
    variantName: string;
    /** Site content root, e.g. `/sitecore/content/{collection}/{site}`. */
    siteSitecorePath?: string;
  } & CmLookupOptions,
): Promise<string | null> {
  const componentName = options.componentName.trim();
  const variantName = options.variantName.trim();
  if (!componentName || !variantName) return null;
  if (variantName.toLowerCase() === "default") return null;

  const candidates: string[] = [];
  const siteRoot = options.siteSitecorePath?.trim().replace(/\/+$/, "");
  if (siteRoot) {
    candidates.push(
      `${siteRoot}/Presentation/Headless Variants/${componentName}/${variantName}`,
    );
  }
  candidates.push(
    `${getHeadlessVariantsSitecorePath()}/${componentName}/${variantName}`,
  );

  for (const sitecorePath of candidates) {
    const resolved = await resolveItemIdByPath({
      sitecorePath,
      endpointName: options.endpointName,
      lookupPath: options.lookupPath,
      skipCm: options.skipCm,
      logPrefix: "[bq:apply:variants]",
    });
    if (resolved.found) return resolved.id;
  }
  return null;
}
/** Encode Sitecore rendering param `FieldNames={guid}` (URL-encoded braces). */
export function encodeFieldNamesParam(variantId: string): string {
  const bare = variantId.replace(/[{}]/g, "");
  return `FieldNames=${encodeURIComponent(`{${bare}}`)}`;
}

export type ApplyVariantsOptions = {
  /** Override handle (e.g. rendering SAI handle when emitting inline). */
  handle?: string;
  /** Fallback icon when the variants definition omits `icon`. */
  icon?: string;
  collectionSystem?: string;
  siteSystem?: string;
  siteContext?: DataPlacementSiteContext;
};

/**
 * Headless Variants YAML is only needed for multi-variant components.
 * A single export is always `Default` â€” SDK resolves it without FieldNames / YAML.
 */
export function shouldApplyHeadlessVariants(
  variants: Array<{ name: string }>,
): boolean {
  const names = variants
    .map((v) => v.name?.trim())
    .filter((n): n is string => Boolean(n));
  return names.length >= 2;
}

/**
 * Emit `{site}/Presentation/Headless Variants/{componentName}/â€¦`
 * (folder + one item per variant name).
 * Skips disk writes when the list is Default-only (single export).
 */
export async function applyVariantsDefinition(
  definition: VariantsDefinition,
  options: ApplyVariantsOptions = {},
): Promise<ScsWriteStats> {
  const stats = emptyWriteStats();
  const variants = definition.variants.filter((v) => v.name?.trim());
  if (!variants.length) {
    throw new Error(
      `variants "${definition.definitionKey}": variants must include at least one name`,
    );
  }

  if (!shouldApplyHeadlessVariants(variants)) {
    return stats;
  }

  const componentName = definition.componentName.trim();
  if (!componentName) {
    throw new Error(
      `variants "${definition.definitionKey}": componentName must be non-empty`,
    );
  }

  const icon = definition.icon?.trim() || options.icon?.trim();

  const roots = await resolveHeadlessVariantsRoots({
    collectionSystem: options.collectionSystem,
    siteSystem: options.siteSystem,
    siteContext: options.siteContext,
  });
  const diskDir = roots.diskDir;
  const sitecoreBase = roots.sitecorePath;
  const folderYaml = path.join(diskDir, `${componentName}.yml`);
  const folderSitecorePath = `${sitecoreBase}/${componentName}`;

  const folderSharedFields: ScsField[] = [];
  if (icon) {
    folderSharedFields.push({
      id: FIELD_IDS.Icon,
      hint: "__Icon",
      value: icon,
    });
  }

  const folderWrite = await applyAuthoringItem(
    folderYaml,
    {
      parent: roots.rootId,
      template: HEADLESS_VARIANTS_FOLDER_TEMPLATE,
      path: folderSitecorePath,
      sharedFields: folderSharedFields.length ? folderSharedFields : undefined,
    },
    { bqProvenance: true },
  );
  recordWrite(stats, folderWrite);
  const folderId = folderWrite.itemId;

  for (const variant of variants) {
    const name = variant.name.trim();
    const variantYaml = path.join(diskDir, componentName, `${name}.yml`);
    recordWrite(
      stats,
      await applyAuthoringItem(
        variantYaml,
        {
          parent: folderId,
          template: HEADLESS_VARIANT_TEMPLATE,
          path: `${folderSitecorePath}/${name}`,
        },
        { bqProvenance: true },
      ),
    );
  }

  return stats;
}

/**
 * Build a transient variants definition from an inline rendering/component list.
 */
export function variantsDefinitionFromInline(options: {
  definitionKey: string;
  componentName: string;
  variants: Array<{ name: string }>;
  icon?: string;
}): VariantsDefinition {
  return {
    kind: "variants",
    definitionKey: options.definitionKey,
    componentName: options.componentName,
    variants: options.variants,
    icon: options.icon,
  };
}
