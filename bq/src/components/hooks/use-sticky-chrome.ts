'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefCallback,
} from 'react';
import {
  computeStickyChromeInsets,
  stickyChromeStyle,
  type StickyChromeEdge,
} from './sticky-chrome-stack';

export type { StickyChromeEdge };
export { computeStickyChromeInsets, stickyChromeStyle } from './sticky-chrome-stack';

const ATTR_EDGE = 'data-bq-sticky-edge';
const ATTR_ID = 'data-bq-sticky-layer';
const ATTR_HIDDEN = 'data-bq-sticky-hidden';
const CSS_TOTAL_TOP = '--bq-sticky-stack-top-total';
const CSS_TOTAL_BOTTOM = '--bq-sticky-stack-bottom-total';

interface RegistryEntry {
  id: string;
  edge: StickyChromeEdge;
  el: HTMLElement;
  height: number;
  hidden: boolean;
}

type Listener = () => void;

const registry = new Map<string, RegistryEntry>();
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function documentOrderOf(el: HTMLElement): number {
  const all = document.querySelectorAll(`[${ATTR_EDGE}]`);
  let i = 0;
  for (const node of all) {
    if (node === el) return i;
    i += 1;
  }
  return Number.MAX_SAFE_INTEGER;
}

function contribution(entry: RegistryEntry): number {
  if (entry.hidden) return 0;
  return entry.height > 0 ? entry.height : 0;
}

function recomputeAndPublish(): Map<string, number> {
  const byEdge: Record<StickyChromeEdge, RegistryEntry[]> = {
    top: [],
    bottom: [],
  };
  for (const entry of registry.values()) {
    byEdge[entry.edge].push(entry);
  }

  const allInsets = new Map<string, number>();

  for (const edge of ['top', 'bottom'] as StickyChromeEdge[]) {
    const layers = byEdge[edge].map((e) => ({
      id: e.id,
      height: contribution(e),
      documentOrder: documentOrderOf(e.el),
    }));
    const insets = computeStickyChromeInsets(layers);
    for (const [id, inset] of insets) {
      allInsets.set(id, inset);
    }

    const total = layers.reduce((sum, l) => sum + (l.height > 0 ? l.height : 0), 0);
    const varName = edge === 'top' ? CSS_TOTAL_TOP : CSS_TOTAL_BOTTOM;
    document.documentElement.style.setProperty(varName, `${total}px`);
  }

  return allInsets;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function upsertEntry(entry: RegistryEntry): void {
  registry.set(entry.id, entry);
  recomputeAndPublish();
  notify();
}

function removeEntry(id: string): void {
  if (!registry.has(id)) return;
  registry.delete(id);
  recomputeAndPublish();
  notify();
}

function readInset(id: string, fallback: number): number {
  const insets = recomputeAndPublish();
  if (insets.has(id)) return insets.get(id) ?? fallback;
  return fallback;
}

export interface UseStickyChromeLayerOptions {
  edge: StickyChromeEdge;
  /** When true, this layer contributes 0 height to the stack. */
  hidden?: boolean;
  /**
   * SSR / first-paint inset when no preceding publishers have registered yet.
   * Consumers with a resting stickyTopPx should pass that value.
   */
  fallbackInsetPx?: number;
}

export interface UseStickyChromeLayerResult {
  ref: RefCallback<HTMLElement | null>;
  /** Inset from the pinned edge (sum of preceding same-edge layers). */
  inset: number;
  /** `{ top }` or `{ bottom }` ready for a fixed/sticky shell. */
  style: CSSProperties;
}

/**
 * Register a sticky/fixed chrome band on a shared edge stack.
 * Document order determines stacking; hide/dismiss by setting `hidden`.
 *
 * @param options - Edge, hidden flag, optional fallback inset.
 */
export function useStickyChromeLayer(
  options: UseStickyChromeLayerOptions,
): UseStickyChromeLayerResult {
  const { edge, hidden = false, fallbackInsetPx = 0 } = options;
  const reactId = useId();
  const id = `bq-sticky-${reactId.replace(/:/g, '')}`;
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [inset, setInset] = useState(fallbackInsetPx);

  const ref = useCallback<RefCallback<HTMLElement | null>>(
    (node) => {
      setEl(node);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!el) return;

    el.setAttribute(ATTR_EDGE, edge);
    el.setAttribute(ATTR_ID, id);
    if (hidden) {
      el.setAttribute(ATTR_HIDDEN, 'true');
    } else {
      el.removeAttribute(ATTR_HIDDEN);
    }

    const measure = () => {
      const height = hidden ? 0 : Math.round(el.getBoundingClientRect().height);
      upsertEntry({ id, edge, el, height, hidden });
      setInset(readInset(id, fallbackInsetPx));
    };

    measure();

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(el);

    const unsubscribe = subscribe(() => {
      setInset(readInset(id, fallbackInsetPx));
    });

    return () => {
      ro.disconnect();
      unsubscribe();
      removeEntry(id);
      el.removeAttribute(ATTR_EDGE);
      el.removeAttribute(ATTR_ID);
      el.removeAttribute(ATTR_HIDDEN);
    };
  }, [el, edge, hidden, id, fallbackInsetPx]);

  useEffect(() => {
    if (!el) return;
    if (hidden) {
      el.setAttribute(ATTR_HIDDEN, 'true');
    } else {
      el.removeAttribute(ATTR_HIDDEN);
    }
    const height = hidden ? 0 : Math.round(el.getBoundingClientRect().height);
    upsertEntry({ id, edge, el, height, hidden });
    setInset(readInset(id, fallbackInsetPx));
  }, [hidden, el, edge, id, fallbackInsetPx]);

  const pin = stickyChromeStyle(edge, inset);
  const style: CSSProperties = {
    ...pin,
    transitionProperty: edge === 'bottom' ? 'bottom' : 'top',
    transitionDuration: '300ms',
    transitionTimingFunction: 'ease',
  };

  return { ref, inset, style };
}

/**
 * Read the inset for a sticky shell that sits after other same-edge layers.
 * Alias of {@link useStickyChromeLayer} — consumers also register so later
 * bands can stack on top of them.
 *
 * @param edge - Pinned edge.
 * @param fallbackInsetPx - Resting inset from capture (`stickyTopPx`) when alone.
 */
export function useStickyChromeInset(
  edge: StickyChromeEdge,
  fallbackInsetPx = 0,
): UseStickyChromeLayerResult {
  return useStickyChromeLayer({ edge, hidden: false, fallbackInsetPx });
}
