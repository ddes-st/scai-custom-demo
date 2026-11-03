import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fakeXmc } from "./helpers/fake-xmc";
import { retryOnTimeout, runPortalSetup } from "../src/lib/portal/setup/core.mjs";

const TIMEOUT = () => Object.assign(new Error("[client SDK] Request timed out"), { code: "TIMEOUT" });

describe("retryOnTimeout: a slow answer is tried once more", () => {
  test("a timeout, then success: the answer, one retry, a log line", async () => {
    let calls = 0;
    const lines: string[] = [];
    const gql = retryOnTimeout(async () => { if (++calls === 1) throw TIMEOUT(); return { ok: true }; }, (l: string) => lines.push(l));
    assert.deepEqual(await gql("query { x }", {}), { ok: true });
    assert.equal(calls, 2);
    assert.deepEqual(lines, ["  ! slow answer — trying again"]);
  });
  test("two timeouts in a row still fail (the run stops, a new run continues)", async () => {
    let calls = 0;
    const gql = retryOnTimeout(async () => { calls++; throw TIMEOUT(); });
    await assert.rejects(gql("mutation { x }", {}), /timed out/);
    assert.equal(calls, 2);
  });
  test("any other error isn't retried", async () => {
    let calls = 0;
    const gql = retryOnTimeout(async () => { calls++; throw new Error("Access denied"); });
    await assert.rejects(gql("mutation { x }", {}), /Access denied/);
    assert.equal(calls, 1);
  });
});

describe("a setup run on a new collection where making a field shared times out once (the Sodexo case)", () => {
  test("the run continues and every settings field ends up shared", async () => {
    const COL = "collection-sodexo";
    const x = fakeXmc(COL, "portal-sodexo");
    let failed = false;
    // the CM finishes the change, but the answer arrives too late: the first "Shared" write times out after it applied
    const slow = async (query: string, variables: Record<string, any> = {}) => {
      const res = await x.gql(query, variables);
      if (!failed && /updateItem/.test(query) && (variables.i?.fields ?? []).some((f: any) => f.name === "Shared")) { failed = true; throw TIMEOUT(); }
      return res;
    };
    const lines: string[] = [];
    const base = { cropNames: [], partnerKits: [], vertical: null, branding: {}, theme: null, dealers: 0, siteKind: "portal" };
    await runPortalSetup({ gql: slow, log: (l: string) => lines.push(l), discovery: base, options: { collection: COL, site: "portal-sodexo", languages: [], publish: true, marketplaceAppId: "app-1", headUrl: "https://sodexo.example", publicHost: "sodexo.example" } });
    assert.equal(failed, true);
    assert.ok(lines.includes("  ! slow answer — trying again"));
    const field = x.byPath(`sitecore/templates/Project/${COL}/Portal/Portal Settings/Portal/BrandScope`);
    assert.equal(field?.shared.get("Shared"), "1");
    assert.ok(x.byPath(`sitecore/content/${COL}/portal-sodexo/Home`), "the run got to the page tree");
  });
});
