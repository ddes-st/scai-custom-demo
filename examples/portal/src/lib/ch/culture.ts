import "server-only";
import { currentSite } from "../portal/sites";
import { AsyncLocalStorage } from "node:async_hooks";
import { unstable_cache } from "next/cache";
import { requestContext } from "../portal/request-context";

/**
 * SitecoreAI language → Content Hub culture.
 *
 * Content Hub's Edge and REST APIs return localized properties as `{ "en-US": "…", "de-DE": "…" }`
 * maps. The page's SitecoreAI language (the `[locale]` segment: `en`, `de-DE`, …) decides which
 * entry `loc()` / `extractPropValue()` pick: the exact culture, else any culture of the same
 * language (`de` → `de-DE`), else `CH_DEFAULT_CULTURE` (en-US), else the first value. Explicit
 * pairs can be forced with `CH_CULTURE_MAP="en=en-GB,fr=fr-CA"`.
 *
 * The culture travels with the request (request context) and into the cached loaders through an
 * AsyncLocalStorage scope, and every loader's cache entry is keyed by it.
 */
export const DEFAULT_CULTURE = (process.env.CH_DEFAULT_CULTURE || "en-US").trim();

const MAP: Record<string, string> = Object.fromEntries(
  (process.env.CH_CULTURE_MAP || "")
    .split(",")
    .map((pair) => pair.split("=").map((s) => s.trim()))
    .filter(([k, v]) => k && v)
    .map(([k, v]) => [k.toLowerCase(), v])
);

/** The Content Hub culture to use for a SitecoreAI language. */
export function cultureFor(locale: string | undefined | null): string {
  const l = (locale || "").trim();
  if (!l) return DEFAULT_CULTURE;
  return MAP[l.toLowerCase()] || l;
}

const scope = new AsyncLocalStorage<string>();

/** The culture of the current request (or of the running cached loader). */
export function activeCulture(): string {
  const running = scope.getStore();
  if (running) return running;
  let locale = "";
  try { locale = requestContext().locale; } catch { /* outside a request (build, scripts) */ }
  return cultureFor(locale);
}

export const runWithCulture = <T>(culture: string, fn: () => Promise<T>): Promise<T> => scope.run(culture, fn);

/** The best value of a localized map for a culture. */
export function pickCulture(o: Record<string, unknown>, culture: string): string {
  const str = (k: string | undefined) => (k && typeof o[k] === "string" ? (o[k] as string) : "");
  const keys = Object.keys(o);
  const want = culture.toLowerCase();
  const lang = want.split(/[-_]/)[0];
  return (
    str(keys.find((k) => k.toLowerCase() === want)) ||
    str(keys.find((k) => k.toLowerCase().split(/[-_]/)[0] === lang && typeof o[k] === "string" && o[k])) ||
    str("invariant") ||
    str(keys.find((k) => k.toLowerCase() === DEFAULT_CULTURE.toLowerCase())) ||
    ((Object.values(o).find((x) => typeof x === "string" && x) as string | undefined) ?? "")
  );
}

/**
 * A 60 s cache per culture: the cache key carries the active culture and the loader runs inside
 * a scope where loc()/extractPropValue() see it. Extra arguments become part of the key.
 * `tags` adds cache tags — "xmc-site" for loaders filtered by the brand scope (Portal Settings
 * in SitecoreAI), so a SitecoreAI revalidation refreshes them too.
 */
export function cachedByCulture<A extends (string | number)[], R>(key: string, fn: (...args: A) => Promise<R>, opts: number | { revalidate?: number; tags?: string[] } = 60) {
  const revalidate = typeof opts === "number" ? opts : (opts.revalidate ?? 60);
  const extra = typeof opts === "number" ? [] : (opts.tags ?? []);
  return (...args: A): Promise<R> => {
    const culture = activeCulture();
    // per site too: one deployment can serve several sites (joint microsites), and the brand
    // scope and profiles are the site's
    const site = currentSite();
    // tags: "ch" (everything from Content Hub) and "ch:<key>" (one loader) — see /api/revalidate
    return unstable_cache(() => runWithCulture(culture, () => fn(...args)), [key, culture, site, ...args.map(String)], { revalidate, tags: ["ch", `ch:${key}`, ...extra] })();
  };
}

/** The tag of the SitecoreAI-side caches; brand-scoped Content Hub loaders carry it too. */
export const SCOPED = { tags: ["xmc-site"] };
