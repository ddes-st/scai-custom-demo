import type { Page } from '@sitecore-content-sdk/nextjs';
import client from '@/lib/sitecore-client';
import type { HomeItemFields } from '@/components/hero/hero.props';

function asHomeFields(fields: unknown): HomeItemFields {
  if (!fields || typeof fields !== 'object') {
    return {};
  }
  return fields as HomeItemFields;
}

/**
 * Loads Sitecore home route fields on the server.
 * Reuses the current page when already on home (empty path).
 */
export async function getHomeItemFields(options: {
  site: string;
  locale: string;
  path?: string[];
  page?: Page;
}): Promise<HomeItemFields> {
  const { site, locale, path, page } = options;

  if (!site) {
    return {};
  }

  const isHome = !path || path.length === 0;
  if (isHome && page) {
    return asHomeFields(page.layout?.sitecore?.route?.fields);
  }

  try {
    const homePage = await client.getPage([], { site, locale });
    return asHomeFields(homePage?.layout?.sitecore?.route?.fields);
  } catch (error) {
    console.error('[home-fields] Failed to fetch home item fields:', error);
    return {};
  }
}
