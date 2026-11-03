/**
 * Campaign microsites served by the portal's own deployment (joint mode): PORTAL_MICROSITES =
 * [{ site: SitecoreAI site name, microsite: the Microsite record's identifier, host: its hostname }]
 * (set by the Demo Builder on the portal's live and editing projects). Each one is its own
 * SitecoreAI site in the portal's collection, served at `/` on its host. The other mode — a
 * microsite as its own deployment (PORTAL_SITE_KIND=microsite, PORTAL_MICROSITE) — stays as it is.
 * Pure (no server APIs): the proxy reads it too.
 */
export interface JointMicrosite { site: string; microsite: string; host: string }

const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export function parseMicrosites(raw: string | undefined): JointMicrosite[] {
  let list: unknown;
  try { list = JSON.parse(raw || "[]"); } catch { return []; }
  if (!Array.isArray(list)) return [];
  const out: JointMicrosite[] = [];
  for (const x of list.slice(0, 50)) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    const site = typeof e.site === "string" ? e.site.trim() : "";
    const microsite = typeof e.microsite === "string" ? e.microsite.trim() : "";
    const host = typeof e.host === "string" ? e.host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "";
    if (!/^[\w][\w -]{0,99}$/.test(site) || !microsite || !HOST.test(host)) continue;
    if (out.some((m) => m.site.toLowerCase() === site.toLowerCase() || m.host === host)) continue;
    out.push({ site, microsite, host });
  }
  return out;
}

export const jointMicrosites = () => parseMicrosites(process.env.PORTAL_MICROSITES);

/** The joint microsite a site name is, or null. */
export const jointMicrositeOf = (site: string) => jointMicrosites().find((m) => m.site.toLowerCase() === site.toLowerCase()) ?? null;

/** The joint microsite served on a hostname, or null. */
export const jointMicrositeOnHost = (host: string) => {
  const h = host.toLowerCase().replace(/:\d+$/, "");
  return jointMicrosites().find((m) => m.host === h) ?? null;
};

/**
 * The Content SDK's site list with this deployment's joint microsites in front, each with its own
 * host: the SDK resolves a request's site by host, exact hosts before the default site's "*".
 */
export function withJointMicrosites<T extends { name: string; hostName: string; language: string }>(sites: T[], defaultLanguage: string): T[] {
  const extra = jointMicrosites().map((m) => {
    const known = sites.find((x) => x.name.toLowerCase() === m.site.toLowerCase());
    return { ...(known ?? ({ language: defaultLanguage } as T)), name: known?.name ?? m.site, hostName: m.host } as T;
  });
  return [...extra, ...sites];
}
