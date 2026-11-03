import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * The head's tooling APIs (the Marketplace apps' picker, setup discovery, Content Hub info and
 * health routes) answer authors, not visitors. With PORTAL_TOOLS_KEY set they require it — the
 * apps pass it on from their own URL (`/ch-picker_<key>` as the extension point's route in App
 * Studio; see tools-fetch.ts) as the `x-portal-tools-key` header. Without the key they stay
 * open as before, minus the records nobody may list (see pickableDefinition).
 */
export function toolsDenied(request: Request): NextResponse | null {
  const want = process.env.PORTAL_TOOLS_KEY || "";
  if (!want) return null;
  const got = request.headers.get("x-portal-tools-key") || "";
  const a = Buffer.from(got), b = Buffer.from(want);
  if (a.length === b.length && timingSafeEqual(a, b)) return null;
  return NextResponse.json({ error: "This API is for the portal's Marketplace apps (tools key missing or wrong)." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

/** True when PORTAL_TOOLS_KEY is set and the request carries it (e.g. the hub's forwarding route). */
export function toolsKeyMatches(request: Request): boolean {
  const want = process.env.PORTAL_TOOLS_KEY || "";
  if (!want) return false;
  const got = request.headers.get("x-portal-tools-key") || "";
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Definitions the tooling APIs never list: the portal's own records (partners, usage events, configuration). */
export const pickableDefinition = (definition: string) => !!definition && !/^BrandSite[_.]/i.test(definition);
