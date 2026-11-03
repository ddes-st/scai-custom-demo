/**
 * Gated mode's file URLs: same-origin and VERSIONED — /api/asset/<id>?r=preview&v=<version>,
 * the version being the asset's last modification. Content that can't change under a URL can
 * be cached for good: Vercel's CDN and the browser keep the bytes, and a changed file (new
 * modification time) gets a new URL, so it reloads only when it changes. Pages build these
 * URLs from data they already have — rendering a page costs no Content Hub call for files.
 */

/** A short, URL-safe version token from a modification timestamp (or any string). */
export function versionKey(v: unknown): string {
  const s = String(v ?? "");
  const t = Date.parse(s);
  return Number.isFinite(t) ? t.toString(36) : s.replace(/[^\w.-]/g, "").slice(0, 40);
}

import { isEditingHost } from "../portal/editing-host-flag";

/**
 * An editing host's images from its live portal: PORTAL_IMAGE_ORIGIN (the live portal's https origin, set by
 * the Demo Builder only when the live portal isn't gated). Sitecore's editing render gives the browser — an
 * author's, or SitecoreAI's own page renderer — the draft-mode cookie, and Vercel's cache skips every request
 * that carries it: each image then ran the portal again. The live host never gets that cookie, and it keeps
 * files anonymous visitors may see in the shared cache, after its own access check. "" when not set, not an
 * https origin, or not an editing host (a live portal never points elsewhere). Client-safe.
 */
export function imageOrigin(): string {
  if (!isEditingHost()) return "";
  const raw = (process.env.PORTAL_IMAGE_ORIGIN || "").trim();
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && (u.pathname === "/" || u.pathname === "") && !u.search && !u.hash && !u.username ? u.origin : "";
  } catch {
    return "";
  }
}

/** A portal image (/api/asset/…) from the live portal on an editing host (imageOrigin); other URLs as they are.
 *  Images only: downloads, PDFs, fonts and file lists (partner kits, sales) stay on the deployment's own origin. */
export function imageFromOrigin(url: string): string {
  const origin = imageOrigin();
  return origin && isPortalFileUrl(url) ? `${origin}${url}` : url;
}

/** The widths /api/asset resizes images to (?w=); other values snap up to the next one. */
export const IMAGE_WIDTHS = [160, 320, 640, 960, 1280, 1920];
/** True for a portal file URL (hybrid/gated mode), which can be asked for at a width. */
export const isPortalFileUrl = (url: string) => url.startsWith("/api/asset/");

/** A portal image URL (/api/asset/…) asked for at a width — the route resizes it; other URLs as they are. */
export function sizedFileUrl(url: string, w: number): string {
  if (!isPortalFileUrl(url)) return url;
  // snapped to the widths the route serves, so equal sizes share one cached file
  const snapped = IMAGE_WIDTHS.find((x) => x >= w) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
  return `${url}${url.includes("?") ? "&" : "?"}w=${snapped}`;
}

export function gatedFileUrl(id: string | number, opts: { preview?: boolean; rendition?: "thumbnail"; version?: unknown; publicLink?: string } = {}): string {
  const q = new URLSearchParams();
  if (opts.preview) q.set("r", "preview");
  else if (opts.rendition) q.set("r", opts.rendition);
  // a named public link of the asset (a crop such as HomePageHero), streamed by /api/asset after the access check
  if (opts.publicLink) q.set("pl", opts.publicLink);
  const v = opts.version != null && opts.version !== "" ? versionKey(opts.version) : "";
  if (v) q.set("v", v);
  const qs = q.toString();
  return `/api/asset/${encodeURIComponent(String(id))}${qs ? `?${qs}` : ""}`;
}
