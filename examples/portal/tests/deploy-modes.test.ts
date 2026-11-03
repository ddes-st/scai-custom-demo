import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { env } from "../src/lib/ch/env";
import { closedSiteResponse } from "../src/lib/portal/auth/closed";

const saved = { SITE_MODE: process.env.SITE_MODE, PORTAL_FILES: process.env.PORTAL_FILES, PORTAL_NOINDEX: process.env.PORTAL_NOINDEX };
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
const setEnv = (v: Record<string, string | undefined>) => { for (const [k, x] of Object.entries(v)) { if (x === undefined) delete process.env[k]; else process.env[k] = x; } };

describe("PORTAL_FILES=asset (editing hosts)", () => {
  test("public mode serves public links unless PORTAL_FILES=asset", () => {
    setEnv({ SITE_MODE: "public", PORTAL_FILES: undefined });
    assert.equal(env.gatedFiles, false);
    setEnv({ PORTAL_FILES: "asset" });
    assert.equal(env.gatedFiles, true);
    assert.equal(env.siteMode, "public"); // pages stay ungated
  });
  test("hybrid and gated always go through /api/asset", () => {
    setEnv({ SITE_MODE: "hybrid", PORTAL_FILES: undefined });
    assert.equal(env.gatedFiles, true);
  });
});

describe("PORTAL_NOINDEX=1", () => {
  test("robots.txt closes and sitemaps empty on a public site with PORTAL_NOINDEX", async () => {
    setEnv({ SITE_MODE: "public", PORTAL_NOINDEX: undefined });
    assert.equal(closedSiteResponse("robots"), null);
    setEnv({ PORTAL_NOINDEX: "1" });
    const r = closedSiteResponse("robots");
    assert.equal(await r?.text(), "User-agent: *\nDisallow: /\n");
    assert.match(await closedSiteResponse("xml")?.text() ?? "", /<urlset[^>]*><\/urlset>/);
  });
});
