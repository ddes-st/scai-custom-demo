import { defineRouting } from 'next-intl/routing';
import sitecoreConfig from 'sitecore.config';
import { SUPPORTED_LOCALES, type SupportedLocale } from './supported-locales';

function toSupportedLocale(language: string): SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(language)
    ? (language as SupportedLocale)
    : 'en';
}

export const routing = defineRouting({
  // All cultures hosted by any BQ site (union of site api.languages)
  locales: [...SUPPORTED_LOCALES],

  // Used when no locale matches
  defaultLocale: toSupportedLocale(sitecoreConfig.defaultLanguage),

  // No prefix is added for the default locale ("as-needed").
  // For other configuration options, refer to the next-intl documentation:
  // https://next-intl.dev/docs/routing/configuration
  localePrefix: 'as-needed',
});
