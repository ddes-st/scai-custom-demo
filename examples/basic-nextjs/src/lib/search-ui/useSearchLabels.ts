'use client';
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { SEARCH_LABELS, SearchLabelName } from './constants';

/**
 * Guarded dictionary lookup for search UI labels. A missing Sitecore
 * Dictionary entry renders the English fallback — it never throws or logs
 * MISSING_MESSAGE. (Plain `t(key) || fallback` does NOT work with next-intl:
 * a missing key errors instead of returning something falsy.)
 */
export const useSearchLabels = () => {
  const t = useTranslations();

  return useCallback(
    (name: SearchLabelName): string => {
      const { key, fallback } = SEARCH_LABELS[name];
      return t.has(key) ? t(key) : fallback;
    },
    [t]
  );
};
