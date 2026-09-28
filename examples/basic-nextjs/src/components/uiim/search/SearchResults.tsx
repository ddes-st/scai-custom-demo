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
import { stripHtml, formatDate, formatDateLong, extractImageUrl } from '@/lib/search-ui/text';
import { isSodexoHelpPage, isSodexoSearchResultsPage } from '@/lib/sodexo-page';
import { navigateTo } from '@/lib/search-ui/navigate';
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

  if (isSodexoHelpPage(page) && searchIndexId) {
    return (
      <SodexoHelpLayout
        params={params}
        inputValue={inputValue}
        setInputValue={setInputValue}
        mapping={mapping}
        results={results}
        live={live}
        sendEvent={sendEvent}
        label={label}
      />
    );
  }

  if (isSodexoSearchResultsPage(page) && searchIndexId) {
    return (
      <SodexoSearchLayout
        fields={fields}
        params={params}
        inputValue={inputValue}
        setInputValue={setInputValue}
        pageNumber={pageNumber}
        setPageNumber={setPageNumber}
        query={query}
        mapping={mapping}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        results={results}
        isLoading={isLoading}
        isError={isError}
        error={error}
        showSkeletons={showSkeletons}
        showEmpty={showEmpty}
        live={live}
        sendEvent={sendEvent}
        label={label}
      />
    );
  }

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

export const SodexoSearch = Default;

const SodexoResultImage = ({ src, alt }: { src: string; alt: string }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative h-28 w-40 shrink-0 overflow-hidden rounded-md sm:h-32 sm:w-48">
      {!broken ? (
        <Image fill src={src} alt={alt} className="object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="bg-muted flex h-full w-full items-center justify-center">
          <ImageOff className="size-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

const SodexoSearchLayout = ({
  params,
  inputValue,
  setInputValue,
  pageNumber,
  setPageNumber,
  query,
  mapping,
  pageSize,
  total,
  totalPages,
  results,
  isLoading,
  isError,
  error,
  showSkeletons,
  showEmpty,
  live,
  sendEvent,
  label,
}: {
  fields: SearchResultsFields;
  params: SearchResultsProps['params'];
  inputValue: string;
  setInputValue: (value: string) => void;
  pageNumber: number;
  setPageNumber: (value: number) => void;
  query: string;
  mapping: { title?: string; description?: string; image?: string; link?: string; date?: string };
  pageSize: number;
  total: number;
  totalPages: number;
  results: SearchDoc[];
  isLoading: boolean;
  isError: boolean;
  error?: { message?: string } | null;
  showSkeletons: boolean;
  showEmpty: boolean;
  live: boolean;
  sendEvent: (name: 'viewed' | 'clicked') => void;
  label: (name: 'RESULTS_FOUND' | 'NO_RESULTS_FOUND' | 'TRY_ADJUSTING_YOUR_SEARCH' | 'CLEAR_SEARCH' | 'SOMETHING_WENT_WRONG' | 'TRY_AGAIN' | 'SEARCH_INPUT_PLACEHOLDER' | 'LEARN_MORE' | 'BACK_TO_PREVIOUS') => string;
}) => {
  const brandFg = 'var(--brand-fg, #2a295c)';
  const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
  const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1);

  return (
    <section
      className={cn('component search-results', params?.styles)}
      id={params?.RenderingIdentifier || undefined}
      style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
    >
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <a
          href="/Search"
          className="mb-8 inline-flex items-center gap-2 text-sm"
          style={{ color: brandFg, fontFamily: bodyFont }}
        >
          <span aria-hidden>‹</span>
          {label('BACK_TO_PREVIOUS')}
        </a>

        <form
          role="search"
          className="relative mb-10"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={label('SEARCH_INPUT_PLACEHOLDER')}
            aria-label={label('SEARCH_INPUT_PLACEHOLDER')}
            className="h-14 w-full rounded-md border py-3 pl-12 pr-28 text-base shadow-none"
            style={{
              borderColor: 'var(--brand-border, #d4d4e8)',
              color: brandFg,
              fontFamily: bodyFont,
            }}
          />
          <Search className="text-muted-foreground absolute left-4 top-1/2 size-5 -translate-y-1/2" />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 inline-flex h-11 -translate-y-1/2 items-center gap-2 rounded-md px-4 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-primary, #283897)' }}
          >
            Search
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </form>

        <h2
          className="mb-8 text-3xl font-bold"
          style={{ color: brandFg, fontFamily: headingFont }}
          aria-live="polite"
        >
          {total} results
        </h2>

        {isError && (
          <div className="py-12 text-center" role="alert">
            <p className="mb-1 font-medium" style={{ color: brandFg }}>
              {label('SOMETHING_WENT_WRONG')}
            </p>
            {error?.message && <p className="text-muted-foreground mb-4 text-sm">{error.message}</p>}
            <Button variant="outline" onClick={() => setInputValue('')}>
              {label('TRY_AGAIN')}
            </Button>
          </div>
        )}

        {showEmpty && (
          <div className="py-12 text-center">
            <p className="mb-1 font-medium" style={{ color: brandFg }}>
              {label('NO_RESULTS_FOUND')}
            </p>
            <p className="text-muted-foreground mb-4 text-sm">{label('TRY_ADJUSTING_YOUR_SEARCH')}</p>
            {query && (
              <Button variant="outline" onClick={() => setInputValue('')}>
                {label('CLEAR_SEARCH')}
              </Button>
            )}
          </div>
        )}

        <div className="mb-10">
          {showSkeletons &&
            Array.from({ length: pageSize }).map((_, i) => (
              <div key={i} className="flex gap-6 border-b py-8" data-testid="search-skeleton">
                <div className="flex-1 space-y-3">
                  <div className="bg-muted h-4 w-1/3 animate-pulse rounded" />
                  <div className="bg-muted h-6 w-3/4 animate-pulse rounded" />
                  <div className="bg-muted h-4 w-full animate-pulse rounded" />
                </div>
                <div className="bg-muted h-28 w-40 animate-pulse rounded" />
              </div>
            ))}

          {!isLoading &&
            results.map((doc, index) => {
              const title = docValue(doc, mapping.title);
              const description = docValue(doc, mapping.description);
              const image = extractImageUrl(mapping.image ? doc[mapping.image] : '');
              const link = docValue(doc, mapping.link);
              const date = formatDateLong(docValue(doc, mapping.date) || undefined);
              const Wrapper = link ? 'a' : 'article';

              return (
                <Wrapper
                  key={docValue(doc, 'sc_item_id') || title}
                  href={link || undefined}
                  onClick={link ? () => sendEvent('clicked') : undefined}
                  className="flex flex-col gap-6 border-b py-8 no-underline sm:flex-row sm:items-start sm:justify-between"
                  style={{
                    backgroundColor: index % 2 === 1 ? 'var(--brand-surface, #f4f6fb)' : 'transparent',
                    borderColor: 'var(--brand-border, #e0dff0)',
                  }}
                >
                  <div className="min-w-0 flex-1 px-0 sm:px-2">
                    {date && (
                      <p className="mb-2 text-sm" style={{ color: brandFg, fontFamily: bodyFont }}>
                        {date}
                      </p>
                    )}
                    {title && (
                      <h3 className="mb-2 text-xl font-semibold" style={{ color: brandFg, fontFamily: headingFont }}>
                        {title}
                      </h3>
                    )}
                    {description && (
                      <p className="mb-4 line-clamp-3 text-sm leading-relaxed" style={{ color: brandFg, fontFamily: bodyFont }}>
                        {stripHtml(description)}
                      </p>
                    )}
                    <span
                      className="inline-flex items-center gap-2 text-sm font-medium"
                      style={{ color: brandFg, fontFamily: bodyFont }}
                    >
                      {label('LEARN_MORE')}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </span>
                  </div>
                  {image && <SodexoResultImage src={image} alt={title} />}
                </Wrapper>
              );
            })}
        </div>

        {live && !isLoading && !isError && totalPages > 1 && (
          <nav className="flex items-center gap-4 pb-8" aria-label="Search pagination">
            {pages.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setPageNumber(page)}
                className="text-sm"
                style={{
                  color: page === pageNumber ? 'var(--brand-primary, #283897)' : brandFg,
                  fontFamily: bodyFont,
                  fontWeight: page === pageNumber ? 700 : 400,
                }}
                aria-current={page === pageNumber ? 'page' : undefined}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={pageNumber >= totalPages}
              onClick={() => setPageNumber(pageNumber + 1)}
              className="text-sm disabled:opacity-40"
              style={{ color: brandFg }}
              aria-label="Next page"
            >
              ›
            </button>
          </nav>
        )}
      </div>
    </section>
  );
};

const SodexoHelpLayout = ({
  params,
  inputValue,
  setInputValue,
  mapping,
  results,
  live,
  sendEvent,
  label,
}: {
  params: SearchResultsProps['params'];
  inputValue: string;
  setInputValue: (value: string) => void;
  mapping: { title?: string; link?: string };
  results: SearchDoc[];
  live: boolean;
  sendEvent: (name: 'viewed' | 'clicked') => void;
  label: (name: 'SEARCH_HELP_PLACEHOLDER' | 'SEE_ALL_RESULTS') => string;
}) => {
  const goToResults = () => {
    const q = inputValue.trim();
    if (!q) return;
    navigateTo(`/SearchResults?q=${encodeURIComponent(q)}`);
  };

  return (
    <section
      className={cn('component search-results', params?.styles)}
      id={params?.RenderingIdentifier || undefined}
    >
      <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 lg:px-8">
        <form
          role="search"
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            goToResults();
          }}
        >
          <Input
            type="text"
            value={inputValue}
            disabled={!live}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={label('SEARCH_HELP_PLACEHOLDER')}
            aria-label={label('SEARCH_HELP_PLACEHOLDER')}
            className="h-14 w-full rounded-md border py-3 pl-12 pr-28 text-base shadow-none"
            style={{
              borderColor: 'var(--brand-border, #d4d4e8)',
              color: 'var(--brand-fg, #2a295c)',
              fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
            }}
          />
          <Search className="text-muted-foreground absolute left-4 top-1/2 size-5 -translate-y-1/2" />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 inline-flex h-11 -translate-y-1/2 items-center gap-2 rounded-md px-4 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-primary, #283897)' }}
          >
            Search
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
          {live && inputValue.trim() && results.length > 0 && (
            <ul
              className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-md"
              style={{ borderColor: 'var(--brand-border, #e0dff0)' }}
            >
              {results.slice(0, 5).map((doc) => {
                const title = docValue(doc, mapping.title);
                const link = docValue(doc, mapping.link);
                if (!title) return null;
                return (
                  <li key={docValue(doc, 'sc_item_id') || title}>
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-black/5"
                      onClick={() => {
                        sendEvent('clicked');
                        if (link) navigateTo(link);
                        else goToResults();
                      }}
                    >
                      {title}
                    </button>
                  </li>
                );
              })}
              <li className="border-t" style={{ borderColor: 'var(--brand-border, #e0dff0)' }}>
                <button
                  type="button"
                  className="block w-full px-4 py-2 text-left text-sm font-medium"
                  style={{ color: 'var(--brand-primary, #283897)' }}
                  onClick={goToResults}
                >
                  {label('SEE_ALL_RESULTS')}
                </button>
              </li>
            </ul>
          )}
        </form>
      </div>
    </section>
  );
};
