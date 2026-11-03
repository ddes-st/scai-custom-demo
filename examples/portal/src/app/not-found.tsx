import Link from 'next/link';
import { Metadata } from 'next';
import { ErrorPage } from '@sitecore-content-sdk/nextjs';
import client from 'lib/sitecore-client';
import scConfig from 'sitecore.config';
import Layout from 'src/Layout';
import Providers from 'src/Providers';

// Metadata for 404 Not Found page
export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function NotFound() {
  if (scConfig.defaultSite) {
    let page = null;
    try {
      page = await client.getErrorPage(ErrorPage.NotFound, {
        site: scConfig.defaultSite,
        locale: scConfig.defaultLanguage,
      });
    } catch (error) {
      // no Edge access (e.g. a build without a context id): fall back to the static page
      console.warn('Error fetching the 404 page:', error instanceof Error ? error.message : error);
    }
    if (page) {
      return (
        <Providers page={page}>
          <Layout page={page} />
        </Providers>
      );
    }
  }

  return (
    <div style={{ padding: 10 }}>
      <h1>Page not found</h1>
      <p>This page does not exist.</p>
      <Link href="/">Go to the Home page</Link>
    </div>
  );
}
