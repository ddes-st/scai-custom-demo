import { defineRouting } from 'next-intl/routing';
import sitecoreConfig from 'sitecore.config';

export const routing = defineRouting({
  // A list of all locales that are supported
  // The site's default language plus any extra SitecoreAI languages (NEXT_PUBLIC_EXTRA_LOCALES="de-DE,fr-FR").
  locales: [sitecoreConfig.defaultLanguage, ...(process.env.NEXT_PUBLIC_EXTRA_LOCALES || '').split(',').map((l) => l.trim()).filter((l) => l && l !== sitecoreConfig.defaultLanguage)],

  // Used when no locale matches
  defaultLocale: sitecoreConfig.defaultLanguage,

  // No prefix is added for the default locale ("as-needed").
  // For other configuration options, refer to the next-intl documentation:
  // https://next-intl.dev/docs/routing/configuration
  localePrefix: 'as-needed',
});
