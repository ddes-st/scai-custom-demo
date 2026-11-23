'use client';

import React from 'react';
import { Page, SitecoreProvider } from '@sitecore-content-sdk/nextjs';
import scConfig from 'sitecore.config';
import components from '.sitecore/component-map.client';
import { ThemeProvider } from '@/components/theme-provider/theme-provider.dev';
import { VideoProvider } from './contexts/VideoContext';
import { HomeFieldsProvider } from './contexts/HomeFieldsContext';
import type { HomeItemFields } from '@/components/hero/hero.props';

export default function Providers({
  children,
  page,
  homeFields,
}: {
  children: React.ReactNode;
  page: Page;
  homeFields?: HomeItemFields;
}) {
  return (
    <SitecoreProvider
      api={scConfig.api}
      componentMap={components}
      page={page}
      loadImportMap={() => import('.sitecore/import-map.client')}
    >
      <HomeFieldsProvider homeFields={homeFields}>
        <VideoProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </VideoProvider>
      </HomeFieldsProvider>
    </SitecoreProvider>
  );
}
