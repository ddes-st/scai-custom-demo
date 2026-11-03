/**
 * POST /api/login (form: user, password, from) — the portal's own sign-in. A good login sets the
 * session cookie and returns to `from` (same-origin paths only); a bad one goes back to /login
 * with ?error=1 after a uniform delay. Disabled in public mode and without AUTH_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "src/lib/ch/env";
import { verifyLogin } from "src/lib/portal/auth/credentials";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_S } from "src/lib/portal/auth/session";
import { clientIp, Limiter } from "src/lib/portal/auth/rate-limit";

export const dynamic = "force-dynamic";
const FAIL_DELAY_MS = 800;
// failed attempts: 20 per client and 8 per username per 15 minutes (per instance)
const perIp = new Limiter(20, 15 * 60_000);
const perUser = new Limiter(8, 15 * 60_000);

// same-origin paths only: no "//host", no backslashes and no control characters (browsers drop tabs and newlines, turning "/\t/evil" into "//evil")
const safePath = (from: string) => (from.startsWith("/") && !from.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(from) ? from : "/");

export async function POST(request: NextRequest) {
  if (env.siteMode === "public" || !env.authSecret) return NextResponse.json({ error: "Sign-in is not enabled on this portal." }, { status: 404 });
  const form = await request.formData();
  const user = String(form.get("user") || "");
  const password = String(form.get("password") || "");
  const from = safePath(String(form.get("from") || "/"));
  const ip = clientIp(request.headers);
  const name = user.trim().toLowerCase().slice(0, 64);
  const back = (code: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?error=${code}${from !== "/" ? `&from=${encodeURIComponent(from)}` : ""}`;
    return NextResponse.redirect(url, 303);
  };
  if (perIp.blocked(ip) || perUser.blocked(name)) {
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return back("2");
  }
  const login = verifyLogin(user, password);
  if (!login) {
    perIp.hit(ip);
    perUser.hit(name);
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return back("1");
  }
  perUser.reset(name);
  const target = request.nextUrl.clone();
  target.pathname = from.split("?")[0];
  target.search = from.includes("?") ? `?${from.split("?").slice(1).join("?")}` : "";
  const res = NextResponse.redirect(target, 303);
  res.cookies.set(SESSION_COOKIE, await createSessionToken(env.authSecret, login.subject), { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: SESSION_TTL_S });
  return res;
}
