/**
 * Bridge: Authoring-first apply. Appliers build ScsItem trees; this persists via GraphQL.
 * No YAML read/write.
 */
import {
  ensureAuthoringItemFromScs,
  type AuthoringApplyItemOptions,
  type AuthoringApplyItemResult,
} from "./authoring-apply-item";
import {
  emptyWriteStats,
  recordWrite,
  type ScsItem,
  type ScsWriteStats,
} from "./authoring-item-model";
import {
  inferApplyInventoryKind,
  leafNameFromSitecorePath,
  recordActiveInventoryEntry,
} from "./apply-inventory";

export type { AuthoringApplyItemResult };

let defaultApplyOptions: AuthoringApplyItemOptions = {};

export function setAuthoringApplyOptions(options: AuthoringApplyItemOptions): void {
  defaultApplyOptions = { ...options };
}

export function getAuthoringApplyOptions(): AuthoringApplyItemOptions {
  return { ...defaultApplyOptions };
}

/**
 * Record a successful Authoring ensure into the active apply-inventory session.
 * @param {AuthoringApplyItemResult} result
 * @param {string} [diskPathOrLabel]
 */
function recordInventoryFromApply(
  result: AuthoringApplyItemResult,
  diskPathOrLabel?: string,
): void {
  const sitecorePath = String(result.path || "").trim();
  const itemId = String(result.itemId || "").trim();
  if (!sitecorePath || !itemId) return;
  const diskHint = String(diskPathOrLabel || "").trim();
  recordActiveInventoryEntry({
    id: itemId,
    path: sitecorePath,
    ...(diskHint && (diskHint.includes("/") || diskHint.includes("\\"))
      ? { diskPath: diskHint }
      : {}),
    kind: inferApplyInventoryKind(sitecorePath),
    leafName: leafNameFromSitecorePath(sitecorePath),
  });
}

/**
 * Apply ScsItem to CM. Optional first-arg label is for logging only (not a file path).
 * Returns live CM `itemId` from create/find for subsequent parent/template use.
 */
export async function applyAuthoringItem(
  item: ScsItem,
  options?: AuthoringApplyItemOptions,
): Promise<AuthoringApplyItemResult>;
export async function applyAuthoringItem(
  label: string,
  item: ScsItem,
  options?: AuthoringApplyItemOptions,
): Promise<AuthoringApplyItemResult>;
export async function applyAuthoringItem(
  labelOrItem: string | ScsItem,
  itemOrOptions?: ScsItem | AuthoringApplyItemOptions,
  options?: AuthoringApplyItemOptions,
): Promise<AuthoringApplyItemResult> {
  if (typeof labelOrItem === "string") {
    const result = await ensureAuthoringItemFromScs(itemOrOptions as ScsItem, {
      ...defaultApplyOptions,
      ...options,
    });
    recordInventoryFromApply(result, labelOrItem);
    return result;
  }
  const result = await ensureAuthoringItemFromScs(labelOrItem, {
    ...defaultApplyOptions,
    ...(itemOrOptions as AuthoringApplyItemOptions | undefined),
  });
  recordInventoryFromApply(result);
  return result;
}

export async function recordAuthoringApply(
  stats: ScsWriteStats,
  item: ScsItem,
  options?: AuthoringApplyItemOptions,
): Promise<AuthoringApplyItemResult>;
export async function recordAuthoringApply(
  stats: ScsWriteStats,
  label: string,
  item: ScsItem,
  options?: AuthoringApplyItemOptions,
): Promise<AuthoringApplyItemResult>;
export async function recordAuthoringApply(
  stats: ScsWriteStats,
  labelOrItem: string | ScsItem,
  itemOrOptions?: ScsItem | AuthoringApplyItemOptions,
  options?: AuthoringApplyItemOptions,
): Promise<AuthoringApplyItemResult> {
  const result =
    typeof labelOrItem === "string"
      ? await applyAuthoringItem(
          labelOrItem,
          itemOrOptions as ScsItem,
          options,
        )
      : await applyAuthoringItem(
          labelOrItem,
          itemOrOptions as AuthoringApplyItemOptions | undefined,
        );
  recordWrite(stats, result);
  return result;
}

export { emptyWriteStats };
