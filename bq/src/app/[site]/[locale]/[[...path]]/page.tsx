import { isDesignLibraryPreviewData } from '@sitecore-content-sdk/nextjs/editing';
import { notFound } from 'next/navigation';
import { draftMode, headers as nextHeaders } from 'next/headers';
import { Metadata } from 'next';
import { getPageMetadata } from '@sitecore-content-sdk/nextjs';
import { SiteInfo } from '@sitecore-content-sdk/nextjs';
import sites from '.sitecore/sites.json';
import { routing } from 'src/i18n/routing';
import scConfig from 'sitecore.config';
import client from 'src/lib/sitecore-client';
import Layout from 'src/Layout';
import Providers from 'src/Providers';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

type PageProps = {
  params: Promise<{ site: string; locale: string; path?: string[]; [key: string]: string | string[] | undefined }>;
};

export default async function Page({ params }: PageProps) {
  const { site, locale, path } = await params;

  // Set site and locale to be available in src/i18n/request.ts for fetching the dictionary
  setRequestLocale(`${site}_${locale}`);

  const draft = await draftMode();

  // Fetch the page data from Sitecore
  let page;
  if (draft.isEnabled) {
    const headers = await nextHeaders();
    const previewData = client.getPreviewData(headers);

    if (isDesignLibraryPreviewData(previewData)) {
      page = await client.getDesignLibraryData(previewData);
    } else {
      page = await client.getPreview(previewData);
    }
  } else {
    page = await client.getPage(path ?? [], { site, locale });
  }

  // If the page is not found, return a 404
  if (!page) {
    notFound();
  }

  return (
    <NextIntlClientProvider>
      <Providers page={page}>
        <Layout page={page} />
      </Providers>
    </NextIntlClientProvider>
  );
}

// This function gets called at build and export time to determine
// pages for SSG ("paths", as tokenized array).
// Fetch per site+locale so one incomplete Edge site (IV-007) or culture
// cannot fail the whole Vercel build; skipped routes still render on demand.
export const generateStaticParams = async () => {
  if (process.env.NODE_ENV === 'development' || !scConfig.generateStaticPaths) {
    return [];
  }

  const siteNames = [...new Set(sites.map((site: SiteInfo) => site.name))];
  const locales = routing.locales.slice();
  const params: { site: string; locale: string; path: string[] }[] = [];

  for (const siteName of siteNames) {
    for (const locale of locales) {
      try {
        const siteParams = await client.getAppRouterStaticParams([siteName], [locale]);
        params.push(...siteParams);
      } catch (error) {
        console.warn(
          `[generateStaticParams] Skipping ${siteName}/${locale}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  if (params.length === 0) {
    return [
      {
        site: siteNames[0] ?? scConfig.defaultSite ?? 'default',
        locale: routing.defaultLocale,
        path: [] as string[],
      },
    ];
  }

  return params;
};
// Metadata fields for the page.
export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const { path, site, locale } = await params;

  // The same call as for rendering the page. Should be cached by default react behavior
  const page = await client.getPage(path ?? [], { site, locale });
  return getPageMetadata(page?.layout.sitecore.route);
};
