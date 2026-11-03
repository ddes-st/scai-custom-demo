import "server-only";
import { currentSite } from "./sites";
import { unstable_cache } from "next/cache";
import scConfig from "sitecore.config";
import { env } from "../ch/env";
import { withLastGood } from "../ch/last-good";
import { xmcQuery } from "./xmc-graphql";
import { parseThemeVars } from "./theme-tokens";

/**
 * Site-level settings authored in SitecoreAI: the `Portal Settings` item under
 * `<site>/Settings` (template Project/Portal/Portal Settings). Cached 60 s. A failure is never
 * cached: it degrades to the last settings this instance read, else to the env fallbacks, so
 * configuration never takes the site down (and a hiccup never widens the brand scope for 60 s).
 *
 * Fields: BrandScope (multi-line, one Content Hub M.Brand identifier per line), TrackUsage
 * (checkbox), UsageSiteLabel (single-line), SiteMode (public | gated — phase 2).
 */
export interface PortalSettings {
  brandScope: Set<string>;
  trackUsage: boolean;
  usageSiteLabel: string;
  /** The head's SITE_MODE (public | hybrid | gated) — a deployment property; the item's SiteMode field is informational. */
  siteMode: "public" | "hybrid" | "gated";
  /** The site's content root, e.g. /sitecore/content/Portal/portal — "" when unknown. */
  rootPath: string;
  /** True when the item was read from SitecoreAI (false = env fallbacks only). */
  fromSitecore: boolean;
  /** The Theme section as authored (empty strings = not set; see lib/portal/theme.ts for the resolution). */
  theme: PortalThemeSettings;
}

/** Theme section as authored: Accent, FontSerif/Sans/Mono, BrandBookLayout and ThemeVars (JSON of CSS token → value, written by the theme editor app). */
export interface PortalThemeSettings { accent: string; fonts: { serif: string; sans: string; mono: string }; brandBookLayout: string; vars: Record<string, string> }
const EMPTY_THEME: PortalThemeSettings = { accent: "", fonts: { serif: "", sans: "", mono: "" }, brandBookLayout: "", vars: {} };

interface RawSettings { rootPath: string; brandScope: string[]; trackUsage: boolean; usageSiteLabel: string; siteMode: string; found: boolean; theme: PortalThemeSettings }

const SITE_ROOT_QUERY = `query($site: String!, $language: String!) {
  layout(site: $site, routePath: "/", language: $language) { item { path parent { path } } }
}`;

const SETTINGS_QUERY = `query($path: String!, $language: String!) {
  item(path: $path, language: $language) { fields { name value } }
}`;

/**
 * The site's content root (parent of Home), resolved through the layout query. Edge answers
 * `parent: null` in a language the site root item has no version in (the setup versions Home and
 * below, not the root), so the root also comes from Home's own path.
 */
export async function siteRootPath(site: string, language: string): Promise<string> {
  const data = await xmcQuery<{ layout?: { item?: { path?: string; parent?: { path?: string } } } }>(SITE_ROOT_QUERY, { site, language });
  const item = data?.layout?.item;
  return item?.parent?.path || (item?.path ? item.path.replace(/\/[^/]+$/, "") : "");
}

const emptyRaw = (): RawSettings => ({ rootPath: "", brandScope: [], trackUsage: false, usageSiteLabel: "", siteMode: "public", found: false, theme: { ...EMPTY_THEME, fonts: { ...EMPTY_THEME.fonts }, vars: {} } });

/** THROWS when SitecoreAI doesn't answer (never cached); found=false only when the item really isn't there. */
async function loadSettingsUncached(site: string, language: string): Promise<RawSettings> {
  const out = emptyRaw();
  out.rootPath = await siteRootPath(site, language);
  if (!out.rootPath) return out;
  const data = await xmcQuery<{ item?: { fields?: Array<{ name: string; value: string }> } }>(SETTINGS_QUERY, { path: `${out.rootPath}/Settings/Portal Settings`, language });
  const fields = new Map((data?.item?.fields ?? []).map((f) => [f.name, f.value ?? ""]));
  if (!data?.item) return out;
  out.found = true;
  out.brandScope = (fields.get("BrandScope") ?? "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  out.trackUsage = fields.get("TrackUsage") === "1";
  out.usageSiteLabel = (fields.get("UsageSiteLabel") ?? "").trim().slice(0, 80);
  out.siteMode = (fields.get("SiteMode") ?? "").trim().toLowerCase() === "gated" ? "gated" : "public";
  const t = (n: string) => (fields.get(n) ?? "").trim();
  out.theme = { accent: t("Accent"), fonts: { serif: t("FontSerif"), sans: t("FontSans"), mono: t("FontMono") }, brandBookLayout: t("BrandBookLayout").toLowerCase(), vars: parseThemeVars(t("ThemeVars")) };
  return out;
}

const loadSettingsCached = (site: string, language: string) =>
  unstable_cache(() => loadSettingsUncached(site, language), ["portal-settings", site, language], { revalidate: 60, tags: ["xmc-site"] })();

/** The cached settings; on a failure the last good ones of this instance, else none (env fallbacks). */
const loadSettings = withLastGood("portal settings", loadSettingsCached, () => emptyRaw());

export async function getPortalSettings(site = "", language = scConfig.defaultLanguage): Promise<PortalSettings> {
  const raw = await loadSettings(site || currentSite(), language || scConfig.defaultLanguage);
  return {
    brandScope: new Set(raw.found ? raw.brandScope : [...env.portalBrands]),
    trackUsage: raw.found ? raw.trackUsage : env.trackUsage,
    usageSiteLabel: (raw.found && raw.usageSiteLabel) || env.siteLabel,
    siteMode: env.siteMode,
    rootPath: raw.rootPath,
    fromSitecore: raw.found,
    theme: raw.theme,
  };
}
