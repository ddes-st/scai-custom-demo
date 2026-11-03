import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { pickImage, type ImageLink } from "../src/lib/ch/image-links";

const gated: ImageLink[] = [
  { u: "/api/asset/a1?pl=96477-PortalCard-1200x900&v=x", w: 1200, h: 900, d: 1200, n: "PortalCard", crop: true },
  { u: "/api/asset/a1?pl=1-Wide-2000x800&v=x", w: 2000, h: 800, d: 2000, n: "Wide", crop: true },
];

describe("pickImage on portal file URLs (hybrid/gated)", () => {
  test("a card gets its crop resized for 2× its box, with a srcset below the crop's width", () => {
    const img = pickImage(gated, "card");
    assert.equal(img.name, "PortalCard");
    assert.equal(img.src, "/api/asset/a1?pl=96477-PortalCard-1200x900&v=x&w=960");
    assert.equal(img.srcSet, ["320", "640", "960"].map((w) => `/api/asset/a1?pl=96477-PortalCard-1200x900&v=x&w=${w} ${w}w`).join(", "));
    assert.equal(img.width, 960);
    assert.equal(img.height, 720);
  });
  test("a wide box keeps the full crop in the srcset (it needs more than 1920)", () => {
    const img = pickImage(gated, "wide");
    assert.equal(img.name, "Wide");
    assert.match(img.src, /&w=1920$/);
    assert.match(img.srcSet ?? "", /1-Wide-2000x800&v=x 2000w$/);
  });
  test("a small image stays as it is", () => {
    const img = pickImage([{ u: "/api/asset/a2?r=preview", w: 300, h: 200, d: 300, n: "preview", crop: false }], "card");
    assert.equal(img.src, "/api/asset/a2?r=preview");
  });
  test("Content Hub public links (public mode) are not touched", () => {
    const img = pickImage([{ u: "https://ch.example/api/public/content/abc?v=1", w: 1200, h: 900, d: 1200, n: "PortalCard", crop: true }], "card");
    assert.equal(img.src, "https://ch.example/api/public/content/abc?v=1");
  });
});

test("only a preview: a portal file is still asked for at 2× the box", () => {
  assert.equal(pickImage([], "card", "/api/asset/a3?r=preview&v=1").src, "/api/asset/a3?r=preview&v=1&w=960");
  assert.equal(pickImage([], "card", "https://ch.example/p.jpg").src, "https://ch.example/p.jpg");
});
