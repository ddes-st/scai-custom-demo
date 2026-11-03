/**
 * GET /api/hub-auth/check — Phase B sign-in check (hub mode): verifies the caller's Sitecore token
 * (Authorization: Bearer) as the forwarding route would and answers whether the hub accepts it,
 * why not, the token's non-secret claims (issuer, audience, organisation, tenant, expiry) and the
 * hub's auth mode. Never echoes the token.
 */
import { NextResponse } from "next/server";
import { bearerOf, verifySitecoreToken } from "src/lib/portal/sitecore-token";
import { hubAuthMode } from "src/lib/portal/hub-access";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (process.env.PORTAL_HUB !== "1") return NextResponse.json({ ok: false, reason: "Not a hub deployment." }, { status: 404, headers: NO_STORE });
  const token = bearerOf(request);
  if (!token) return NextResponse.json({ ok: false, reason: "no token", mode: hubAuthMode() }, { status: 401, headers: NO_STORE });
  const check = await verifySitecoreToken(token);
  return NextResponse.json({ ...check, mode: hubAuthMode() }, { status: check.ok ? 200 : 401, headers: NO_STORE });
}
