/**
 * The gate in front of every page request (runs in the Content SDK proxy, edge runtime):
 *  - public mode: nothing to do (pages with an audience other than "everyone" 404 in the route);
 *  - hybrid mode: everything passes here; the route redirects to /login for a page the visitor
 *    may not see (so the public sections stay public and cacheable);
 *  - gated mode: every page needs a session; the login flow, the Page builder (editing
 *    requests carry the draft-mode cookie) and the head's own tooling routes pass. The cookie
 *    can't be verified here (any value passes), so the page route checks the session again
 *    unless Next confirms draft mode — this is only the early redirect.
 * File and API routes are not matched by the proxy and check the session themselves.
 */
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionSubject } from "./session";
import { jointMicrositeOnHost } from "../microsites";

const OPEN = /^\/(login|theme-editor|ch-picker|ch-info|portal-setup|api\/|sitemap|robots|llms|healthz|_next\/|favicon\.ico|sc_logo\.svg|pdf\.(min|worker\.min)\.mjs)/;

export async function gateRequest(req: NextRequest): Promise<NextResponse | null> {
  if ((process.env.SITE_MODE || "public") !== "gated") return null;
  // a joint campaign microsite (its own host) is public whatever the portal's mode is
  if (jointMicrositeOnHost(req.headers.get("host") || req.nextUrl.host)) return null;
  const { pathname } = req.nextUrl;
  if (OPEN.test(pathname) || req.cookies.has("__prerender_bypass")) return null;
  const subject = await sessionSubject(req.cookies.get(SESSION_COOKIE)?.value, process.env.AUTH_SECRET || "");
  if (subject) return null;
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = pathname !== "/" ? `?from=${encodeURIComponent(pathname + req.nextUrl.search)}` : "";
  return NextResponse.redirect(login);
}
