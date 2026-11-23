/**
 * Sort-order helpers shared by data / rendering / parameters / enum / dictionary emitters.
 */

import type { ScsField } from "./provenance";
import { FIELD_IDS } from "./system-ids";
import { readItemFieldValue } from "./authoring-items";

/**
 * When definition omits `sortOrder`, use 100-based sequence matching array order
 * (1st → 100, 2nd → 200, …). Explicit values win as-is.
 */
export function resolveSortOrder(
  explicit: number | undefined,
  index: number,
): number {
  return explicit ?? (index + 1) * 100;
}

/**
 * `__Standard Values` must sort after every sibling under the template.
 *
 * @param emptyFallbackMax — when `siblingSortOrders` is empty, treat this as the
 *   max sibling sort before adding 100. Data uses `0` (→ 100); parameters uses
 *   `100` (→ 200) to match historical emit.
 */
export function standardValuesSortOrder(
  siblingSortOrders: number[],
  emptyFallbackMax = 0,
): number {
  const max = siblingSortOrders.length
    ? Math.max(...siblingSortOrders)
    : emptyFallbackMax;
  return max + 100;
}

/**
 * When `explicit` is omitted, emit `__Sortorder` from CM if present, else
 * `(index + 1) * 100`. When `explicit` is set, return undefined — callers rely
 * on `collectStandardFields` / `pickStandardFields` for the definition value.
 */
export async function preserveOrDefaultSortOrderField(
  sitecorePath: string,
  index: number,
  explicit: number | undefined,
): Promise<ScsField | undefined> {
  if (explicit !== undefined) return undefined;

  const existingSortOrder = sitecorePath
    ? await readItemFieldValue({
        path: sitecorePath,
        fieldName: "__Sortorder",
      })
    : undefined;

  return {
    id: FIELD_IDS.Sortorder,
    hint: "__Sortorder",
    value:
      existingSortOrder !== undefined && existingSortOrder !== ""
        ? Number.isFinite(Number(existingSortOrder))
          ? Number(existingSortOrder)
          : existingSortOrder
        : (index + 1) * 100,
  };
}
