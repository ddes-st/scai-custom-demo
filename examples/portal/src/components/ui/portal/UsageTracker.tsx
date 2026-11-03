"use client";

/**
 * The portal's usage tracker (only rendered when PORTAL_TRACK_USAGE is on): a download is a
 * click on a link marked data-track="<asset id>" or on a download link to /api/asset/<id>;
 * a view is a TrackView on a detail page (once per page and visitor every 30 minutes).
 * Events go to /api/track by sendBeacon — fire and forget, never in the visitor's way.
 */
import { useEffect } from "react";

type Beacon = { a: "download" | "view"; k: string; t: string; n?: string; p?: string };

function send(b: Beacon) {
  const body = JSON.stringify({ ...b, p: b.p ?? location.pathname });
  try {
    if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
  } catch { /* fall back */ }
  fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}

export function UsageTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a) return;
      let target = a.getAttribute("data-track") || "";
      if (!target && a.hasAttribute("download")) {
        const m = /\/api\/asset\/([^/?#]+)/.exec(a.getAttribute("href") || "");
        if (m) target = decodeURIComponent(m[1]);
      }
      if (!target) return;
      send({ a: "download", k: "asset", t: target, n: a.getAttribute("data-track-title") || a.getAttribute("title") || "" });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

/** A file opened in the lightbox (a "preview"): once per file and visitor every 30 minutes. */
export function trackPreview(id: string, title: string) {
  const key = `portal-view:asset:${id}`;
  try {
    if (Date.now() - Number(sessionStorage.getItem(key) || 0) < 30 * 60 * 1000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch { /* storage off: count it */ }
  send({ a: "view", k: "asset", t: id, n: title });
}

/** A detail-page view: once per page and visitor every 30 minutes. */
export function TrackView({ kind, id, title }: { kind: string; id: string; title: string }) {
  useEffect(() => {
    const key = `portal-view:${kind}:${id}`;
    try {
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 30 * 60 * 1000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch { /* storage off: count it */ }
    send({ a: "view", k: kind, t: id, n: title });
  }, [kind, id, title]);
  return null;
}
