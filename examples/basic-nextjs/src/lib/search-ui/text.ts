const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/**
 * Reduce an HTML string (rich-text index attributes like ArticleContent) to
 * plain text suitable for a card snippet. Regex-based so it is SSR-safe.
 */
export const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Extract a usable image URL from whatever shape an image-typed index
 * attribute returns: a plain URL string, a Sitecore image-field XML fragment
 * (<Image src="..."/> / <image .../>), or an object carrying src/url.
 * Returns an empty string when no URL can be found.
 */
export const extractImageUrl = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.src === 'string') return v.src;
    if (typeof v.url === 'string') return v.url;
    return '';
  }
  if (typeof value !== 'string') return '';
  const s = value.trim();
  if (s.startsWith('<')) {
    const m = s.match(/src="([^"]+)"/i);
    return m ? m[1].replace(/&amp;/g, '&') : '';
  }
  return s;
};

/**
 * Format an ISO date string from a search document for card display.
 * Returns an empty string for missing or unparseable values.
 */
export const formatDate = (isoDate: string | undefined, locale = 'en'): string => {
  if (!isoDate) return '';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
};
