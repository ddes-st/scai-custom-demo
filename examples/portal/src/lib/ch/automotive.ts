import "server-only";
import { micrositeIdNow, portalUrlNow, siteKindNow } from "../portal/sites";
import { edgeAll, edgeTypeFields, hasField, loc, toPortalAsset, ASSET_SELECTION, type PortalAsset } from "./portalEdge";
import { cachedByCulture, SCOPED } from "./culture";
import { env } from "./env";
import { listBrands } from "./data";
import type { BrandSummary } from "./types";
import { loadEntity } from "./entities";
import { edgeRequest } from "./edge";
import { loadCatalog } from "./products";
import { fieldOf, portalModel, relationOf, type ModelDefinition } from "./sports";
import { highlightFigures, micrositeModels, micrositePhase, type FigureKey, type Market, type MicrositePhase } from "./automotive-match";

/**
 * A car maker's campaign microsites and markets from the demo's industry model (PORTAL_MODEL,
 * found by role: microsite / market), and the key figures of the products a microsite highlights.
 * No demo prefix or field name in code: fields are found by what their names say (URL, reveal,
 * go-live and takedown dates, status, markets; country, language, test cycle, disclaimer …) and
 * checked against the Edge schema before they are queried.
 */

export type AutomotiveRole = "microsites" | "markets";
const ROLES: Record<AutomotiveRole, RegExp> = { microsites: /micro.?site/i, markets: /\bmarkets?\b/i };

export function automotiveModel(role: AutomotiveRole): ModelDefinition | null {
  return portalModel().find((d) => ROLES[role].test(`${d.definition} ${d.label}`)) ?? null;
}

const results = (rel: any): any[] => rel?.results ?? [];
const str = (v: unknown) => (v == null ? "" : typeof v === "string" ? v.trim() : typeof v === "object" ? loc(v).trim() : String(v));
const assets = (rel: any): PortalAsset[] => results(rel).map(toPortalAsset).filter((a): a is PortalAsset => !!a);
const nameOf = (x: any, nameField: string) => str(x[nameField]) || str(x.taxonomyLabel) || "";

async function modelSelection(def: ModelDefinition, relations: string[]): Promise<string | null> {
  const fields = await edgeTypeFields(def.type);
  if (!fields) return null;
  const has = (n: string) => !!n && hasField(fields, n);
  const scalar = [...new Set(["id", "taxonomyLabel", ...def.fields.map((f) => f.edge)])].filter((n) => has(n) && !/^entity_/i.test(n));
  const rels = [...new Set(relations)].filter(has).map((r) => {
    const target = def.relations.find((x) => x.edge === r)?.target ?? "";
    return `${r} { results { ${/M\.Asset/i.test(target) ? ASSET_SELECTION : /M\.Brand/i.test(target) ? "id brandName" : "id"} } }`;
  });
  return [...scalar, ...rels].join(" ");
}

// ---- markets -------------------------------------------------------------------------------

async function loadMarketsUncached(): Promise<Market[]> {
  const def = automotiveModel("markets");
  if (!def || !env.edgeToken) return [];
  const sel = await modelSelection(def, []);
  if (!sel) return [];
  const f = {
    name: fieldOf(def, /^name$/i) || "name", country: fieldOf(def, /country/i), language: fieldOf(def, /language|locale/i), cycle: fieldOf(def, /test.?cycle|cycle/i),
    disclaimer: fieldOf(def, /disclaimer|legal/i), launch: fieldOf(def, /launch/i, /date/i), manager: fieldOf(def, /manager|owner/i),
  };
  const rows = await edgeAll(`all${def.type}`, sel, { max: 500 });
  return rows.map((x: any): Market => ({
    // a market without a name field is known by its country
    id: String(x.id), name: nameOf(x, f.name) || str(x[f.country]), country: str(x[f.country]), language: str(x[f.language]), testCycle: str(x[f.cycle]),
    disclaimer: str(x[f.disclaimer]), launchDate: str(x[f.launch]), manager: str(x[f.manager]),
  }));
}
export const loadMarkets = cachedByCulture("auto-markets", loadMarketsUncached, { tags: SCOPED.tags });

// ---- microsites ----------------------------------------------------------------------------

export interface Microsite {
  id: string;
  name: string;
  url: string;
  revealDate: string;
  goLive: string;
  takedown: string;
  status: string;
  owner: string;
  phase: MicrositePhase;
  /** The microsite's markets, in the record's order (relation, or names matched to Market records). */
  markets: Market[];
  /** The marque: the first related brand ({ id = M.Brand identifier, name }), or null. */
  brand: { id: string; name: string } | null;
  /** The reveal visual (the master asset, else the first image) and the rest for the gallery. */
  hero: PortalAsset | null;
  gallery: PortalAsset[];
  campaignIds: string[];
}

async function loadMicrositesUncached(): Promise<Microsite[]> {
  const def = automotiveModel("microsites");
  if (!def || !env.edgeToken) return [];
  const marketDef = automotiveModel("markets");
  const master = relationOf(def, /M\.Asset/i, true), gallery = relationOf(def, /M\.Asset/i, false);
  const brandRel = relationOf(def, /M\.Brand/i), campaignRel = relationOf(def, /Campaign/i);
  const marketRel = marketDef ? def.relations.find((r) => r.target === marketDef.definition || /market/i.test(`${r.name} ${r.target}`))?.edge ?? "" : "";
  const sel = await modelSelection(def, [master, gallery, brandRel, campaignRel, marketRel].filter(Boolean));
  if (!sel) return [];
  const f = {
    name: fieldOf(def, /^name$/i) || "name", url: fieldOf(def, /\burl\b|web.?address|domain/i), reveal: fieldOf(def, /reveal/i, /date/i),
    goLive: fieldOf(def, /go.?live|live.?date|start/i, /date/i), takedown: fieldOf(def, /take.?down|end.?date|expir/i, /date/i),
    status: fieldOf(def, /status/i), owner: fieldOf(def, /owner/i), markets: fieldOf(def, /market/i),
  };
  const [rows, allMarkets] = await Promise.all([edgeAll(`all${def.type}`, sel, { max: 500 }), loadMarkets().catch(() => [] as Market[])]);
  return rows.map((x: any): Microsite => {
    // the markets in the record's order: the names field ("Markets (in order)") when it names known
    // markets, else the relation to the Market records
    const names = f.markets ? str(x[f.markets]).split(/[,;|\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
    const byName = names.map((n) => allMarkets.find((m) => m.name.toLowerCase() === n || m.country.toLowerCase() === n)).filter((m): m is Market => !!m);
    const markets = byName.length ? byName : marketRel ? results(x[marketRel]).map((r: any) => allMarkets.find((m) => m.id === String(r.id))).filter((m: Market | undefined): m is Market => !!m) : [];
    const b = results(x[brandRel])[0];
    const all = [...assets(x[master]), ...assets(x[gallery])].filter((a, i, arr) => arr.findIndex((y) => y.id === a.id) === i).filter((a) => a.preview);
    const hero = all.find((a) => a.kind === "image") ?? null;
    const rec = { status: str(x[f.status]), goLive: str(x[f.goLive]), revealDate: str(x[f.reveal]), takedown: str(x[f.takedown]) };
    return {
      id: String(x.id), name: nameOf(x, f.name), url: str(x[f.url]), owner: str(x[f.owner]), ...rec, phase: micrositePhase(rec),
      markets, brand: b ? { id: String(b.id), name: str(b.brandName) } : null,
      hero, gallery: all.filter((a) => a !== hero), campaignIds: results(x[campaignRel]).map((r: any) => String(r.id)),
    };
  });
}
export const loadMicrosites = cachedByCulture("auto-microsites", loadMicrositesUncached, { tags: SCOPED.tags });

/**
 * This site's microsite (its PORTAL_MICROSITES entry, else PORTAL_MICROSITE); in the Page builder without one, a sample (the
 * first live, else the first record) so the components can be laid out. null when there is none.
 */
export async function loadMicrosite(sample = false): Promise<Microsite | null> {
  const all = await loadMicrosites();
  const id = micrositeIdNow();
  const own = id ? all.find((m) => m.id === id) : undefined;
  if (own || !sample) return own ?? null;
  return all.find((m) => m.phase === "revealed" || m.phase === "teaser") ?? all[0] ?? null;
}

/**
 * Where a taken-down microsite sends its visitors: the marque's brand book on the portal
 * (PORTAL_PORTAL_URL/brands/<slug>), else the portal's home; "" while the site is up, without a
 * portal URL, or when the record can't be read (never redirect on a hiccup).
 */
export async function takedownTarget(): Promise<string> {
  const portal = portalUrlNow();
  if (siteKindNow() !== "microsite" || !portal || !micrositeIdNow()) return "";
  try {
    const m = await loadMicrosite();
    if (!m || m.phase !== "down") return "";
    const slug = m.brand ? (await listBrands().catch((): BrandSummary[] => [])).find((b) => b.identifier === m.brand!.id)?.slug ?? "" : "";
    return `${portal}${slug ? `/brands/${encodeURIComponent(slug)}` : "/"}`;
  } catch {
    return "";
  }
}

// ---- model highlights ----------------------------------------------------------------------

export interface Highlight { id: string; name: string; href: string; image: PortalAsset | null; figures: Partial<Record<FigureKey, string>> }

/** The picked products with their key figures (WLTP range, starting price, power, CO2 …), in the page's language. */
export async function loadHighlights(ids: string[], max = 12): Promise<Highlight[]> {
  const rows = await Promise.all(ids.slice(0, max).map((id) => loadEntity("M_PCM_Product", id).catch(() => null)));
  return rows.filter((e): e is NonNullable<typeof e> => !!e).map((e) => ({
    id: e.id, name: e.title, href: e.href, image: e.images.find((a) => a.kind === "image") ?? null, figures: highlightFigures(e.fields),
  }));
}

// ---- what the setup writes for a microsite -------------------------------------------------

export interface MicrositeSetupInfo {
  name: string;
  /** The marque: its M.Brand identifier and name. */
  brand: { id: string; name: string } | null;
  /** The marque's logo: its master asset's identifier (Edge id), "" without one. */
  logo: string;
  /** Up to three cars: the microsite's own model (by its name), else the marque's newest; those with a range or a price first. */
  models: Array<{ id: string; name: string }>;
}

/** The setup's defaults for this site's microsite (header wordmark and logo, the model highlights); null without a record. */
export async function micrositeSetupInfo(): Promise<MicrositeSetupInfo | null> {
  const m = await loadMicrosite();
  if (!m) return null;
  let logo = "";
  if (m.brand) {
    const fields = await edgeTypeFields("M_Brand");
    if (hasField(fields, "pCMBrandToMasterAsset")) {
      const d = await edgeRequest(`query($id: String!) { b: m_Brand(id: $id) { pCMBrandToMasterAsset { results { id } } } }`, { id: m.brand.id }).catch(() => null);
      logo = String(d?.b?.pCMBrandToMasterAsset?.results?.[0]?.id ?? "");
    }
  }
  let models: MicrositeSetupInfo["models"] = [];
  const marque = m.brand?.name.trim().toLowerCase() ?? "";
  if (marque) {
    const catalog = await loadCatalog();
    const all = [...catalog.families.flatMap((f) => f.products), ...catalog.unassigned].filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
    const mine = all.filter((p) => p.brands.some((b) => b.trim().toLowerCase() === marque));
    const named = micrositeModels(m.name, m.brand!.name, mine);
    const year = (h: Highlight) => Number(h.figures.modelYear ?? 0) || 0;
    const figured = (h: Highlight) => (h.figures.range || h.figures.price ? 1 : 0);
    const cars = await loadHighlights((named.length ? named : mine).map((p) => p.id), named.length ? 12 : 40);
    // the microsite's model in catalog order; without one, the marque's newest cars
    if (!named.length) cars.sort((a, b) => year(b) - year(a) || a.name.localeCompare(b.name));
    models = cars
      .filter((h) => named.length || figured(h))
      .sort((a, b) => figured(b) - figured(a))
      .slice(0, 3)
      .map((h) => ({ id: h.id, name: h.name }));
  }
  return { name: m.name, brand: m.brand, logo, models };
}
