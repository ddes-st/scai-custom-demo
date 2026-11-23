import { DEFAULT_LOCALE } from "./locale-direction";

// Static `<html><body>` shell for the generated editing host's root
// layout.
//
// This deliberately does NOT resolve the locale via next-intl's
// `getLocale()`. The root layout executes before the catch-all page, so
// a `getLocale()` call here runs before the page's
// `setRequestLocale(...)` — next-intl resolves the request config with
// no locale and caches that resolution for the rest of the request.
// That both pinned this shell to the default locale forever AND poisoned
// locale resolution (dictionary, `getTranslations`,
// `NextIntlClientProvider`) for everything below the page.
//
// The active locale is applied by `<LocaleAttributes locale={...} />`
// (locale-attributes.tsx), rendered by the catch-all page — the only
// place that knows the `[locale]` route param. It rewrites `lang`/`dir`
// on `documentElement` via a pre-paint inline script, which is why the
// server-rendered defaults here carry `suppressHydrationWarning`.
export function LocaleHtml({ children }: { children: React.ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE} dir="ltr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
