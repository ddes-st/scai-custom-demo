import { defineConfig } from '@sitecore-content-sdk/nextjs/config';
/**
 * @type {import('@sitecore-content-sdk/nextjs/config').SitecoreConfig}
 * Connection values (context ids, site name, editing secret) come from the environment —
 * see .env.remote.example. Only portal-specific defaults live here.
 */
export default defineConfig({
  // All pages are rendered per request (Content Hub data is cached 60 s); nothing is prebuilt.
  generateStaticPaths: false,
  // No embedded personalization on the portal: saves a CDP round trip per request.
  personalize: { enabled: false },
});
