/**
 * Phase B of the Marketplace hub: the author's own Sitecore sign-in (Marketplace custom
 * authorization, Auth0 at auth.sitecorecloud.io) instead of an access key in the app URL. Hub mode
 * only, and only with NEXT_PUBLIC_SITECORE_AUTH_CLIENT_ID (the hub app's single-page-application
 * client credentials from App Studio — a public id, no secret).
 *
 * The apps get an access token for the author's organisation (application.context →
 * organization_id, tenant_id, product_codes mkp_<app id>, as Sitecore's Blok quick start does), send
 * it as `Authorization: Bearer` to the hub's forwarding route (tools-fetch.ts), which verifies it
 * (sitecore-token.ts). Tokens stay in this frame's storage (localStorage, refresh tokens — the
 * Page builder frames can't rely on third-party cookies for silent renewal). Sign-in inside the
 * frames is the open question of the spike, so the state records how the token was obtained:
 * cache, silent (refresh token / hidden frame), popup, or redirect (via /sitecore-auth-callback).
 */
import type { Auth0Client } from "@auth0/auth0-spa-js";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { HUB } from "./hub";

export const AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_SITECORE_AUTH_CLIENT_ID || "";
export const AUTH_DOMAIN = (process.env.NEXT_PUBLIC_SITECORE_AUTH_DOMAIN || "auth.sitecorecloud.io").replace(/^https?:\/\//, "").replace(/\/+$/, "");
export const AUTH_AUDIENCE = process.env.NEXT_PUBLIC_SITECORE_AUTH_AUDIENCE || "https://api-webapp.sitecorecloud.io";
export const AUTH_ON = HUB && !!AUTH_CLIENT_ID;
export const CALLBACK_PATH = "/sitecore-auth-callback";
const SCOPE = "openid profile email offline_access";
const CTX_STORE = "sitecore-auth-context";
const METHOD_STORE = "sitecore-auth-method";

export type AuthMethod = "cache" | "silent" | "popup" | "redirect" | "handover";
export interface TokenClaims { iss: string; aud: string[]; org: string; orgName: string; tenant: string; tenantName: string; exp: number }
export interface AuthState {
  status: "off" | "checking" | "signed-in" | "needs-login" | "error";
  method?: AuthMethod;
  /** Why sign-in or the hub's token check failed (no token contents). */
  error?: string;
  claims?: TokenClaims;
  /** The organisation and Marketplace tenant the app asked for (application.context). */
  context?: { organizationId: string; tenantId: string; appId: string };
}

// ---------- state the auth bar subscribes to ----------
let state: AuthState = { status: AUTH_ON ? "checking" : "off" };
const listeners = new Set<() => void>();
const set = (next: Partial<AuthState>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };
export const authState = () => state;
export const subscribeAuth = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
// counts sign-ins made in this app (popup, handover): the apps load their data again then, since
// what they asked for before the sign-in was refused
let epoch = 0;
export const authEpoch = () => epoch;
const signedInNow = () => { epoch++; };

// ---------- the author's organisation (from the Marketplace host; kept for the callback page) ----------
let ctx = { organizationId: "", tenantId: "", appId: "" };
function loadCtx() {
  try { const v = JSON.parse(sessionStorage.getItem(CTX_STORE) || "null"); if (v && typeof v === "object") ctx = { ...ctx, ...v }; } catch { /* storage blocked */ }
}
function saveCtx() {
  try { sessionStorage.setItem(CTX_STORE, JSON.stringify(ctx)); } catch { /* storage blocked */ }
}
const params = () => ({
  audience: AUTH_AUDIENCE,
  scope: SCOPE,
  redirect_uri: `${window.location.origin}${CALLBACK_PATH}`,
  ...(ctx.organizationId ? { organization_id: ctx.organizationId } : {}),
  ...(ctx.tenantId ? { tenant_id: ctx.tenantId } : {}),
  ...(ctx.appId ? { product_codes: `mkp_${ctx.appId}` } : {}),
});

let clientP: Promise<Auth0Client> | null = null;
export function authClient(): Promise<Auth0Client> {
  if (!clientP) {
    clientP = import("@auth0/auth0-spa-js").then(({ Auth0Client }) => new Auth0Client({
      domain: AUTH_DOMAIN, clientId: AUTH_CLIENT_ID, cacheLocation: "localstorage", useRefreshTokens: true,
      // no refresh token (Sitecore's sign-in decides whether it issues one): renew through the sign-in
      // session the popup left at auth.sitecorecloud.io instead of asking again
      useRefreshTokensFallback: true,
      authorizationParams: params(),
    }));
  }
  return clientP;
}

const errorText = (e: any) => String(e?.error_description || e?.message || e?.error || e || "unknown error").slice(0, 300);
const needsLogin = (e: any) => ["login_required", "consent_required", "interaction_required", "missing_refresh_token", "invalid_grant"].includes(e?.error);

/** Ask the hub whether it accepts the token (signature, issuer, audience, expiry, organisation). */
async function confirm(token: string, method: AuthMethod) {
  const r = await fetch("/api/hub-auth/check", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const b = await r.json().catch(() => ({}));
  if (r.ok && b?.ok) { set({ status: "signed-in", method, claims: b.claims, error: undefined }); scheduleRenewal(); }
  else set({ status: "error", method, claims: b?.claims, error: `The hub didn't accept the token: ${b?.reason || r.status}` });
}

// ---------- staying signed in ----------
// Sitecore issues short-lived access tokens (its sign-in service sets the lifetime, not this app).
// Before one runs out it is renewed quietly — with the refresh token, else through the sign-in
// session — and the sign-in line shows the new time; only when that fails is a sign-in asked for.
let renewTimer: number | null = null;
function scheduleRenewal() {
  if (typeof window === "undefined") return;
  if (renewTimer) window.clearTimeout(renewTimer);
  const exp = state.claims?.exp ?? 0;
  if (!exp) return;
  const wait = Math.max(5_000, exp * 1000 - Date.now() - 120_000);
  renewTimer = window.setTimeout(() => { void renewNow(); }, Math.min(wait, 2_147_000_000));
}
async function renewNow() {
  if (handedOver || state.status !== "signed-in") return;
  try {
    const c = await authClient();
    const t = await c.getTokenSilently({ cacheMode: "off", authorizationParams: params(), timeoutInSeconds: 10 });
    const exp = t ? expOf(t) : 0;
    if (!exp) throw new Error("no token");
    set({ claims: state.claims ? { ...state.claims, exp } : state.claims });
    scheduleRenewal();
  } catch (e: any) {
    set({ status: "needs-login", error: `your Sitecore sign-in ended and couldn't be renewed quietly (${errorText(e)}) — sign in again` });
  }
}
// timers sleep in background tabs: renew on return when the token is (nearly) due
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    const exp = state.claims?.exp ?? 0;
    if (document.visibilityState === "visible" && state.status === "signed-in" && exp && exp * 1000 - Date.now() < 150_000) void renewNow();
  });
}

let started = false;
/** Connect sign-in to the Marketplace host's context and look for a token (no interaction). */
export async function startSitecoreAuth(client: ClientSDK | null) {
  if (!AUTH_ON || started || typeof window === "undefined") return;
  started = true;
  loadCtx();
  if (client) {
    try {
      const res: any = await client.query("application.context");
      const a = res?.data ?? {};
      ctx = { organizationId: String(a.organizationId ?? ctx.organizationId ?? ""), tenantId: String(a.MarketplaceAppTenantId ?? ctx.tenantId ?? ""), appId: String(a.id ?? ctx.appId ?? "") };
      saveCtx();
    } catch { /* keep what the frame had */ }
  }
  set({ status: "checking", context: { ...ctx } });
  let redirected: AuthMethod | null = null;
  try { redirected = sessionStorage.getItem(METHOD_STORE) === "redirect" ? "redirect" : null; sessionStorage.removeItem(METHOD_STORE); } catch { /* storage blocked */ }
  try {
    const c = await authClient();
    const cached = await c.getTokenSilently({ cacheMode: "cache-only", authorizationParams: params() });
    if (cached) return await confirm(cached, redirected ?? "cache");
    const fresh = await c.getTokenSilently({ authorizationParams: params(), timeoutInSeconds: 8 });
    if (!fresh) throw { error: "login_required" };
    await confirm(fresh, "silent");
  } catch (e: any) {
    // no stored session in this frame yet (or it ended): a sign-in is needed, not an error
    set(needsLogin(e) || e?.error === "timeout" ? { status: "needs-login", error: e?.error === "missing_refresh_token" || e?.error === "login_required" ? "not signed in in this app yet" : errorText(e) } : { status: "error", error: errorText(e) });
  }
}

/** Sign in through a popup (needs the app's "Open pop-ups" permission in App Studio). */
export async function signInPopup() {
  set({ status: "checking", error: undefined });
  try {
    const c = await authClient();
    await c.loginWithPopup({ authorizationParams: params() });
    const t = await c.getTokenSilently({ cacheMode: "cache-only", authorizationParams: params() });
    if (!t) throw new Error("no token after the popup");
    await confirm(t, "popup");
    if (state.status === "signed-in") { signedInNow(); set({}); }
  } catch (e: any) {
    set({ status: "needs-login", error: `Popup: ${errorText(e)}` });
  }
}

/** Sign in by navigating this frame to Sitecore's login and back (/sitecore-auth-callback). */
export async function signInRedirect() {
  saveCtx();
  const c = await authClient();
  await c.loginWithRedirect({ authorizationParams: params(), appState: { returnTo: `${window.location.pathname}${window.location.search}` } });
}

/** The callback page: finish the redirect sign-in and go back to the app (same origin only). */
export async function finishRedirect(): Promise<string> {
  loadCtx();
  const c = await authClient();
  const { appState } = await c.handleRedirectCallback<{ returnTo?: string }>();
  try { sessionStorage.setItem(METHOD_STORE, "redirect"); } catch { /* storage blocked */ }
  const to = String(appState?.returnTo ?? "/");
  return to.startsWith("/") && !to.startsWith("//") ? to : "/";
}

export async function signOut() {
  const c = await authClient();
  await c.logout({ openUrl: false });
  set({ status: "needs-login", method: undefined, claims: undefined, error: undefined });
}

// ---------- the picker's larger window: tokens handed over by the modal (picker-popup.ts) ----------
let handedOver: { token: string; exp: number; fetch: () => Promise<string> } | null = null;
const expOf = (t: string) => {
  try { return Number(JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp) || 0; } catch { return 0; }
};
/** The window signs nothing in itself: it uses the modal's token and asks it for fresh ones. */
export function acceptHandedOverTokens(token: string, fetch: () => Promise<string>) {
  if (!AUTH_ON) return;
  started = true;
  handedOver = { token, exp: expOf(token), fetch };
  set(token ? { status: "signed-in", method: "handover", error: undefined } : { status: "needs-login", method: "handover", error: "the field's dialog has no Sitecore sign-in — sign in there" });
}

/** The token for an API call: renewed only once sign-in worked, else from the cache (never waits on a login). */
export async function bearer(): Promise<string | null> {
  if (!AUTH_ON) return null;
  // the stored session is still being checked (app start): wait for it rather than call without
  if (state.status === "checking" && !handedOver) await new Promise<void>((resolve) => {
    const t = window.setTimeout(done, 10_000);
    const off = subscribeAuth(() => { if (state.status !== "checking") done(); });
    function done() { window.clearTimeout(t); off(); resolve(); }
  });
  if (handedOver) {
    if (!handedOver.token || handedOver.exp - 60 < Date.now() / 1000) { const t = await handedOver.fetch().catch(() => ""); handedOver = { ...handedOver, token: t, exp: expOf(t) }; }
    return handedOver.token || null;
  }
  try {
    const c = await authClient();
    const t = await c.getTokenSilently(state.status === "signed-in" ? { authorizationParams: params(), timeoutInSeconds: 10 } : { cacheMode: "cache-only", authorizationParams: params() });
    return t || null;
  } catch {
    return null;
  }
}
