import {
  fieldImageSrc,
  fieldText,
  normalizeReferenceField,
  type WildcardLinkedItem,
} from 'src/lib/wildcard';

/** Article items authored under the newsroom data branch. */
export const NEWSROOM_BRANCH_PATH =
  '/sitecore/content/domsecurity/domsecurity-com/Data/News Teasers';

/** Rendering parameter on Dom Security News Teasers. */
export const NEWS_TEASER_MAX_ITEMS_PARAM = 'Maximum Items';

export const DEFAULT_NEWS_TEASER_MAX_ITEMS = 3;

type RenderingParams = Record<string, string | undefined>;

/**
 * Maximum teasers to load and render. Empty or invalid values stay at 3.
 */
export function resolveNewsTeaserMaxItems(params: RenderingParams | undefined): number {
  const raw = String(
    params?.[NEWS_TEASER_MAX_ITEMS_PARAM] || params?.MaximumItems || params?.maximumItems || '',
  ).trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_NEWS_TEASER_MAX_ITEMS;
  return parsed;
}

export type NewsArticle = {
  id: string;
  name: string;
  title: string;
  date: string;
  imageSrc: string;
  imageAlt: string;
  href: string;
  linkText: string;
  badge: 'News' | 'Group News';
};

type LinkValue = {
  href?: string;
  url?: string;
  text?: string;
};

function linkValue(fields: WildcardLinkedItem['fields']): LinkValue {
  const raw = fields.Link;
  if (!raw || typeof raw !== 'object') return {};
  const record = raw as { value?: LinkValue };
  return record.value && typeof record.value === 'object' ? record.value : (raw as LinkValue);
}

function imageAlt(fields: WildcardLinkedItem['fields']): string {
  const raw = fields.Image;
  if (!raw || typeof raw !== 'object') return '';
  const record = raw as { value?: { alt?: string }; alt?: string };
  return record.value?.alt || record.alt || '';
}

export function toNewsArticle(item: WildcardLinkedItem): NewsArticle | null {
  const title = fieldText(item.fields, 'Title').trim();
  const imageSrc = fieldImageSrc(item.fields, 'Image');
  const link = linkValue(item.fields);
  const href = (link.href || link.url || '').trim();
  if (!title || (!imageSrc && !href)) return null;
  if (fieldText(item.fields, 'Heading') && !imageSrc) return null;

  const path = `${href} ${link.url || ''}`.toLowerCase();
  return {
    id: item.id || item.name || title,
    name: item.name || '',
    title,
    date: fieldText(item.fields, 'Date').trim(),
    imageSrc,
    imageAlt: imageAlt(item.fields) || title,
    href,
    linkText: (link.text || 'Read article').trim() || 'Read article',
    badge: path.includes('group-news') ? 'Group News' : 'News',
  };
}

/** Ids or item names from a Promoted multilist, when the field is set. */
export function promotedKeysFromFields(fields: unknown): string[] {
  if (!fields || typeof fields !== 'object') return [];
  const promoted = (fields as { Promoted?: unknown }).Promoted;
  if (!promoted || typeof promoted !== 'object') return [];
  const record = promoted as { value?: unknown; jsonValue?: unknown };
  const linked = normalizeReferenceField(record.jsonValue ?? record.value ?? promoted);
  const keys = linked
    .map((item) => item.id || item.name || '')
    .map((key) => key.trim())
    .filter(Boolean);
  if (keys.length) return keys;
  const value = record.value ?? (record.jsonValue as { value?: unknown } | undefined)?.value;
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

/**
 * Promoted items, in field order, when they match the branch.
 * Otherwise the whole branch list.
 */
export function selectNewsArticles(articles: NewsArticle[], promotedKeys: string[]): NewsArticle[] {
  if (!promotedKeys.length) return articles;
  const byKey = new Map<string, NewsArticle>();
  for (const article of articles) {
    byKey.set(article.id.toLowerCase(), article);
    byKey.set(article.id.replace(/[{}]/g, '').toLowerCase(), article);
    if (article.name) byKey.set(article.name.toLowerCase(), article);
  }
  const picked = promotedKeys
    .map((key) => byKey.get(key.toLowerCase()) || byKey.get(key.replace(/[{}]/g, '').toLowerCase()))
    .filter((article): article is NewsArticle => Boolean(article));
  return picked.length ? picked : articles;
}
