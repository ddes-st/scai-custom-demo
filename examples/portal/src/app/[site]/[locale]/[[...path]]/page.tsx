import { isDesignLibraryPreviewData } from "@sitecore-content-sdk/nextjs/editing";
import { siteKindNow, siteModeNow } from "src/lib/portal/sites";
import { takedownTarget } from "src/lib/ch/automotive";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { draftMode, headers as nextHeaders } from "next/headers";
import { cache } from "react";
import { getPageMetadata, type Page, type SiteInfo } from "@sitecore-content-sdk/nextjs";
import sites from ".sitecore/sites.json";
import { routing } from "src/i18n/routing";
import scConfig from "sitecore.config";
import client from "src/lib/sitecore-client";
import Layout from "src/Layout";
import components from "src/lib/component-map";
import Providers from "src/Providers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { flattenMessages } from "src/lib/portal/ui-keys";
import { HtmlLang } from "components/ui/portal/HtmlLang";
import { LangScope } from "components/ui/portal/LangScope";
import { getBaseUrl } from "lib/utils";
import { setRequestContext } from "src/lib/portal/request-context";
import { routeId } from "src/lib/portal/sections";
import { detailSpecOf, resolveDetail } from "src/lib/portal/detail";
import { audienceOf, canView, strictest } from "src/lib/portal/audience";
import { getViewer } from "src/lib/ch/viewer";

/** The path segment SitecoreAI publishes a wildcard item (`*`) under. */
const WILDCARD = ",-w-,";

// Every page is rendered per request: the Content Hub loaders (cached 60 s with unstable_cache)
// and draftMode()/headers() are dynamic, and a static render of this route fails in production
// with DYNAMIC_SERVER_USAGE. generateStaticParams below is kept for the SDK but yields nothing.
export const dynamic = "force-dynamic";
// a page that can't render in ~15 s (Content Hub or Edge stuck) ends there instead of at the platform's limit
export const maxDuration = 15;

type PageProps = {
  params: Promise<{
    site: string;
    locale: string;
    path?: string[];
    [key: string]: string | string[] | undefined;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Resolved = { page: Page | null; wildcard: boolean };

/**
 * The page for a public path. Experience Edge's delivery endpoint doesn't resolve wildcard
 * items, so a miss on a path of two or more segments is retried against the parent's `*`
 * item (published as `,-w-,`): /products/<id> → /products/,-w-, . One cached call per
 * request (React cache) shared by the page and generateMetadata.
 */
const resolvePage = cache(async (path: string[], site: string, locale: string, draft: boolean): Promise<Resolved> => {
  if (draft) {
    const headers = await nextHeaders();
    const previewData = client.getPreviewData(headers);
    const page = isDesignLibraryPreviewData(previewData)
      ? await client.getDesignLibraryData(previewData)
      : await client.getPreview(previewData);
    return { page, wildcard: page?.layout.sitecore.route?.name === "*" };
  }
  const page = await client.getPage(path, { site, locale });
  // The preview endpoint resolves wildcard items natively (route name "*"); delivery does not.
  if (page) return { page, wildcard: page.layout.sitecore.route?.name === "*" };
  if (path.length >= 2 && path[path.length - 1] !== WILDCARD) {
    const fallback = await client.getPage([...path.slice(0, -1), WILDCARD], { site, locale });
    if (fallback) return { page: fallback, wildcard: true };
  }
  // A page without a version in this language shows its default-language version (the URL,
  // the Content Hub culture and the dictionary stay in the requested language).
  if (locale !== routing.defaultLocale) return resolvePage(path, site, routing.defaultLocale, draft);
  return { page: null, wildcard: false };
});

const firstValues = (sp: Record<string, string | string[] | undefined>): Record<string, string> =>
  Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? "" : v ?? ""]));

export default async function Page({ params, searchParams }: PageProps) {
  const { site, locale, path = [] } = await params;
  // the site this request is for: one deployment can serve the portal and its joint microsites
  setRequestContext({ site });
  const search = firstValues(await searchParams);
  const draft = await draftMode();

  const { page, wildcard } = await resolvePage(path, site, locale, draft.isEnabled);
  if (!page) notFound();

  // The Page builder renders through a preview URL whose locale segment is the default language;
  // the language being edited is the page's own. Elsewhere the URL's language wins (a page without
  // a version in it shows its default-language version under the localized URL).
  const uiLocale = draft.isEnabled && page.locale ? page.locale : locale;
  // Set site and locale to be available in src/i18n/request.ts for fetching the dictionary
  setRequestLocale(`${site}_${uiLocale}`);

  // What the Portal components need from the URL: the detail id/slug and the search params.
  const slug = wildcard ? routeId(path[path.length - 1] ?? "") : "";
  const dictionary = flattenMessages(await getMessages().catch(() => ({})));
  setRequestContext({ segments: path, slug, search, wildcard, locale: uiLocale, dictionary });

  // A campaign microsite past its takedown (status "Taken down" or the takedown day over) sends its
  // visitors to the marque's page on the portal; the Page builder still shows it (with a notice).
  if (siteKindNow() === "microsite" && !page.mode.isEditing && !page.mode.isDesignLibrary) {
    const to = await takedownTarget();
    if (to) redirect(to);
  }

  // Who may see this page (VisibleTo: everyone | partners | staff). A visitor without the
  // right session is sent to the sign-in page (hybrid/gated); in public mode, and for a
  // signed-in viewer of the wrong kind, the page does not exist. The Page builder always sees it.
  // Read in the page language and the default language; the stricter wins (see strictest()).
  // Gated mode: every page needs a session here too — the proxy lets any request with a
  // draft-mode cookie through (it can't verify it), so the route is where that is enforced.
  const routeFields = (p: Page | null) => p?.layout.sitecore.route?.fields as Record<string, { value?: unknown }> | undefined;
  const base = locale !== routing.defaultLocale ? (await resolvePage(path, site, routing.defaultLocale, draft.isEnabled)).page : null;
  const audience = strictest(audienceOf(routeFields(page)?.VisibleTo?.value), audienceOf(routeFields(base)?.VisibleTo?.value));
  // the site's mode: a joint microsite is public whatever the portal's SITE_MODE is
  const mode = siteModeNow();
  if ((audience !== "everyone" || mode === "gated") && !page.mode.isEditing && !page.mode.isDesignLibrary) {
    const viewer = await getViewer();
    if (!canView(viewer.kind, audience)) {
      if (mode === "public" || viewer.kind === "partner" || viewer.kind === "staff") notFound();
      const here = `/${path.join("/")}`;
      redirect(`/login?from=${encodeURIComponent(locale === routing.defaultLocale ? here : `/${locale}${here}`)}`);
    }
  }

  // A detail page (template Portal Detail Page, field DetailKind) must 404 for an unknown
  // Content Hub item on the live site; the component shows a sample item while editing.
  const kind = detailSpecOf(page.layout.sitecore.route?.fields as Record<string, unknown> | undefined) || (base ? detailSpecOf(base.layout.sitecore.route?.fields as Record<string, unknown> | undefined) : null);
  if (kind && !page.mode.isEditing && !page.mode.isDesignLibrary) {
    const state = await resolveDetail(kind, slug);
    if (state.status === "missing") notFound();
  }

  // Fetch the component data from Sitecore (Likely will be deprecated)
  const componentProps = await client.getComponentData(page.layout, {}, components);

  return (
    <NextIntlClientProvider>
      <HtmlLang lang={uiLocale} />
      <LangScope lang={uiLocale}>
        <Providers page={page} componentProps={componentProps}>
          <Layout page={page} />
        </Providers>
      </LangScope>
    </NextIntlClientProvider>
  );
}

// This function gets called at build and export time to determine
// pages for SSG ("paths", as tokenized array).
export const generateStaticParams = async () => {
  if (process.env.NODE_ENV !== "development" && scConfig.generateStaticPaths) {
    const defaultSite = scConfig.defaultSite;
    const allowedSites = defaultSite
      ? sites.filter((site: SiteInfo) => site.name === defaultSite).map((site: SiteInfo) => site.name)
      : sites.map((site: SiteInfo) => site.name);
    return await client.getAppRouterStaticParams(allowedSites, routing.locales.slice());
  }
  return [];
};

type AuthoredField = { value?: unknown };

/** Maps this starter's page fields onto the names getPageMetadata reads. */
function toSdkMetadataFields(fields: Record<string, AuthoredField | undefined> | undefined) {
  const text = (field?: AuthoredField) => {
    const value = field?.value;
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    return String(value) ? field : undefined;
  };
  const title = text(fields?.Title) ?? text(fields?.metadataTitle) ?? text(fields?.pageTitle) ?? text(fields?.ogTitle);
  return {
    ...fields,
    Title: title,
    baseMetadataTitle: text(fields?.baseMetadataTitle) ?? text(fields?.metadataTitle) ?? title,
    baseMetadataDescription:
      text(fields?.baseMetadataDescription) ?? text(fields?.metadataDescription) ?? text(fields?.pageSummary) ?? text(fields?.ogDescription),
    baseMetadataKeywords: text(fields?.baseMetadataKeywords) ?? text(fields?.metadataKeywords),
    baseMetadataAuthor: text(fields?.baseMetadataAuthor) ?? text(fields?.metadataAuthor),
    baseOgTitle: text(fields?.baseOgTitle) ?? text(fields?.ogTitle) ?? title,
    baseOgDescription:
      text(fields?.baseOgDescription) ?? text(fields?.ogDescription) ?? text(fields?.metadataDescription) ?? text(fields?.pageSummary),
    baseOgImage: fields?.baseOgImage ?? fields?.ogImage ?? fields?.thumbnailImage,
  };
}

// Metadata fields for the page.
export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const baseUrl = getBaseUrl();
  const { path = [], site, locale } = await params;
  setRequestContext({ site });
  const draft = await draftMode();

  // Canonical URL: base URL + content path only (no site/locale segments)
  const pathSegment = path.length ? `/${path.join("/")}` : "";
  const canonicalUrl = baseUrl ? `${baseUrl}${pathSegment}` : undefined;

  const { page, wildcard } = await resolvePage(path, site, locale, draft.isEnabled);
  const route = page?.layout.sitecore.route;

  // A detail page is titled and described after its Content Hub item.
  let detail: { title: string; description?: string; image?: string } | null = null;
  const kind = detailSpecOf(route?.fields as Record<string, unknown> | undefined);
  if (kind && wildcard) {
    const state = await resolveDetail(kind, routeId(path[path.length - 1] ?? ""));
    if (state.status === "ok") detail = state;
  }

  const meta = getPageMetadata(
    route && {
      ...route,
      fields: toSdkMetadataFields(route.fields as Record<string, AuthoredField | undefined> | undefined) as typeof route.fields,
    }
  );
  return {
    ...meta,
    ...(detail && {
      title: detail.title,
      ...(detail.description && { description: detail.description }),
      openGraph: { ...(meta.openGraph as object), title: detail.title, ...(detail.description && { description: detail.description }), ...(detail.image && { images: [detail.image] }), ...(canonicalUrl && { url: canonicalUrl }) },
    }),
    ...(baseUrl && {
      alternates: {
        canonical: canonicalUrl,
        // hreflang: the same path in every language of the site (the default language without prefix)
        languages: Object.fromEntries([
          ...routing.locales.map((l) => [l, `${baseUrl}${l === routing.defaultLocale ? "" : `/${l}`}${pathSegment}`]),
          ["x-default", `${baseUrl}${pathSegment}`],
        ]),
      },
    }),
  };
};
