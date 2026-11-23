"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { WildcardItemState } from "components/lib/registry/wildcard/use-wildcard-item";

/**
 * React context exposing the resolved wildcard item to descendant
 * renderings. The `wildcard-experience@1` wrapper is the only
 * producer: it resolves `<SourceRoot>/<slug>` ONCE via
 * `useWildcardItem` and provides the whole {@link WildcardItemState}
 * (status + item + field map) here, so any component composed inside
 * its `wildcard-content-{*}` placeholder can bind resolved fields
 * without firing its own Edge lookup.
 *
 * Consumers are not written by hand per component — the generic
 * consumer lives at the `withSitecore` seam: when a rendering carries
 * a `WildcardBindings` rendering param (a JSON map of prop name →
 * resolved field name) AND this context holds a resolved item, the
 * adapter overlays the mapped resolved fields onto the final props
 * (see `applyWildcardBindings` in ./bindings.ts).
 *
 * Mirrors `search-controller-context.tsx`: provider-optional — when no
 * provider is mounted (every non-wildcard page, the showcase preview,
 * editing mode) `useWildcardItemContext` returns `null` and the
 * mechanism is inert; authored datasource content renders unchanged.
 */
const WildcardItemContext = createContext<WildcardItemState | null>(null);

export interface WildcardItemProviderProps {
  state: WildcardItemState;
  children: ReactNode;
}

export function WildcardItemProvider({
  state,
  children,
}: WildcardItemProviderProps) {
  return (
    <WildcardItemContext.Provider value={state}>
      {children}
    </WildcardItemContext.Provider>
  );
}

/**
 * Returns the ambient wildcard-item state if a parent
 * `WildcardItemProvider` is mounted, or `null` otherwise. Client-only
 * (this module is `"use client"`): inside a react-server render this
 * export is a client reference and cannot be invoked — callers that
 * may render on the server must guard the call (see the `withSitecore`
 * adapter seam).
 */
export function useWildcardItemContext(): WildcardItemState | null {
  return useContext(WildcardItemContext);
}
