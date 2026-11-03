import "server-only";
import { edgeAll, edgeTypeFields, hasField, loc, toPortalAsset, ASSET_SELECTION, type PortalAsset } from "./portalEdge";
import { cachedByCulture, SCOPED } from "./culture";
import { overlay, pairLocalizedVariants, stripVariantSuffix } from "./localized";
import { env } from "./env";

/**
 * A sports club's games, players and sponsorships from the demo's industry model on Experience
 * Edge. The Demo Builder describes the model in PORTAL_MODEL (JSON: definition, Edge type,
 * fields and relations with their Edge names); nothing here names a demo's prefix or fields:
 * the definitions are found by role (games / players / sponsorships) and the fields by what
 * they are (a date, the opponent, home or away …) plus the feed connectors' own field names
 * (statsFeed_*, ticketmaster_*), all checked against the Edge schema before they are queried.
 */

export interface ModelField { name: string; edge: string; type: string; label: string; multilanguage?: boolean }
export interface ModelRelation { name: string; edge: string; target: string; role: string; cardinality: string; label: string }
export interface ModelDefinition { definition: string; type: string; label: string; taxonomy: boolean; count: number; fields: ModelField[]; relations: ModelRelation[] }

export type SportsRole = "games" | "players" | "sponsorships";
const ROLES: Record<SportsRole, RegExp> = { games: /game|match|fixture/i, players: /player|athlete/i, sponsorships: /sponsor/i };

/** The industry model the deployment was given (PORTAL_MODEL); [] when there is none. */
export function portalModel(): ModelDefinition[] {
  try {
    const raw = JSON.parse(process.env.PORTAL_MODEL || "[]");
    return (Array.isArray(raw) ? raw : []).filter((d: any) => d && typeof d.type === "string" && /^\w+$/.test(d.type) && Array.isArray(d.fields)).map((d: any) => ({
      definition: String(d.definition ?? d.type), type: String(d.type), label: String(d.label ?? ""), taxonomy: !!d.taxonomy, count: Number(d.count) || 0,
      fields: (d.fields as any[]).filter((f) => f && /^\w+$/.test(String(f.edge ?? ""))).map((f) => ({ name: String(f.name ?? f.edge), edge: String(f.edge), type: String(f.type ?? ""), label: String(f.label ?? ""), multilanguage: !!f.multilanguage })),
      relations: (Array.isArray(d.relations) ? d.relations : []).filter((r: any) => r && /^\w+$/.test(String(r.edge ?? ""))).map((r: any) => ({ name: String(r.name ?? r.edge), edge: String(r.edge), target: String(r.target ?? ""), role: String(r.role ?? ""), cardinality: String(r.cardinality ?? ""), label: String(r.label ?? "") })),
    }));
  } catch {
    return [];
  }
}

/** The model definition playing a role (games, players, sponsorships), or null. */
export function modelFor(role: SportsRole): ModelDefinition | null {
  return portalModel().find((d) => ROLES[role].test(`${d.definition} ${d.label}`)) ?? null;
}

/** True when the deployment's model is a sports club's (games and players). */
export const isSportsModel = () => !!modelFor("games") && !!modelFor("players");

/** A model field by what it is: its name or label matches `re` (and the type, when given). */
export function fieldOf(def: ModelDefinition, re: RegExp, type?: RegExp): string {
  return def.fields.find((f) => !/^(statsFeed|ticketmaster|slate|localist)_/i.test(f.edge) && re.test(`${f.name} ${f.label}`) && (!type || type.test(f.type)))?.edge ?? "";
}
/** A relation by target and kind: master (…ToMasterAsset), gallery (…ToAsset), brand, product, campaign. */
export function relationOf(def: ModelDefinition, target: RegExp, master?: boolean): string {
  return def.relations.find((r) => target.test(r.target) && (master === undefined || /master/i.test(r.edge) === master))?.edge ?? "";
}

// ---- shared helpers ------------------------------------------------------------------------

const results = (rel: any): any[] => rel?.results ?? [];
const str = (v: unknown) => (v == null ? "" : typeof v === "string" ? v.trim() : typeof v === "object" ? loc(v).trim() : String(v));
const num = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const none = (v: string) => !v || v === "-" || v === "–" || v === "—";
const assets = (rel: any): PortalAsset[] => results(rel).map(toPortalAsset).filter((a): a is PortalAsset => !!a);

/** The selection for one type: id, display name, the model's fields and these relations — only what Edge has. */
async function selectionFor(def: ModelDefinition, relations: string[]): Promise<{ sel: string; has: (n: string) => boolean } | null> {
  const fields = await edgeTypeFields(def.type);
  if (!fields) return null;
  const has = (n: string) => !!n && hasField(fields, n);
  const scalar = [...new Set(["id", "taxonomyLabel", "taxonomyName", ...def.fields.map((f) => f.edge)])].filter((n) => has(n) && !/^entity_/i.test(n));
  const rels = relations.filter(has).map((r) => `${r} { results { ${ASSET_OR_REF(def, r)} } }`);
  return { sel: [...scalar, ...rels].join(" "), has };
}
function ASSET_OR_REF(def: ModelDefinition, edge: string): string {
  const target = def.relations.find((r) => r.edge === edge)?.target ?? "";
  if (/M\.Asset/i.test(target)) return ASSET_SELECTION;
  if (/M\.Brand/i.test(target)) return "id brandName";
  return "id";
}
/** The display name: the taxonomy label in the page culture (then en-US), never the key. */
const nameOf = (x: any) => str(x.taxonomyLabel) || str(x.content_Name) || "";

// ---- games ---------------------------------------------------------------------------------

export interface ScoringEvent {
  period: string;
  time: string;
  /** "us" when the club scored (a line naming a scorer), "them" otherwise. */
  side: "us" | "them";
  team: string;
  scorer: string;
  assists: string;
  /** Extras after the assists ("PPG", "SHG", "EN" …). */
  note: string;
  score: string;
}

export interface Game {
  id: string;
  title: string;
  date: string;
  opponent: string;
  home: boolean;
  gameType: string;
  themeNight: string;
  status: "scheduled" | "closed";
  finalScore: string;
  result: string;
  win: boolean | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  shotsFor: number | null;
  shotsAgainst: number | null;
  powerPlay: string;
  scoring: ScoringEvent[];
  threeStars: string[];
  goalie: string;
  ticket: { status: string; url: string; onSale: string; capacity: number | null; sold: number | null; sellThrough: number | null; averagePrice: number | null; soldOut: boolean; completed: boolean };
  image: PortalAsset | null;
  photos: PortalAsset[];
  campaignIds: string[];
}

/** "1st 16:05 — Ironwings: T. Kerr (L. Bastien) · PPG — 1–0" / "2nd 18:19 — Wolves — 4–3". */
export function parseScoring(text: string): ScoringEvent[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/\s+[—–-]\s+/);
    const [when = "", who = "", score = ""] = parts.length >= 3 ? [parts[0], parts.slice(1, -1).join(" — "), parts[parts.length - 1]] : [parts[0] ?? "", parts[1] ?? "", ""];
    const [period = "", time = ""] = when.split(/\s+/);
    const m = /^([^:]+):\s*(.+)$/.exec(who);
    if (!m) return { period, time, side: "them" as const, team: who.trim(), scorer: "", assists: "", note: "", score: score.trim() };
    const [scorerPart, ...notes] = m[2].split(/\s+·\s+/);
    const a = /^(.*?)\s*\((.*)\)\s*$/.exec(scorerPart);
    return { period, time, side: "us" as const, team: m[1].trim(), scorer: (a ? a[1] : scorerPart).trim(), assists: a ? a[2].trim() : "", note: notes.join(" · ").trim(), score: score.trim() };
  });
}

async function loadGamesUncached(): Promise<Game[]> {
  const def = modelFor("games");
  if (!def || !env.edgeToken) return [];
  const master = relationOf(def, /M\.Asset/i, true), gallery = relationOf(def, /M\.Asset/i, false), campaign = relationOf(def, /Campaign/i);
  const s = await selectionFor(def, [master, gallery, campaign]);
  if (!s) return [];
  const f = {
    date: fieldOf(def, /date|start|time/i, /date/i), opponent: fieldOf(def, /opponent|versus|vs/i), homeAway: fieldOf(def, /home|away|venue/i),
    type: fieldOf(def, /type|kind|competition/i), theme: fieldOf(def, /theme/i), result: fieldOf(def, /^result/i),
  };
  const rows = await edgeAll(`all${def.type}`, s.sel, { max: 2000 });
  return rows.map((x: any): Game => {
    const tmStatus = str(x.ticketmaster_Status);
    const finalScore = str(x.statsFeed_FinalScore);
    const status = /closed|final|complete/i.test(str(x.statsFeed_Status)) || (!!finalScore && !/scheduled/i.test(str(x.statsFeed_Status))) ? "closed" : "scheduled";
    const result = str(x.statsFeed_Result) || str(x[f.result]);
    const theme = str(x[f.theme]);
    return {
      id: String(x.id),
      title: nameOf(x),
      date: str(x[f.date]),
      opponent: str(x[f.opponent]),
      home: /home/i.test(str(x[f.homeAway])),
      gameType: str(x[f.type]),
      themeNight: none(theme) ? "" : theme,
      status,
      finalScore,
      result,
      win: result ? /^win/i.test(result) : null,
      goalsFor: num(x.statsFeed_GoalsFor), goalsAgainst: num(x.statsFeed_GoalsAgainst),
      shotsFor: num(x.statsFeed_ShotsFor), shotsAgainst: num(x.statsFeed_ShotsAgainst),
      powerPlay: str(x.statsFeed_PowerPlay),
      scoring: parseScoring(str(x.statsFeed_Scoring)),
      threeStars: str(x.statsFeed_ThreeStars).split(/\r?\n/).map((l) => l.replace(/^\s*\d+\.\s*/, "").trim()).filter(Boolean),
      goalie: str(x.statsFeed_Goalie),
      ticket: {
        status: tmStatus, url: /^https?:\/\//i.test(str(x.ticketmaster_EventUrl)) ? str(x.ticketmaster_EventUrl) : "", onSale: str(x.ticketmaster_OnSale),
        capacity: num(x.ticketmaster_Capacity), sold: num(x.ticketmaster_TicketsSold), sellThrough: num(x.ticketmaster_SellThrough), averagePrice: num(x.ticketmaster_AverageTicketPrice),
        soldOut: /sold out/i.test(tmStatus), completed: /completed/i.test(tmStatus),
      },
      image: assets(x[master])[0] ?? assets(x[gallery])[0] ?? null,
      photos: assets(x[gallery]),
      campaignIds: results(x[campaign]).map((c: any) => String(c.id)),
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}
export const loadGames = cachedByCulture("sports-games", loadGamesUncached, { tags: SCOPED.tags });

export async function loadGame(id: string): Promise<Game | null> {
  return (await loadGames()).find((g) => g.id === id) ?? null;
}

/** The next game not played yet, and the last one played (by date; `now` for tests). */
export function nextAndLast(games: Game[], now = Date.now()): { next: Game | null; last: Game | null } {
  const upcoming = games.filter((g) => g.status === "scheduled" && Date.parse(g.date) >= now - 3 * 60 * 60 * 1000);
  const played = games.filter((g) => g.status === "closed");
  return { next: upcoming[0] ?? null, last: played[played.length - 1] ?? null };
}

// ---- players -------------------------------------------------------------------------------

export interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string;
  /** G (goalie), D (defence) or F (forward) — the roster's groups. */
  group: "G" | "D" | "F";
  shoots: string;
  nationality: string;
  status: string;
  active: boolean;
  /** Assigned to the farm team. */
  farm: boolean;
  rightsExpiry: string;
  rightsValid: boolean;
  stats: { gamesPlayed: number | null; goals: number | null; assists: number | null; points: number | null; plusMinus: number | null; penaltyMinutes: number | null; shots: number | null; wins: number | null; losses: number | null; savePct: number | null; gaa: number | null };
  lastGame: string;
  headshot: PortalAsset | null;
  gallery: PortalAsset[];
  productIds: string[];
}

async function loadPlayersUncached(): Promise<Player[]> {
  const def = modelFor("players");
  if (!def || !env.edgeToken) return [];
  const master = relationOf(def, /M\.Asset/i, true), gallery = relationOf(def, /M\.Asset/i, false), product = relationOf(def, /Product/i);
  const s = await selectionFor(def, [master, gallery, product]);
  if (!s) return [];
  const f = {
    number: fieldOf(def, /number|jersey/i), position: fieldOf(def, /position/i), shoots: fieldOf(def, /shoot|hand|catch/i),
    nationality: fieldOf(def, /nationality|country/i), status: fieldOf(def, /status|roster/i), rights: fieldOf(def, /rights|expir/i, /date/i),
  };
  const rows = await edgeAll(`all${def.type}`, s.sel, { max: 2000 });
  return rows.map((x: any): Player => {
    const position = str(x[f.position]).toUpperCase();
    const status = str(x[f.status]);
    const rights = str(x[f.rights]);
    return {
      id: String(x.id),
      name: nameOf(x),
      number: num(x[f.number]),
      position,
      group: /^G/.test(position) ? "G" : /^D/.test(position) ? "D" : "F",
      shoots: str(x[f.shoots]),
      nationality: str(x[f.nationality]),
      status,
      active: !status || /active/i.test(status),
      farm: /assigned|farm|forge|loan/i.test(status),
      rightsExpiry: rights,
      rightsValid: !rights || Date.parse(rights) > Date.now(),
      stats: {
        gamesPlayed: num(x.statsFeed_GamesPlayed), goals: num(x.statsFeed_Goals), assists: num(x.statsFeed_Assists), points: num(x.statsFeed_Points),
        plusMinus: num(x.statsFeed_PlusMinus), penaltyMinutes: num(x.statsFeed_PenaltyMinutes), shots: num(x.statsFeed_Shots),
        wins: num(x.statsFeed_Wins), losses: num(x.statsFeed_Losses), savePct: num(x.statsFeed_SavePercentage), gaa: num(x.statsFeed_GoalsAgainstAverage),
      },
      lastGame: str(x.statsFeed_LastGame),
      headshot: assets(x[master])[0] ?? null,
      gallery: assets(x[gallery]),
      productIds: results(x[product]).map((p: any) => String(p.id)),
    };
  }).sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name));
}
export const loadPlayers = cachedByCulture("sports-players", loadPlayersUncached, { tags: SCOPED.tags });

export async function loadPlayer(id: string): Promise<Player | null> {
  return (await loadPlayers()).find((p) => p.id === id) ?? null;
}

// ---- sponsorships --------------------------------------------------------------------------

export interface Sponsorship {
  id: string;
  name: string;
  placement: string;
  exclusivity: string;
  start: string;
  end: string;
  activation: string;
  logo: PortalAsset | null;
  brands: string[];
}

async function loadSponsorshipsUncached(): Promise<Sponsorship[]> {
  const def = modelFor("sponsorships");
  if (!def || !env.edgeToken) return [];
  const master = relationOf(def, /M\.Asset/i, true), brand = relationOf(def, /Brand/i);
  const s = await selectionFor(def, [master, brand]);
  if (!s) return [];
  const f = {
    placement: fieldOf(def, /placement|asset|position/i), exclusivity: fieldOf(def, /exclusiv|category/i),
    start: fieldOf(def, /start|from/i, /date/i), end: fieldOf(def, /end|until|to\b/i, /date/i), activation: fieldOf(def, /activation|rights|benefit/i, /string|text/i),
  };
  const rows = await edgeAll(`all${def.type}`, s.sel, { max: 2000 });
  return rows.map((x: any): Sponsorship => ({
    id: String(x.id), name: nameOf(x), placement: str(x[f.placement]), exclusivity: str(x[f.exclusivity]),
    start: str(x[f.start]), end: str(x[f.end]), activation: str(x[f.activation]),
    logo: assets(x[master])[0] ?? null,
    brands: results(x[brand]).map((b: any) => str(b.brandName)).filter(Boolean),
  })).sort((a, b) => a.placement.localeCompare(b.placement) || a.name.localeCompare(b.name));
}
export const loadSponsorships = cachedByCulture("sports-sponsorships", loadSponsorshipsUncached, { tags: SCOPED.tags });

// ---- game recaps ---------------------------------------------------------------------------

export interface GameRecap { id: string; title: string; lead: string; bodyHtml: string; boxScoreHtml: string; date: string; image: PortalAsset | null }

const RECAP_TYPES = ["M_Content_GameRecap", "M_Content_MatchRecap", "M_Content_Recap"];

/**
 * Content items of a "game recap" type, newest first: the masters, each with the active
 * culture's localized variant on top (the fr-CA page shows the fr-CA recap under the master's
 * place — src/lib/ch/localized.ts, as for press releases). [] when the type isn't published.
 */
async function loadRecapsUncached(): Promise<GameRecap[]> {
  if (!env.edgeToken) return [];
  let type = "", fields: Awaited<ReturnType<typeof edgeTypeFields>> = null;
  for (const t of RECAP_TYPES) {
    fields = await edgeTypeFields(t);
    if (fields) { type = t; break; }
  }
  if (!fields) return [];
  const f = fields;
  const pre = f.map((x) => x.name).find((n) => /recap_Title$/i.test(n))?.replace(/_Title$/i, "") ?? "";
  if (!pre) return [];
  const pick = (suffix: string) => (hasField(f, `${pre}_${suffix}`) ? `${pre}_${suffix}` : "");
  const [t, l, b, box] = [pick("Title"), pick("Lead"), pick("Body"), pick("BoxScore")];
  const opt = (n: string, sub = "") => (hasField(f, n) ? `${n}${sub}` : "");
  const sel = ["id", "content_Name", opt("content_PublicationDate"), t, l, b, box, opt("cmpContentToMasterLinkedAsset", ` { results { ${ASSET_SELECTION} } }`),
    opt("m_Content_IsVariant"), opt("contentToContentVariant_Parent", " { id }"), opt("contentToContentLocalization_Parent", " { id }"), opt("localizationToContent", " { id }")].filter(Boolean).join(" ");
  // subtypes come back through allM_Content (the subtype's own list is empty on this Edge)
  const rows = (await edgeAll("allM_Content", `__typename ... on ${type} { ${sel} }`, { max: 2000 })).filter((x: any) => x.__typename === type);
  const isCopy = (c: any) => c.m_Content_IsVariant === true || !!c.contentToContentVariant_Parent?.id || !!c.contentToContentLocalization_Parent?.id;
  const { masters, byMaster } = await pairLocalizedVariants(rows, {
    definition: "M.Content", relation: "LocalizationToContent", localizationField: hasField(f, "localizationToContent") ? "localizationToContent" : "", isCopy,
    parentId: (c: any) => String(c.contentToContentLocalization_Parent?.id ?? c.contentToContentVariant_Parent?.id ?? ""),
    titleOf: (c: any) => str(c[t]) || str(c.content_Name),
  });
  return masters.map((m: any): GameRecap => {
    const x = overlay(m, byMaster.get(String(m.id)), [t, l, b, box, "content_Name"].filter(Boolean));
    return {
      id: String(m.id), title: stripVariantSuffix(str(x[t]) || str(x.content_Name)), lead: str(x[l]), bodyHtml: str(x[b]), boxScoreHtml: str(x[box]),
      date: str(m.content_PublicationDate), image: assets(m.cmpContentToMasterLinkedAsset)[0] ?? null,
    };
  }).sort((a, b2) => b2.date.localeCompare(a.date));
}
export const loadRecaps = cachedByCulture("sports-recaps", loadRecapsUncached, { tags: SCOPED.tags });

/**
 * The recap of a played game: it names the opponent (full name or its last word, "Wolves")
 * and either the game's date ("Oct 17", ISO) or was published within four days after it.
 */
export function recapFor(game: Game, recaps: GameRecap[]): GameRecap | null {
  const opp = game.opponent.toLowerCase();
  if (!opp || game.status !== "closed") return null;
  const d = new Date(game.date);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const dayTokens = Number.isNaN(d.getTime()) ? [] : [`${months[d.getUTCMonth()]} ${d.getUTCDate()}`, d.toISOString().slice(0, 10)];
  const text = (r: GameRecap) => `${r.title} ${r.lead}`.toLowerCase();
  const short = opp.split(/\s+/).pop() ?? opp;
  const named = recaps.filter((r) => text(r).includes(opp) || new RegExp(`\\b${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text(r)));
  const soon = (r: GameRecap) => { const p = Date.parse(r.date); return !Number.isNaN(p) && !Number.isNaN(d.getTime()) && p >= d.getTime() - 6 * 3600_000 && p <= d.getTime() + 4 * 86_400_000; };
  return named.find((r) => dayTokens.some((tok) => text(r).includes(tok))) ?? named.find(soon) ?? null;
}
