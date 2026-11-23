"use client";

/**
 * `useWildcardItem` — client hook that resolves the current URL's
 * last segment (the slug) to a Sitecore content item under a
 * configured data-folder root. This is the head-app half of the
 * Sitecore *wildcard page* pattern: a page item named `*` carries the
 * design; this hook supplies the per-URL content.
 *
 * Resolution goes through the same server-only Edge GraphQL proxy the
 * IGQL components use (`/api/sitecore/igql`) so the Edge context id
 * never ships to the browser. The proxy whitelists queries by name;
 * this hook requests `"wildcard-item"`.
 *
 * Graceful degradation (mirrors breadcrumb's curated fallback):
 *
 *   - No `sourceRoot` configured, no usable pathname, or rendering
 *     inside the showcase preview → `status: "idle"`, no fetch.
 *   - Edge not configured, network error, or no item at
 *     `<sourceRoot>/<slug>` → `status: "unavailable"`.
 *
 * In both non-resolved states `item` is `null` and `fields` is `{}` —
 * callers render their authored datasource content instead.
 */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  normalizeWildcardItem,
  type WildcardFieldMap,
  type WildcardItem,
} from "components/lib/registry/wildcard/normalize";
import type { WildcardItemResponse } from "components/lib/registry/wildcard/queries";

export type WildcardItemStatus =
  | "idle"
  | "loading"
  | "resolved"
  | "unavailable";

export interface WildcardItemState {
  status: WildcardItemStatus;
  /** The resolved content item, or `null` outside `status: "resolved"`. */
  item: WildcardItem | null;
  /**
   * The resolved item's field map (`{}` when unresolved). Convenience
   * alias for `item?.fields` so callers can destructure once.
   */
  fields: WildcardFieldMap;
}

export interface UseWildcardItemOptions {
  /**
   * Content-tree path of the data folder the slug resolves under,
   * e.g. `/sitecore/content/Acme/Home/Data/Items`. Usually authored
   * on the component's datasource (`SourceRoot` field). Empty /
   * undefined disables resolution entirely.
   */
  sourceRoot?: string;
  /** Item language for the Edge query. Defaults to `"en"`. */
  language?: string;
}

const IDLE_STATE: WildcardItemState = {
  status: "idle",
  item: null,
  fields: {},
};
const UNAVAILABLE_STATE: WildcardItemState = {
  status: "unavailable",
  item: null,
  fields: {},
};

/**
 * App-internal surfaces where a wildcard slug is meaningless — the
 * last path segment is a component or preview name, not a content
 * slug. The hook stays idle there so the showcase gallery renders the
 * authored fallback without firing doomed Edge lookups.
 */
const PREVIEW_PATH_PREFIXES = [
  "/showcase",
  "/preview",
  "/preview-iframe",
  "/page-preview-iframe",
  "/page-render",
  "/product-render",
];

/**
 * Derive the wildcard slug from a pathname: the last non-empty
 * segment, URI-decoded. Returns `undefined` for the root path or
 * anything unparseable.
 */
export function wildcardSlugFromPathname(
  pathname: string | null | undefined,
): string | undefined {
  if (!pathname) return undefined;
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return undefined;
  try {
    return decodeURIComponent(last);
  } catch {
    // Malformed percent-encoding — use the raw segment rather than
    // dropping the slug entirely.
    return last;
  }
}

const isPreviewPathname = (pathname: string): boolean =>
  PREVIEW_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export function useWildcardItem({
  sourceRoot,
  language,
}: UseWildcardItemOptions): WildcardItemState {
  const pathname = usePathname();
  const [state, setState] = useState<WildcardItemState>(IDLE_STATE);

  const trimmedRoot = sourceRoot?.trim().replace(/\/+$/, "");
  const slug =
    pathname && !isPreviewPathname(pathname)
      ? wildcardSlugFromPathname(pathname)
      : undefined;
  const itemPath = trimmedRoot && slug ? `${trimmedRoot}/${slug}` : null;
  const resolvedLanguage = language?.trim() || "en";

  useEffect(() => {
    if (!itemPath) {
      setState(IDLE_STATE);
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", item: null, fields: {} });

    (async () => {
      try {
        const response = await fetch("/api/sitecore/igql", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: "wildcard-item",
            variables: { path: itemPath, language: resolvedLanguage },
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          setState(UNAVAILABLE_STATE);
          return;
        }
        const payload = (await response.json()) as {
          data?: WildcardItemResponse | null;
        };
        const raw = payload.data?.item;
        if (!raw) {
          setState(UNAVAILABLE_STATE);
          return;
        }
        const item = normalizeWildcardItem(raw);
        setState({ status: "resolved", item, fields: item.fields });
      } catch (error) {
        if (controller.signal.aborted) return;
        // Degrade to the authored fallback; surface the cause for
        // debugging without breaking the page.
        console.warn("[useWildcardItem] resolution failed:", error);
        setState(UNAVAILABLE_STATE);
      }
    })();

    return () => controller.abort();
  }, [itemPath, resolvedLanguage]);

  return state;
}
