import "server-only";
import { cache } from "react";

/**
 * Per-request store (React `cache()` is request-scoped on the server): the catch-all page
 * records the public URL segments and search params, and the Portal components read the
 * id/slug of a wildcard detail page or `?brand=` / `?layout=` without prop drilling through
 * the Sitecore layout tree.
 */
export interface PortalRequest {
  /** The public path segments, e.g. ["products", "db.demo.product.1"]. */
  segments: string[];
  /** The last segment when the route resolved through a wildcard (`*`) item; "" otherwise. */
  slug: string;
  /** The request's search params (first value per key). */
  search: Record<string, string>;
  /** True when the layout came from a wildcard item. */
  wildcard: boolean;
  /** The page's SitecoreAI language (the [locale] segment), e.g. "en" or "de-DE". */
  locale: string;
  /** The site dictionary of that language (key → phrase), for the UI strings (ui-text.ts). */
  dictionary: Record<string, unknown>;
  /** The SitecoreAI site this request is for (the [site] segment; a tooling API's ?site=); "" = the deployment's default site. */
  site: string;
}

const store = cache((): PortalRequest => ({ segments: [], slug: "", search: {}, wildcard: false, locale: "", dictionary: {}, site: "" }));

export function requestContext(): PortalRequest {
  return store();
}

export function setRequestContext(patch: Partial<PortalRequest>): void {
  Object.assign(store(), patch);
}
