/**
 * CM that stores media binaries. Edge links point at the public site host instead.
 * Override with NEXT_PUBLIC_SITECORE_API_HOST or SITECORE_API_HOST.
 */
const DEFAULT_SITECORE_MEDIA_ORIGIN =
  'https://xmc-sitecoresaa0144-ddcustomdem0a79-sfpi6ed3.sitecorecloud.io';

export function sitecoreMediaOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITECORE_API_HOST || process.env.SITECORE_API_HOST || '';
  return (fromEnv || DEFAULT_SITECORE_MEDIA_ORIGIN).replace(/\/$/, '');
}
