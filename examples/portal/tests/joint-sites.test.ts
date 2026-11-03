import { test, describe, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import { SiteResolver } from "@sitecore-content-sdk/content/site";
import { jointMicrositeOf, jointMicrositeOnHost, parseMicrosites, withJointMicrosites } from "../src/lib/portal/microsites";

// sitecore.config needs a context id and names the default site: set before the site helpers load
process.env.SITECORE_EDGE_CONTEXT_ID ||= "test-context";
process.env.NEXT_PUBLIC_DEFAULT_SITE_NAME = "veltrane-portal";
let S: typeof import("../src/lib/portal/sites");
before(async () => { S = await import("../src/lib/portal/sites"); });

const JOINT = [
  { site: "cadence-e", microsite: "VELT.Microsite.cadence-e-reveal", host: "cadence-e-veltrane.vercel.app" },
  { site: "ridgeback", microsite: "VELT.Microsite.ridgeback", host: "https://ridgeback-veltrane.vercel.app/" },
];
const saved = { PORTAL_MICROSITES: process.env.PORTAL_MICROSITES, SITE_MODE: process.env.SITE_MODE, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, PORTAL_SITE_KIND: process.env.PORTAL_SITE_KIND };
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
const useJoint = () => { process.env.PORTAL_MICROSITES = JSON.stringify(JOINT); };

describe("PORTAL_MICROSITES", () => {
  test("entries with a site, a record and a host (normalized); bad and duplicate entries dropped", () => {
    const list = parseMicrosites(JSON.stringify([...JOINT, { site: "x", microsite: "m", host: "not a host" }, { site: "cadence-e", microsite: "dup", host: "other.vercel.app" }, "nope"]));
    assert.deepEqual(list.map((m) => [m.site, m.host]), [["cadence-e", "cadence-e-veltrane.vercel.app"], ["ridgeback", "ridgeback-veltrane.vercel.app"]]);
    assert.deepEqual(parseMicrosites("{broken"), []);
  });
  test("by site name and by host (any case, port ignored)", () => {
    useJoint();
    assert.equal(jointMicrositeOf("Cadence-E")?.microsite, "VELT.Microsite.cadence-e-reveal");
    assert.equal(jointMicrositeOnHost("RIDGEBACK-veltrane.vercel.app:443")?.site, "ridgeback");
    assert.equal(jointMicrositeOnHost("veltrane.vercel.app"), null);
  });
});

describe("the Content SDK resolves the joint microsites by host", () => {
  // as generated: the default site first with "*", the environment's other sites after it
  const generated = [{ name: "veltrane-portal", hostName: "*", language: "en" }, { name: "cadence-e", hostName: "*", language: "en" }, { name: "portal-bw", hostName: "*", language: "en" }];
  test("a microsite's host → the microsite; the portal's and unknown hosts → the portal", () => {
    useJoint();
    const resolver = new SiteResolver(withJointMicrosites(generated, "en"));
    assert.equal(resolver.getByHost("cadence-e-veltrane.vercel.app").name, "cadence-e");
    assert.equal(resolver.getByHost("ridgeback-veltrane.vercel.app").name, "ridgeback");
    assert.equal(resolver.getByHost("veltrane.vercel.app").name, "veltrane-portal");
    assert.equal(resolver.getByHost("anything.example").name, "veltrane-portal");
  });
  test("without PORTAL_MICROSITES the list is unchanged", () => {
    delete process.env.PORTAL_MICROSITES;
    assert.deepEqual(withJointMicrosites(generated, "en"), generated);
  });
});

describe("the request's site", () => {
  test("a tooling API answers only for the deployment's own sites", () => {
    useJoint();
    const req = (site: string) => new Request(`https://hub.example/api/theme?site=${encodeURIComponent(site)}`);
    assert.equal(S.siteFromRequest(req("cadence-e")), "cadence-e");
    assert.equal(S.siteFromRequest(req("portal-bw")), null); // another deployment's site
    assert.equal(S.siteFromRequest(req("../x")), null);
  });
  test("per-site kind, mode, record and portal address", async () => {
    useJoint();
    process.env.SITE_MODE = "gated";
    process.env.NEXT_PUBLIC_SITE_URL = "https://veltrane.vercel.app/some/path";
    delete process.env.PORTAL_SITE_KIND;
    // outside a request: the deployment's default site — the portal, gated
    assert.equal(S.siteKindNow(), "portal");
    assert.equal(S.siteModeNow(), "gated");
    // a tooling call for a joint microsite: public, its own record, the portal's own origin
    await (async () => {
      S.applyRequestSite(new Request("https://x.example/api/theme?site=cadence-e"));
      await Promise.resolve();
      assert.equal(S.currentSite(), "cadence-e");
      assert.equal(S.siteKindNow(), "microsite");
      assert.equal(S.siteModeNow(), "public");
      assert.equal(S.micrositeIdNow(), "VELT.Microsite.cadence-e-reveal");
      assert.equal(S.portalUrlNow(), "https://veltrane.vercel.app");
    })();
  });
});
