"use client";
/**
 * Runs in the editing host (Page builder canvas) only: applies theme values sent by the theme
 * editor app (/theme-editor, a Page builder context panel) as inline custom properties on <html>,
 * so colours, fonts and radius change in the canvas as the author drags a colour picker — no
 * save, no reload. On mount it says hello so an editor that is already open re-sends its draft
 * after a canvas reload. Renders nothing; inactive outside an iframe.
 */
import { useEffect } from "react";
import { broadcastTheme, ensureGoogleFont, isThemeMessage } from "src/lib/portal/theme-bus";
import { FONT_FAMILY, HEX_COLOR, THEME_TOKENS, sanitizeVars } from "src/lib/portal/theme-tokens";

const FONT_VARS = { serif: "--bgd-serif", sans: "--bgd-sans", mono: "--bgd-mono" } as const;
const FONT_FALLBACKS = { serif: "Georgia, serif", sans: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', mono: '"SF Mono", Menlo, Consolas, monospace' } as const;

export function ThemeLiveBridge() {
  useEffect(() => {
    if (window.top === window) return;
    const root = document.documentElement;
    const managed = [...THEME_TOKENS.map((t) => t.key), "--portal-accent", ...Object.values(FONT_VARS)];
    const onMessage = (e: MessageEvent) => {
      if (!isThemeMessage(e.data)) return;
      const msg = e.data;
      if (msg.type === "reset") { for (const k of managed) root.style.removeProperty(k); return; }
      if (msg.type !== "preview") return;
      const vars = sanitizeVars(msg.vars);
      for (const t of THEME_TOKENS) { if (vars[t.key]) root.style.setProperty(t.key, vars[t.key]); else root.style.removeProperty(t.key); }
      if (typeof msg.accent === "string" && HEX_COLOR.test(msg.accent)) root.style.setProperty("--portal-accent", msg.accent); else root.style.removeProperty("--portal-accent");
      for (const key of ["serif", "sans", "mono"] as const) {
        const family = (msg.fonts?.[key] ?? "").trim();
        if (family && FONT_FAMILY.test(family)) { ensureGoogleFont(document, family); root.style.setProperty(FONT_VARS[key], `"${family}", ${FONT_FALLBACKS[key]}`); }
        else root.style.removeProperty(FONT_VARS[key]);
      }
    };
    window.addEventListener("message", onMessage);
    broadcastTheme({ type: "hello" });
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return null;
}
