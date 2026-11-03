import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { portalHeaders } from './src/lib/portal/response-headers';

const nextConfig: NextConfig = {
  // The Content SDK's client bundle needs a context id too (NEXT_PUBLIC_SITECORE_EDGE_CONTEXT_ID);
  // without one it throws at load and the page is replaced by the error page after hydration.
  // Fall back to the server context id at build time so a missing public variable never takes
  // the site down (a scoped context id is still the better value for browsers).
  env: {
    NEXT_PUBLIC_SITECORE_EDGE_CONTEXT_ID: process.env.NEXT_PUBLIC_SITECORE_EDGE_CONTEXT_ID || process.env.SITECORE_EDGE_CONTEXT_ID || '',
    // an editing host (PORTAL_EDITING_HOST=1, or PORTAL_NOINDEX=1 with PORTAL_FILES=asset): the browser bundle needs it too (one image size)
    // an editing host's images from its live portal (fileUrl.imageOrigin): a public origin, set by the Demo Builder when the live portal isn't gated
    PORTAL_IMAGE_ORIGIN: process.env.PORTAL_IMAGE_ORIGIN || '',
    PORTAL_EDITING_HOST: process.env.PORTAL_EDITING_HOST === '1' || (process.env.PORTAL_NOINDEX === '1' && (process.env.PORTAL_FILES || '').trim().toLowerCase() === 'asset') ? '1' : '',
  },
  // Allow specifying a distinct distDir when concurrently running app in a container
  distDir: process.env.NEXTJS_DIST_DIR || '.next',
  
  // Enable React Strict Mode
  reactStrictMode: true,

  // Disable the X-Powered-By header. Follows security best practices.
  poweredByHeader: false,

  // use this configuration to ensure that only images from the whitelisted domains
  // can be served from the Next.js Image Optimization API
  // see https://nextjs.org/docs/app/api-reference/components/image#remotepatterns
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'edge*.**',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'xmc-*.**',
        port: '',
      },
    ],
    // Disable image optimization in development to avoid upstream timeouts
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // PORTAL_NOINDEX=1 (e.g. an editing host): every response asks crawlers not to index or follow
  // (robots.txt and the sitemaps close too, src/lib/portal/auth/closed.ts). Read at build time.
  headers: async () => portalHeaders(),

  // use this configuration to serve the sitemap.xml and robots.txt files from the API route handlers
  rewrites: async () => {
    return [
      {
        // the Marketplace app routes with their access key in the one path segment App Studio
        // allows (/ch-picker_<key>): the same pages; the key is read from the URL in the browser
        // (src/lib/portal/tools-fetch.ts)
        source: '/:page(portal-setup|theme-editor|ch-picker)_:key([A-Za-z0-9_-]{24,200})',
        destination: '/:page',
        locale: false,
      },
      {
        // sitemap.xml serves the main sitemap
        source: '/sitemap.xml',
        destination: '/api/sitemap',
        locale: false,
      },
      {
        // Numbered sitemap index pages (e.g. /sitemap-0.xml, /sitemap-1.xml)
        source: '/sitemap-:id(\\d+).xml',
        destination: '/api/sitemap',
        locale: false,
      },
      {
        // Content Hub detail pages (brands, products, press releases)
        source: '/sitemap-ch.xml',
        destination: '/api/sitemap-ch',
        locale: false,
      },
      {
        // LLM-optimized sitemap for AI crawler ingestion
        source: '/sitemap-llm.xml',
        destination: '/api/sitemap-llm',
        locale: false,
      },
      {
        source: '/robots.txt',
        destination: '/api/robots',
        locale: false,
      },
      {
        source: '/llms.txt',
        destination: '/api/llms-txt',
        locale: false,
      },
      {
        source: '/.well-known/ai.txt',
        destination: '/api/well-known/ai-txt',
        locale: false,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
