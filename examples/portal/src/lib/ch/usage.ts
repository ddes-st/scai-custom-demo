import "server-only";
/**
 * Portal usage → Content Hub: every download and detail-page view becomes one
 * BrandSite.PortalEvent entity (the demo builder creates the definition and shows the events
 * in a Portal usage panel on the asset page and a Portal usage page). One small entity per
 * event — the asset itself is never written, so its version (gated file URLs, Vercel's CDN)
 * and its Edge publication stay as they are.
 */
import { chGet, chPost, resolveIdentifier } from "./rest";
import { env } from "./env";
import type { Viewer } from "./viewer";

export const USAGE_ED = "BrandSite.PortalEvent";
export const USAGE_ACTIONS = ["download", "view"] as const;
export const USAGE_KINDS = ["asset", "product", "press", "campaign", "battlecard", "casestudy", "kit"] as const;
export type UsageAction = (typeof USAGE_ACTIONS)[number];
export type UsageKind = (typeof USAGE_KINDS)[number];

export interface UsageEvent { action: UsageAction; kind: UsageKind; target: string; title: string; path: string }

const ids = new Map<string, { id: number | null; identifier: string }>();
const MAX_IDS = 2000;

/** Both forms of the target: numeric id and identifier (cached per instance — successful
 *  lookups only, the oldest dropped beyond MAX_IDS). */
async function resolveTarget(target: string): Promise<{ id: number | null; identifier: string }> {
  const hit = ids.get(target);
  if (hit) return hit;
  let out: { id: number | null; identifier: string };
  let resolved: boolean;
  if (/^\d+$/.test(target)) {
    const e = await chGet(`/api/entities/${target}`).catch(() => null);
    resolved = !!e?.identifier;
    out = { id: Number(target), identifier: String(e?.identifier ?? target) };
  } else {
    const id = await resolveIdentifier(target);
    resolved = id != null;
    out = { id, identifier: target };
  }
  if (resolved) {
    ids.set(target, out);
    if (ids.size > MAX_IDS) ids.delete(ids.keys().next().value as string);
  }
  return out;
}

let disabledUntil = 0;

/** Writes the event; false when Content Hub refused it (the login can't create events: off
 *  for 10 minutes, warned once). */
/** Who's on the other end, roughly: the country (Vercel's geo header), the browser and the device
 *  (the user agent) — what Content effectiveness shows for the portal's views. */
export interface UsageAudience { country: string; browser: string; device: string }

export function audienceOf(headers: Headers): UsageAudience {
  const ua = headers.get("user-agent") ?? "";
  const country = (headers.get("x-vercel-ip-country") ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  const mobile = /Mobi|iPhone|Android/i.test(ua);
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /iPhone|iPad/.test(ua) && /Safari/.test(ua) && !/CriOS/.test(ua) ? "Mobile Safari"
    : /Chrome\/|CriOS/.test(ua) ? (mobile ? "Mobile Chrome" : "Chrome") : /Safari\//.test(ua) ? "Safari" : ua ? "Webkit" : "Unknown";
  // Android tablets say "Android" without "Mobile"
  const device = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? "Tablet" : mobile ? "Mobile" : "Desktop";
  return { country, browser, device };
}

/** The event shape (field level, with or without the partner relation) the tenant last accepted. */
let workingShape = "";

export async function recordUsage(ev: UsageEvent, viewer: Viewer, audience: UsageAudience | undefined, siteLabel: string): Promise<boolean> {
  if (Date.now() < disabledUntil) return false;
  const t = await resolveTarget(ev.target);
  const who = viewer.kind === "partner" ? "partner" : viewer.kind === "staff" ? "staff" : "public";
  const label = ev.action === "download" ? "Download" : "View";
  const properties: Record<string, unknown> = {
    PortalEventName: `${label} · ${ev.title || t.identifier}`.slice(0, 200),
    PortalEventAction: ev.action,
    PortalEventTargetType: ev.kind,
    PortalEventTarget: t.identifier,
    ...(t.id ? { PortalEventTargetId: t.id } : {}),
    PortalEventTitle: ev.title.slice(0, 200),
    PortalEventViewer: who,
    ...(viewer.kind === "partner" ? { PortalEventPartner: viewer.partner.name } : {}),
    PortalEventSite: (siteLabel || env.siteLabel).slice(0, 80),
    PortalEventPath: ev.path.slice(0, 300),
    PortalEventAt: new Date().toISOString(),
    PortalEventSource: "portal",
    ...(audience?.country ? { PortalEventCountry: audience.country } : {}),
    ...(audience ? { PortalEventBrowser: audience.browser, PortalEventDevice: audience.device } : {}),
  };
  const href = { href: `${env.chHost}/api/entitydefinitions/${USAGE_ED}` };
  // a partner's event hangs on its Partner record (PartnerToPortalEvent, the Demo Builder's
  // reporting insights filter the Partner detail page by it). Older definitions lack fields
  // (Country / Browser / Device, then When / Source) or the relation and answer 400: the shapes
  // are tried newest first, every field set WITH the relation before any without it (so an old
  // definition doesn't cost the partner link), stopping at the first non-400 answer; the shape
  // that worked goes first next time, so later events cost one request.
  const partnerId = viewer.kind === "partner" && viewer.partner.entity ? await resolveIdentifier(viewer.partner.entity).catch(() => null) : null;
  const relations = partnerId ? { PartnerToPortalEvent: { parent: { href: `${env.chHost}/api/entities/${partnerId}` } } } : undefined;
  const { PortalEventCountry: _c, PortalEventBrowser: _b, PortalEventDevice: _d, ...older } = properties;
  const { PortalEventAt: _at, PortalEventSource: _src, ...oldest } = older;
  const shapes = [properties, older, oldest]
    .flatMap((props, level) => [
      ...(relations ? [{ key: `${level}+rel`, body: { entitydefinition: href, properties: props, relations } }] : []),
      { key: `${level}`, body: { entitydefinition: href, properties: props } },
    ])
    .sort((a, b) => (a.key === workingShape ? -1 : b.key === workingShape ? 1 : 0));
  let r = { status: 0, location: "" };
  for (const shape of shapes) {
    r = await chPost("/api/entities", shape.body);
    if (r.status !== 400) {
      if (r.status < 400) workingShape = shape.key;
      break;
    }
  }
  if (r.status >= 400) {
    if (r.status === 403 || r.status === 404) {
      disabledUntil = Date.now() + 10 * 60 * 1000;
      console.warn(`portal usage: Content Hub refused the event (HTTP ${r.status}) — the site's login can't create ${USAGE_ED}, or it doesn't exist; tracking paused for 10 minutes`);
    }
    return false;
  }
  return true;
}
