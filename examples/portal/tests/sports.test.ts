import { test } from "node:test";
import assert from "node:assert/strict";
import { nextAndLast, parseScoring, recapFor, type Game } from "../src/lib/ch/sports";
import { canBuy, keyStats, savePct, ticketBadge } from "../src/lib/portal/sports-format";
import { verticalOf } from "../src/lib/portal/setup/core.mjs";

const t = (k: string, v?: Record<string, string | number>) => (v ? `${k}:${JSON.stringify(v)}` : k);

test("parseScoring reads club goals with assists and notes, and opponent goals", () => {
  const ev = parseScoring("1st 05:29 — Ironwings: L. Moreau (K. Dubois, S. Okonkwo) — 1–0\n3rd 03:36 — Mariners — 4–1\n3rd 11:46 — Ironwings: Jaxon Reid (Mathis Gagnon, T. Kerr) · PPG — 5–1");
  assert.equal(ev.length, 3);
  assert.deepEqual(ev[0], { period: "1st", time: "05:29", side: "us", team: "Ironwings", scorer: "L. Moreau", assists: "K. Dubois, S. Okonkwo", note: "", score: "1–0" });
  assert.equal(ev[1].side, "them");
  assert.equal(ev[1].team, "Mariners");
  assert.equal(ev[1].score, "4–1");
  assert.equal(ev[2].note, "PPG");
  assert.equal(ev[2].scorer, "Jaxon Reid");
});

test("parseScoring keeps an unassisted goal", () => {
  const [e] = parseScoring("2nd 10:00 — Ironwings: T. Kerr — 2–1");
  assert.equal(e.scorer, "T. Kerr");
  assert.equal(e.assists, "");
});

const game = (o: Partial<Game>): Game => ({
  id: "g", title: "", date: "2026-10-17T19:00:00.000Z", opponent: "Westmoor Wolves", home: true, gameType: "", themeNight: "", status: "closed", finalScore: "6–3", result: "Win", win: true,
  goalsFor: 6, goalsAgainst: 3, shotsFor: 0, shotsAgainst: 0, powerPlay: "", scoring: [], threeStars: [], goalie: "",
  ticket: { status: "", url: "", onSale: "", capacity: null, sold: null, sellThrough: null, averagePrice: null, soldOut: false, completed: false }, image: null, photos: [], campaignIds: [], ...o,
});

test("nextAndLast picks the next scheduled game and the last played one", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  const games = [game({ id: "a", date: "2026-10-10T19:00:00Z" }), game({ id: "b", date: "2026-10-17T19:00:00Z" }), game({ id: "c", date: "2026-12-12T19:00:00Z", status: "scheduled" }), game({ id: "d", date: "2027-01-23T19:00:00Z", status: "scheduled" })];
  const { next, last } = nextAndLast(games, now);
  assert.equal(next?.id, "c");
  assert.equal(last?.id, "b");
});

const recap = (id: string, title: string, date = "") => ({ id, title, lead: "", bodyHtml: "", boxScoreHtml: "", date, image: null });

test("recapFor matches by opponent and the date in the text", () => {
  const recaps = [recap("r1", "Ironwings top Wolves 6–3 (Oct 17)"), recap("r2", "Stags edge Ironwings")];
  assert.equal(recapFor(game({}), recaps)?.id, "r1");
  assert.equal(recapFor(game({ opponent: "Granite Bay Glaciers" }), recaps), null);
});

test("recapFor matches by publication date and not another game against the same opponent", () => {
  const recaps = [recap("r1", "Ironwings Erase Early Deficit, Beat Wolves 6-3 Behind Lapointe's 33 Saves", "2026-10-18T09:00:00Z")];
  assert.equal(recapFor(game({ date: "2026-10-17T19:00:00Z" }), recaps)?.id, "r1");
  assert.equal(recapFor(game({ date: "2027-02-13T19:00:00Z" }), recaps), null);
  assert.equal(recapFor(game({ status: "scheduled" }), recaps), null);
});

test("ticket helpers: buy only for home games on sale; badges", () => {
  assert.equal(canBuy({ home: true, status: "scheduled", ticket: { url: "https://x", soldOut: false, completed: false } }), true);
  assert.equal(canBuy({ home: false, status: "scheduled", ticket: { url: "https://x", soldOut: false, completed: false } }), false);
  assert.equal(canBuy({ home: true, status: "scheduled", ticket: { url: "https://x", soldOut: true, completed: false } }), false);
  assert.equal(ticketBadge({ soldOut: true, sellThrough: null, sold: null, capacity: null }, t as any), "spSoldOut");
  assert.equal(ticketBadge({ soldOut: false, sellThrough: 74.6, sold: null, capacity: null }, t as any), 'spSoldPct:{"pct":75}');
});

test("stats: save percentage the hockey way, goalie vs skater key stats", () => {
  assert.equal(savePct(0.917), ".917");
  assert.equal(savePct(91.7), ".917");
  assert.deepEqual(keyStats({ group: "G", stats: { wins: 3, savePct: 0.9, gaa: 2.5 } }, t as any).map(([k]) => k), ["spW", "spSvPct", "spGAA"]);
  assert.deepEqual(keyStats({ group: "F", stats: { goals: 1, assists: 2, points: 3 } }, t as any).map(([, v]) => v), ["1", "2", "3"]);
});

test("verticalOf: sports when the model has games and players", () => {
  assert.equal(verticalOf(JSON.stringify([{ definition: "LIW.Game" }, { definition: "LIW.Player" }])), "sports");
  assert.equal(verticalOf(JSON.stringify([{ definition: "LIW.Game" }])), "");
  assert.equal(verticalOf(""), "");
  assert.equal(verticalOf("not json"), "");
});
