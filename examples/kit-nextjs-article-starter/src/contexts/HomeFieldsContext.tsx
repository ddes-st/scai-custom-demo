'use client';

import type React from 'react';
import { createContext, useContext } from 'react';
import type { HomeItemFields } from '@/components/hero/hero.props';

const HomeFieldsContext = createContext<HomeItemFields | undefined>(undefined);

export function HomeFieldsProvider({
  children,
  homeFields,
}: {
  children: React.ReactNode;
  homeFields?: HomeItemFields;
}) {
  return (
    <HomeFieldsContext.Provider value={homeFields ?? {}}>
      {children}
    </HomeFieldsContext.Provider>
  );
}

/** Home route fields fetched on the server and passed into the client tree. */
export function useHomeFields(): HomeItemFields {
  return useContext(HomeFieldsContext) ?? {};
}
