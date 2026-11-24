import { SitecoreClient } from '@sitecore-content-sdk/nextjs/client';
import scConfig from 'sitecore.config';

/**
 * Edge stamps media library URLs onto the public site host
 * (`https://<site>/-/media/Project/...`). That host does not store the file.
 * Root-relative paths go through the `/-/media` rewrite to the CM, which does.
 * Customer CDN paths such as `/-/media/DOM/` are left unchanged.
 */
export function rewriteProjectMediaToAppPath(value: string): string {
  return value.replace(
    /https?:\/\/[^/\s"'<>]+(\/-\/(?:media|jssmedia)\/Project\/)/gi,
    '$1',
  );
}

const client = new SitecoreClient({
  ...scConfig,
  rewriteMediaUrls: rewriteProjectMediaToAppPath,
});

export default client;
