import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from 'src/i18n/supported-locales';

/**
 * Public culture URLs for BQ / Sitecore AI App Router.
 *
 * Browser URLs omit the site segment (MultisiteProxy resolves it). With
 * localePrefix "as-needed", the default culture also omits the locale segment:
 *   en      → /homeowners
 *   nl-BE   → /nl-BE/homeowners
 *   fr-BE   → /fr-BE/homeowners
 * Internal route remains /[site]/[locale]/[[...path]].
 */

/** Same cultures as the rendering host (`routing.locales`). */
export const DEMO_LOCALES = SUPPORTED_LOCALES;

export type DemoLocale = SupportedLocale;

export const DEFAULT_DEMO_LOCALE: DemoLocale = 'en';

/** UI chip codes (en/fr/nl) → Sitecore culture names. */
export const CODE_TO_LOCALE: Record<string, string> = {
  en: "en",
  fr: "fr-BE",
  nl: "nl-BE",
};

export function localeToCode(locale: string): string {
  const normalized = locale.toLowerCase();
  if (normalized === "fr-be" || normalized === "fr") return "fr";
  if (normalized === "nl-be" || normalized === "nl") return "nl";
  return "en";
}

/**
 * Content path from a public or rewritten pathname (no leading site/locale).
 * Examples: "/homeowners", "" (home).
 */
export function extractContentPath(
  pathname: string,
  site: string,
  locales: readonly string[] = DEMO_LOCALES,
): string {
  let rest = pathname || "/";

  if (site) {
    const sitePrefix = `/${site}`;
    if (rest === sitePrefix || rest === `${sitePrefix}/`) return "";
    if (rest.startsWith(`${sitePrefix}/`)) {
      rest = rest.slice(sitePrefix.length);
    }
  }

  for (const loc of locales) {
    const locPrefix = `/${loc}`;
    if (rest === locPrefix || rest === `${locPrefix}/`) return "";
    if (rest.startsWith(`${locPrefix}/`)) {
      rest = rest.slice(locPrefix.length);
      break;
    }
  }

  if (!rest || rest === "/") return "";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/** Public href for a target Sitecore culture (no site segment). */
export function publicHrefForLocale(
  targetLocale: string,
  contentPath: string,
  defaultLocale: string = DEFAULT_DEMO_LOCALE,
): string {
  const suffix = contentPath && contentPath !== "/" ? contentPath : "";
  if (targetLocale === defaultLocale) {
    return suffix || "/";
  }
  return `/${targetLocale}${suffix}`;
}
