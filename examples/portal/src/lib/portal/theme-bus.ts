"use client";
/**
 * Live-preview channel between the theme editor app and the editing host, both iframes of the
 * Page builder on different origins. Neither can reach the other directly, but every window may
 * enumerate `window.top`'s frame tree and call postMessage on each frame, so messages are
 * broadcast to every frame under the top window and filtered by `source` on arrival.
 * Values are validated again by the receiver (theme-tokens.ts), so a stray message can only
 * restyle the receiving frame cosmetically.
 */
import { THEME_BUS, type ThemePreviewMessage } from "./theme-tokens";

function walk(win: Window, visit: (w: Window) => void, depth = 0) {
  if (depth > 6) return;
  let n = 0;
  try { n = win.frames.length; } catch { return; }
  for (let i = 0; i < n; i++) {
    let child: Window | null = null;
    try { child = win.frames[i]; } catch { child = null; }
    if (!child) continue;
    visit(child);
    walk(child, visit, depth + 1);
  }
}

/** Posts `msg` to every frame under window.top (excluding this window). No-op outside an iframe. */
export function broadcastTheme(msg: Omit<ThemePreviewMessage, "source">): number {
  if (typeof window === "undefined" || window.top === window) return 0;
  const payload: ThemePreviewMessage = { source: THEME_BUS, ...msg };
  let sent = 0;
  const root = window.top ?? window.parent;
  const send = (w: Window) => { if (w === window) return; try { w.postMessage(payload, "*"); sent++; } catch { /* sandboxed or gone */ } };
  send(root);
  walk(root, send);
  return sent;
}

export function isThemeMessage(data: unknown): data is ThemePreviewMessage {
  return !!data && typeof data === "object" && (data as ThemePreviewMessage).source === THEME_BUS && typeof (data as ThemePreviewMessage).type === "string";
}

/** Google Fonts stylesheet URL for one family (400–600 weights, swap). */
export function googleFontHref(family: string): string {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600&display=swap`;
}

/** Adds the Google Fonts stylesheet for `family` to `doc` once. */
export function ensureGoogleFont(doc: Document, family: string) {
  const id = `portal-theme-font-${family.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  if (doc.getElementById(id)) return;
  const link = doc.createElement("link");
  link.id = id; link.rel = "stylesheet"; link.href = googleFontHref(family);
  doc.head.appendChild(link);
}
