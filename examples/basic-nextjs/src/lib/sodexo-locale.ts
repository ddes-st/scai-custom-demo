import type { Page } from '@sitecore-content-sdk/nextjs';

export const SODEXO_EN_LOCALE = 'en';
export const SODEXO_FR_LOCALE = 'fr-FR';

const KNOWN_LOCALES = ['en', 'fr-FR', 'fr', 'es-ES', 'it-IT'];

type SitecoreLayout = {
  context?: { language?: string };
  route?: { itemLanguage?: string };
};

function getSitecoreLayout(page?: Page): SitecoreLayout | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (page as any)?.layout?.sitecore as SitecoreLayout | undefined;
}

export function isFrenchLocale(locale?: string): boolean {
  return /^fr(-fr)?$/i.test(locale || '');
}

export function getPageLocale(page?: Page): string {
  const sitecore = getSitecoreLayout(page);
  const language = String(sitecore?.context?.language || sitecore?.route?.itemLanguage || '');
  return isFrenchLocale(language) ? SODEXO_FR_LOCALE : SODEXO_EN_LOCALE;
}

export function buildLocalePath(pathname: string, targetLocale: string, search = ''): string {
  const parts = pathname.split('/');
  const localeIndex = parts.findIndex((segment) =>
    KNOWN_LOCALES.some((locale) => locale.toLowerCase() === segment.toLowerCase())
  );

  if (localeIndex >= 0) {
    parts[localeIndex] = targetLocale;
  } else if (parts.length >= 2 && parts[1]) {
    parts.splice(2, 0, targetLocale);
  } else {
    return `/${targetLocale}${pathname === '/' ? '' : pathname}${search}`;
  }

  const nextPath = parts.join('/') || '/';
  return `${nextPath}${search}`;
}

const PREVIEW_QUERY_KEYS = ['sc_lang', 'sc_itemid', 'sc_mode', 'sc_site', 'sc_version', 'secret'];

function getRouteItemId(page?: Page): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const route = (page as any)?.layout?.sitecore?.route;
  return String(route?.itemId || route?.itemID || '');
}

export function isPreviewOrEditingUrl(href: string): boolean {
  try {
    const url = new URL(href, 'http://local.invalid');
    return (
      url.pathname.includes('/api/editing') ||
      PREVIEW_QUERY_KEYS.some((key) => url.searchParams.has(key))
    );
  } catch {
    return false;
  }
}

export function buildLocaleHref(
  href: string,
  targetLocale: string,
  page?: Page
): string {
  const url = new URL(href, 'http://local.invalid');
  const isEditing = Boolean(page?.mode?.isEditing || page?.mode?.isPreview);
  const keepPreview = isEditing || isPreviewOrEditingUrl(href);
  const isEditingRender = url.pathname.includes('/api/editing');

  if (keepPreview) {
    url.searchParams.set('sc_lang', targetLocale);
    const itemId = getRouteItemId(page);
    if (itemId && !url.searchParams.has('sc_itemid')) {
      url.searchParams.set('sc_itemid', itemId);
    }
    if (!url.searchParams.has('sc_site')) {
      url.searchParams.set('sc_site', 'sodexo');
    }
    if (!isEditingRender) {
      url.pathname = buildLocalePath(url.pathname, targetLocale);
    }
    return `${url.pathname}${url.search}${url.hash}`;
  }

  return `${buildLocalePath(url.pathname, targetLocale, url.search)}${url.hash}`;
}
