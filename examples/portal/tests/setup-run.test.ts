import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fakeXmc } from "./helpers/fake-xmc";
import { checkSite, fixSite, runPortalSetup } from "../src/lib/portal/setup/core.mjs";

// the setup core end to end against an in-memory Authoring API: a portal, then its microsites
const LANGS = ["fr-FR", "it-IT", "de-DE", "es-ES"];
const base = { cropNames: [], partnerKits: [], vertical: null, branding: {}, theme: null, dealers: 6 };
const COL = "collection-veltrane";
const opts = (site: string, appId = "app-1") => ({ collection: COL, site, languages: LANGS, publish: true, marketplaceAppId: appId, headUrl: "https://veltrane.example", publicHost: `${site}.example` });

const MARQUE = { brand: { id: "VELT.Brand.Arvenne", name: "Arvenne" }, logo: "arvenne-logo-asset", models: [{ id: "cadence-e-style", name: "Arvenne Cadence-e Style" }, { id: "cadence-e-gt", name: "Arvenne Cadence-e GT Long Range" }] };
const fieldOf = (it: { langs: Map<string, Map<string, string>> } | null, name: string) => it?.langs.get("en")?.get(name) ?? "";

async function portalThen(micro: { joint: boolean; appId?: string; microsite?: unknown }) {
  const x = fakeXmc(COL, "portal-veltrane");
  await runPortalSetup({ gql: x.gql, log: () => {}, discovery: { ...base, siteKind: "portal" }, options: opts("portal-veltrane") });
  x.reset(); x.addSite("cadence-e-reveal");
  const lines: string[] = [];
  const discovery = { ...base, branding: { wordmark: "Veltrane" }, siteKind: "microsite", joint: micro.joint, microsite: micro.microsite ?? null };
  await runPortalSetup({ gql: x.gql, log: (l: string) => lines.push(l), discovery, options: opts("cadence-e-reveal", micro.appId) });
  const at = (p: string) => x.byPath(`sitecore/content/${COL}/cadence-e-reveal/${p}`);
  return { x, lines, at, quick: lines.some((l) => /quick microsite run/.test(l)) };
}

describe("setup runs (in-memory Authoring API)", () => {
  test("a joint microsite after its portal: quick, lean, no dictionary of its own", async () => {
    const { x, at, quick } = await portalThen({ joint: true });
    assert.equal(quick, true);
    assert.ok(x.total() < 400, `a quick microsite run made ${x.total()} calls`);
    assert.equal(x.calls.publishItem, 1); // only the site, not the collection's templates and renderings
    assert.ok(at("Home/dealers"));
    assert.ok(at("Data/Portal Picks/Featured models"));
    for (const portalOnly of ["Dictionary/Portal", "Data/Portal Banners", "Data/Content Hub Profiles", "Data/Partners", "Data/Lookups", "Data/Portal Picks/Featured products", "Home/brands"]) assert.equal(at(portalOnly), null, `${portalOnly} on the microsite`);
  });
  test("a microsite on its own deployment keeps its dictionary", async () => {
    const { at, quick } = await portalThen({ joint: false });
    assert.equal(quick, true);
    assert.ok(at("Dictionary/Portal/portal-download"));
  });
  test("a microsite's header shows its marque; its model highlights start with the marque's cars", async () => {
    const { at } = await portalThen({ joint: true, microsite: MARQUE });
    const header = at("Data/Portal Header/Header");
    assert.equal(fieldOf(header, "Wordmark"), "Arvenne");
    assert.deepEqual(JSON.parse(fieldOf(header, "LogoPick")).items.map((i: { id: string }) => i.id), ["arvenne-logo-asset"]);
    assert.deepEqual(JSON.parse(fieldOf(at("Data/Portal Picks/Featured models"), "Picks")), { definition: "M_PCM_Product", items: MARQUE.models });
  });
  test("a microsite's pages show its own header, not the portal's (the default layout is the portal's)", async () => {
    const { x, at } = await portalThen({ joint: true, microsite: MARQUE });
    const sv = x.byPath(`sitecore/templates/Project/${COL}/Portal/Portal Home Page/__Standard Values`)!.shared.get("__Renderings")!;
    const svHeader = /<r uid="(\{[^"]+\})"[^>]*ph="headless-header"[^>]*ds="(\{[^"]+\})"/.exec(sv)!;
    const portalHeader = x.byPath(`sitecore/content/${COL}/portal-veltrane/Data/Portal Header/Header`)!;
    assert.equal(svHeader[2], `{${portalHeader.id}}`); // the default stays the portal's
    const own = `{${at("Data/Portal Header/Header")!.id}}`;
    for (const page of ["Home", "Home/dealers"]) {
      const layout = at(page)!.shared.get("__Renderings") ?? "";
      assert.ok(layout.includes(`<r uid="${svHeader[1]}" s:ds="${own}" />`), `${page} points the header at the microsite's own`);
    }
    const portalHome = x.byPath(`sitecore/content/${COL}/portal-veltrane/Home`)!.shared.get("__Renderings") ?? "";
    assert.ok(!portalHome.includes(svHeader[1]), "the portal's own pages keep the default header");
  });
  test("a second microsite run keeps its pages as the setup's (no 'changed in SitecoreAI')", async () => {
    const { x } = await portalThen({ joint: true, microsite: MARQUE });
    const lines: string[] = [];
    await runPortalSetup({ gql: x.gql, log: (l: string) => lines.push(l), discovery: { ...base, branding: { wordmark: "Veltrane" }, siteKind: "microsite", joint: true, microsite: MARQUE }, options: opts("cadence-e-reveal") });
    assert.deepEqual(lines.filter((l) => /changed in SitecoreAI/.test(l)), []);
  });
  test("what the author changed stays on a second run", async () => {
    const x = await portalThen({ joint: true, microsite: MARQUE });
    const header = x.at("Data/Portal Header/Header")!, picks = x.at("Data/Portal Picks/Featured models")!;
    header.langs.get("en")!.set("Wordmark", "Cadence-e");
    picks.langs.get("en")!.set("Picks", JSON.stringify({ definition: "M_PCM_Product", items: [{ id: "volna-e", name: "Arvenne Volna-e" }] }));
    await runPortalSetup({ gql: x.x.gql, log: () => {}, discovery: { ...base, branding: { wordmark: "Veltrane" }, siteKind: "microsite", joint: true, microsite: MARQUE }, options: opts("cadence-e-reveal") });
    assert.equal(fieldOf(header, "Wordmark"), "Cadence-e");
    assert.equal(JSON.parse(fieldOf(picks, "Picks")).items[0].id, "volna-e");
  });
  test("the header logo follows the brand's master asset; a logo the author picked stays", async () => {
    const x = await portalThen({ joint: true, microsite: MARQUE });
    const header = x.at("Data/Portal Header/Header")!;
    const rerun = (logo: string) => runPortalSetup({ gql: x.x.gql, log: () => {}, discovery: { ...base, branding: { wordmark: "Veltrane" }, siteKind: "microsite", joint: true, microsite: { ...MARQUE, logo } }, options: opts("cadence-e-reveal") });
    await rerun("arvenne-new-master");
    assert.equal(JSON.parse(fieldOf(header, "LogoPick")).items[0].id, "arvenne-new-master");
    const picked = JSON.stringify({ definition: "M_Asset", max: 1, items: [{ id: "group-logo", name: "Veltrane Logo" }], src: "https://hub.example" });
    header.langs.get("en")!.set("LogoPick", picked);
    await rerun("arvenne-third");
    assert.equal(fieldOf(header, "LogoPick"), picked);
  });
  test("without a marque: the deployment's wordmark, nothing picked", async () => {
    const { at } = await portalThen({ joint: true });
    assert.equal(fieldOf(at("Data/Portal Header/Header"), "Wordmark"), "Veltrane");
    assert.equal(fieldOf(at("Data/Portal Header/Header"), "LogoPick"), "");
  });
  test("another app than the one that set up the collection: the full run", async () => {
    const { quick, x } = await portalThen({ joint: true, appId: "app-2" });
    assert.equal(quick, false);
    assert.ok(x.calls.publishItem >= 3);
  });
  test("the portal's default page layout stays the portal's after a full microsite run", async () => {
    const { x } = await portalThen({ joint: true, appId: "app-2" });
    const sv = x.byPath(`sitecore/templates/Project/${COL}/Portal/Portal Section Page/__Standard Values`);
    const header = x.byPath(`sitecore/content/${COL}/portal-veltrane/Data/Portal Header/Header`);
    assert.ok(sv?.shared.get("__Renderings")?.includes(`{${header!.id}}`), "standard values point at the portal's header");
  });
  test("a page whose own layout blanks the header and footer: the check spots it, the fix brings them back", async () => {
    const x = fakeXmc(COL, "portal-veltrane");
    await runPortalSetup({ gql: x.gql, log: () => {}, discovery: { ...base, siteKind: "portal" }, options: opts("portal-veltrane") });
    const sv = x.byPath(`sitecore/templates/Project/${COL}/Portal/Portal Home Page/__Standard Values`)!.shared.get("__Renderings")!;
    const uid = (ph: string) => new RegExp(`uid="(\\{[^"]+\\})"[^>]*ph="${ph}"`).exec(sv)![1];
    const carousel = '<r uid="{CF74BCB0-78F1-8F3E-FD68-32B2861D56E6}" s:par="Variant=carousel&amp;Columns=1" />';
    const blank = (u: string) => `<r uid="${u}" s:id="{00000000-0000-0000-0000-000000000000}" />`;
    const home = x.byPath(`sitecore/content/${COL}/portal-veltrane/Home`)!;
    home.langs.get("en")!.set("__Final Renderings", `<r xmlns:p="p" xmlns:s="s" p:p="1"><d id="{FE5D7FDF-89C0-4D99-9AA3-B5FBD009C9F3}">${carousel}${blank(uid("headless-header"))}${blank(uid("headless-footer"))}</d></r>`);
    const site = { collection: COL, site: "portal-veltrane", languages: ["en"] };
    const before = (await checkSite({ gql: x.gql }, site)).find((c: { id: string }) => c.id === "chrome")!;
    assert.equal(before.status, "warn");
    assert.match(before.detail, /Home/);
    x.reset();
    await fixSite({ gql: x.gql }, "chrome", site);
    assert.equal(home.langs.get("en")!.get("__Final Renderings"), `<r xmlns:p="p" xmlns:s="s" p:p="1"><d id="{FE5D7FDF-89C0-4D99-9AA3-B5FBD009C9F3}">${carousel}</d></r>`);
    assert.equal(x.calls.publishItem, 1); // that page only
    assert.equal((await checkSite({ gql: x.gql }, site)).find((c: { id: string }) => c.id === "chrome")!.status, "ok");
  });
});
