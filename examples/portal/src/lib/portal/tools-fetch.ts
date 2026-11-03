/**
 * fetch for the Marketplace apps' calls to the head's tooling APIs: adds the tools key the app
 * was opened with (in the extension point URL, kept for the frame's session) as the
 * `x-portal-tools-key` header. App Studio routes allow one path segment of letters, digits, `_`
 * and `-` only, so the key comes after the page name (`/ch-picker_<key>`, rewritten to the page
 * in next.config.ts); `?k=<key>` works too where a URL may carry a query. Without a key it is plain fetch. See src/lib/portal/auth/tools.ts.
 * In hub mode that key is the hub's access key (PORTAL_HUB_ACCESS_KEY), sent as
 * `x-portal-hub-key` to the hub's forwarding route (see hub-access.ts).
 */
import { getHead, headReady, HUB } from "./hub";
import { bearer } from "./sitecore-auth";

const STORE = "portal-tools-key";
let key: string | null | undefined;

/** The key in an app URL: `/ch-picker_<key>` (App Studio) or `?k=<key>`; null without one. */
export function keyFromLocation(loc: { pathname: string; search: string }): string | null {
  const m = /^\/(?:portal-setup|theme-editor|ch-picker)_([A-Za-z0-9_-]{24,200})\/?$/.exec(loc.pathname);
  return m ? m[1] : new URLSearchParams(loc.search).get("k");
}

/** The picker's larger window gets the key from the modal that opened it (picker-popup.ts). */
export function setToolsKey(k: string) {
  key = k || null;
}
/** The key this frame was opened with ("" without one), to hand to the larger window. */
export const currentToolsKey = () => toolsKey() ?? "";

function toolsKey(): string | null {
  if (key !== undefined) return key;
  key = null;
  try {
    const fromUrl = keyFromLocation(window.location);
    if (fromUrl) { key = fromUrl; try { sessionStorage.setItem(STORE, fromUrl); } catch { /* storage blocked in the frame */ } }
    else key = sessionStorage.getItem(STORE);
  } catch { /* no window or storage */ }
  return key;
}

// the SitecoreAI site the app works on (the open page's site, the setup's chosen site): one
// deployment can serve several sites (joint microsites), so every tooling call names it
let site = "";
/** The site the app's tooling calls are for ("" = the deployment's default). */
export function setToolsSite(name: string) {
  site = /^[\w][\w -]{0,99}$/.test(name.trim()) ? name.trim() : "";
}
/** The site name of a SitecoreAI item path (/sitecore/content/<collection>/<site>/…), or "". */
export const siteNameOf = (itemPath: string) => /^\/sitecore\/content\/[^/]+\/([^/]+)/i.exec(itemPath || "")?.[1] ?? "";

/** `/api/x?y` with `site=` added when the app knows its site. */
function withSite(input: string): string {
  if (!site || !input.startsWith("/api/")) return input;
  const url = new URL(input, "http://local");
  url.searchParams.set("site", site);
  return `${url.pathname}${url.search}`;
}

export async function toolsFetch(input: string, init: RequestInit = {}): Promise<Response> {
  input = withSite(input);
  // hub mode: the site's head, through the hub's forwarding route (which adds the tools key)
  if (HUB && input.startsWith("/api/")) {
    await headReady();
    const url = new URL(`/api/hub/${input.slice("/api/".length)}`, window.location.origin);
    url.searchParams.set("head", getHead());
    const headers = new Headers(init.headers);
    const k = toolsKey();
    if (k) headers.set("x-portal-hub-key", k);
    // Phase B: the author's Sitecore token, when signed in (sitecore-auth.ts)
    const t = await bearer();
    if (t) headers.set("Authorization", `Bearer ${t}`);
    return fetch(url.toString(), { ...init, headers });
  }
  const k = toolsKey();
  if (!k) return fetch(input, init);
  const headers = new Headers(init.headers);
  headers.set("x-portal-tools-key", k);
  return fetch(input, { ...init, headers });
}
