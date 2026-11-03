import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { gateRequest } from "../src/lib/portal/auth/gate";
import { createSessionToken, SESSION_COOKIE } from "../src/lib/portal/auth/session";

const SECRET = "gate-test-secret";
const req = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "https://portal.example.test"), cookie ? { headers: { cookie } } : undefined);

describe("gateRequest", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
    process.env.SITE_MODE = "gated";
  });

  test("public mode (and unset) passes everything", async () => {
    process.env.SITE_MODE = "public";
    assert.equal(await gateRequest(req("/brands")), null);
    delete process.env.SITE_MODE;
    assert.equal(await gateRequest(req("/brands")), null);
  });
  test("hybrid mode passes in the proxy", async () => {
    process.env.SITE_MODE = "hybrid";
    assert.equal(await gateRequest(req("/sales")), null);
  });
  test("gated without session redirects to /login?from=…", async () => {
    const res = await gateRequest(req("/products/x~y?tab=files"));
    assert.ok(res);
    assert.ok(res.status >= 300 && res.status < 400);
    const loc = new URL(res.headers.get("location")!);
    assert.equal(loc.pathname, "/login");
    assert.equal(loc.searchParams.get("from"), "/products/x~y?tab=files");
  });
  test("gated root redirects to /login without from", async () => {
    const res = await gateRequest(req("/"));
    const loc = new URL(res!.headers.get("location")!);
    assert.equal(loc.pathname, "/login");
    assert.equal(loc.search, "");
  });
  test("gated with a forged cookie redirects", async () => {
    const res = await gateRequest(req("/brands", `${SESSION_COOKIE}=123.staff.abc`));
    assert.ok(res);
  });
  test("gated with a valid session passes", async () => {
    const token = await createSessionToken(SECRET, "p:kansai");
    assert.equal(await gateRequest(req("/brands", `${SESSION_COOKIE}=${token}`)), null);
  });
  test("draft-mode cookie passes", async () => {
    assert.equal(await gateRequest(req("/brands", "__prerender_bypass=1")), null);
  });
  test("OPEN paths pass", async () => {
    for (const p of ["/login", "/api/auth/login", "/theme-editor", "/portal-setup", "/sitemap.xml", "/robots.txt", "/healthz", "/_next/static/x.js", "/favicon.ico", "/pdf.worker.min.mjs"]) {
      assert.equal(await gateRequest(req(p)), null, p);
    }
  });
});
