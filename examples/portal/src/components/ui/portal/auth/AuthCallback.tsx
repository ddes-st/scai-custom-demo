"use client";
import React, { useEffect, useState } from "react";
import { finishRedirect } from "src/lib/portal/sitecore-auth";

/** Finishes a redirect sign-in and returns to the app page it started from. */
export function AuthCallback() {
  const [error, setError] = useState("");
  useEffect(() => {
    finishRedirect().then((to) => window.location.replace(to)).catch((e: any) => setError(String(e?.error_description || e?.message || e)));
  }, []);
  return (
    <main style={{ font: "14px/1.5 system-ui, sans-serif", padding: 24, color: "#1b2328" }}>
      {error ? <><p><strong>Sign-in didn&apos;t finish:</strong> {error}</p><p><button type="button" onClick={() => window.history.go(-2)}>Back to the app</button></p></> : <p>Signing in with Sitecore…</p>}
    </main>
  );
}
