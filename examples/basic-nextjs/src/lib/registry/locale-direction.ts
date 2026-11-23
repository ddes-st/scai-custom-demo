export type Direction = "ltr" | "rtl";

export const DEFAULT_LOCALE = "en";

const RTL_LANGUAGES = [
  "ar", // Arabic
  "he", // Hebrew
  "fa", // Persian/Farsi
  "ur", // Urdu
  "yi", // Yiddish
  "ji", // Yiddish (alternative)
  "ku", // Kurdish
  "ps", // Pashto
  "sd", // Sindhi
] as const;

export function isRtlLocale(locale: string): boolean {
  const langCode = locale.toLowerCase().split("-")[0];
  return RTL_LANGUAGES.includes(langCode as (typeof RTL_LANGUAGES)[number]);
}

export function getDirectionFromLocale(locale: string): Direction {
  return isRtlLocale(locale) ? "rtl" : "ltr";
}
