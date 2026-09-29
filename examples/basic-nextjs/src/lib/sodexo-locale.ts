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
