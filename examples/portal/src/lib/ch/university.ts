import "server-only";
import { edgeAll, edgeTypeFields, hasField, loc, toPortalAsset, ASSET_SELECTION, type PortalAsset } from "./portalEdge";
import { cachedByCulture, SCOPED } from "./culture";
import { env } from "./env";
import { loadCatalog, type CatalogProduct } from "./products";
import { fieldOf, portalModel, relationOf, type ModelDefinition } from "./sports";

/**
 * A university's programs, faculty experts, campus events and published claims. Programs are
 * the tenant's products (degree programs; the colleges are product families) with the
 * admissions CRM's fields (slate_*); experts, events and claims come from the demo's industry
 * model (PORTAL_MODEL, found by role) with the event platform's fields (localist_*). No demo
 * prefix or field name in code beyond the connectors' own: product facts are found by what
 * their names say, every field is checked against the Edge schema before it is queried.
 */

export type UniversityRole = "experts" | "events" | "claims";
const ROLES: Record<UniversityRole, RegExp> = { experts: /expert|faculty/i, events: /\bevents?\b|campusevent/i, claims: /claim/i };

export function universityModel(role: UniversityRole): ModelDefinition | null {
  return portalModel().find((d) => ROLES[role].test(`${d.definition} ${d.label} ${d.type}`)) ?? null;
}

// ---- shared helpers ------------------------------------------------------------------------

const results = (rel: any): any[] => rel?.results ?? [];
const str = (v: unknown) => (v == null ? "" : typeof v === "string" ? v.trim() : typeof v === "object" ? loc(v).trim() : String(v));
const num = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const assets = (rel: any): PortalAsset[] => results(rel).map(toPortalAsset).filter((a): a is PortalAsset => !!a);
const future = (iso: string) => !iso || Date.parse(iso) > Date.now();
/** A record's display name: its `name` field (records), else the taxonomy label. */
const nameOf = (x: any, nameField: string) => str(x[nameField]) || str(x.taxonomyLabel) || "";

async function modelSelection(def: ModelDefinition, relations: string[]): Promise<string | null> {
  const fields = await edgeTypeFields(def.type);
  if (!fields) return null;
  const has = (n: string) => !!n && hasField(fields, n);
  const scalar = [...new Set(["id", "taxonomyLabel", ...def.fields.map((f) => f.edge)])].filter((n) => has(n) && !/^entity_/i.test(n));
  const rels = relations.filter(has).map((r) => {
    const target = def.relations.find((x) => x.edge === r)?.target ?? "";
    return `${r} { results { ${/M\.Asset/i.test(target) ? ASSET_SELECTION : "id"} } }`;
  });
  return [...scalar, ...rels].join(" ");
}

// ---- programs ------------------------------------------------------------------------------

export interface Program extends CatalogProduct {
  college: { id: string; name: string } | null;
  code: string;
  level: string;
  cip: string;
  creditHours: number | null;
  delivery: string;
  tuitionInState: number | null;
  tuitionOutOfState: number | null;
  deadline: string;
  employmentRate: number | null;
  entryTerm: string;
  /** Admissions CRM figures (Slate): applications vs. last year (%), admit rate, yield. */
  applicationsVsLastYear: number | null;
  admitRate: number | null;
  yield: number | null;
  requestInfoUrl: string;
}

const pct = (v: number | null) => (v == null ? null : Math.abs(v) <= 1 && v !== 0 ? v * 100 : v);

/** The degree programs: products with an admissions program code (slate_ProgramCode), in the page culture. */
async function loadProgramsUncached(): Promise<Program[]> {
  if (!env.edgeToken) return [];
  const fields = await edgeTypeFields("M_PCM_Product");
  if (!fields || !hasField(fields, "slate_ProgramCode")) return [];
  const names = fields.map((f) => f.name);
  const find = (re: RegExp, not?: RegExp) => names.find((n) => !/^(slate|localist)_/i.test(n) && re.test(n) && !(not && not.test(n))) ?? "";
  const f = {
    level: find(/degree.?level|^level$/i), cip: find(/^c?ip.?code$/i), credits: find(/credit/i), delivery: find(/delivery|mode$/i),
    tuitionIn: find(/tuition.*in.?state|tuition.*resident/i, /out/i), tuitionOut: find(/tuition.*out/i), deadline: find(/deadline/i), employment: find(/employ|placement/i),
  };
  const slate = ["slate_ProgramCode", "slate_EntryTerm", "slate_ApplicationsVsLastYear", "slate_AdmitRate", "slate_Yield", "slate_RequestInfoUrl"].filter((n) => hasField(fields, n));
  const family = hasField(fields, "pCMProductFamilyToProduct") ? "pCMProductFamilyToProduct { results { id } }" : "";
  const sel = ["id", ...Object.values(f).filter(Boolean), ...slate, family].filter(Boolean).join(" ");
  const [rows, catalog] = await Promise.all([edgeAll("allM_PCM_Product", sel, { max: 2000 }), loadCatalog()]);
  // names, summaries, images (localized) and the colleges come from the catalog
  const cards = new Map<string, CatalogProduct>();
  const collegeOf = new Map<string, { id: string; name: string }>();
  for (const fam of catalog.families) for (const p of fam.products) { cards.set(p.id, p); collegeOf.set(p.id, { id: fam.id, name: fam.name }); }
  for (const p of catalog.unassigned) cards.set(p.id, p);
  const familyName = new Map(catalog.families.map((fam) => [fam.id, fam.name]));
  return rows.filter((x: any) => str(x.slate_ProgramCode) && cards.has(String(x.id))).map((x: any): Program => {
    const card = cards.get(String(x.id))!;
    const famId = results(x.pCMProductFamilyToProduct).map((r: any) => String(r.id))[0] ?? "";
    return {
      ...card,
      college: collegeOf.get(card.id) ?? (famId && familyName.get(famId) ? { id: famId, name: familyName.get(famId)! } : null),
      code: str(x.slate_ProgramCode), level: str(x[f.level]), cip: str(x[f.cip]), creditHours: num(x[f.credits]), delivery: str(x[f.delivery]),
      tuitionInState: num(x[f.tuitionIn]), tuitionOutOfState: num(x[f.tuitionOut]), deadline: str(x[f.deadline]), employmentRate: pct(num(x[f.employment])),
      entryTerm: str(x.slate_EntryTerm), applicationsVsLastYear: num(x.slate_ApplicationsVsLastYear), admitRate: pct(num(x.slate_AdmitRate)), yield: pct(num(x.slate_Yield)),
      requestInfoUrl: /^https?:\/\//i.test(str(x.slate_RequestInfoUrl)) ? str(x.slate_RequestInfoUrl) : "",
    };
  }).sort((a, b) => (a.college?.name ?? "").localeCompare(b.college?.name ?? "") || a.name.localeCompare(b.name));
}
export const loadPrograms = cachedByCulture("uni-programs", loadProgramsUncached, { tags: SCOPED.tags });

export async function loadProgram(id: string): Promise<Program | null> {
  return (await loadPrograms()).find((p) => p.id === id) ?? null;
}

/** True when the deployment is a university's: programs with admissions codes and an experts or events model. */
export const isUniversity = async () => !!(universityModel("events") || universityModel("experts")) && (await loadPrograms()).length > 0;

// ---- faculty experts -----------------------------------------------------------------------

export interface Expert {
  id: string;
  name: string;
  title: string;
  topics: string[];
  languages: string[];
  mediaTrained: boolean;
  /** The portrait — only while the photo consent runs (expiry in the future or unset). */
  portrait: PortalAsset | null;
  programIds: string[];
}

async function loadExpertsUncached(): Promise<Expert[]> {
  const def = universityModel("experts");
  if (!def || !env.edgeToken) return [];
  const master = relationOf(def, /M\.Asset/i, true), product = relationOf(def, /Product/i);
  const sel = await modelSelection(def, [master, product]);
  if (!sel) return [];
  const f = {
    name: fieldOf(def, /^name$/i) || "name", title: fieldOf(def, /title|department|position/i), topics: fieldOf(def, /topic|expertise/i),
    languages: fieldOf(def, /language/i), media: fieldOf(def, /media/i, /bool/i), consent: fieldOf(def, /consent|photo|rights|expir/i, /date/i),
  };
  const rows = await edgeAll(`all${def.type}`, sel, { max: 2000 });
  return rows.map((x: any): Expert => ({
    id: String(x.id), name: nameOf(x, f.name), title: str(x[f.title]),
    topics: str(x[f.topics]).split(/\s*[,;]\s*/).map((t) => t.trim()).filter(Boolean),
    languages: str(x[f.languages]).split(/\s*[,;/]\s*|\s+and\s+/i).map((t) => t.trim()).filter(Boolean),
    mediaTrained: x[f.media] === true || /^(true|yes|1)$/i.test(str(x[f.media])),
    portrait: future(str(x[f.consent])) ? assets(x[master])[0] ?? null : null,
    programIds: results(x[product]).map((p: any) => String(p.id)),
  })).sort((a, b) => a.name.localeCompare(b.name));
}
export const loadExperts = cachedByCulture("uni-experts", loadExpertsUncached, { tags: SCOPED.tags });

// ---- campus events -------------------------------------------------------------------------

export interface CampusEvent {
  id: string;
  name: string;
  date: string;
  type: string;
  audience: string;
  location: string;
  /** English | Spanish | Bilingual … as the record says. */
  language: string;
  status: string;
  past: boolean;
  capacity: number | null;
  registrations: number | null;
  waitlist: number | null;
  checkedIn: number | null;
  /** Seats left (capacity − registrations) for open registrations; null when unknown. */
  seatsLeft: number | null;
  full: boolean;
  waitlisted: boolean;
  url: string;
  image: PortalAsset | null;
}

async function loadEventsUncached(): Promise<CampusEvent[]> {
  const def = universityModel("events");
  if (!def || !env.edgeToken) return [];
  const master = relationOf(def, /M\.Asset/i, true), gallery = relationOf(def, /M\.Asset/i, false);
  const sel = await modelSelection(def, [master, gallery]);
  if (!sel) return [];
  const f = {
    name: fieldOf(def, /^name$/i) || "name", date: fieldOf(def, /date|start/i, /date/i), type: fieldOf(def, /type|kind/i), audience: fieldOf(def, /audience/i),
    location: fieldOf(def, /location|venue|place/i), language: fieldOf(def, /language/i), capacity: fieldOf(def, /capacity/i),
  };
  const fields = await edgeTypeFields(def.type);
  const localist = (fields ?? []).map((x) => x.name).filter((n) => /^localist_/i.test(n));
  const extra = localist.filter((n) => !sel.includes(n)).join(" ");
  const rows = await edgeAll(`all${def.type}`, `${sel} ${extra}`, { max: 2000 });
  return rows.map((x: any): CampusEvent => {
    const status = str(x.localist_Status);
    const date = str(x[f.date]);
    const past = /past|ended|complete/i.test(status) || (!!date && Date.parse(date) < Date.now() - 6 * 3600_000);
    const capacity = num(x.localist_Capacity) ?? num(x[f.capacity]);
    const registrations = num(x.localist_Registrations);
    return {
      id: String(x.id), name: nameOf(x, f.name), date, type: str(x[f.type]), audience: str(x[f.audience]), location: str(x[f.location]), language: str(x[f.language]),
      status, past, capacity, registrations, waitlist: num(x.localist_Waitlist), checkedIn: num(x.localist_CheckedIn),
      seatsLeft: capacity != null && registrations != null ? Math.max(0, capacity - registrations) : null,
      full: /full/i.test(status), waitlisted: /wait/i.test(status),
      url: /^https?:\/\//i.test(str(x.localist_EventUrl)) ? str(x.localist_EventUrl) : "",
      image: assets(x[master])[0] ?? assets(x[gallery])[0] ?? null,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}
export const loadEvents = cachedByCulture("uni-events", loadEventsUncached, { tags: SCOPED.tags });

// ---- published claims ----------------------------------------------------------------------

export interface Claim { id: string; name: string; wording: string; source: string; dataYear: string; verifiedBy: string; verified: string; expiry: string; status: string; image: PortalAsset | null; contentIds: string[] }

/** Verified claims whose expiry hasn't passed (anything else never reaches a page). */
async function loadClaimsUncached(): Promise<Claim[]> {
  const def = universityModel("claims");
  if (!def || !env.edgeToken) return [];
  const master = relationOf(def, /M\.Asset/i, true), content = relationOf(def, /Content/i);
  const sel = await modelSelection(def, [master, content]);
  if (!sel) return [];
  const f = {
    name: fieldOf(def, /^name$/i) || "name", wording: fieldOf(def, /wording|statement|text|claim/i), source: fieldOf(def, /source/i), year: fieldOf(def, /year/i),
    by: fieldOf(def, /verified.?by|verifier/i), verified: fieldOf(def, /verification|verified.?(on|date)/i, /date/i), expiry: fieldOf(def, /expir/i, /date/i), status: fieldOf(def, /status/i),
  };
  const rows = await edgeAll(`all${def.type}`, sel, { max: 2000 });
  return rows.map((x: any): Claim => ({
    id: String(x.id), name: nameOf(x, f.name), wording: str(x[f.wording]) || nameOf(x, f.name), source: str(x[f.source]), dataYear: str(x[f.year]),
    verifiedBy: str(x[f.by]), verified: str(x[f.verified]), expiry: str(x[f.expiry]), status: str(x[f.status]),
    image: assets(x[master])[0] ?? null, contentIds: results(x[content]).map((c: any) => String(c.id)),
  })).filter((c) => /^verified$/i.test(c.status) && c.expiry && future(c.expiry));
}
export const loadClaims = cachedByCulture("uni-claims", loadClaimsUncached, { tags: SCOPED.tags });

export { claimFor } from "./university-match";
