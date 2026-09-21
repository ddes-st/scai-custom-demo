import type { Page } from '@sitecore-content-sdk/nextjs';

type SitecoreLayout = {
  context?: { itemPath?: string; site?: { name?: string } };
  route?: { itemPath?: string; name?: string };
};

function getSitecoreLayout(page?: Page): SitecoreLayout | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (page as any)?.layout?.sitecore as SitecoreLayout | undefined;
}

export function isSodexoAboutPage(page?: Page): boolean {
  const sitecore = getSitecoreLayout(page);
  const siteName = String(sitecore?.context?.site?.name || '').toLowerCase();
  if (siteName && siteName !== 'sodexo') return false;

  const itemPath = String(sitecore?.context?.itemPath || sitecore?.route?.itemPath || '');
  const routeName = String(sitecore?.route?.name || '');
  return /\/Home\/About(\/|$)/i.test(itemPath) || /\/About(\/|$)/i.test(itemPath) || /^About$/i.test(routeName);
}
