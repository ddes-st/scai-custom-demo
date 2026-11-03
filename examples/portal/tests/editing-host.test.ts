import { test, describe, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { editingHostGate } from "../src/lib/portal/editing-host";
import { pickImage } from "../src/lib/ch/image-links";

const saved = { PORTAL_EDITING_HOST: process.env.PORTAL_EDITING_HOST, PORTAL_NOINDEX: process.env.PORTAL_NOINDEX, PORTAL_FILES: process.env.PORTAL_FILES };
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
const req = (path: string, init: { cookie?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(new URL(path, "https://portal-editing.example.test"), { headers: { ...(init.headers ?? {}), ...(init.cookie ? { cookie: init.cookie } : {}) } });

describe("editing host: pages for the Page builder only", () => {
  test("not an editing host: nothing changes", () => {
    delete process.env.PORTAL_EDITING_HOST; delete process.env.PORTAL_NOINDEX; delete process.env.PORTAL_FILES;
    assert.equal(editingHostGate(req("/products")), null);
  });
  test("a visitor without a Page builder session gets a quick, uncached 404", () => {
    process.env.PORTAL_EDITING_HOST = "1";
    for (const path of ["/", "/products", "/de-DE/brands/x", "/products/abc~1"]) {
      const res = editingHostGate(req(path));
      assert.equal(res?.status, 404, path);
      assert.equal(res?.headers.get("cache-control"), "no-store"); // the same path must still render for the Page builder
    }
  });
  test("the Page builder passes: its render request, its draft-mode cookie, a preview tab", () => {
    process.env.PORTAL_EDITING_HOST = "1";
    assert.equal(editingHostGate(req("/products", { headers: { "x-sitecore-editing-params": "{}" } })), null);
    assert.equal(editingHostGate(req("/products", { headers: { __content_sdk_preview: "1" } })), null);
    assert.equal(editingHostGate(req("/products", { cookie: "__prerender_bypass=abc" })), null);
    assert.equal(editingHostGate(req("/products", { cookie: "sc_site=portal; sc_preview=true" })), null);
  });
  test("APIs, files, the hub apps and the sign-in pages stay open", () => {
    process.env.PORTAL_EDITING_HOST = "1";
    for (const path of ["/api/editing/render", "/api/editing/config", "/api/asset/x?w=320", "/api/theme", "/api/track", "/_next/static/a.js", "/ch-picker_key123", "/theme-editor_k", "/portal-setup_k", "/ch-info", "/sitecore-auth-callback", "/login", "/robots.txt", "/sitemap.xml"]) {
      assert.equal(editingHostGate(req(path)), null, path);
    }
  });
  test("recognised by the pair the Demo Builder sets on editing hosts", () => {
    delete process.env.PORTAL_EDITING_HOST;
    process.env.PORTAL_NOINDEX = "1"; process.env.PORTAL_FILES = "asset";
    assert.equal(editingHostGate(req("/"))?.status, 404);
    process.env.PORTAL_FILES = "";
    assert.equal(editingHostGate(req("/")), null); // noindex alone isn't an editing host
  });
});

describe("editing host: one image size", () => {
  const links = [{ n: "PortalCard", u: "/api/asset/a1?pl=PortalCard&v=1", w: 1200, h: 900, d: 1200, crop: true }];
  test("a live head gets the srcset, an editing host one size", () => {
    delete process.env.PORTAL_EDITING_HOST; delete process.env.PORTAL_NOINDEX; delete process.env.PORTAL_FILES;
    assert.ok(pickImage(links, "card").srcSet);
    process.env.PORTAL_EDITING_HOST = "1";
    const one = pickImage(links, "card");
    assert.equal(one.srcSet, undefined);
    assert.match(one.src, /[?&]w=\d+$/);
  });
});

// the module reaches sitecore.config, which needs a context id: set before it loads
process.env.SITECORE_EDGE_CONTEXT_ID ||= "test-context";
let cdnShareable: typeof import("../src/lib/ch/assetAccess").cdnShareable;
before(async () => ({ cdnShareable } = await import("../src/lib/ch/assetAccess")));

describe("the shared cache keeps only what anonymous visitors may see", () => {
  const KITS = new Set(["kit-delacroix"]);
  const pub = { ok: true, linked: true, collections: [] as string[] };
  test("public portal material on a public or hybrid site: shared, whoever asked", () => {
    assert.equal(cdnShareable("public", pub, KITS), true);
    assert.equal(cdnShareable("hybrid", pub, KITS), true);
    assert.equal(cdnShareable("hybrid", { ok: true, linked: false, collections: ["kit-delacroix"], brandBook: true }, KITS), true);
  });
  test("never in gated mode", () => {
    assert.equal(cdnShareable("gated", pub, KITS), false);
    assert.equal(cdnShareable("gated", { ...pub, brandBook: true }, KITS), false);
  });
  test("never a partner's own document, even when it is also public material", () => {
    assert.equal(cdnShareable("hybrid", pub, KITS, ["partner-1"]), false);
    assert.equal(cdnShareable("public", { ...pub, brandBook: true }, KITS, ["partner-1"]), false);
  });
  test("never a file only partner kits hold, nor one the portal doesn't grant", () => {
    assert.equal(cdnShareable("hybrid", { ok: true, linked: false, collections: ["kit-delacroix"] }, KITS), false);
    assert.equal(cdnShareable("public", { ...pub, ok: false }, KITS), false);
  });
});
