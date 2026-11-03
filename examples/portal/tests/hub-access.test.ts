import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { hubCallerDenied, hubHead } from "../src/lib/portal/hub-access";
import { keyFromLocation } from "../src/lib/portal/tools-fetch";

const KEY = "h".repeat(32);
const req = (key?: string) => new Request("https://hub.example/api/hub/theme", { headers: key ? { "x-portal-hub-key": key } : {} });

describe("hubCallerDenied (access key)", () => {
  test("the right key passes", async () => assert.equal(await hubCallerDenied(req(KEY), { PORTAL_HUB_ACCESS_KEY: KEY, PORTAL_TOOLS_KEY: "t".repeat(32) }), null));
  test("no or a wrong key is 401", async () => {
    assert.equal((await hubCallerDenied(req(), { PORTAL_HUB_ACCESS_KEY: KEY }))?.status, 401);
    assert.equal((await hubCallerDenied(req("h".repeat(31) + "x"), { PORTAL_HUB_ACCESS_KEY: KEY }))?.status, 401);
  });
  test("fails closed without a usable hub key", async () => {
    assert.equal((await hubCallerDenied(req(""), {}))?.status, 503);
    assert.equal((await hubCallerDenied(req("short"), { PORTAL_HUB_ACCESS_KEY: "short" }))?.status, 503);
    assert.equal((await hubCallerDenied(req(KEY), { PORTAL_HUB_ACCESS_KEY: KEY, PORTAL_TOOLS_KEY: KEY }))?.status, 503);
  });
});

describe("hubCallerDenied (Sitecore token, PORTAL_HUB_AUTH)", () => {
  const ok = async () => ({ ok: true as const, claims: { iss: "", aud: [], org: "org_a", orgName: "", tenant: "", tenantName: "", exp: 0 } });
  const bad = async () => ({ ok: false as const, reason: "expired" });
  const withToken = (key?: string) => new Request("https://hub.example/api/hub/theme", { headers: { authorization: "Bearer x.y.z", ...(key ? { "x-portal-hub-key": key } : {}) } });
  test("key mode ignores tokens", async () => {
    assert.equal((await hubCallerDenied(withToken(), { PORTAL_HUB_ACCESS_KEY: KEY }, ok))?.status, 401);
  });
  test("either: a valid token or the key", async () => {
    const env = { PORTAL_HUB_AUTH: "either", PORTAL_HUB_ACCESS_KEY: KEY };
    assert.equal(await hubCallerDenied(withToken(), env, ok), null);
    assert.equal(await hubCallerDenied(withToken(KEY), env, bad), null);
    const denied = await hubCallerDenied(withToken(), env, bad);
    assert.equal(denied?.status, 401);
    assert.match(denied?.error ?? "", /Sitecore token: expired/);
  });
  test("token: only a valid token, no key needed", async () => {
    const env = { PORTAL_HUB_AUTH: "token" };
    assert.equal(await hubCallerDenied(withToken(), env, ok), null);
    assert.equal((await hubCallerDenied(withToken(KEY), { ...env, PORTAL_HUB_ACCESS_KEY: KEY }, bad))?.status, 401);
    assert.equal((await hubCallerDenied(req(KEY), { ...env, PORTAL_HUB_ACCESS_KEY: KEY }, ok))?.status, 401);
  });
});

describe("hubHead", () => {
  const HOSTS = "brightwater-university-sitecoreai-p.vercel.app, https://lakehaven.vercel.app/";
  test("listed https hosts only, as their origin", () => {
    assert.equal(hubHead("https://brightwater-university-sitecoreai-p.vercel.app/x?y", HOSTS)?.toString(), "https://brightwater-university-sitecoreai-p.vercel.app/");
    assert.equal(hubHead("https://lakehaven.vercel.app", HOSTS)?.host, "lakehaven.vercel.app");
  });
  test("anything else is refused", () => {
    assert.equal(hubHead("https://attacker.vercel.app", HOSTS), null);
    assert.equal(hubHead("http://lakehaven.vercel.app", HOSTS), null);
    assert.equal(hubHead("https://lakehaven.vercel.app:8443", HOSTS), null);
    assert.equal(hubHead("https://u:p@lakehaven.vercel.app", HOSTS), null);
    assert.equal(hubHead("https://lakehaven.vercel.app.attacker.com", HOSTS), null);
    assert.equal(hubHead(null, HOSTS), null);
  });
  test("no list or wildcards allow nothing", () => {
    assert.equal(hubHead("https://lakehaven.vercel.app", ""), null);
    assert.equal(hubHead("https://lakehaven.vercel.app", "*.vercel.app"), null);
  });
});

describe("keyFromLocation", () => {
  const K = "AbCdEfGhIjKlMnOpQrStUvWx-_12";
  test("the key after the page name (App Studio routes) or ?k=", () => {
    assert.equal(keyFromLocation({ pathname: `/ch-picker_${K}`, search: "" }), K);
    assert.equal(keyFromLocation({ pathname: `/portal-setup_${K}`, search: "?x=1" }), K);
    assert.equal(keyFromLocation({ pathname: `/theme-editor_${K}/`, search: "" }), K);
    assert.equal(keyFromLocation({ pathname: "/ch-picker", search: `?k=${K}` }), K);
  });
  test("none for other paths or short keys", () => {
    assert.equal(keyFromLocation({ pathname: "/ch-picker", search: "" }), null);
    assert.equal(keyFromLocation({ pathname: "/ch-picker_short", search: "" }), null);
    assert.equal(keyFromLocation({ pathname: `/products_${K}`, search: "" }), null);
  });
});
