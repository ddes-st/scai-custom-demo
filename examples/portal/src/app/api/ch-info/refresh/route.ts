/**
 * POST /api/ch-info/refresh — the Content Hub info panel's "Refresh now": drops this
 * deployment's Content Hub caches for the given definitions (all of them without any) and asks
 * the portal's other deployment — the public site (NEXT_PUBLIC_SITE_URL) or the editing host
 * (PORTAL_EDITING_URL), whichever this one isn't — to do the same through /api/revalidate with
 * the shared REVALIDATE_SECRET.
 *
 * The panel has no secret to send, so the route only accepts same-origin browser calls (the
 * panel is served from this deployment) and runs at most once per 10 seconds per instance;
 * dropping a cache only makes the next page view fetch fresh data from Content Hub.
 *
 * Body: { definitions?: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { chTagsFor } from "src/lib/portal/revalidate-tags";
import { toolsDenied, toolsKeyMatches } from "src/lib/portal/auth/tools";

export const dynamic = "force-dynamic";

let last = 0;
const MIN_GAP_MS = 10_000;
const origin = (u: string) => { try { return new URL(u).origin; } catch { return ""; } };

export async function POST(request: NextRequest) {
  const denied = toolsDenied(request);
  if (denied) return denied;
  const headers = { "Cache-Control": "no-store" };
  const self = request.nextUrl.origin;
  const from = request.headers.get("origin") || origin(request.headers.get("referer") || "");
  // the panel of this deployment, or the hub forwarding it with the tools key (no browser origin)
  if (from !== self && !toolsKeyMatches(request)) return NextResponse.json({ error: "Only the Content Hub info panel of this deployment may refresh." }, { status: 403, headers });
  const now = Date.now();
  if (now - last < MIN_GAP_MS) return NextResponse.json({ error: `Refreshed a moment ago — try again in ${Math.ceil((MIN_GAP_MS - (now - last)) / 1000)} s.` }, { status: 429, headers });
  last = now;

  let body: any = null;
  try { body = await request.json(); } catch { body = null; }
  const definitions: string[] = (Array.isArray(body?.definitions) ? body.definitions : []).map((d: unknown) => String(d ?? "").trim().slice(0, 80)).filter(Boolean).slice(0, 20);
  const tags = new Set<string>(definitions.length ? definitions.flatMap(chTagsFor) : ["ch"]);
  // expire now: the next view fetches fresh data ("max" would serve the stale entry once more)
  for (const t of tags) revalidateTag(t, { expire: 0 });

  // the other deployment of this portal
  const secret = process.env.REVALIDATE_SECRET || "";
  const others = [process.env.NEXT_PUBLIC_SITE_URL || "", process.env.PORTAL_EDITING_URL || ""].map(origin).filter((o) => o && o !== self && !/localhost/.test(o));
  const remote = await Promise.all([...new Set(others)].map(async (o) => {
    if (!secret) return { host: o.replace(/^https?:\/\//, ""), ok: false, error: "REVALIDATE_SECRET is not set here" };
    const targets = definitions.length ? definitions : [""];
    try {
      for (const d of targets) {
        const r = await fetch(`${o}/api/revalidate${d ? `?definition=${encodeURIComponent(d)}` : ""}`, { method: "POST", headers: { "x-revalidate-secret": secret }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) return { host: o.replace(/^https?:\/\//, ""), ok: false, error: `HTTP ${r.status}` };
      }
      return { host: o.replace(/^https?:\/\//, ""), ok: true };
    } catch (e: any) { return { host: o.replace(/^https?:\/\//, ""), ok: false, error: String(e?.message ?? e).slice(0, 120) }; }
  }));
  return NextResponse.json({ ok: true, revalidated: [...tags], here: self.replace(/^https?:\/\//, ""), remote }, { headers });
}
