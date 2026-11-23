export const TRUSTED_IMAGE_HOSTS = [
  "*.public.blob.vercel-storage.com", // Vercel Blob (persona avatars, some brand assets)
  "*.sitecorecloud.io", // Sitecore Edge media + platform
  "images.unsplash.com", // demo / preview content
  "picsum.photos", // demo / preview content
] as const;

/**
 * Match a hostname against one allowlist entry. A leading `*.` matches
 * exactly one subdomain label — mirroring Next's `remotePatterns` `*`
 * semantics so the build-time allowlist and the runtime check agree.
 */
const matchesHostPattern = (host: string, pattern: string): boolean => {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1); // ".sitecorecloud.io"
    if (!host.endsWith(suffix)) return false;
    const label = host.slice(0, host.length - suffix.length);
    return label.length > 0 && !label.includes(".");
  }
  return host === pattern;
};

/**
 * True when `src` should go through Next's image optimizer:
 *   - relative / same-origin URLs (our own `/api/themes/asset` proxy, etc.)
 *   - https hosts on {@link TRUSTED_IMAGE_HOSTS}
 *
 * Everything else — unknown brand hosts, `data:` / `blob:` sources, or an
 * unparseable value — returns false, so `<NextImage>` renders it unoptimized.
 */
export const isTrustedImageHost = (src: string | undefined | null): boolean => {
  if (!src) return false;
  if (src.startsWith("/")) return true; // relative → same-origin
  if (src.startsWith("data:") || src.startsWith("blob:")) return false;
  let host: string;
  try {
    host = new URL(src).hostname;
  } catch {
    return false;
  }
  return TRUSTED_IMAGE_HOSTS.some((pattern) =>
    matchesHostPattern(host, pattern),
  );
};
