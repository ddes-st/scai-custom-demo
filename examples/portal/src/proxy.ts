import { NextRequest } from 'next/server';
import {
  defineProxy,
  PreviewProxy,
  AppRouterMultisiteProxy,
  PersonalizeProxy,
  RedirectsProxy,
  LocaleProxy,
} from '@sitecore-content-sdk/nextjs/proxy';
import generatedSites from '.sitecore/sites.json';
import scConfig from 'sitecore.config';
import { routing } from './i18n/routing';
import client from './lib/sitecore-client';
import { gateRequest } from './lib/portal/auth/gate';
import { withJointMicrosites } from './lib/portal/microsites';
import { editingHostGate } from './lib/portal/editing-host';

// the deployment's sites, with its joint campaign microsites (PORTAL_MICROSITES) served by host
const sites = withJointMicrosites(generatedSites, scConfig.defaultLanguage);

/**
 * The SDK's preview proxy (active on the Sitecore-hosted editing host) checks every request a
 * preview tab makes with `getPage(pathname, language)`, but it runs before the locale proxy
 * and reads the language from the request only — so `/de-DE/products` was checked as an
 * English page named "de-DE/products" and answered 403. A localized path is therefore checked
 * as its unprefixed path in its own language.
 */
const PREVIEW_LOCALE_HEADER = 'x-portal-preview-locale';
class LocalizedPreviewProxy extends PreviewProxy {
  getLanguage(req: NextRequest, res?: Parameters<PreviewProxy['getLanguage']>[1]): string {
    return req.headers.get(PREVIEW_LOCALE_HEADER) || super.getLanguage(req, res);
  }
}
const previewProxy = new LocalizedPreviewProxy({
    client,
    ...scConfig.api.edge,
});
// every routed language, the default too: the switcher links English as /en/... from a German page
const prefixLocales = routing.locales.slice();
const preview = {
  name: previewProxy.name,
  handle: (req: NextRequest, res: Parameters<PreviewProxy['handle']>[1], ctx: Parameters<PreviewProxy['handle']>[2]) => {
    const [, first = '', ...rest] = req.nextUrl.pathname.split('/');
    const locale = prefixLocales.find((l) => l.toLowerCase() === first.toLowerCase());
    if (!locale) return previewProxy.handle(req, res, ctx);
    const url = req.nextUrl.clone();
    url.pathname = `/${rest.join('/')}`;
    const headers = new Headers(req.headers);
    headers.set(PREVIEW_LOCALE_HEADER, locale);
    return previewProxy.handle(new NextRequest(url, { headers, method: req.method }), res, ctx);
  },
};

const locale = new LocaleProxy({
  /**
   * List of sites for site resolver to work with
   */
  sites,
  /**
   * List of all supported locales configured in routing.ts
   */
  locales: routing.locales.slice(),
  // This function determines if the middleware should be turned off on per-request basis.
  // Certain paths are ignored by default (e.g. files and Next.js API routes), but you may wish to disable more.
  // This is an important performance consideration since Next.js Edge middleware runs on every request.
  // in multilanguage scenarios, we need locale middleware to always run first to ensure locale is set and used correctly by the rest of the middlewares
  skip: () => false,
});

const multisite = new AppRouterMultisiteProxy({
  /**
   * List of sites for site resolver to work with
   */
  sites,
  ...scConfig.api.edge,
  ...scConfig.multisite,
  // This function determines if the middleware should be turned off on per-request basis.
  // Certain paths are ignored by default (e.g. files and Next.js API routes), but you may wish to disable more.
  // This is an important performance consideration since Next.js Edge middleware runs on every request.
  skip: () => false,
});

const redirects = new RedirectsProxy({
  /**
   * List of sites for site resolver to work with
   */
  sites,
  ...scConfig.api.edge,
  ...scConfig.api.local,
  ...scConfig.redirects,
  // This function determines if the middleware should be turned off on per-request basis.
  // Certain paths are ignored by default (e.g. Next.js API routes), but you may wish to disable more.
  // By default it is disabled while in development mode.
  // This is an important performance consideration since Next.js Edge middleware runs on every request.
  skip: () => false,
});

const personalize = new PersonalizeProxy({
  /**
   * List of sites for site resolver to work with
   */
  sites,
  ...scConfig.api.edge,
  ...scConfig.personalize,
  // This function determines if the middleware should be turned off on per-request basis.
  // Certain paths are ignored by default (e.g. Next.js API routes), but you may wish to disable more.
  // By default it is disabled while in development mode.
  // This is an important performance consideration since Next.js Edge middleware runs on every request.
  skip: () => false,
});

export default async function proxy(req: NextRequest) {
  // an editing host renders pages for the Page builder only (everyone else: a quick 404)
  const editing = editingHostGate(req);
  if (editing) return editing;
  // gated mode: a page needs a session (the login flow, the Page builder and tooling pass)
  const gate = await gateRequest(req);
  if (gate) return gate;
  return defineProxy(preview, locale, multisite, redirects, personalize).exec(req);
}

export const config = {
  /*
   * Match all paths except for:
   * 1. API route handlers
   * 2. /_next (Next.js internals)
   * 3. /sitecore/api (Sitecore API routes)
   * 4. /- (Sitecore media)
   * 5. /healthz (Health check)
   * 7. all root files inside /public
   */
  matcher: [
    '/',
    '/((?!api/|\\.well-known/|sitemap|robots|llms|_next/|healthz|ch-picker|ch-info|theme-editor|portal-setup|sitecore-auth-callback|login|sitecore/api/|-/|favicon.ico|sc_logo.svg|ai/|pdf\\.min\\.mjs|pdf\\.worker\\.min\\.mjs).*)',
  ],
};