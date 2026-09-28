'use client';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useSearch } from '@sitecore-content-sdk/nextjs/search';
import { useInfiniteSearch } from '@sitecore-content-sdk/nextjs/search';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SearchDocument, SearchExperienceProps, SearchFieldsMapping } from '@/lib/search/search-components/models';
import { SearchEmptyResults } from '@/lib/search/search-components/SearchEmptyResults';
import { SearchError } from '@/lib/search/search-components/SearchError';
import { SearchItem } from '@/lib/search/search-components/SearchItem';
import { SearchSkeletonItem } from '@/lib/search/search-components/SearchSkeletonItem';
import { SearchPagination } from '@/lib/search/search-components/SearchPagination';
import { SearchInput } from '@/lib/search/search-components/SearchInput';
import { useEvent } from '@/lib/search/search-components/useEvent';
import { useRouter } from '@/lib/search/search-components/useRouter';
import { DICTIONARY_KEYS, DEFAULT_PAGE_SIZE, gridColsClass } from '@/lib/search/search-components/constants';

// --- Helpers ---

/**
 * Build a SearchFieldsMapping from the individual datasource fields.
 * Replaces the JSON parsing from V1's useSearchField hook.
 */
const useFieldsMapping = (fields: SearchExperienceProps['fields']): {
  searchIndex: string;
  fieldsMapping: SearchFieldsMapping;
} => {
  return {
    searchIndex: fields.SearchIndex?.value ?? '',
    fieldsMapping: {
      title: fields.TitleMapping?.value || undefined,
      description: fields.DescriptionMapping?.value || undefined,
      images: fields.ImageMapping?.value || undefined,
      tags: fields.TagsMapping?.value || undefined,
      link: fields.LinkMapping?.value || undefined,
      type: fields.TypeMapping?.value || undefined,
    },
  };
};

// --- Shared layout ---

type SearchLayoutProps = {
  props: SearchExperienceProps;
  isEditing: boolean;
  isPreview: boolean;
  searchQuery: string;
  inputValue: string;
  onSearchChange: (value: string, debounced?: boolean) => void;
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  results: SearchDocument[];
  fieldsMapping: SearchFieldsMapping;
  columns: number;
  pageSize: number;
  sendEvent: (type: 'clicked' | 'viewed') => void;
  footer?: React.ReactNode;
};

const SearchLayout = ({
  props,
  isEditing,
  isPreview,
  searchQuery,
  inputValue,
  onSearchChange,
  total,
  isLoading,
  isError,
  error,
  results,
  fieldsMapping,
  columns,
  pageSize,
  sendEvent,
  footer,
}: SearchLayoutProps) => {
  const t = useTranslations();
  const variant = columns === 1 ? 'list' : 'card';

  return (
    <div
      className={cn('component search-experience-v2', props.params.styles)}
      id={props.params.RenderingIdentifier || undefined}
    >
      <div className="component-content">
        <div
          className={cn('max-w-7xl mx-auto p-6', {
            'pt-24 lg:pt-32': !isEditing,
          })}
        >
          <div className="mb-8">
            <SearchInput value={inputValue} onChange={(value) => onSearchChange(value, true)} />

            <p className="text-muted-foreground mb-6" aria-live="polite">
              {total} {t(DICTIONARY_KEYS.RESULTS_FOUND) || 'results found'}
            </p>
          </div>

          {isError && error && (
            <SearchError error={error} onTryAgain={() => onSearchChange('', false)} />
          )}

          {!isLoading && !isError && total === 0 && (
            <SearchEmptyResults
              query={searchQuery}
              onClearSearch={() => onSearchChange('', false)}
            />
          )}

          <div className={cn('grid gap-6 mb-8', gridColsClass(columns))}>
            {!isLoading &&
              results.map((result) => (
                <SearchItem
                  variant={variant}
                  key={result.sc_item_id}
                  data={result}
                  mapping={fieldsMapping}
                  onClick={() => sendEvent('clicked')}
                />
              ))}

            {(((isEditing || isPreview) && total === 0) || isLoading) &&
              Array.from({ length: pageSize }).map((_, index) => (
                <SearchSkeletonItem variant={variant} key={index} mapping={fieldsMapping} />
              ))}
          </div>

          {footer}
        </div>
      </div>
    </div>
  );
};

// --- Default variant (pagination) ---

// useSearchParams() requires a Suspense boundary for static prerendering
const DefaultContent = (props: SearchExperienceProps) => {
  const { params, fields, page, rendering } = props;
  const t = useTranslations();

  const { searchIndex, fieldsMapping } = useFieldsMapping(fields);
  const pageSize = Number(params.pageSize) || DEFAULT_PAGE_SIZE;
  const columns = Number(params.columns) || 3;
  const searchParams = useSearchParams();

  const isEditing = page?.mode?.isEditing ?? false;
  const isPreview = page?.mode?.isPreview ?? false;

  const [pageNumber, setPageNumber] = useState(() => {
    const urlPage = Number(searchParams.get('page'));
    return urlPage > 0 ? urlPage : 1;
  });
  const [inputValue, setInputValue] = useState<string>(searchParams.get('q') || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchEnabled, setSearchEnabled] = useState(false);

  const { total, totalPages, results, isLoading, isSuccess, isError, error } =
    useSearch<SearchDocument>({
      searchIndexId: searchIndex,
      page: pageNumber,
      pageSize,
      enabled: searchEnabled,
      query: searchQuery,
    });

  const { setRouterQuery, setRouterPage } = useRouter();
  const sendEvent = useEvent({ query: searchQuery, uid: rendering.uid, page });

  useEffect(() => {
    if (isSuccess) {
      sendEvent('viewed');
    }
  }, [isSuccess, sendEvent]);

  useEffect(() => {
    const routerQuery = searchParams.get('q') || '';
    const routerPage = Number(searchParams.get('page'));

    setSearchQuery(routerQuery);

    if (!routerQuery) {
      setPageNumber(1);
    } else if (routerPage > 0) {
      setPageNumber(routerPage);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isEditing || isPreview) return;
    setSearchEnabled(true);
  }, [isEditing, isPreview]);

  const onSearchChange = useCallback(
    (value: string, debounced: boolean = true) => {
      setInputValue(value);
      setPageNumber(1);

      if (isEditing || isPreview) return;

      setRouterQuery(value, debounced);
    },
    [setRouterQuery, isEditing, isPreview]
  );

  const onPageChange = useCallback(
    (newPage: number) => {
      setPageNumber(newPage);
      setRouterPage(newPage, searchQuery);
    },
    [setRouterPage, searchQuery]
  );

  return (
    <SearchLayout
      props={props}
      isEditing={isEditing}
      isPreview={isPreview}
      searchQuery={searchQuery}
      inputValue={inputValue}
      onSearchChange={onSearchChange}
      total={total}
      isLoading={isLoading}
      isError={isError}
      error={error}
      results={results}
      fieldsMapping={fieldsMapping}
      columns={columns}
      pageSize={pageSize}
      sendEvent={sendEvent}
      footer={
        !isLoading && !isError && results.length > 0 ? (
          <SearchPagination
            currentPage={pageNumber}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        ) : undefined
      }
    />
  );
};

export const Default = (props: SearchExperienceProps) => (
  <Suspense>
    <DefaultContent {...props} />
  </Suspense>
);

// --- LoadMore variant (infinite scroll) ---

const LoadMoreContent = (props: SearchExperienceProps) => {
  const { params, fields, page, rendering } = props;
  const t = useTranslations();

  const { searchIndex, fieldsMapping } = useFieldsMapping(fields);
  const pageSize = Number(params.pageSize) || DEFAULT_PAGE_SIZE;
  const columns = Number(params.columns) || 3;
  const searchParams = useSearchParams();

  const isEditing = page?.mode?.isEditing ?? false;
  const isPreview = page?.mode?.isPreview ?? false;

  const [inputValue, setInputValue] = useState<string>(searchParams.get('q') || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchEnabled, setSearchEnabled] = useState(false);

  const {
    total,
    loadMore,
    results,
    isLoading,
    isLoadingMore,
    error,
    isError,
    isSuccess,
    hasNextPage,
  } = useInfiniteSearch<SearchDocument>({
    searchIndexId: searchIndex,
    pageSize,
    enabled: searchEnabled,
    query: searchQuery,
  });

  const { setRouterQuery } = useRouter();
  const sendEvent = useEvent({ query: searchQuery, uid: rendering.uid, page });

  useEffect(() => {
    if (isSuccess) {
      sendEvent('viewed');
    }
  }, [isSuccess, sendEvent]);

  useEffect(() => {
    const routerQuery = searchParams.get('q') || '';
    setSearchQuery(routerQuery);
  }, [searchParams]);

  useEffect(() => {
    if (isEditing || isPreview) return;
    setSearchEnabled(true);
  }, [isEditing, isPreview]);

  const onSearchChange = useCallback(
    (value: string, debounced: boolean = true) => {
      setInputValue(value);

      if (isEditing || isPreview) return;

      setRouterQuery(value, debounced);
    },
    [setRouterQuery, isEditing, isPreview]
  );

  return (
    <SearchLayout
      props={props}
      isEditing={isEditing}
      isPreview={isPreview}
      searchQuery={searchQuery}
      inputValue={inputValue}
      onSearchChange={onSearchChange}
      total={total}
      isLoading={isLoading}
      isError={isError}
      error={error}
      results={results}
      fieldsMapping={fieldsMapping}
      columns={columns}
      pageSize={pageSize}
      sendEvent={sendEvent}
      footer={
        hasNextPage ? (
          <div className="flex justify-center items-center">
            <Button onClick={() => loadMore()} disabled={isLoadingMore}>
              {t(DICTIONARY_KEYS.LOAD_MORE) || 'Load more'}
            </Button>
          </div>
        ) : undefined
      }
    />
  );
};

export const LoadMore = (props: SearchExperienceProps) => (
  <Suspense>
    <LoadMoreContent {...props} />
  </Suspense>
);
