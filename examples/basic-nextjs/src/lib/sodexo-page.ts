import type { Page } from '@sitecore-content-sdk/nextjs';

type SitecoreLayout = {
  context?: { itemPath?: string; site?: { name?: string } };
  route?: { itemPath?: string; name?: string };
};

function getSitecoreLayout(page?: Page): SitecoreLayout | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (page as any)?.layout?.sitecore as SitecoreLayout | undefined;
}

export function isSodexoSite(page?: Page): boolean {
  const sitecore = getSitecoreLayout(page);
  const siteName = String(sitecore?.context?.site?.name || '').toLowerCase();
  return siteName === 'sodexo';
}

export function isSodexoAboutPage(page?: Page): boolean {
  const sitecore = getSitecoreLayout(page);
  const siteName = String(sitecore?.context?.site?.name || '').toLowerCase();
  if (siteName && siteName !== 'sodexo') return false;

  const itemPath = String(sitecore?.context?.itemPath || sitecore?.route?.itemPath || '');
  const routeName = String(sitecore?.route?.name || '');
  return /\/Home\/About(\/|$)/i.test(itemPath) || /\/About(\/|$)/i.test(itemPath) || /^About$/i.test(routeName);
}

export function isSodexoArticlesPage(page?: Page): boolean {
  const sitecore = getSitecoreLayout(page);
  const siteName = String(sitecore?.context?.site?.name || '').toLowerCase();
  if (siteName && siteName !== 'sodexo') return false;

  const itemPath = String(sitecore?.context?.itemPath || sitecore?.route?.itemPath || '');
  const routeName = String(sitecore?.route?.name || '');
  return /\/Home\/Articles$/i.test(itemPath) || /\/Articles$/i.test(itemPath) || /^Articles$/i.test(routeName);
}

export function isSodexoHelpPage(page?: Page): boolean {
  const sitecore = getSitecoreLayout(page);
  const siteName = String(sitecore?.context?.site?.name || '').toLowerCase();
  if (siteName && siteName !== 'sodexo') return false;

  const itemPath = String(sitecore?.context?.itemPath || sitecore?.route?.itemPath || '');
  const routeName = String(sitecore?.route?.name || '');
  return /\/Home\/Search$/i.test(itemPath) || /\/Search$/i.test(itemPath) || /^Search$/i.test(routeName);
}

export function isSodexoBrandsPage(page?: Page): boolean {
  const sitecore = getSitecoreLayout(page);
  const siteName = String(sitecore?.context?.site?.name || '').toLowerCase();
  if (siteName && siteName !== 'sodexo') return false;

  const itemPath = String(sitecore?.context?.itemPath || sitecore?.route?.itemPath || '');
  const routeName = String(sitecore?.route?.name || '');
  return /\/Home\/Brands(\/|$)/i.test(itemPath) || /\/Brands(\/|$)/i.test(itemPath) || /^Brands$/i.test(routeName);
}

export function isSodexoSearchResultsPage(page?: Page): boolean {
  const sitecore = getSitecoreLayout(page);
  const siteName = String(sitecore?.context?.site?.name || '').toLowerCase();
  if (siteName && siteName !== 'sodexo') return false;

  const itemPath = String(sitecore?.context?.itemPath || sitecore?.route?.itemPath || '');
  const routeName = String(sitecore?.route?.name || '');
  return (
    /\/Home\/SearchResults$/i.test(itemPath) ||
    /\/SearchResults$/i.test(itemPath) ||
    /^SearchResults$/i.test(routeName)
  );
}
