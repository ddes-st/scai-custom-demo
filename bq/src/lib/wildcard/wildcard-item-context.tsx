'use client';

import { createContext, type ReactNode, useContext } from 'react';
import type { WildcardItemState } from './use-wildcard-item';

const WildcardItemContext = createContext<WildcardItemState | null>(null);

export interface WildcardItemProviderProps {
  state: WildcardItemState;
  children: ReactNode;
}

export function WildcardItemProvider({ state, children }: WildcardItemProviderProps) {
  return <WildcardItemContext.Provider value={state}>{children}</WildcardItemContext.Provider>;
}

export function useWildcardItemContext(): WildcardItemState | null {
  return useContext(WildcardItemContext);
}
