'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ImageOff, Search, X } from 'lucide-react';
import { Field } from '@sitecore-content-sdk/nextjs';
import { useSearch } from '@sitecore-content-sdk/nextjs/search';
import { ComponentProps } from '@/lib/component-props';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DEFAULT_PAGE_SIZE } from '@/lib/search-ui/constants';
import { stripHtml, formatDate, extractImageUrl } from '@/lib/search-ui/text';
import { useDebouncedValue } from '@/lib/search-ui/useDebouncedValue';
import { readUrlParam, useUrlMirror } from '@/lib/search-ui/useUrlMirror';
import { useSearchLabels } from '@/lib/search-ui/useSearchLabels';
import { useSearchEvents } from '@/lib/search-ui/useSearchEvents';

interface SearchResultsFields {
  SearchIndex?: Field<string>;
  TitleMapping?: Field<string>;
  DescriptionMapping?: Field<string>;
  ImageMapping?: Field<string>;
  LinkMapping?: Field<string>;
  DateMapping?: Field<string>;
  SortBy?: Field<string>;
}

type SortChoice = 'relevance' | 'newest' | 'oldest';

const isSortChoice = (value: string): value is SortChoice =>
  value === 'relevance' || value === 'newest' || value === 'oldest';

interface SearchResultsProps extends ComponentProps {
  fields: SearchResultsFields;
}

// Structurally matches the SDK's SearchDocument constraint (not re-exported by
// the nextjs submodule).
type SearchDoc = { [key: string]: string | number | boolean | (string | number | boolean)[] };

const docValue = (doc: SearchDoc, attribute: string | undefined): string => {
  if (!attribute) return '';
  const value = doc[attribute];
  return typeof value === 'string' ? value : '';
};

const gridClass = (columns: number): string =>
  ({ 1: 'grid-cols-1', 2: 'grid-cols-1 md:grid-cols-2' }[columns] ??
  'grid-cols-1 md:grid-cols-3');

const ResultImage = ({ src, alt }: { src: string; alt: string }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className="bg-muted relative h-44 w-full overflow-hidden rounded-t-lg">
      {!broken ? (
        <Image fill src={src} alt={alt} className="object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageOff className="size-8 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

const SkeletonCard = () => (
  <Card className="overflow-hidden" data-testid="search-skeleton">
    <div className="bg-muted h-44 w-full animate-pulse" />
    <CardContent className="space-y-3 p-5">
      <div className="bg-muted h-5 w-3/4 animate-pulse rounded" />
      <div className="bg-muted h-4 w-full animate-pulse rounded" />
      <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
    </CardContent>
  </Card>
);

const EmptyStateFallback = () => (
  <div className="component search-results">
    <span className="is-empty-hint">SearchResults</span>
  </div>
);

export const Default = (props: SearchResultsProps) => {
  const { fields, params, page, rendering } = props;
  const label = useSearchLabels();

  const isEditing = page?.mode?.isEditing ?? false;
  const isPreview = page?.mode?.isPreview ?? false;
  const live = !isEditing && !isPreview;

  const searchIndexId = fields?.SearchIndex?.value ?? '';
  const mapping = {
    title: fields?.TitleMapping?.value || undefined,
    description: fields?.DescriptionMapping?.value || undefined,
    image: fields?.ImageMapping?.value || undefined,
    link: fields?.LinkMapping?.value || undefined,
    date: fields?.DateMapping?.value || undefined,
  };

  const pageSize = Number(params?.pageSize) || DEFAULT_PAGE_SIZE;
  const columns = Number(params?.columns) || 3;

  // Local state is the source of truth; the URL is hydrated from once (mount)
  // and mirrored to write-only (useUrlMirror). No router round-trips.
  // State must start identical on server and client — reading the URL during
  // the first render is a hydration mismatch (the server cannot see ?q=), so
  // hydration happens in a post-mount effect instead.
  const [inputValue, setInputValue] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [sortChoice, setSortChoice] = useState<SortChoice>('relevance');
  const [urlSynced, setUrlSynced] = useState(false);
  const hydratedQueryRef = useRef<string | null>(null);
  const query = useDebouncedValue(inputValue);

  useEffect(() => {
    const q = readUrlParam('q');
    const fromUrl = Number(readUrlParam('page'));
    const sort = readUrlParam('sort');
    if (q) {
      hydratedQueryRef.current = q;
      setInputValue(q);
    }
    if (fromUrl > 1) setPageNumber(fromUrl);
    if (isSortChoice(sort)) setSortChoice(sort);
    setUrlSynced(true);
  }, []);

  // Reset to page 1 when the (debounced) query changes — render-phase adjust.
  // The one hydration-induced change is consumed without resetting so a deep
  // link with ?page= is preserved.
  const [prevQuery, setPrevQuery] = useState('');
  if (query !== prevQuery) {
    setPrevQuery(query);
    if (hydratedQueryRef.current !== null && query === hydratedQueryRef.current) {
      hydratedQueryRef.current = null;
    } else {
      setPageNumber(1);
    }
  }

  // Mirror only after the URL has been read — otherwise the first effect pass
  // would strip ?q=/?page= before hydration applies them.
  useUrlMirror(
    live && urlSynced
      ? {
          q: query,
          page: pageNumber > 1 ? String(pageNumber) : '',
          sort: sortChoice !== 'relevance' ? sortChoice : '',
        }
      : null
  );

  // Visitor-facing sort over the authorable SortBy attribute. Stable identity
  // is load-bearing: useSearch re-runs when `sort` changes and an inline
  // object literal changes every render (= infinite fetch loop).
  const sortBy = fields?.SortBy?.value || '';
  const sort = useMemo(
    () =>
      sortBy && sortChoice !== 'relevance'
        ? ({ name: sortBy, order: sortChoice === 'newest' ? 'desc' : 'asc' } as const)
        : undefined,
    [sortBy, sortChoice]
  );

  const { total, totalPages, results, isLoading, isSuccess, isError, error } =
    useSearch<SearchDoc>({
      searchIndexId,
      page: pageNumber,
      pageSize,
      sort,
      enabled: live && !!searchIndexId,
      query,
    });

  const sendEvent = useSearchEvents({ query, uid: rendering?.uid, page });

  useEffect(() => {
    if (isSuccess) sendEvent('viewed');
  }, [isSuccess, sendEvent]);

  if (!fields || !searchIndexId) {
    return isEditing ? <EmptyStateFallback /> : null;
  }

  const showSkeletons = isLoading || ((isEditing || isPreview) && results.length === 0);
  const showEmpty = live && !isLoading && !isError && total === 0;

  return (
    <section
      className={cn('component search-results', params?.styles)}
      id={params?.RenderingIdentifier || undefined}
    >
      <div className="mx-auto max-w-7xl p-6">
        <div role="search" className="relative mb-2">
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={label('SEARCH_INPUT_PLACEHOLDER')}
            aria-label={label('SEARCH_INPUT_PLACEHOLDER')}
            className="w-full py-3 pl-11 pr-10"
          />
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-5 -translate-y-1/2" />
          {inputValue && (
            <button
              type="button"
              onClick={() => setInputValue('')}
              aria-label={label('CLEAR_SEARCH')}
              className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <div className="mb-6 flex items-center justify-between gap-4">
          <p className="text-muted-foreground" aria-live="polite">
            {total} {label('RESULTS_FOUND')}
          </p>
          {sortBy && (
            <label className="text-muted-foreground flex items-center gap-2 text-sm">
              {label('SORT_BY')}
              <select
                value={sortChoice}
                onChange={(e) => {
                  if (!isSortChoice(e.target.value)) return;
                  setSortChoice(e.target.value);
                  setPageNumber(1);
                }}
                className="border-input bg-background text-foreground focus-visible:ring-ring h-9 rounded-md border px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
              >
                <option value="relevance">{label('SORT_RELEVANCE')}</option>
                <option value="newest">{label('SORT_NEWEST')}</option>
                <option value="oldest">{label('SORT_OLDEST')}</option>
              </select>
            </label>
          )}
        </div>

        {isError && (
          <div className="py-12 text-center" role="alert">
            <p className="text-foreground mb-1 font-medium">{label('SOMETHING_WENT_WRONG')}</p>
            {error?.message && (
              <p className="text-muted-foreground mb-4 text-sm">{error.message}</p>
            )}
            <Button variant="outline" onClick={() => setInputValue('')}>
              {label('TRY_AGAIN')}
            </Button>
          </div>
        )}

        {showEmpty && (
          <div className="py-12 text-center">
            <p className="text-foreground mb-1 font-medium">{label('NO_RESULTS_FOUND')}</p>
            <p className="text-muted-foreground mb-4 text-sm">
              {label('TRY_ADJUSTING_YOUR_SEARCH')}
            </p>
            {query && (
              <Button variant="outline" onClick={() => setInputValue('')}>
                {label('CLEAR_SEARCH')}
              </Button>
            )}
          </div>
        )}

        <div className={cn('mb-8 grid gap-6', gridClass(columns))}>
          {showSkeletons &&
            Array.from({ length: pageSize }).map((_, i) => <SkeletonCard key={i} />)}

          {!isLoading &&
            results.map((doc) => {
              const title = docValue(doc, mapping.title);
              const description = docValue(doc, mapping.description);
              const image = extractImageUrl(mapping.image ? doc[mapping.image] : '');
              const link = docValue(doc, mapping.link);
              const date = formatDate(docValue(doc, mapping.date) || undefined);

              return (
                <Card key={docValue(doc, 'sc_item_id') || title} className="overflow-hidden">
                  {image && <ResultImage src={image} alt={title} />}
                  <CardContent className="p-5">
                    {date && <p className="text-muted-foreground mb-2 text-sm">{date}</p>}
                    {title && (
                      <h3 className="text-foreground mb-2 line-clamp-2 text-lg font-semibold">
                        {title}
                      </h3>
                    )}
                    {description && (
                      <p className="text-muted-foreground mb-3 line-clamp-3">
                        {stripHtml(description)}
                      </p>
                    )}
                    {link && (
                      <a
                        href={link}
                        onClick={() => sendEvent('clicked')}
                        className="text-primary hover:text-primary/80 font-medium"
                      >
                        {label('READ_MORE')}
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>

        {live && !isLoading && !isError && totalPages > 1 && (
          <nav className="flex items-center justify-center gap-4" aria-label="Search pagination">
            <Button
              variant="outline"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber(pageNumber - 1)}
            >
              {label('PREVIOUS_PAGE')}
            </Button>
            <span className="text-muted-foreground text-sm">
              {pageNumber} / {totalPages}
            </span>
            <Button
              variant="outline"
              disabled={pageNumber >= totalPages}
              onClick={() => setPageNumber(pageNumber + 1)}
            >
              {label('NEXT_PAGE')}
            </Button>
          </nav>
        )}
      </div>
    </section>
  );
};
