import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { highlightFigures, marketFor, marketLanguage, micrositeModels, micrositePhase, numberOf, type Market } from "../src/lib/ch/automotive-match";
import { parseDealers } from "../src/lib/portal/dealers";

const at = (iso: string) => Date.parse(iso);
// the Veltrane plan's Cadence-e reveal: live Oct 15, 2026, reveal Nov 18, 2026, takedown Mar 31, 2027
const cadence = { status: "Live", goLive: "2026-10-15T00:00:00Z", revealDate: "2026-11-18T00:00:00Z", takedown: "2027-03-31T00:00:00Z" };

describe("micrositePhase", () => {
  test("teaser, revealed, down along the Cadence-e dates", () => {
    assert.equal(micrositePhase(cadence, at("2026-10-23T12:00:00Z")), "teaser");
    assert.equal(micrositePhase(cadence, at("2026-11-18T00:00:01Z")), "revealed");
    assert.equal(micrositePhase(cadence, at("2027-03-31T18:00:00Z")), "revealed"); // the takedown day still counts
    assert.equal(micrositePhase(cadence, at("2027-04-01T00:00:01Z")), "down");
  });
  test("status Taken down wins; before the go-live it is planned", () => {
    assert.equal(micrositePhase({ ...cadence, status: "Taken down" }, at("2026-10-23T12:00:00Z")), "down");
    assert.equal(micrositePhase({ status: "Planned", goLive: "2027-01-05", revealDate: "2027-01-12", takedown: "2027-04-30" }, at("2026-10-23T12:00:00Z")), "planned");
  });
  test("no reveal date: a teaser until the takedown", () => {
    assert.equal(micrositePhase({ ...cadence, revealDate: "" }, at("2026-12-01T00:00:00Z")), "teaser");
  });
});

const market = (name: string, country: string, language: string, disclaimer = `${name} disclaimer`): Market => ({ id: name, name, country, language, testCycle: "WLTP", disclaimer, launchDate: "", manager: "" });
const markets = [market("France", "France", "fr-FR"), market("United Kingdom", "United Kingdom", "English"), market("Italy", "Italy", ""), market("Germany", "Germany", "de-DE")];

describe("marketFor (the disclaimer's market)", () => {
  test("the page language's market; English takes the first English-speaking one", () => {
    assert.equal(marketFor(markets, "fr-FR")?.name, "France");
    assert.equal(marketFor(markets, "en")?.name, "United Kingdom");
    assert.equal(marketFor(markets, "it-IT")?.name, "Italy"); // by country
    assert.equal(marketFor(markets, "de-DE")?.name, "Germany");
  });
  test("no match: the first market; none: null", () => {
    assert.equal(marketFor(markets, "ja-JP")?.name, "France");
    assert.equal(marketFor([], "en"), null);
  });
  test("a market's language from a code, a name or its country", () => {
    assert.equal(marketLanguage({ language: "es-ES", country: "" }), "es");
    assert.equal(marketLanguage({ language: "Spanish", country: "" }), "es");
    assert.equal(marketLanguage({ language: "", country: "Netherlands" }), "nl");
  });
});

describe("highlightFigures", () => {
  const fields = [
    { label: "Powertrain", value: "Battery electric" }, { label: "Power (hp)", value: "218" }, { label: "WLTP Range (km)", value: "540" },
    { label: "CO2 Emissions (g/km)", value: "0" }, { label: "Starting Price (EUR)", value: "38990" }, { label: "Model Year", value: "2027" },
  ];
  test("each figure by its field's name; price is not range, powertrain is not power", () => {
    assert.deepEqual(highlightFigures(fields), { price: "38990", range: "540", power: "218", co2: "0", powertrain: "Battery electric", modelYear: "2027" });
  });
  test("missing figures are left out", () => {
    assert.deepEqual(highlightFigures([{ label: "Product name", value: "Cadence-e" }]), {});
  });
  test("numberOf reads plain numbers only", () => {
    assert.equal(numberOf("38 990"), 38990);
    assert.equal(numberOf("441,5"), 441.5);
    assert.equal(numberOf("from 38990"), null);
  });
});

describe("parseDealers", () => {
  const showroom = { name: "Delacroix Lyon Gerland", city: "Lyon", address: "12 avenue Tony Garnier", country: "fr", lat: 45.73, lng: 4.83, phone: "04 65 71 00 01" };
  test("PORTAL_DEALERS wins, with its showrooms", () => {
    const d = parseDealers(JSON.stringify([{ n: "Garage Delacroix Automobiles", b: "db.auto.brand.arvenne", r: "Lyon & Grenoble", t: "Platinum", e: "db.auto.partner.1", s: [showroom] }]), JSON.stringify([{ u: "other", n: "Other" }]));
    assert.equal(d.length, 1);
    assert.equal(d[0].id, "db.auto.partner.1");
    assert.equal(d[0].showrooms[0].name, "Delacroix Lyon Gerland");
    assert.equal(d[0].showrooms[0].country, "FR");
  });
  test("from PORTAL_PARTNERS only the public facts — never a login or password", () => {
    const d = parseDealers("", JSON.stringify([{ u: "delacroix", p: "secret", h: "$2b$hash", n: "Garage Delacroix", b: "x", s: [showroom] }]));
    assert.equal(d.length, 1);
    assert.equal(JSON.stringify(d).includes("secret"), false);
    assert.equal(JSON.stringify(d).includes("$2b$"), false);
    assert.equal(d[0].id, "delacroix");
  });
  test("bad coordinates are dropped from the map, junk entries skipped", () => {
    const d = parseDealers(JSON.stringify([{ n: "A", s: [{ city: "Milan", lat: 200, lng: 9.19 }, { city: "", lat: null }] }, { x: 1 }, "nope"]));
    assert.equal(d.length, 1);
    assert.equal(d[0].showrooms.length, 1);
    assert.ok(Number.isNaN(d[0].showrooms[0].lat));
  });
});

describe("micrositeModels (the model highlights a microsite starts with)", () => {
  const p = (name: string) => ({ id: name, name });
  const arvenne = ["Arvenne Cadence-e Style", "Arvenne Cadence-e GT Long Range", "Arvenne Volna-e", "Arvenne Lisère Hybrid", "Arvenne Lisère-e"].map(p);
  const vellara = ["Vellara Ardenza Q4", "Vellara Ardenza 70 Anniversario", "Vellara Corvino Plug-in Hybrid"].map(p);
  const ironpeak = ["Ironpeak Ridgeback First Edition", "Ironpeak Ridgeback Work", "Ironpeak Cascade Plug-in Hybrid"].map(p);
  const names = (l: Array<{ name: string }>) => l.map((x) => x.name);
  test("the plan's four microsites", () => {
    assert.deepEqual(names(micrositeModels("Cadence-e Reveal", "Arvenne", arvenne)), ["Arvenne Cadence-e Style", "Arvenne Cadence-e GT Long Range"]);
    assert.deepEqual(names(micrositeModels("Ridgeback Reservations", "Ironpeak", ironpeak)), ["Ironpeak Ridgeback First Edition", "Ironpeak Ridgeback Work"]);
    assert.deepEqual(names(micrositeModels("Vellara 70 Years", "Vellara", vellara)), ["Vellara Ardenza 70 Anniversario", "Vellara Ardenza Q4"]);
    assert.deepEqual(names(micrositeModels("Lisère Summer Drive", "Arvenne", arvenne)), ["Arvenne Lisère Hybrid", "Arvenne Lisère-e"]);
  });
  test("a name that points to no model: none (the setup falls back to the marque's newest)", () => {
    assert.deepEqual(micrositeModels("Arvenne Spring Offers", "Arvenne", arvenne), []);
  });
});
