/**
 * The dealers for the dealer locator, from the deployment (the Demo Builder):
 *  - PORTAL_DEALERS (password-free, set on the microsite and the portal):
 *    [{ n: name, b: focus brand (M.Brand identifier), r: region, t: tier, e: Edge id, s: showrooms }]
 *  - else PORTAL_PARTNERS (the partner logins — only the same public facts are read, never the
 *    login or password).
 * A showroom: { name, city, address, country (ISO-2), lat, lng, phone }. Pure (no server APIs).
 */

export interface Showroom { name: string; city: string; address: string; country: string; lat: number; lng: number; phone: string }
export interface Dealer { id: string; name: string; brand: string; region: string; tier: string; showrooms: Showroom[] }

const text = (v: unknown, max = 160) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const coord = (v: unknown, limit: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};
const idOf = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function showroomsOf(raw: unknown): Showroom[] {
  if (!Array.isArray(raw)) return [];
  const out: Showroom[] = [];
  for (const s of raw.slice(0, 50)) {
    if (!s || typeof s !== "object") continue;
    const x = s as Record<string, unknown>;
    const lat = coord(x.lat, 90), lng = coord(x.lng ?? x.lon, 180);
    const city = text(x.city, 80);
    if (!city && lat == null) continue;
    out.push({
      name: text(x.name, 120), city, address: text(x.address, 200), country: /^[A-Za-z]{2}$/.test(text(x.country)) ? text(x.country).toUpperCase() : "",
      lat: lat ?? NaN, lng: lng ?? NaN, phone: /^[+\d][\d\s().\-/]{2,30}$/.test(text(x.phone, 40)) ? text(x.phone, 40) : "",
    });
  }
  return out;
}

function parse(raw: string | undefined): Dealer[] {
  let list: unknown;
  try { list = JSON.parse(raw || "[]"); } catch { return []; }
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: Dealer[] = [];
  for (const d of list.slice(0, 500)) {
    if (!d || typeof d !== "object") continue;
    const x = d as Record<string, unknown>;
    const name = text(x.n, 120);
    if (!name) continue;
    let id = text(x.e, 120) || text(x.u, 40) || idOf(name);
    if (seen.has(id)) id = `${id}-${out.length}`;
    seen.add(id);
    out.push({ id, name, brand: text(x.b, 120), region: text(x.r, 120), tier: text(x.t, 40), showrooms: showroomsOf(x.s) });
  }
  return out;
}

/** The dealers: PORTAL_DEALERS when set, else the public facts of PORTAL_PARTNERS. */
export function parseDealers(dealersEnv?: string, partnersEnv?: string): Dealer[] {
  return dealersEnv && dealersEnv.trim() ? parse(dealersEnv) : parse(partnersEnv);
}

/** This deployment's dealers. */
export const deploymentDealers = () => parseDealers(process.env.PORTAL_DEALERS, process.env.PORTAL_PARTNERS);

/** True when a showroom can be put on the map. */
export const onMap = (s: Showroom) => Number.isFinite(s.lat) && Number.isFinite(s.lng);
