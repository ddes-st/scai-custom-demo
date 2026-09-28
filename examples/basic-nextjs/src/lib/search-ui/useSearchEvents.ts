'use client';
import { useCallback } from 'react';
import { Page } from '@sitecore-content-sdk/nextjs';
import { event } from '@sitecore-content-sdk/events';

/**
 * Sends Sitecore search analytics events (viewed / clicked) for a search
 * component instance. Silent in development, editing, and preview.
 */
export const useSearchEvents = ({
  query,
  uid,
  page,
}: {
  query: string;
  uid?: string;
  page: Page;
}) => {
  const isEditing = page?.mode?.isEditing ?? false;
  const isPreview = page?.mode?.isPreview ?? false;
  const route = page?.layout?.sitecore?.route;

  return useCallback(
    (type: 'clicked' | 'viewed') => {
      if (process.env.NODE_ENV === 'development' || isEditing || isPreview) return;

      event({
        type: 'search',
        siteId: page.siteName,
        channel: 'web',
        name: route?.name,
        language: route?.itemLanguage,
        core: {
          componentId: uid ?? '',
          interactionType: type,
          keyword: query ?? '',
          nullResults: false,
        },
      });
    },
    [route, page, uid, query, isEditing, isPreview]
  );
};
