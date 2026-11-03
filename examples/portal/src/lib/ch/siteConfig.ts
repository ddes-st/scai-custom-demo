import "server-only";
/**
 * BrandSite.Config: admin-managed configuration stored in Content Hub.
 *
 * One global entity (identifier BrandSite.Config.Global) plus optional per-brand overrides
 * (linked to M.Brand via BrandSiteConfigToBrand). Resolution: code defaults ← global ← brand
 * override, deep-merged per key so an override can change one value without restating the rest.
 *
 * The sites read ONLY ConfigJson (the published payload); ConfigDraftJson is the component
 * editor's work-in-progress copy. A fetch failure is never cached (the loader throws): it
 * degrades to the last configuration this instance read, else to defaults — configuration must
 * never take the site down, and a hiccup must not make hidden brands visible for a minute.
 */
import { cachedByCulture } from "./culture";
import { chGet, definitionEntities, isNotFound } from "./rest";
import { withLastGood } from "./last-good";
import { BookConfig, DEFAULT_SECTION_LABELS, SECTION_KEYS, SectionKey } from "./types";

export interface SiteConfig {
  shared: {
    sections: Record<SectionKey, boolean>;
    sectionOrder: SectionKey[];
    /** Custom display names, e.g. { dodont: "Usage rules" }. Empty/missing = default label. */
    sectionLabels: Partial<Record<SectionKey, string>>;
  };
  site: {
    /** Production URL of this site — informational (shown in the component's config editor). */
    baseUrl: string;
    fonts: { serif: string; sans: string; mono: string };
    /** Default accent: overrides FALLBACK_ACCENT. Brands with a visualization colour keep it. */
    accent: string;
    layout: { default: "tabbed" | "editorial"; doDontColumns: number };
    chrome: { wordmark: string; heroTitle: string; heroLead: string; footerText: string };
    allowViewerOverrides: boolean;
    downloadsEnabled: boolean;
  };
  component: { defaultLayout: "" | "tabbed" | "editorial" };
  brand: {
    visibility: "visible" | "hidden" | "comingSoon";
    contact: { name: string; email: string };
  };
  /** The portal's own settings (Content Hub's Portal settings page; contracts/portalSettings.ts). */
  portal: PortalSettings;
}

export type PortalSectionKey = "brands" | "products" | "press" | "media" | "partners" | "sales";

export interface PortalSettings {
  /** "deploy": PORTAL_THEME (the deploy's brand style) wins; "settings": the palette, accent and fonts here. */
  style: { source: "deploy" | "settings"; palette: string[] };
  /** An https image before the wordmark. */
  logoUrl: string;
  /** "auto": one section opens on it; "landing": always a home page. */
  home: { mode: "auto" | "landing" };
  sections: Partial<Record<PortalSectionKey, { hidden?: boolean; label?: string; title?: string; lead?: string; blurb?: string }>>;
  sectionOrder: PortalSectionKey[];
}

export const DEFAULT_CONFIG: SiteConfig = {
  shared: {
    sections: {
      colour: true,
      logo: true,
      typography: true,
      documents: true,
      templates: true,
      dodont: true,
      personas: true,
      characteristics: true,
    },
    sectionOrder: [...SECTION_KEYS],
    sectionLabels: {},
  },
  site: {
    baseUrl: "",
    fonts: { serif: "", sans: "", mono: "" },
    accent: "",
    layout: { default: "tabbed", doDontColumns: 1 },
    chrome: { wordmark: "", heroTitle: "", heroLead: "", footerText: "" },
    allowViewerOverrides: true,
    downloadsEnabled: true,
  },
  component: { defaultLayout: "" },
  brand: { visibility: "visible", contact: { name: "", email: "" } },
  portal: {
    style: { source: "deploy", palette: [] },
    logoUrl: "",
    home: { mode: "auto" },
    sections: {},
    sectionOrder: ["brands", "products", "press", "media", "partners", "sales"],
  },
};

/** Plain-object deep merge; arrays and scalars replace, objects merge. null/undefined skipped. */
function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(base) || Array.isArray(patch)) return patch as T;
  if (typeof base === "object" && base !== null && typeof patch === "object") {
    const out: any = { ...base };
    for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      out[k] = k in (base as any) ? deepMerge((base as any)[k], v) : v;
    }
    return out;
  }
  return patch as T;
}

interface RawConfigs {
  global: unknown;
  /** brandId -> override payload */
  byBrand: Record<number, unknown>;
}

/** THROWS when Content Hub doesn't answer (never cached); a missing entity or definition (404) is "no config". */
async function fetchConfigsUncached(): Promise<RawConfigs> {
  const out: RawConfigs = { global: null, byBrand: {} };
  const orMissing = <T>(p: Promise<T>): Promise<T | null> => p.catch((e) => { if (isNotFound(e)) return null; throw e; });
  // direct identifier GET — always fresh, no search-index lag for the common global edits
  const globalEntity = await orMissing(chGet(`/api/entities/identifier/BrandSite.Config.Global`));
  out.global = globalEntity?.properties?.ConfigJson ?? null;
  const items = (await orMissing(definitionEntities("BrandSite.Config"))) ?? [];
  for (const item of items) {
    if (item?.identifier === "BrandSite.Config.Global" || !item?.properties?.ConfigJson) continue;
    // entities return relations as links — follow the link for the brand pointer
    const rel = await orMissing(chGet(`/api/entities/${item.id}/relations/BrandSiteConfigToBrand`));
    const href = rel?.parent?.href || rel?.parents?.[0]?.href || "";
    const m = /\/(\d+)(?:\?|$)/.exec(href);
    if (m) out.byBrand[parseInt(m[1], 10)] = item.properties.ConfigJson;
  }
  return out;
}

const fetchConfigsCached = cachedByCulture("brandsite-config", fetchConfigsUncached);
const fetchConfigs = withLastGood("brand site config", fetchConfigsCached, (): RawConfigs => ({ global: null, byBrand: {} }), () => "global");

/** Global config (no brand context) — chrome, fonts, viewer-override policy, defaults. */
export async function getGlobalConfig(): Promise<SiteConfig> {
  const raw = await fetchConfigs();
  return deepMerge(DEFAULT_CONFIG, raw.global);
}

/** Config for one brand: defaults ← global ← brand override. */
export async function getBrandConfig(brandId: number): Promise<SiteConfig> {
  const raw = await fetchConfigs();
  return deepMerge(deepMerge(DEFAULT_CONFIG, raw.global), raw.byBrand[brandId]);
}

/** Brand visibility for every brand that HAS an override (absent = visible). */
export async function getBrandVisibilityMap(): Promise<Record<number, SiteConfig["brand"]["visibility"]>> {
  const raw = await fetchConfigs();
  const map: Record<number, SiteConfig["brand"]["visibility"]> = {};
  for (const [brandId, payload] of Object.entries(raw.byBrand)) {
    const merged = deepMerge(deepMerge(DEFAULT_CONFIG, raw.global), payload);
    map[Number(brandId)] = merged.brand.visibility;
  }
  return map;
}

/** Ordered, enabled sections with display labels — the shape the layouts consume. */
export function resolveSections(config: SiteConfig): { key: SectionKey; label: string }[] {
  const order = config.shared.sectionOrder.filter((k): k is SectionKey => SECTION_KEYS.includes(k as SectionKey));
  // any key missing from the stored order (e.g. added by a newer schema) appends at the end
  for (const key of SECTION_KEYS) if (!order.includes(key)) order.push(key);
  return order
    .filter((key) => config.shared.sections[key] !== false)
    .map((key) => ({ key, label: config.shared.sectionLabels[key] || DEFAULT_SECTION_LABELS[key] }));
}

/** The client-safe slice a brand book needs, from a resolved config. */
export function toBookConfig(config: SiteConfig): BookConfig {
  return {
    sections: resolveSections(config),
    doDontColumns: Math.min(3, Math.max(1, Number(config.site.layout.doDontColumns) || 1)),
    downloads: config.site.downloadsEnabled !== false,
    contact: {
      name: String(config.brand.contact?.name || ""),
      email: String(config.brand.contact?.email || ""),
    },
  };
}
