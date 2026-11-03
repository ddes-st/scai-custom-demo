/**
 * The deployment's brand theme: PORTAL_THEME, set by the Demo Builder from the demo's Content Hub
 * brand ({b: brand name, c: [hex…] palette, h: heading font, t: text font}), as the Portal Settings
 * Theme values — accent, fonts and the site tokens derived from the palette. The setup writes it
 * where the theme is still empty; the theme editor offers it as the brand preset. Null without one.
 */
import { computePortalThemeVars } from "src/lib/ch/brandPalette";
import { FONT_FAMILY, sanitizeVars } from "./theme-tokens";

export interface DeployTheme { brand: string; accent: string; fontSerif: string; fontSans: string; vars: Record<string, string> }

export function deployTheme(raw = process.env.PORTAL_THEME): DeployTheme | null {
  try {
    const t = JSON.parse(raw || "null");
    const colors = (Array.isArray(t?.c) ? t.c : []).map(String).filter((c: string) => /^#[0-9a-f]{6}$/i.test(c));
    if (!colors.length) return null;
    const font = (v: unknown) => (FONT_FAMILY.test(String(v ?? "").trim()) ? String(v).trim() : "");
    return { brand: String(t?.b ?? "").slice(0, 80), accent: colors[0], fontSerif: font(t?.h), fontSans: font(t?.t), vars: sanitizeVars(computePortalThemeVars(colors)) };
  } catch {
    return null;
  }
}
