/**
 * Union of `api.languages` across BQ site definitions.
 * Dom Security / AXA: en, nl-BE, fr-BE. Crelan / Sitecore.com: en.
 *
 * Keep in sync when a site gains a new culture (or generate from site defs later).
 * LocaleProxy / next-intl match these strings exactly (casing matters).
 */
export const SUPPORTED_LOCALES = ['en', 'nl-BE', 'fr-BE'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
