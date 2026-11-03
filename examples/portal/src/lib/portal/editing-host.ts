/**
 * An editing host (editing-host-flag.ts): the deployment the Page builder renders pages with. Its address is
 * public on *.vercel.app but its pages are for the Page builder only — anyone else (crawlers, preview
 * services, scanners) got full, uncached page renders on the preview data. Edge-safe (runs in the proxy).
 */
import { NextResponse, type NextRequest } from "next/server";
import { isEditingHost } from "./editing-host-flag";

// what the Content SDK sends: the internal render request of /api/editing/render (its headers and the
// draft-mode cookie) and a Page builder preview tab (the SDK's preview cookies)
const BUILDER_HEADERS = ["x-sitecore-editing-params", "__content_sdk_preview"];
const BUILDER_COOKIES = ["__prerender_bypass", "sc_preview", "sc_preview_token"];

/** Does this request come from a Page builder session? Presence only: this keeps load away, it isn't access control. */
export function isPageBuilderRequest(req: NextRequest): boolean {
  return BUILDER_HEADERS.some((h) => req.headers.has(h)) || BUILDER_COOKIES.some((c) => req.cookies.has(c));
}

// the head's own app pages (Marketplace apps, sign-in callback, login) and everything that isn't a page
const OPEN = /^\/(api\/|_next\/|theme-editor|ch-picker|ch-info|portal-setup|sitecore-auth-callback|login|sitemap|robots|llms|ai\/|healthz|sitecore\/api\/|-\/|favicon\.ico|sc_logo\.svg|pdf\.(min|worker\.min)\.mjs)/;

/**
 * On an editing host, a page request without a Page builder session gets a quick 404 (no render, no
 * Content Hub or Edge call). Not cached anywhere: the same path must still render for the Page builder.
 * Null: go on.
 */
export function editingHostGate(req: NextRequest): NextResponse | null {
  if (!isEditingHost()) return null;
  if (OPEN.test(req.nextUrl.pathname) || isPageBuilderRequest(req)) return null;
  return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
