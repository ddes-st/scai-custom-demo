/**
 * Client-safe formatting for the sports components: dates in the page language, positions and
 * stat lines. The data types come from src/lib/ch/sports.ts (server); the client islands get
 * plain objects of these shapes.
 */
import type { UiKey } from "./ui-keys";

type Ui = (key: UiKey, vars?: Record<string, string | number>) => string;

const tag = (locale: string) => (!locale || locale === "en" ? "en-GB" : locale);

/** "Sat 25 Oct, 19:00" in the page language; the club's local time is the feed's (UTC on Edge). */
export function gameDate(iso: string, locale: string, withTime = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "UTC" };
  try { return d.toLocaleString(tag(locale), opts); } catch { return d.toLocaleString("en-GB", opts); }
}

/** "October 2026" — the schedule's month heading. */
export function monthLabel(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try { return d.toLocaleDateString(tag(locale), { month: "long", year: "numeric", timeZone: "UTC" }); } catch { return d.toISOString().slice(0, 7); }
}

/** A plain date ("30 Jun 2027") for rights periods and expiries. */
export function plainDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try { return d.toLocaleDateString(tag(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); } catch { return iso.slice(0, 10); }
}

const POSITIONS: Record<string, UiKey> = { C: "spPosC", LW: "spPosLW", RW: "spPosRW", D: "spPosD", G: "spPosG" };
/** "C" → "Centre"; unknown codes as they are. */
export const positionLabel = (code: string, t: Ui) => (POSITIONS[code.toUpperCase()] ? t(POSITIONS[code.toUpperCase()]) : code);

/** ".917" for a save percentage (the hockey way), "2.41" for a goals-against average. */
export function savePct(v: number | null): string {
  if (v == null) return "–";
  const x = v > 1 ? v / 100 : v;
  return x.toFixed(3).replace(/^0/, "");
}
export const twoDecimals = (v: number | null) => (v == null ? "–" : v.toFixed(2));
export const n = (v: number | null) => (v == null ? "–" : String(v));
export const signed = (v: number | null) => (v == null ? "–" : v > 0 ? `+${v}` : String(v));

/** The key stat pairs of a player card: goalies W / SV% / GAA, skaters G / A / P. */
export function keyStats(p: { group: string; stats: Record<string, number | null> }, t: Ui): Array<[string, string]> {
  const s = p.stats;
  return p.group === "G"
    ? [[t("spW"), n(s.wins)], [t("spSvPct"), savePct(s.savePct)], [t("spGAA"), twoDecimals(s.gaa)]]
    : [[t("spG"), n(s.goals)], [t("spA"), n(s.assists)], [t("spP"), n(s.points)]];
}

/** The ticket badge of an upcoming game: "Sold out", "84% sold" or "". */
export function ticketBadge(ticket: { soldOut: boolean; sellThrough: number | null; sold: number | null; capacity: number | null }, t: Ui): string {
  if (ticket.soldOut) return t("spSoldOut");
  const pct = ticket.sellThrough ?? (ticket.sold != null && ticket.capacity ? (ticket.sold / ticket.capacity) * 100 : null);
  return pct != null && pct > 0 ? t("spSoldPct", { pct: Math.round(pct > 1 ? pct : pct * 100) }) : "";
}

/** The Buy tickets link: home games with an event URL that isn't sold out or over. */
export const canBuy = (g: { home: boolean; status: string; ticket: { url: string; soldOut: boolean; completed: boolean } }) =>
  g.home && g.status !== "closed" && !!g.ticket.url && !g.ticket.soldOut && !g.ticket.completed;

const RESULTS: Array<[RegExp, UiKey]> = [
  [/^win\s*\(\s*ot\s*\)$/i, "spResWinOT"], [/^ot\s*loss$/i, "spResOTL"], [/^win\s*\(\s*so\s*\)$/i, "spResWinSO"], [/^so\s*loss$/i, "spResSOL"],
  [/^win$/i, "spResWin"], [/^loss$/i, "spResLoss"],
];
/** The stats feed's result ("Win (OT)", "SO loss" …) in the page language; anything else as it is. */
export const resultLabel = (result: string, t: Ui) => {
  const hit = RESULTS.find(([re]) => re.test(result.trim()));
  return hit ? t(hit[1]) : result;
};
