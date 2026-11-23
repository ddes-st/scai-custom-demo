'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchWildcardChildren } from './fetch-wildcard-children';
import {
  normalizeWildcardItem,
  type WildcardFieldMap,
  type WildcardItem,
} from './normalize';
import type { WildcardItemResponse } from './queries';

export type WildcardItemStatus = 'idle' | 'loading' | 'resolved' | 'unavailable';

export interface WildcardItemState {
  status: WildcardItemStatus;
  item: WildcardItem | null;
  fields: WildcardFieldMap;
}

export interface UseWildcardItemOptions {
  sourceRoot?: string;
  language?: string;
}

const IDLE_STATE: WildcardItemState = {
  status: 'idle',
  item: null,
  fields: {},
};
const UNAVAILABLE_STATE: WildcardItemState = {
  status: 'unavailable',
  item: null,
  fields: {},
};

const PREVIEW_PATH_PREFIXES = [
  '/showcase',
  '/preview',
  '/preview-iframe',
  '/page-preview-iframe',
  '/page-render',
  '/product-render',
];

const LOCALE_SEGMENTS = new Set(['en', 'nl-be', 'fr-be', 'nl', 'fr']);

export function wildcardSlugFromPathname(pathname: string | null | undefined): string | undefined {
  if (!pathname) return undefined;
  const segments = pathname.split('/').filter(Boolean);
  // Drop leading locale when present (public routes: /en/products/... or /nl-BE/...)
  if (segments.length && LOCALE_SEGMENTS.has(segments[0]!.toLowerCase())) {
    segments.shift();
  }
  const last = segments[segments.length - 1];
  if (!last || last === '*') return undefined;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

const isPreviewPathname = (pathname: string): boolean =>
  PREVIEW_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

async function fetchIgqlItem(
  path: string,
  language: string,
  signal: AbortSignal,
): Promise<WildcardItemResponse | null> {
  const response = await fetch('/api/sitecore/igql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'wildcard-item',
      variables: { path, language },
    }),
    signal,
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    data?: WildcardItemResponse | null;
    errors?: unknown;
  };
  if (payload.errors) {
    console.warn('[useWildcardItem] GraphQL errors:', payload.errors);
    return null;
  }
  return payload.data ?? null;
}

export function useWildcardItem({ sourceRoot, language }: UseWildcardItemOptions): WildcardItemState {
  const pathname = usePathname();
  const [state, setState] = useState<WildcardItemState>(IDLE_STATE);

  const trimmedRoot = sourceRoot?.trim().replace(/\/+$/, '');
  const slug =
    pathname && !isPreviewPathname(pathname) ? wildcardSlugFromPathname(pathname) : undefined;
  const itemPath = trimmedRoot && slug ? `${trimmedRoot}/${slug}` : null;
  const resolvedLanguage = language?.trim() || 'en';

  useEffect(() => {
    if (!itemPath) {
      setState(IDLE_STATE);
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading', item: null, fields: {} });

    (async () => {
      try {
        const itemData = await fetchIgqlItem(itemPath, resolvedLanguage, controller.signal);
        const raw = itemData?.item;
        if (!raw) {
          setState(UNAVAILABLE_STATE);
          return;
        }

        const item = normalizeWildcardItem(raw);
        const children = await fetchWildcardChildren({
          path: itemPath,
          language: resolvedLanguage,
          signal: controller.signal,
        });
        if (children.length) {
          item.children = children;
        }

        if (controller.signal.aborted) return;
        setState({ status: 'resolved', item, fields: item.fields });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn('[useWildcardItem] resolution failed:', error);
        setState(UNAVAILABLE_STATE);
      }
    })();

    return () => controller.abort();
  }, [itemPath, resolvedLanguage]);

  return state;
}
