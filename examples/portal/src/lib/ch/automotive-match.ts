/**
 * Pure helpers for the automotive components (no data loading — unit-tested): the microsite's
 * phase in its life span, the market whose disclaimer a page language shows, and a product's key
 * figures found by what its fields are called.
 */

export interface Market { id: string; name: string; country: string; language: string; testCycle: string; disclaimer: string; launchDate: string; manager: string }

export type MicrositePhase = "planned" | "teaser" | "revealed" | "down";

/** A date-only value (or midnight UTC) counts to the end of that day. */
function endOf(iso: string): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return NaN;
  return /T00:00(:00(\.0+)?)?(Z|[+-]00:?00)?$/.test(iso) || /^\d{4}-\d{2}-\d{2}$/.test(iso) ? t + 24 * 3600_000 : t;
}

/**
 * Where the microsite is in its life: "down" once its status says so (Taken down) or its takedown
 * day is over; "planned" before its go-live; "revealed" from the reveal on; "teaser" in between.
 */
export function micrositePhase(m: { status: string; goLive: string; revealDate: string; takedown: string }, now = Date.now()): MicrositePhase {
  if (/taken.?down|retired|offline|closed/i.test(m.status)) return "down";
  const end = endOf(m.takedown);
  if (Number.isFinite(end) && now >= end) return "down";
  const live = Date.parse(m.goLive);
  if (Number.isFinite(live) && now < live) return "planned";
  const reveal = Date.parse(m.revealDate);
  return Number.isFinite(reveal) && now >= reveal ? "revealed" : "teaser";
}

const LANGUAGE_NAMES: Record<string, string> = {
  english: "en", french: "fr", français: "fr", francais: "fr", italian: "it", italiano: "it", german: "de", deutsch: "de", spanish: "es", español: "es", espanol: "es",
  dutch: "nl", nederlands: "nl", portuguese: "pt", swedish: "sv", norwegian: "nb", danish: "da", finnish: "fi", polish: "pl", arabic: "ar", japanese: "ja", chinese: "zh",
};
const COUNTRY_LANGUAGE: Record<string, string> = {
  "united kingdom": "en", uk: "en", gb: "en", "great britain": "en", ireland: "en", ie: "en", "united states": "en", usa: "en", us: "en", canada: "en", ca: "en", australia: "en", au: "en",
  france: "fr", fr: "fr", belgium: "fr", italy: "it", it: "it", germany: "de", de: "de", austria: "de", at: "de", switzerland: "de", spain: "es", es: "es", mexico: "es", mx: "es",
  netherlands: "nl", nl: "nl", portugal: "pt", pt: "pt", sweden: "sv", se: "sv", norway: "nb", no: "nb", denmark: "da", dk: "da", finland: "fi", fi: "fi", poland: "pl", pl: "pl",
};

/** A market's language as a base code ("fr"): its language field (a code or a name), else its country's. */
export function marketLanguage(m: Pick<Market, "language" | "country">): string {
  const raw = m.language.trim().toLowerCase();
  const code = /^([a-z]{2,3})(?:[-_][a-z]{2,4})?$/i.exec(raw)?.[1];
  if (code) return code;
  if (LANGUAGE_NAMES[raw]) return LANGUAGE_NAMES[raw];
  return COUNTRY_LANGUAGE[m.country.trim().toLowerCase()] ?? "";
}

/**
 * The market whose mandatory disclaimer a page shows: among the microsite's markets (in the
 * record's order) the first one in the page's language — so English takes the first
 * English-speaking market — else the first market; null without markets.
 */
export function marketFor(markets: Market[], locale: string): Market | null {
  if (!markets.length) return null;
  const want = locale.toLowerCase();
  const base = want.split("-")[0];
  return markets.find((m) => m.language.trim().toLowerCase() === want) ?? markets.find((m) => marketLanguage(m) === base) ?? markets[0];
}

export type FigureKey = "range" | "price" | "power" | "co2" | "powertrain" | "modelYear";
const FIGURES: Array<[FigureKey, RegExp, RegExp?]> = [
  ["price", /starting.?price|\bprice\b|\bmsrp\b|\brrp\b/i],
  ["range", /wltp|\bepa\b|\brange\b/i, /price/i],
  ["power", /\bpower\b|\bhp\b|horse.?power|\bkw\b/i, /train/i],
  ["co2", /co2|co₂|emission/i],
  ["powertrain", /powertrain|drive.?train|fuel.?type|propulsion/i],
  ["modelYear", /model.?year/i],
];

/** A product's key figures from its fields (label → value), by what the labels say; only the ones present. */
export function highlightFigures(fields: Array<{ label: string; value: string }>): Partial<Record<FigureKey, string>> {
  const out: Partial<Record<FigureKey, string>> = {};
  for (const [key, re, not] of FIGURES) {
    const hit = fields.find((f) => re.test(f.label) && !(not && not.test(f.label)) && f.value.trim());
    if (hit) out[key] = hit.value.trim();
  }
  return out;
}

/** A figure's number when the value is one ("38990", "38 990", "441,5"); null otherwise. */
export function numberOf(value: string): number | null {
  const t = value.replace(/\s| | /g, "");
  if (!/^-?\d+([.,]\d+)?$/.test(t)) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const words = (s: string) => s.normalize("NFC").toLowerCase().split(/[^\p{L}\p{N}-]+/u).map((w) => w.replace(/^-+|-+$/g, "")).filter((w) => w.length > 1);
// "lisère-e" is a Lisère, "cadence-e" the Cadence-e
const sameWord = (product: string, name: string) => product === name || product.startsWith(`${name}-`);

/**
 * The microsite's own model among its marque's products, in catalog order: the products whose names share a
 * word with the microsite's name ("Cadence-e Reveal" → both Cadence-e trims; "Vellara 70 Years" → the Ardenza
 * 70 Anniversario), then the rest of those models' lines (the Ardenza Q4). The marque's name doesn't count.
 * Empty when the name points to no product.
 */
export function micrositeModels<T extends { name: string }>(micrositeName: string, marque: string, products: T[]): T[] {
  const skip = new Set(words(marque));
  const wanted = words(micrositeName).filter((w) => !skip.has(w));
  const own = (p: T) => words(p.name).filter((w) => !skip.has(w));
  const line = (p: T) => own(p)[0] ?? "";
  const direct = products.filter((p) => own(p).some((w) => wanted.some((n) => sameWord(w, n))));
  const lines = new Set(direct.map(line).filter(Boolean));
  return [...direct, ...products.filter((p) => !direct.includes(p) && lines.has(line(p)))];
}
