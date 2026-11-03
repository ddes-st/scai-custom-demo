/**
 * The hub's forwarding route (hub mode only, PORTAL_HUB=1): /api/hub/<tooling path>?head=<origin>
 * → <head>/api/<tooling path>, with the tools key (PORTAL_TOOLS_KEY) added server-side so it never
 * reaches the browser. Only for the hub's own pages (PORTAL_HUB_ACCESS_KEY and/or the author's Sitecore
 * token, PORTAL_HUB_AUTH), only the tooling APIs
 * the Marketplace apps use, only https heads listed in PORTAL_HUB_HEADS. See hub-access.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { hubCallerDenied, hubHead } from "src/lib/portal/hub-access";
import { platformErrorText } from "src/lib/portal/error-text";

export const dynamic = "force-dynamic";

const PATHS = /^(picker\/(definitions|facets|search)|ch-info(\/refresh)?|theme|portal-setup\/(discovery|published)|portal-health)$/;
const NO_STORE = { "Cache-Control": "no-store" };

async function forward(request: NextRequest, path: string[], method: "GET" | "POST") {
  if (process.env.PORTAL_HUB !== "1") return NextResponse.json({ error: "Not a hub deployment." }, { status: 404, headers: NO_STORE });
  const denied = await hubCallerDenied(request);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status, headers: NO_STORE });
  const sub = path.join("/");
  if (!PATHS.test(sub)) return NextResponse.json({ error: "Not a tooling API." }, { status: 404, headers: NO_STORE });
  const head = hubHead(request.nextUrl.searchParams.get("head"));
  if (!head) return NextResponse.json({ error: "Unknown portal deployment (head) — it must be https and listed in the hub's PORTAL_HUB_HEADS." }, { status: 400, headers: NO_STORE });
  const target = new URL(`/api/${sub}`, head);
  request.nextUrl.searchParams.forEach((v, k) => { if (k !== "head") target.searchParams.append(k, v); });
  const headers: Record<string, string> = { Accept: "application/json" };
  const ct = request.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;
  if (process.env.PORTAL_TOOLS_KEY) headers["x-portal-tools-key"] = process.env.PORTAL_TOOLS_KEY;
  try {
    const r = await fetch(target, { method, headers, body: method === "POST" ? await request.text() : undefined, cache: "no-store", signal: AbortSignal.timeout(45_000), redirect: "manual" });
    const body = await r.text();
    // Vercel's own error instead of the portal's answer (not deployed, timed out, paused): the cause in words
    const platform = r.ok ? null : platformErrorText(head.host, r.status, r.headers.get("x-vercel-error"));
    if (platform) return NextResponse.json({ error: platform }, { status: r.status, headers: NO_STORE });
    return new NextResponse(body, { status: r.status, headers: { ...NO_STORE, "Content-Type": r.headers.get("content-type") || "application/json" } });
  } catch (e: any) {
    return NextResponse.json({ error: `The site's portal (${head.host}) didn't answer: ${e?.name === "TimeoutError" ? "timeout" : "unreachable"}.` }, { status: 502, headers: NO_STORE });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await params).path, "GET");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await params).path, "POST");
}
