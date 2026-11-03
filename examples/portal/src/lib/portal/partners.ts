import "server-only";
import { currentSite } from "./sites";
import { unstable_cache } from "next/cache";
import scConfig from "sitecore.config";
import { siteRootPath } from "./settings";
import { xmcQuery } from "./xmc-graphql";
import { withLastGood } from "../ch/last-good";

/**
 * Partner profiles, from two sources that meet on `user`:
 *  - PORTAL_PARTNERS (the Demo Builder): the login plus the partner's facts — name n, tier t,
 *    region r, kit collection k, about a, focus brand b, and since phase 3 the partner's
 *    BrandSite.Partner record e (its Edge id), its Partner Manager m and its type y, and the
 *    partner's contact person c with the email ce, and l, the contact's sign-in name;
 *  - items under <site>/Data/Partners (template Portal Partner — User, Tier, Region, FocusBrand,
 *    KitCollection, About), authored in SitecoreAI: a non-empty field there wins.
 * A partner that can sign in but has no item keeps the login's facts; an item without a login is
 * listed for staff but cannot sign in.
 */
export interface PartnerProfile {
  user: string;
  name: string;
  tier: string;
  region: string;
  /** Content Hub M.Brand identifier of the partner's focus brand ("" = none). */
  brand: string;
  /** Content Hub collection id (Edge id) of the partner kit ("" = none). */
  kit: string;
  about: string;
  /** BrandSite.Partner identifier (Edge id) — what the brand shares with the partner; "" = none yet. */
  entity: string;
  /** The Partner Manager's name and the partner type (display). */
  manager: string;
  type: string;
  /** The partner's contact person and their email ("" when not set). */
  contact: string;
  contactEmail: string;
  /** The sign-in name besides `user` (PORTAL_PARTNERS l, the contact's name); "" = only `user`. */
  login: string;
}

/** The partner facts in PORTAL_PARTNERS (never the password). */
export function envPartners(): PartnerProfile[] {
  try {
    const list = JSON.parse(process.env.PORTAL_PARTNERS || "[]");
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    return (Array.isArray(list) ? list : [])
      .map((x: any) => ({ user: str(x?.u).toLowerCase(), name: str(x?.n), tier: str(x?.t), region: str(x?.r), brand: str(x?.b), kit: str(x?.k), about: str(x?.a), entity: str(x?.e), manager: str(x?.m), type: str(x?.y), contact: str(x?.c).slice(0, 80), contactEmail: /^[^\s@]+@[^\s@]+$/.test(str(x?.ce)) ? str(x?.ce) : "", login: /^[a-z0-9-]{1,40}$/.test(str(x?.l)) ? str(x?.l) : "" }))
      .filter((p: PartnerProfile) => /^[a-z0-9-]{1,40}$/.test(p.user))
      .map((p: PartnerProfile) => ({ ...p, name: p.name || p.user }));
  } catch { return []; }
}

const QUERY = `query($path: String!, $language: String!) {
  item(path: $path, language: $language) { children(first: 50) { results { name displayName fields { name value } } } }
}`;

async function loadUncached(site: string, language: string): Promise<PartnerProfile[]> {
  const root = await siteRootPath(site, language);
  if (!root) return [];
  const data = await xmcQuery<{ item?: { children?: { results?: any[] } } }>(QUERY, { path: `${root}/Data/Partners`, language });
  const out: PartnerProfile[] = [];
  for (const it of data?.item?.children?.results ?? []) {
    const f = new Map<string, string>((it?.fields ?? []).map((x: any) => [String(x.name), String(x.value ?? "").trim()]));
    const user = (f.get("User") || String(it?.name ?? "")).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40);
    if (!user) continue;
    out.push({ user, name: String(it?.displayName || it?.name || user).trim(), tier: f.get("Tier") ?? "", region: f.get("Region") ?? "", brand: f.get("FocusBrand") ?? "", kit: f.get("KitCollection") ?? "", about: f.get("About") ?? "", entity: "", manager: "", type: "", contact: "", contactEmail: "", login: "" });
  }
  return out;
}

/** The login's facts with the SitecoreAI item's non-empty fields on top; items without a login after. */
function merge(items: PartnerProfile[], logins: PartnerProfile[]): PartnerProfile[] {
  const byUser = new Map(items.map((p) => [p.user, p]));
  const pick = (a: string, b: string) => a || b;
  const merged = logins.map((l) => {
    const i = byUser.get(l.user);
    return i ? { ...l, name: pick(i.name !== i.user ? i.name : "", l.name), tier: pick(i.tier, l.tier), region: pick(i.region, l.region), brand: pick(i.brand, l.brand), kit: pick(i.kit, l.kit), about: pick(i.about, l.about) } : l;
  });
  return [...merged, ...items.filter((i) => !logins.some((l) => l.user === i.user))];
}

/** The items; on a failure the last good list of this instance (other partners' kits stay
 *  known — see otherPartnerKits), else none. */
const load = withLastGood("portal partners", (site: string, language: string) =>
  unstable_cache(() => loadUncached(site, language), ["portal-partners", site, language], { revalidate: 60, tags: ["xmc-site"] })(), () => [] as PartnerProfile[]);

export async function loadPartners(site = "", language = scConfig.defaultLanguage): Promise<PartnerProfile[]> {
  site = site || currentSite();
  return merge(await load(site, language), envPartners());
}

export async function findPartner(user: string): Promise<PartnerProfile | null> {
  const u = user.trim().toLowerCase();
  return (await loadPartners()).find((p) => p.user === u) ?? null;
}

/** The kit collection ids of every partner except `user` (what a partner must never fetch). */
export async function otherPartnerKits(user: string): Promise<Set<string>> {
  return new Set((await loadPartners()).filter((p) => p.user !== user && p.kit).map((p) => p.kit));
}
