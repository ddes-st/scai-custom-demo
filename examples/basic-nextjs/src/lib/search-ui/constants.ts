export const DEBOUNCE_MS = 400;

export const DEFAULT_PAGE_SIZE = 6;

export const DEFAULT_MAX_SUGGESTIONS = 5;

export const DEFAULT_MAX_ITEMS = 3;

/**
 * Dictionary keys shared by all search components, with English fallbacks.
 * The keys reuse the existing SearchExperience_* Dictionary entries so no new
 * Sitecore items are needed. Lookups are guarded (see useSearchLabels) — a
 * missing entry renders the fallback instead of throwing MISSING_MESSAGE.
 */
export const SEARCH_LABELS = {
  RESULTS_FOUND: { key: 'SearchExperience_ResultsFound', fallback: 'results found' },
  NO_RESULTS_FOUND: { key: 'SearchExperience_NoResultsFound', fallback: 'No results found' },
  TRY_ADJUSTING_YOUR_SEARCH: {
    key: 'SearchExperience_TryAdjustingYourSearch',
    fallback: 'Try adjusting your search to find what you are looking for',
  },
  CLEAR_SEARCH: { key: 'SearchExperience_ClearSearch', fallback: 'Clear search' },
  SOMETHING_WENT_WRONG: {
    key: 'SearchExperience_SomethingWentWrong',
    fallback: 'Something went wrong',
  },
  TRY_AGAIN: { key: 'SearchExperience_TryAgain', fallback: 'Try again' },
  LOAD_MORE: { key: 'SearchExperience_LoadMore', fallback: 'Load more' },
  SEARCH_INPUT_PLACEHOLDER: {
    key: 'SearchExperience_SearchInputPlaceholder',
    fallback: 'Search...',
  },
  PREVIOUS_PAGE: { key: 'SearchExperience_PreviousPage', fallback: 'Previous page' },
  NEXT_PAGE: { key: 'SearchExperience_NextPage', fallback: 'Next page' },
  READ_MORE: { key: 'SearchExperience_ReadMore', fallback: 'Read more' },
  SEE_ALL_RESULTS: { key: 'SearchExperience_SeeAllResults', fallback: 'See all results' },
  SUGGESTIONS: { key: 'SearchExperience_Suggestions', fallback: 'Search suggestions' },
  SORT_BY: { key: 'SearchExperience_SortBy', fallback: 'Sort by' },
  SORT_RELEVANCE: { key: 'SearchExperience_SortRelevance', fallback: 'Relevance' },
  SORT_NEWEST: { key: 'SearchExperience_SortNewest', fallback: 'Newest first' },
  SORT_OLDEST: { key: 'SearchExperience_SortOldest', fallback: 'Oldest first' },
} as const;

export type SearchLabelName = keyof typeof SEARCH_LABELS;
