import { test } from "node:test";
import assert from "node:assert/strict";
import { headForSite, normalizeHead, siteRootOf } from "../src/lib/portal/hub";

test("normalizeHead: https origins only (hosts get https), paths dropped", () => {
  assert.equal(normalizeHead("brightwater-university-sitecoreai-p.vercel.app"), "https://brightwater-university-sitecoreai-p.vercel.app");
  assert.equal(normalizeHead("https://x.vercel.app/programs?a=1"), "https://x.vercel.app");
  assert.equal(normalizeHead("http://x.vercel.app"), "");
  assert.equal(normalizeHead("javascript:alert(1)"), "");
  assert.equal(normalizeHead(""), "");
});

test("siteRootOf: the site part of an item path", () => {
  assert.equal(siteRootOf("/sitecore/content/collection-university/portal-bw/Home/programs/*"), "/sitecore/content/collection-university/portal-bw");
  assert.equal(siteRootOf("/sitecore/templates/x"), "");
});

test("headForSite: PortalHead first, else the site's TargetHostName", async () => {
  const gql = (s: string, g: string) => async () => ({ s: { field: { value: s } }, g: { field: { value: g } } });
  assert.equal(await headForSite(gql("https://a.vercel.app", "b.vercel.app"), "/sitecore/content/c/s"), "https://a.vercel.app");
  assert.equal(await headForSite(gql("", "b.vercel.app"), "/sitecore/content/c/s"), "https://b.vercel.app");
  assert.equal(await headForSite(gql("", ""), "/sitecore/content/c/s"), "");
});
