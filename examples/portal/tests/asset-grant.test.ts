import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

// the module reaches sitecore.config, which needs a context id: set before it loads
process.env.SITECORE_EDGE_CONTEXT_ID ||= "test-context";
let grantQuery: typeof import("../src/lib/ch/assetAccess").grantQuery;
let logGrantFailure: typeof import("../src/lib/ch/assetAccess").logGrantFailure;
before(async () => ({ grantQuery, logGrantFailure } = await import("../src/lib/ch/assetAccess")));

const fields = (...names: string[]) => names.map((name) => ({ name, kind: "OBJECT", typeName: "" }));
const LINKS = ["pCMProductToAsset", "pCMProductToMasterAsset", "cmpContentToLinkedAsset", "cmpContentToMasterLinkedAsset", "cmpCampaignToAsset", "cmpCampaignToMasterAsset", "pCMBrandToMasterAsset"];
const FULL = fields("id", "urls", "pCMBrandToAsset", "collectionToAsset", "assetTypeToAsset", ...LINKS);
// the fields a query selects on the asset (what Edge checks against its schema)
const selected = (query: string) => [...query.replace(/^.*?m_Asset\(id: \$id\) \{/, "").matchAll(/(\w+)(?: \{ results \{ id \} \})?/g)].map((m) => m[1]).filter((f) => f !== "results" && f !== "id");
// like Experience Edge: a query naming a field the type doesn't publish is rejected as a whole
const edgeAccepts = (query: string, schema: { name: string }[]) => selected(query).every((f) => schema.some((s) => s.name === f));

describe("the access check's Edge query", () => {
  test("a tenant with every link: the same fields as before", () => {
    const { query, links } = grantQuery(FULL);
    assert.deepEqual(new Set(selected(query)), new Set(["pCMBrandToAsset", "collectionToAsset", "assetTypeToAsset", ...LINKS]));
    assert.deepEqual(links, LINKS);
    assert.ok(edgeAccepts(query, FULL));
  });

  test("Sodexo: no collectionToAsset on Edge — the query leaves it out and Edge accepts it", () => {
    const sodexo = FULL.filter((f) => f.name !== "collectionToAsset");
    const { query } = grantQuery(sodexo);
    assert.ok(!query.includes("collectionToAsset"));
    assert.ok(query.includes("pCMBrandToAsset"));
    assert.ok(edgeAccepts(query, sodexo));
    // the old fixed query on this tenant: rejected, so every file was refused
    const old = `query($id: String!) { a: m_Asset(id: $id) { id pCMBrandToAsset { results { id } } collectionToAsset { results { id } } ${LINKS.map((l) => `${l} { results { id } }`).join(" ")} } }`;
    assert.equal(edgeAccepts(old, sodexo), false);
  });

  test("a tenant without campaigns, content or the brand link: only what's there", () => {
    const lean = fields("id", "pCMProductToAsset", "pCMBrandToMasterAsset");
    const { query, links } = grantQuery(lean);
    assert.deepEqual(links, ["pCMProductToAsset", "pCMBrandToMasterAsset"]);
    assert.deepEqual(selected(query), ["pCMProductToAsset", "pCMBrandToMasterAsset"]);
    assert.ok(edgeAccepts(query, lean));
  });

  test("the industry model's asset relations count as links, once each", () => {
    const schema = [...FULL, ...fields("sportsPlayerToAsset")];
    const { query, links } = grantQuery(schema, ["sportsPlayerToAsset", "pCMProductToAsset", "notOnEdge"]);
    assert.ok(links.includes("sportsPlayerToAsset"));
    assert.ok(!links.includes("notOnEdge"));
    assert.equal(links.filter((l) => l === "pCMProductToAsset").length, 1);
    assert.ok(edgeAccepts(query, schema));
  });
});

describe("a refused file's reason in the log", () => {
  test("logged with the asset id and Edge's answer, once a minute per reason", () => {
    const lines: string[] = [];
    const err = new Error('Edge GraphQL: [{"message":"The field `collectionToAsset` does not exist on the type `M_Asset`."}]');
    logGrantFailure("db.sodexo.press.img.100514", err, (l) => lines.push(l));
    logGrantFailure("db.sodexo.press.img.100572", err, (l) => lines.push(l));
    assert.equal(lines.length, 1);
    assert.match(lines[0], /db\.sodexo\.press\.img\.100514 refused/);
    assert.match(lines[0], /collectionToAsset/);
    logGrantFailure("95851", new Error("Content Hub REST 401"), (l) => lines.push(l));
    assert.equal(lines.length, 2);
  });
});
