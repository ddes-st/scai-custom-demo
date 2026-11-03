import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { requestContext, setRequestContext } from "./request-context";
import { jointMicrositeOf, jointMicrosites } from "./microsites";
import { env } from "../ch/env";

/**
 * The SitecoreAI site a request is for. One deployment can serve several sites of a collection:
 * the portal and its campaign microsites (PORTAL_MICROSITES, by host — see proxy.ts). The catch-all
 * page records the [site] segment, a tooling API its ?site=; everything that reads per-site
 * SitecoreAI data (settings, sections, profiles, partners) asks for this site, the deployment's
 * default site when there is none.
 */
// the deployment's default site: what sitecore.config takes too (read directly, so loaders that ask
// for the site don't need the SDK config — and its context id — to be loadable)
const defaultSite = () => (process.env.NEXT_PUBLIC_DEFAULT_SITE_NAME || "").trim();

// a tooling API's site: React's per-request cache() is a page-render store, so route handlers
// carry the site in an async context instead (entered by applyRequestSite)
const apiSite = new AsyncLocalStorage<string>();

export function currentSite(): string {
  let site = apiSite.getStore() || "";
  if (!site) try { site = requestContext().site; } catch { /* outside a request */ }
  return site || defaultSite();
}

const SITE_NAME = /^[\w][\w -]{0,99}$/;

/** A tooling API's ?site=: the deployment's default site or one of its joint microsites, else null (ignored). */
export function siteFromRequest(request: Request): string | null {
  const raw = new URL(request.url).searchParams.get("site")?.trim() ?? "";
  if (!raw || !SITE_NAME.test(raw)) return null;
  const lower = raw.toLowerCase();
  if (lower === defaultSite().toLowerCase()) return defaultSite();
  return jointMicrosites().find((m) => m.site.toLowerCase() === lower)?.site ?? null;
}

/** Serve a tooling API for the site its request names (?site=), when it is one of this deployment's. */
export function applyRequestSite(request: Request): string {
  const site = siteFromRequest(request);
  if (site) {
    // for the rest of this handler (its awaits inherit the async context)
    apiSite.enterWith(site);
    setRequestContext({ site });
  }
  return currentSite();
}

/** What the current site is: a joint microsite of this deployment, else the deployment's kind (PORTAL_SITE_KIND). */
export function siteKindNow(): "portal" | "microsite" {
  return jointMicrositeOf(currentSite()) ? "microsite" : env.siteKind;
}

/** The current microsite's Microsite record: its PORTAL_MICROSITES entry, else PORTAL_MICROSITE. */
export function micrositeIdNow(): string {
  return jointMicrositeOf(currentSite())?.microsite || env.micrositeId;
}

/** The portal's origin for a microsite's links back: the deployment's own live URL in joint mode, else PORTAL_PORTAL_URL. */
export function portalUrlNow(): string {
  if (jointMicrositeOf(currentSite())) {
    try { return new URL(String(process.env.NEXT_PUBLIC_SITE_URL || "")).origin; } catch { return ""; }
  }
  return env.portalUrl;
}

/** The current site's mode: a joint microsite is always public (sign-in, partner pages and gated files are the portal's). */
export function siteModeNow(): "public" | "hybrid" | "gated" {
  return jointMicrositeOf(currentSite()) ? "public" : env.siteMode;
}
