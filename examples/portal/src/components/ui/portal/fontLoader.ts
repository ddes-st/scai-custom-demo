"use client";

/** Client-side FontFace loading of brand font files, fetched through the same-origin proxy. */

const loadedFonts = new Map<number, string>();

export async function loadBrandFont(assetId: number, proxiedUrl: string): Promise<string> {
  const existing = loadedFonts.get(assetId);
  if (existing) return existing;
  const r = await fetch(proxiedUrl);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = await r.arrayBuffer();
  const family = `bgl-font-${assetId}`;
  const face = new FontFace(family, buf);
  await face.load();
  (document as any).fonts.add(face);
  loadedFonts.set(assetId, family);
  return family;
}

/** "SpaceGrotesk-Bold.woff2" -> "SpaceGrotesk Bold". */
export function fontDisplayName(fileName: string, title: string): string {
  if (title && !/\.(woff2?|ttf|otf)$/i.test(title)) return title;
  return (title || fileName).replace(/\.(woff2?|ttf|otf)$/i, "").replace(/[-_]+/g, " ");
}

/**
 * Byte-level access URL for fetch()/FontFace/PDF.js consumers:
 * - signed delivery URLs (gated mode) are fetched DIRECTLY — the delivery CDN sends CORS *
 *   (verified live), so no proxy hop is needed
 * - app-relative /api/asset/<id> (gated mode) as is: same-origin bytes (cached by Vercel's
 *   CDN), or a redirect to the CORS-enabled delivery CDN for large files
 * - public links go through the /api/file proxy (their CDN's CORS is not guaranteed)
 */
export function proxied(url: string): string {
  if (!url) return "";
  if (url.includes("/api/delivery/")) return url;
  if (url.startsWith("/api/asset/")) return url;
  return `/api/file?u=${encodeURIComponent(url)}`;
}
