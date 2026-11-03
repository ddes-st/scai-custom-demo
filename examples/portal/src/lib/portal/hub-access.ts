import "server-only";
import { timingSafeEqual } from "node:crypto";
import { bearerOf, verifySitecoreToken, type TokenCheck } from "./sitecore-token";

/**
 * Who may use the hub's forwarding route, and where it may forward to. The route adds the
 * environment's tools key (PORTAL_TOOLS_KEY) on the server, so both checks fail closed:
 * - the caller: the hub's own pages, which carry PORTAL_HUB_ACCESS_KEY from their extension point
 *   route (`/ch-picker_<key>`; see tools-fetch.ts) as the `x-portal-hub-key` header. A separate
 *   key: it reaches the browser, the tools key never does.
 *   Phase B: with PORTAL_HUB_AUTH=either the author's Sitecore token (Authorization: Bearer,
 *   verified in sitecore-token.ts — signature, issuer, audience, expiry, PORTAL_ALLOWED_ORGS) also
 *   lets a call through; with =token only the token does and the access key isn't needed. Default
 *   "key": the access key alone, as before.
 * - the head: an https origin whose host is listed exactly in PORTAL_HUB_HEADS (comma-separated;
 *   no wildcards — a shared suffix like *.vercel.app would let anyone's deployment receive the key).
 */
export const HUB_KEY_HEADER = "x-portal-hub-key";
const MIN_KEY = 24;

export type HubAuthMode = "key" | "either" | "token";
export const hubAuthMode = (env: Record<string, string | undefined> = process.env): HubAuthMode => (env.PORTAL_HUB_AUTH === "token" ? "token" : env.PORTAL_HUB_AUTH === "either" ? "either" : "key");

/** null when the caller may use the hub, else the reason (status and message). */
export async function hubCallerDenied(request: Request, env: Record<string, string | undefined> = process.env, verify: (token: string) => Promise<TokenCheck> = (t) => verifySitecoreToken(t, { env })): Promise<{ status: number; error: string } | null> {
  const mode = hubAuthMode(env);
  let tokenNote = "";
  if (mode !== "key") {
    const token = bearerOf(request);
    const check = token ? await verify(token) : null;
    if (check?.ok) return null;
    tokenNote = check ? `Sitecore token: ${check.reason}` : "no Sitecore token";
    if (mode === "token") return { status: 401, error: `Sign in with Sitecore to use this app (${tokenNote}).` };
  }
  const denied = keyDenied(request, env);
  return denied && tokenNote ? { ...denied, error: `${denied.error} (${tokenNote})` } : denied;
}

function keyDenied(request: Request, env: Record<string, string | undefined>): { status: number; error: string } | null {
  const want = env.PORTAL_HUB_ACCESS_KEY || "";
  if (want.length < MIN_KEY) return { status: 503, error: `The hub has no access key (PORTAL_HUB_ACCESS_KEY, at least ${MIN_KEY} characters).` };
  if (want === (env.PORTAL_TOOLS_KEY || "")) return { status: 503, error: "PORTAL_HUB_ACCESS_KEY must differ from PORTAL_TOOLS_KEY." };
  const got = request.headers.get(HUB_KEY_HEADER) || "";
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b) ? null : { status: 401, error: "Open this app from SitecoreAI (hub access key missing or wrong)." };
}

/** The head origin when `raw` is an https origin listed in PORTAL_HUB_HEADS, else null. */
export function hubHead(raw: string | null, hosts = process.env.PORTAL_HUB_HEADS || ""): URL | null {
  try {
    const u = new URL(String(raw ?? ""));
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    const allowed = hosts.split(",").map((h) => h.trim().toLowerCase().replace(/^https:\/\//, "").replace(/\/+$/, "")).filter((h) => h && !h.includes("*"));
    return allowed.includes(u.hostname.toLowerCase()) ? new URL(u.origin) : null;
  } catch {
    return null;
  }
}
