"use client";
/**
 * Phase B sign-in status of the hub apps (sitecore-auth.ts): one line at the top of each app —
 * signed in (how, organisation, expiry), or sign-in buttons (popup / in this frame) with the
 * reason. Renders nothing outside hub mode or without the hub's Sitecore client id.
 */
import React, { useState, useSyncExternalStore } from "react";
import { AUTH_ON, authState, signInPopup, signInRedirect, signOut, subscribeAuth, type AuthState } from "src/lib/portal/sitecore-auth";

const OFF: AuthState = { status: "off" };
const METHOD = { cache: "stored session", silent: "silent renewal", popup: "popup", redirect: "redirect in this frame", handover: "from the field's dialog" } as const;

export function SitecoreAuthBar() {
  const s = useSyncExternalStore(subscribeAuth, authState, () => OFF);
  const [open, setOpen] = useState(false);
  if (!AUTH_ON || s.status === "off") return null;
  const until = s.claims?.exp ? new Date(s.claims.exp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className={`sc-auth sc-auth-${s.status}`} role="status" aria-live="polite">
      <span className="sc-auth-line">
        {s.status === "checking" && "Sitecore sign-in: checking…"}
        {s.status === "signed-in" && <>✓ Signed in with Sitecore{s.method ? ` (${METHOD[s.method]})` : ""}{s.claims?.orgName || s.claims?.org ? ` · ${s.claims.orgName || s.claims.org}` : ""}{until ? ` · until ${until}` : ""}</>}
        {(s.status === "needs-login" || s.status === "error") && <>Sitecore sign-in {s.status === "error" ? "failed" : "needed"}{s.error ? `: ${s.error}` : ""}</>}
      </span>
      <span className="sc-auth-tools">
        {(s.status === "needs-login" || s.status === "error") && s.method !== "handover" && (
          <>
            <button type="button" onClick={() => void signInPopup()}>Sign in (popup)</button>
            <button type="button" onClick={() => void signInRedirect()}>Sign in (in this frame)</button>
          </>
        )}
        {s.status === "signed-in" && s.method !== "handover" && <button type="button" onClick={() => void signOut()}>Sign out</button>}
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>Details</button>
      </span>
      {open && (
        <dl className="sc-auth-details">
          <dt>Asked for</dt><dd>organisation {s.context?.organizationId || "—"} · tenant {s.context?.tenantId || "—"} · app {s.context?.appId || "—"}</dd>
          {s.claims && <><dt>Token</dt><dd>org {s.claims.org || "—"} · tenant {s.claims.tenantName || s.claims.tenant || "—"} · aud {s.claims.aud.join(", ") || "—"} · iss {s.claims.iss || "—"}</dd></>}
        </dl>
      )}
    </div>
  );
}
