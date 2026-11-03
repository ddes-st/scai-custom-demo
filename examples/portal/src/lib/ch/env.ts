import "server-only";

/**
 * Content Hub connection (server-only). Everything site-specific that used to be an env
 * var (brand scope, tracking, site label) now comes from the Portal Settings item in
 * SitecoreAI (src/lib/portal/settings.ts); the PORTAL_* vars below are only fallbacks.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  get chHost(): string {
    return required("CH_HOST").replace(/\/$/, "");
  },
  get chUser(): string {
    return required("CH_USER");
  },
  get chPass(): string {
    return required("CH_PASS");
  },
  get edgeUrl(): string {
    return process.env.EDGE_GRAPHQL_URL || "https://edge-beta.sitecorecloud.io/api/graphql/v1";
  },
  /** Empty string = Content Hub Edge disabled; the Edge-backed sections render their empty states. */
  get edgeToken(): string {
    return process.env.EDGE_TOKEN || "";
  },
  get fallbackAccent(): string {
    return process.env.FALLBACK_ACCENT || "#9528E6";
  },
  /**
   * SITE_MODE — public: no login, binaries are Content Hub public links; hybrid: public
   * portal with sign-in, pages marked for partners/staff need a session, every binary goes
   * through /api/asset (kit and sales files are never public); gated: everything needs a
   * session. A deployment property, so the proxy can decide without reading SitecoreAI.
   */
  get siteMode(): "public" | "hybrid" | "gated" {
    const m = (process.env.SITE_MODE || "public").trim().toLowerCase();
    return m === "gated" ? "gated" : m === "hybrid" ? "hybrid" : "public";
  },
  /**
   * PORTAL_FILES=asset: binaries go through /api/asset in public mode too — pages stay ungated, but
   * carry no Content Hub public links (an editing host: renders by the Page builder, preview
   * services and crawlers then don't count as public-link views; /api/asset serves what the
   * public site shows, never kit or sales files without a session).
   */
  get filesViaAsset(): boolean {
    return (process.env.PORTAL_FILES || "").trim().toLowerCase() === "asset";
  },
  /** True when binaries are served by /api/asset instead of public links (hybrid, gated, or PORTAL_FILES=asset). */
  get gatedFiles(): boolean {
    return this.siteMode !== "public" || this.filesViaAsset;
  },
  /**
   * PORTAL_SITE_KIND=microsite: this deployment is a campaign microsite (its own SitecoreAI site in
   * the portal's collection) — the setup creates the microsite pages, the head follows the
   * Microsite record's life span (PORTAL_MICROSITE) and redirects to the portal after the takedown.
   */
  get siteKind(): "portal" | "microsite" {
    return (process.env.PORTAL_SITE_KIND || "").trim().toLowerCase() === "microsite" ? "microsite" : "portal";
  },
  /** PORTAL_MICROSITE: the Microsite record's Content Hub identifier (its Edge id). */
  get micrositeId(): string {
    return (process.env.PORTAL_MICROSITE || "").trim();
  },
  /** PORTAL_PORTAL_URL: the brand / dealer portal's origin (takedown redirect, links back); "" = none. */
  get portalUrl(): string {
    try { return new URL(String(process.env.PORTAL_PORTAL_URL || "").trim()).origin; } catch { return ""; }
  },
  /** Signs the session cookie (32+ random chars); without it nobody can sign in. */
  get authSecret(): string {
    return (process.env.AUTH_SECRET || "").trim();
  },
  /** PORTAL_UPLOADS: how partner uploads are filed on this tenant (the Demo Builder reads it off the
   *  tenant at deploy time); null = the portal takes no uploads. */
  get uploads(): PortalUploads | null {
    try {
      const v = JSON.parse(process.env.PORTAL_UPLOADS || "null");
      return v && v.v === 1 && v.flc ? (v as PortalUploads) : null;
    } catch {
      return null;
    }
  },
  /** Fallback brand scope (CH M.Brand identifiers) when the Portal Settings item has none. */
  get portalBrands(): Set<string> {
    return new Set((process.env.PORTAL_BRANDS || "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean));
  },
  get trackUsage(): boolean {
    return process.env.PORTAL_TRACK_USAGE === "1";
  },
  get siteLabel(): string {
    return (process.env.PORTAL_SITE_LABEL || "sitecoreai-portal").slice(0, 80);
  },
};

/** PORTAL_UPLOADS, written by the Demo Builder (server/lib/integrations/portal/partnerUploads.ts):
 *  identifiers and names read off the tenant, nothing guessed. */
export interface PortalUploads {
  v: 1;
  demo: string;
  flc: { created: string; underReview: string; approved: string };
  job?: {
    ed: string; jobType: string; notTemplate?: string; requestType?: string; machine: string;
    reviewState: string; reviewRoutes: string[]; sides: Record<string, "parent" | "parents" | "child" | "children">; props: string[];
    activeState: string; availableRoute?: string;
  };
  maxMb: number;
}
