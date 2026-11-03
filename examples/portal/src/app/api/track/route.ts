/**
 * POST /api/track — a download or a detail-page view from the portal's tracker (sendBeacon,
 * JSON {a: action, k: kind, t: target id or identifier, n: title, p: path}). Downloads count
 * only for files the portal serves; repeats within a short window and floods are dropped.
 * Always 204: the tracker fires and forgets. Tracking is switched on in the Portal Settings
 * item in SitecoreAI (fallback: PORTAL_TRACK_USAGE=1).
 */
import { NextRequest, NextResponse } from "next/server";
import { assetAllowed } from "src/lib/ch/assetAccess";
import { getViewer } from "src/lib/ch/viewer";
import { audienceOf, recordUsage, USAGE_ACTIONS, USAGE_KINDS, type UsageAction, type UsageKind } from "src/lib/ch/usage";
import { getPortalSettings } from "src/lib/portal/settings";
import { clientIp, Limiter } from "src/lib/portal/auth/rate-limit";

export const dynamic = "force-dynamic";

const recent = new Map<string, number>();   // who+action+target → last seen
const perClient = new Limiter(60, 60_000);
const DEDUPE_MS = 15_000;

const done = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export async function POST(request: NextRequest) {
  const settings = await getPortalSettings();
  if (!settings.trackUsage) return done();
  let body: any;
  try { body = JSON.parse(await request.text()); } catch { return done(); }
  const action = clean(body?.a, 20) as UsageAction;
  const kind = clean(body?.k, 20) as UsageKind;
  const target = clean(body?.t, 200);
  if (!USAGE_ACTIONS.includes(action) || !USAGE_KINDS.includes(kind) || !/^[\w.:-]{1,200}$/.test(target)) return done();
  if (action === "download" && kind !== "asset") return done();

  const viewer = await getViewer();
  if (viewer.kind === "none") return done();
  const who = viewer.kind === "partner" ? `p:${viewer.partner.user}` : viewer.kind === "staff" ? "staff" : clientIp(request.headers);

  // floods and repeats (a double click, a reload)
  const now = Date.now();
  if (perClient.hit(who, now)) return done();
  const key = `${who}|${action}|${target}`;
  if (now - (recent.get(key) ?? 0) < DEDUPE_MS) return done();
  recent.set(key, now);
  if (recent.size > 5000) for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);

  // only the portal's own files count as downloads
  if (kind === "asset" && !(await assetAllowed(target))) return done();
  try {
    await recordUsage({ action, kind, target, title: clean(body?.n, 200), path: clean(body?.p, 300) }, viewer, audienceOf(request.headers), settings.usageSiteLabel);
  } catch (e: any) {
    console.warn("portal usage: event not written:", e?.message ?? e);
  }
  return done();
}
