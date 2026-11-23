/**
 * Pure sticky-chrome stack math (DOM-order insets).
 * Used by the React hook and unit tests.
 */

export type StickyChromeEdge = 'top' | 'bottom';

export interface StickyChromeLayerInput {
  id: string;
  /** Visible contribution in px; use 0 when hidden/dismissed. */
  height: number;
  /** Ascending document order (smaller = earlier in the tree). */
  documentOrder: number;
}

/**
 * For each layer, inset = sum of heights of earlier same-edge layers.
 *
 * @param layers - Layers on one edge (already filtered).
 * @returns Map of layer id → inset px from the pinned edge.
 */
export function computeStickyChromeInsets(
  layers: StickyChromeLayerInput[],
): Map<string, number> {
  const sorted = [...layers].sort((a, b) => {
    if (a.documentOrder !== b.documentOrder) {
      return a.documentOrder - b.documentOrder;
    }
    return a.id.localeCompare(b.id);
  });

  const insets = new Map<string, number>();
  let running = 0;
  for (const layer of sorted) {
    insets.set(layer.id, running);
    const h = Number.isFinite(layer.height) && layer.height > 0 ? layer.height : 0;
    running += h;
  }
  return insets;
}

/**
 * Build a CSSProperties-like pin object for a fixed/sticky shell.
 *
 * @param edge - Pinned edge.
 * @param insetPx - Offset from that edge.
 */
export function stickyChromeStyle(
  edge: StickyChromeEdge,
  insetPx: number,
): { top: number } | { bottom: number } {
  const px = Number.isFinite(insetPx) && insetPx > 0 ? insetPx : 0;
  return edge === 'bottom' ? { bottom: px } : { top: px };
}
