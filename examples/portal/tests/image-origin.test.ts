import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { gatedFileUrl, imageFromOrigin, imageOrigin, sizedFileUrl } from "../src/lib/ch/fileUrl";
import { pickImage } from "../src/lib/ch/image-links";
import { portalHeaders } from "../src/lib/portal/response-headers";

const keys = ["PORTAL_EDITING_HOST", "PORTAL_NOINDEX", "PORTAL_FILES", "PORTAL_IMAGE_ORIGIN"] as const;
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
afterEach(() => { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
const LIVE = "https://veltrane-mobility-group-sitecoreai.vercel.app";
const editingHost = (origin = LIVE) => { process.env.PORTAL_EDITING_HOST = "1"; process.env.PORTAL_IMAGE_ORIGIN = origin; };
const link = { n: "PortalCard", u: "/api/asset/a1?pl=PortalCard&v=1", w: 1200, h: 900, d: 1200, crop: true };

describe("an editing host's images from the live portal (PORTAL_IMAGE_ORIGIN)", () => {
  test("cards, carousels, tiles, picks: the image from the live portal", () => {
    editingHost();
    const img = pickImage([link], "card");
    assert.ok(img.src.startsWith(`${LIVE}/api/asset/a1?`), img.src);
    assert.equal(imageFromOrigin("/api/asset/x?v=2&w=320"), `${LIVE}/api/asset/x?v=2&w=320`);
  });
  test("not an editing host: the srcset stays on the own origin", () => {
    process.env.PORTAL_IMAGE_ORIGIN = LIVE; delete process.env.PORTAL_EDITING_HOST; delete process.env.PORTAL_NOINDEX;
    assert.ok(pickImage([link], "card").srcSet?.split(", ").every((e) => e.startsWith("/api/asset/"))); // not an editing host: unchanged
  });
  test("a live portal never points elsewhere, even with the variable set", () => {
    delete process.env.PORTAL_EDITING_HOST; delete process.env.PORTAL_NOINDEX; delete process.env.PORTAL_FILES;
    process.env.PORTAL_IMAGE_ORIGIN = LIVE;
    assert.equal(imageOrigin(), "");
    assert.ok(pickImage([link], "card").src.startsWith("/api/asset/"));
  });
  test("only an https origin counts: no path, query, credentials or plain http", () => {
    for (const bad of ["http://x.vercel.app", `${LIVE}/sub`, `${LIVE}/?a=1`, "https://u:p@x.vercel.app", "not a url", ""]) {
      editingHost(bad);
      assert.equal(imageOrigin(), "", bad);
      assert.equal(imageFromOrigin("/api/asset/x"), "/api/asset/x", bad);
    }
    editingHost(`${LIVE}/`);
    assert.equal(imageOrigin(), LIVE); // a trailing slash is fine
  });
  test("downloads, file lists (partner kits, sales) and other URLs stay where they are", () => {
    editingHost();
    // downloads and file-list thumbnails are built with these, which never point elsewhere
    assert.equal(gatedFileUrl("kit-file", { version: "2026-10-01" }).startsWith("/api/asset/"), true);
    assert.equal(sizedFileUrl("/api/asset/kit-file?v=1", 320), "/api/asset/kit-file?v=1&w=320");
    // a Content Hub link or any non-portal URL isn't touched
    assert.equal(imageFromOrigin("https://tenant.example/api/public/content/x"), "https://tenant.example/api/public/content/x");
    assert.equal(imageFromOrigin("/api/file?u=x"), "/api/file?u=x");
  });
});

describe("response headers", () => {
  test("the editing routes send no Referer onward (the editing secret stays out of request logs)", () => {
    const rule = portalHeaders({}).find((r) => r.source === "/api/editing/:path*");
    assert.deepEqual(rule?.headers, [{ key: "Referrer-Policy", value: "no-referrer" }]);
  });
  test("noindex on an editing host only", () => {
    assert.equal(portalHeaders({}).some((r) => r.headers.some((h) => h.key === "X-Robots-Tag")), false);
    assert.equal(portalHeaders({ PORTAL_NOINDEX: "1" }).some((r) => r.source === "/:path*" && r.headers[0].value === "noindex, nofollow"), true);
  });
});
