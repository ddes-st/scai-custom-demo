/** POST /api/logout — drops the session cookie and returns to the home page. */
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "src/lib/portal/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const home = request.nextUrl.clone();
  home.pathname = "/"; home.search = "";
  const res = NextResponse.redirect(home, 303);
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
