import type { ScsField } from "./provenance";
import { applyAuthoringItem } from "./authoring-apply-bridge";
import {
  emptyWriteStats,
  recordWrite,
  type ScsWriteStats,
} from "./authoring-item-model";
import { proposeValidSitecorePath } from "./naming";

/** Sanitize Sitecore path segments to valid item names. */
function sanitizeSitecorePath(sitecorePath: string): string {
  return proposeValidSitecorePath(sitecorePath);
}

export type EnsureExistingOrCreateResult = {
  itemId: string;
  itemSitecorePath: string;
  created: boolean;
  stats: ScsWriteStats;
};

export type EnsureExistingOrCreateOptions = {
  /** Sitecore path used when creating / ensuring via Authoring. */
  defaultSitecorePath: string;
  /**
   * @deprecated Ignored — Authoring create/find is the only identity source.
   * Accepted for call-site compat during migration.
   */
  yamlPath?: string;
  /**
   * @deprecated Ignored.
   */
  preferDiskPathOnReuse?: boolean;
  /** @deprecated Unused — kept for call-site compat. */
  handle?: string;
  /** @deprecated Unused — kept for call-site compat. */
  idKey?: string;
  create: () => {
    parent: string;
    template: string;
    path: string;
    sharedFields?: ScsField[];
  };
};

/**
 * Ensure a parent/folder item exists on CM via Authoring.
 * Live `itemId` comes from create/find (and the in-run path cache) only.
 */
export async function ensureExistingOrCreateItem(
  options: EnsureExistingOrCreateOptions,
): Promise<EnsureExistingOrCreateResult> {
  const stats = emptyWriteStats();
  const created = options.create();
  const itemSitecorePath = sanitizeSitecorePath(created.path);

  const applied = await applyAuthoringItem(itemSitecorePath, {
    parent: created.parent,
    template: created.template,
    path: itemSitecorePath,
    sharedFields: created.sharedFields,
  });
  recordWrite(stats, applied);

  return {
    itemId: applied.itemId,
    itemSitecorePath,
    created: applied.created,
    stats,
  };
}
