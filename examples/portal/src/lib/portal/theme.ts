import "server-only";
import { getPortalSettings } from "./settings";
import { getGlobalConfig } from "../ch/siteConfig";
import { env } from "../ch/env";
import { FONT_FAMILY, THEME_TOKENS, TOKEN_DEFAULTS, sanitizeVars } from "./theme-tokens";

/**
 * The portal's look and feel, resolved in this order per value:
 *   1. the Portal Settings item in SitecoreAI (Theme section: Accent, FontSerif, FontSans,
 *      FontMono, BrandBookLayout, ThemeVars) — the site owner's choice, previewable in the Page
 *      builder and edited live with the theme editor app (/theme-editor);
 *   2. Content Hub's BrandSite.Config (site.accent, site.fonts, site.layout.default) — the
 *      settings of the Vercel-only portal, kept as the fallback so both heads can share them;
 *   3. the built-in defaults (FALLBACK_ACCENT, the Instrument/JetBrains fonts, tabbed books).
 * Brand colours and fonts inside the brand books are brand data and stay in Content Hub.
 */
export interface PortalTheme {
  accent: string;
  fonts: { serif: string; sans: string; mono: string };
  brandBookLayout: "tabbed" | "editorial";
  /** Every CSS token of theme-tokens.ts with its effective value (authored override or default). */
  vars: Record<string, string>;
  /** The authored overrides only (what the ThemeVars field holds), for the editor. */
  customVars: Record<string, string>;
  /** What applies when a SitecoreAI field is empty (Content Hub's BrandSite.Config, else the defaults) — the editor's "inherit" values. */
  fallback: { accent: string; fonts: { serif: string; sans: string; mono: string }; brandBookLayout: "tabbed" | "editorial" };
  /** Where each value came from (for the health endpoint / debugging). */
  source: { accent: ThemeSource; fonts: ThemeSource; brandBookLayout: ThemeSource; vars: ThemeSource };
}
type ThemeSource = "sitecoreai" | "contenthub" | "default";

const HEX = /^#[0-9a-f]{6}$/i;
export const DEFAULT_FONTS = { serif: "Instrument Serif", sans: "Instrument Sans", mono: "JetBrains Mono" } as const;
const FALLBACKS = { serif: "Georgia, serif", sans: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', mono: '"SF Mono", Menlo, Consolas, monospace' } as const;

const clean = (s: unknown) => { const v = String(s ?? "").trim().replace(/^["']|["']$/g, "").slice(0, 80); return FONT_FAMILY.test(v) ? v : ""; };

export async function getPortalTheme(site?: string, language?: string): Promise<PortalTheme> {
  const [settings, config] = await Promise.all([
    getPortalSettings(site, language),
    getGlobalConfig().catch(() => null),
  ]);
  const t = settings.theme;
  const ch = config?.site;

  const accentFrom = HEX.test(t.accent) ? "sitecoreai" : HEX.test(ch?.accent ?? "") ? "contenthub" : "default";
  const accentFallback = HEX.test(ch?.accent ?? "") ? ch!.accent : HEX.test(env.fallbackAccent) ? env.fallbackAccent : "#9528e6";
  const accent = accentFrom === "sitecoreai" ? t.accent : accentFallback;

  const fontFallback = (key: "serif" | "sans" | "mono") => clean(ch?.fonts?.[key]) || DEFAULT_FONTS[key];
  const pick = (key: "serif" | "sans" | "mono"): [string, ThemeSource] => {
    const own = clean(t.fonts[key]);
    if (own) return [own, "sitecoreai"];
    const theirs = clean(ch?.fonts?.[key]);
    if (theirs) return [theirs, "contenthub"];
    return [DEFAULT_FONTS[key], "default"];
  };
  const [serif, sSrc] = pick("serif");
  const [sans, nSrc] = pick("sans");
  const [mono, mSrc] = pick("mono");
  const fontsSource: ThemeSource = [sSrc, nSrc, mSrc].includes("sitecoreai") ? "sitecoreai" : [sSrc, nSrc, mSrc].includes("contenthub") ? "contenthub" : "default";

  const layoutOwn = t.brandBookLayout === "editorial" || t.brandBookLayout === "tabbed" ? t.brandBookLayout : "";
  const layoutCh = ch?.layout?.default === "editorial" ? "editorial" : ch?.layout?.default === "tabbed" ? "tabbed" : "";
  const brandBookLayout = (layoutOwn || layoutCh || "tabbed") as "tabbed" | "editorial";

  const customVars = sanitizeVars(t.vars);
  return {
    accent,
    fonts: { serif, sans, mono },
    brandBookLayout,
    vars: { ...TOKEN_DEFAULTS, ...customVars },
    customVars,
    fallback: { accent: accentFallback, fonts: { serif: fontFallback("serif"), sans: fontFallback("sans"), mono: fontFallback("mono") }, brandBookLayout: (layoutCh || "tabbed") as "tabbed" | "editorial" },
    source: { accent: accentFrom, fonts: fontsSource, brandBookLayout: layoutOwn ? "sitecoreai" : layoutCh ? "contenthub" : "default", vars: Object.keys(customVars).length ? "sitecoreai" : "default" },
  };
}

/**
 * CSS custom properties for the theme: the accent, every site token (so :root is the single
 * place the stylesheets' var() fallbacks resolve from) and the fonts when they differ from the
 * stylesheet defaults.
 */
export function themeCss(theme: PortalTheme): string {
  const vars = [`--portal-accent: ${theme.accent};`, ...THEME_TOKENS.map((t) => `${t.key}: ${theme.vars[t.key] ?? t.default};`)];
  const font = (key: "serif" | "sans" | "mono") => {
    const family = theme.fonts[key];
    if (family && family !== DEFAULT_FONTS[key]) vars.push(`--bgd-${key}: "${family.replace(/"/g, "")}", ${FALLBACKS[key]};`);
  };
  font("serif"); font("sans"); font("mono");
  return `:root { ${vars.join(" ")} }`;
}

/** A Google Fonts stylesheet URL for the configured families the default stylesheet doesn't load; "" when none. */
export function googleFontsHref(theme: PortalTheme): string {
  const extra = (["serif", "sans", "mono"] as const).map((k) => theme.fonts[k]).filter((f) => f && !(Object.values(DEFAULT_FONTS) as string[]).includes(f));
  if (!extra.length) return "";
  const families = [...new Set(extra)].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
