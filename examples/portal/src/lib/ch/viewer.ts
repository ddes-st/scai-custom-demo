import "server-only";
import { jointMicrositeOnHost } from "../portal/microsites";
import { cookies, headers } from "next/headers";
import { env } from "./env";
import { partnerUserOf, SESSION_COOKIE, sessionSubject } from "../portal/auth/session";
import { partnerUsers } from "../portal/auth/credentials";
import { findPartner, type PartnerProfile } from "../portal/partners";

/**
 * Who is looking at the page: `public` (anonymous — everyone in public mode, a visitor
 * without a session in hybrid mode), `staff` (the portal's own login), `partner` (a channel
 * partner with its profile from SitecoreAI), or `none` (gated mode without a session).
 */
export type Viewer =
  | { kind: "public" }
  | { kind: "staff" }
  | { kind: "partner"; partner: PartnerProfile }
  | { kind: "none" };

export async function getViewer(): Promise<Viewer> {
  if (env.siteMode === "public") return { kind: "public" };
  // a joint campaign microsite's host (PORTAL_MICROSITES) is public even when the portal is gated:
  // its anonymous visitors see the public files, never a partner's or the sales kit
  let micrositeHost = false;
  try { micrositeHost = !!jointMicrositeOnHost((await headers()).get("host") || ""); } catch { /* outside a request */ }
  const anonymous: Viewer = env.siteMode === "gated" && !micrositeHost ? { kind: "none" } : { kind: "public" };
  let token: string | undefined;
  try { token = (await cookies()).get(SESSION_COOKIE)?.value; } catch { return anonymous; }
  const subject = await sessionSubject(token, env.authSecret);
  if (!subject) return anonymous;
  if (subject === "staff") return { kind: "staff" };
  const user = partnerUserOf(subject);
  // a partner removed from PORTAL_PARTNERS loses access with its next request
  if (!user || !partnerUsers().has(user)) return anonymous;
  const partner = (await findPartner(user)) ?? { user, name: user, tier: "", region: "", brand: "", kit: "", about: "", entity: "", manager: "", type: "", contact: "", contactEmail: "", login: "" };
  return { kind: "partner", partner };
}

export const viewerKind = (v: Viewer) => v.kind;
