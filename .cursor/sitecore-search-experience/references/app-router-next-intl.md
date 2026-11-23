# App Router + next-intl (required for search)

Search components call `useTranslations()` from **next-intl** and `useSearchParams` / `useRouter` from **next/navigation**. The target host **must** be a **Next.js App Router** Content SDK app with next-intl wired before search UI will render.

**Reference host:** `industry-verticals/kpmg/` (App Router + next-intl + Sitecore dictionary)

**Do not** use `next-localization` / `I18nProvider` from `_app.tsx` — that is Pages Router only and will crash on `useTranslations()`.

---

## Prerequisite — confirm App Router

| Required | Pages Router (unsupported) |
|----------|---------------------------|
| `src/app/[site]/[locale]/[[...path]]/page.tsx` | `src/pages/[[...path]].tsx` |
| `src/app/api/*/route.ts` | `src/pages/api/*` |
| `.sitecore/component-map.client.ts` | single `component-map.ts` only |
| `NextIntlClientProvider` in page/layout | `_app.tsx` + `next-localization` |

If the host is Pages Router, **scaffold a new App Router host** ([`scaffold-rendering-host`](../../scaffold-rendering-host/SKILL.md) with `nextjs-app-router`) or migrate the host to App Router **before** applying this skill.

---

## 1 — next.config.ts

Add the next-intl plugin (default loads `./src/i18n/request.ts`):

```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
```

---

## 2 — src/i18n/routing.ts

```typescript
import { defineRouting } from 'next-intl/routing';
import sitecoreConfig from 'sitecore.config';

export const routing = defineRouting({
  locales: [sitecoreConfig.defaultLanguage],
  defaultLocale: sitecoreConfig.defaultLanguage,
  localePrefix: 'as-needed',
});
```

Add all Sitecore languages to `locales` when the site is multilingual.

---

## 3 — src/i18n/request.ts

Loads Sitecore dictionary into next-intl `messages`. Uses `{site}_{locale}` request locale (set in page via `setRequestLocale`):

```typescript
import { getRequestConfig, GetRequestConfigParams } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import client from 'src/lib/sitecore-client';

export default getRequestConfig(async ({ requestLocale }: GetRequestConfigParams) => {
  const requested = await requestLocale;
  const [parsedSite, parsedLocale] = requested?.split('_') || [];
  const locale = hasLocale(routing.locales, parsedLocale) ? parsedLocale : routing.defaultLocale;

  const messages: Record<string, object> = {};
  messages[parsedSite] = await client.getDictionary({
    locale,
    site: parsedSite,
  });

  return {
    locale,
    messages,
  };
});
```

Search components call `useTranslations()` with keys like `SearchExperience_ResultsFound` — add matching phrases to Sitecore Dictionary (see `search-components/constants.ts`).

---

## 4 — Catch-all page: setRequestLocale + NextIntlClientProvider

In `src/app/[site]/[locale]/[[...path]]/page.tsx` (after loading page data):

```typescript
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

export default async function Page({ params }: PageProps) {
  const { site, locale, path } = await params;

  setRequestLocale(`${site}_${locale}`);

  // … getPage / getPreview …

  return (
    <NextIntlClientProvider>
      <Providers page={page}>
        <Layout page={page} />
      </Providers>
    </NextIntlClientProvider>
  );
}
```

Also wrap `not-found.tsx` the same way if it renders client components that use translations.

---

## 5 — Proxy / middleware

App Router Content SDK hosts use `src/proxy.ts` (or `middleware.ts` re-export). Chain order is **fixed:**

1. **LocaleProxy**
2. **AppRouterMultisiteProxy**
3. RedirectsProxy
4. PersonalizeProxy

See KPMG `src/proxy.ts` and [KPMG AGENTS.md](../../../../industry-verticals/kpmg/AGENTS.md).

---

## 6 — Component maps (App Router)

Register search in **both**:

| File | SearchExperience |
|------|------------------|
| `.sitecore/component-map.ts` | Server map (if used) |
| `.sitecore/component-map.client.ts` | **Required** — `'use client'` search components |

See [component-map-registration.md](component-map-registration.md).

---

## Verification

- [ ] Host has `src/app/` (not `src/pages/` for content routes)
- [ ] `createNextIntlPlugin()` in `next.config.ts`
- [ ] `src/i18n/routing.ts` + `src/i18n/request.ts` present
- [ ] `setRequestLocale(\`${site}_${locale}\`)` at top of catch-all page
- [ ] `NextIntlClientProvider` wraps layout output
- [ ] `/Search` (or `/search`) loads without `useTranslations` error
- [ ] Dictionary contains `SearchExperience_*` keys from `constants.ts`
