import {
  normalizeWildcardChildren,
  type WildcardLinkedItem,
} from './normalize';
import type { WildcardChildRaw } from './queries';

const MAX_PAGES = 10;

type ChildrenPage = {
  item?: {
    children?: {
      pageInfo?: { endCursor?: string; hasNext?: boolean };
      results?: WildcardChildRaw[];
    };
  };
};

async function fetchChildrenPage(
  path: string,
  language: string,
  after: string | undefined,
  signal?: AbortSignal,
): Promise<ChildrenPage | null> {
  const variables: Record<string, unknown> = { path, language };
  if (after) variables.after = after;

  const response = await fetch('/api/sitecore/igql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'wildcard-children',
      variables,
    }),
    signal,
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: ChildrenPage | null; errors?: unknown };
  if (payload.errors) {
    console.warn('[fetchWildcardChildren] GraphQL errors:', payload.errors);
    return null;
  }
  return payload.data ?? null;
}

/**
 * Load Edge children for a path, paging past the default first:10 limit.
 * `maxItems` stops once that many raw children are in hand, before the next page.
 */
export async function fetchWildcardChildren(options: {
  path: string;
  language?: string;
  signal?: AbortSignal;
  maxItems?: number;
}): Promise<WildcardLinkedItem[]> {
  const language = options.language?.trim() || 'en';
  const collected: WildcardChildRaw[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await fetchChildrenPage(options.path, language, after, options.signal);
    const children = data?.item?.children;
    const results = children?.results ?? [];
    collected.push(...results);

    if (options.maxItems && collected.length >= options.maxItems) {
      break;
    }
    if (!children?.pageInfo?.hasNext || !children.pageInfo.endCursor) {
      break;
    }
    after = children.pageInfo.endCursor;
  }

  return normalizeWildcardChildren(collected);
}
