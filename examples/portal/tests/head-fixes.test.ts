import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// the modules reach sitecore.config and the Content Hub env: set before they load
process.env.SITECORE_EDGE_CONTEXT_ID ||= "test-context";
process.env.CH_HOST = "https://ch.example";
process.env.CH_USER = "portal-reader";
process.env.CH_PASS = "test-only";

import { errorText, platformErrorText } from "../src/lib/portal/error-text";
import { MARKETPLACE_REQUEST_TIMEOUT } from "../src/lib/portal/marketplace-timeout";
import { discoverFromEdge } from "../src/lib/portal/setup/core.mjs";

let partnerFileSelection: typeof import("../src/lib/portal/partner-area").partnerFileSelection;
let productSelection: typeof import("../src/lib/ch/products").productSelection;
let kit: typeof import("../src/lib/ch/kit-members");
let isPublicMaterial: typeof import("../src/lib/ch/assetAccess").isPublicMaterial;
before(async () => {
  ({ partnerFileSelection } = await import("../src/lib/portal/partner-area"));
  ({ productSelection } = await import("../src/lib/ch/products"));
  kit = await import("../src/lib/ch/kit-members");
  ({ isPublicMaterial } = await import("../src/lib/ch/assetAccess"));
});

const fields = (...names: string[]) => names.map((name) => ({ name, kind: "OBJECT", typeName: "" }));
/** The top-level and nested field names a selection asks for (what Edge checks against its schema). */
const names = (sel: string) => [...sel.matchAll(/\b([a-zA-Z_]\w*)\b/g)].map((m) => m[1]).filter((n) => n !== "results");

describe("F1: the setup app's request timeout", () => {
  test("60 s, and both Marketplace clients that write to SitecoreAI use it", () => {
    assert.ok(MARKETPLACE_REQUEST_TIMEOUT >= 60_000);
    for (const file of ["src/components/ui/portal/setup/PortalSetupApp.tsx", "src/lib/portal/marketplace-client.ts"]) {
      const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      const inits = [...src.matchAll(/ClientSDK\.init\(\{([^}]*)\}/g)].map((m) => m[1]);
      assert.ok(inits.length > 0, file);
      for (const i of inits) assert.match(i, /timeout: MARKETPLACE_REQUEST_TIMEOUT/, file);
    }
  });
});

describe("F2: error texts", () => {
  test("Vercel's own error object is read, never [object Object]", () => {
    const t = errorText({ error: { code: "404", message: "The deployment could not be found on Vercel." } }, "HTTP 404");
    assert.equal(t, "The deployment could not be found on Vercel.");
    assert.equal(errorText({ error: { code: "FUNCTION_INVOCATION_TIMEOUT", message: "Timed out" } }), "Timed out (FUNCTION_INVOCATION_TIMEOUT)");
    assert.equal(errorText({ error: { code: "DEPLOYMENT_PAUSED" } }), "DEPLOYMENT_PAUSED");
    assert.ok(!errorText({ error: { nested: { deep: 1 } } }).includes("[object Object]"));
  });

  test("the head's own text, GraphQL errors, and the fallback", () => {
    assert.equal(errorText({ error: "Sign in with Sitecore to use this app." }), "Sign in with Sitecore to use this app.");
    assert.equal(errorText({ errors: [{ message: "a" }, { message: "b" }] }), "a; b");
    assert.equal(errorText(null, "HTTP 502"), "HTTP 502");
    assert.equal(errorText({}, "Search failed (500)"), "Search failed (500)");
  });

  test("the hub names the portal and the cause of Vercel's error; the portal's own answers pass", () => {
    assert.equal(platformErrorText("acme-portal.vercel.app", 504, "FUNCTION_INVOCATION_TIMEOUT"), "The site's portal (acme-portal.vercel.app) took too long to answer: HTTP 504 FUNCTION_INVOCATION_TIMEOUT.");
    assert.match(platformErrorText("x.vercel.app", 404, "DEPLOYMENT_NOT_FOUND")!, /isn't deployed at this address/);
    assert.match(platformErrorText("x.vercel.app", 503, "SOMETHING_NEW")!, /answered with a Vercel error: HTTP 503 SOMETHING_NEW/);
    assert.equal(platformErrorText("x.vercel.app", 401, null), null);
  });
});

describe("F3: Edge queries name only published fields", () => {
  test("a partner's files without collectionToAsset or the brand link on Edge", () => {
    const sel = partnerFileSelection(fields("id", "title", "urls"));
    assert.ok(!sel.includes("collectionToAsset") && !sel.includes("pCMBrandToAsset"));
    const full = partnerFileSelection(fields("pCMBrandToAsset", "collectionToAsset"));
    assert.match(full, /pCMBrandToAsset \{ results \{ id brandName \} \}/);
    assert.match(full, /collectionToAsset \{ results \{ id \} \}/);
  });

  test("the product page: the family's and the variants' fields only when published", () => {
    const product = fields("productName", "pCMProductFamilyToProduct", "productToProductVariant_Children");
    const sel = productSelection(product, fields("productFamilyName"));
    assert.match(sel, /pCMProductFamilyToProduct \{ results \{ id productFamilyName \} \}/);
    assert.ok(!names(sel).includes("productFamilyLabel"));
    // variants: productNumber isn't on this tenant's product
    assert.match(sel, /productToProductVariant_Children \{ results \{ id productName \} \}/);
    // no family type on Edge: the family link isn't asked for at all
    assert.ok(!productSelection(product, null).includes("pCMProductFamilyToProduct"));
  });

  test("the setup's partner kits on a tenant whose collections have no description on Edge", async () => {
    const schema = new Set(["id", "collectionName"]);
    const asked: string[] = [];
    const edge = async (query: string) => {
      asked.push(query);
      if (query.includes("__type")) return { __type: { fields: [...schema].map((name) => ({ name })) } };
      if (query.includes("allM_Collection")) {
        // like Edge: an unknown field fails the whole query
        const sel = /results \{ ([^}]*) \}/.exec(query)![1].split(" ");
        if (sel.some((f) => !schema.has(f))) throw new Error(`Edge GraphQL: unknown field in ${sel.join(",")}`);
        return { allM_Collection: { results: [{ id: "db.demo.collection.partner-kit-kansai", collectionName: "Kansai partner kit" }] } };
      }
      return {};
    };
    const out = await discoverFromEdge(edge);
    assert.deepEqual(out.partnerKits.map((k: any) => [k.id, k.name, k.user]), [["db.demo.collection.partner-kit-kansai", "Kansai", "kansai"]]);
    assert.ok(asked.some((q) => q.includes("allM_Collection") && !q.includes("description")));
  });
});

describe("F4: kit privacy without CollectionToAsset on Edge", () => {
  // a stand-in Content Hub REST API: a kit collection (id 500) holding asset 9001
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  before(() => {
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = new URL(String(input));
      calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      if (url.pathname === "/api/authenticate") return json({ token: "t" });
      if (url.pathname === "/api/entities/identifier/db.demo.collection.partner-kit-kansai") return json({ id: 500 });
      if (url.pathname === "/api/entities/identifier/db.demo.collection.gone") return json({}, 404);
      if (url.pathname === "/api/entities/query") return /id==500/.test(url.searchParams.get("query") ?? "") ? json({ items: [{ id: 9001, identifier: "db.demo.asset.price-list" }] }) : json({ items: [] });
      if (url.pathname === "/api/entities/9001/relations/CollectionToAsset") return json({ parents: [{ href: "https://ch.example/api/entities/500" }] });
      if (url.pathname === "/api/entities/9002/relations/CollectionToAsset") return json({ parents: [] });
      if (url.pathname === "/api/entities/500") return json({ id: 500, identifier: "db.demo.collection.partner-kit-kansai" });
      return json({}, 404);
    }) as typeof fetch;
  });
  after(() => { globalThis.fetch = realFetch; });

  test("the file check reads a file's collections from REST: a kit-only file isn't public", async () => {
    const kits = new Set(["db.demo.collection.partner-kit-kansai"]);
    const inKit = await kit.assetCollectionsViaRest("9001");
    assert.deepEqual(inKit, ["db.demo.collection.partner-kit-kansai"]);
    assert.equal(isPublicMaterial({ linked: false, brandBook: false, collections: inKit }, kits), false);
    // what the check saw before: no collections at all, so the same file counted as public
    assert.equal(isPublicMaterial({ linked: false, brandBook: false, collections: [] }, kits), true);
    // a file in no collection stays public material
    const none = await kit.assetCollectionsViaRest("9002");
    assert.equal(isPublicMaterial({ linked: false, brandBook: false, collections: none }, kits), true);
  });

  test("the library's kit members from REST; a kit that isn't on the tenant is skipped", async () => {
    const members = new Map(await kit.kitMembersUncached(["db.demo.collection.partner-kit-kansai", "db.demo.collection.gone"]));
    assert.deepEqual([...members], [["db.demo.asset.price-list", ["db.demo.collection.partner-kit-kansai"]]]);
    // Edge's collections win when Edge publishes the link; else the REST kits; else none
    assert.deepEqual(kit.collectionsOf(["c1"], "db.demo.asset.price-list", members), ["c1"]);
    assert.deepEqual(kit.collectionsOf(null, "db.demo.asset.price-list", members), ["db.demo.collection.partner-kit-kansai"]);
    assert.deepEqual(kit.collectionsOf(null, "db.demo.asset.other", members), []);
  });

  test("a Content Hub failure throws (the check refuses, nothing is cached)", async () => {
    const ok = globalThis.fetch;
    globalThis.fetch = (async (input: any) => (String(input).includes("/api/authenticate") ? new Response(JSON.stringify({ token: "t" })) : new Response("no", { status: 403 }))) as typeof fetch;
    try {
      await assert.rejects(kit.assetCollectionsViaRest("9001"));
    } finally {
      globalThis.fetch = ok;
    }
  });
});
