import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

// the module reaches sitecore.config, which needs a context id: set before it loads
process.env.SITECORE_EDGE_CONTEXT_ID ||= "test-context";
let isBrandBookFile: typeof import("../src/lib/ch/assetAccess").isBrandBookFile;
let isPublicMaterial: typeof import("../src/lib/ch/assetAccess").isPublicMaterial;
before(async () => ({ isBrandBookFile, isPublicMaterial } = await import("../src/lib/ch/assetAccess")));

// the Veltrane case: each dealer's kit holds its marque's logo next to the dealer's own material
const KITS = new Set(["kit-delacroix", "kit-ferrante"]);
const LOGO = "M.AssetType.Brand.Logo";

describe("brand-book files in a dealer's kit", () => {
  test("a marque's logo in dealers' kits stays public", () => {
    const brandBook = isBrandBookFile([LOGO], ["brand.arvenne"], new Set());
    assert.equal(brandBook, true);
    assert.equal(isPublicMaterial({ linked: false, collections: ["kit-delacroix"], brandBook }, KITS), true);
  });
  test("other files only in a kit stay the partner's", () => {
    const brandBook = isBrandBookFile(["M.AssetType.PriceList"], ["brand.arvenne"], new Set());
    assert.equal(brandBook, false);
    assert.equal(isPublicMaterial({ linked: false, collections: ["kit-delacroix"], brandBook }, KITS), false);
  });
  test("a brand-book type outside the portal's brand scope, or on no brand, isn't one", () => {
    assert.equal(isBrandBookFile([LOGO], ["brand.other"], new Set(["brand.arvenne"])), false);
    assert.equal(isBrandBookFile([LOGO], [], new Set()), false);
    assert.equal(isBrandBookFile([LOGO], ["brand.arvenne"], new Set(["brand.arvenne"])), true);
  });
  test("a portal brand's master asset (its logo) is a brand-book file, whatever its type", () => {
    assert.equal(isBrandBookFile(["M.AssetType.Photo"], [], new Set(), ["brand.vellara"]), true);
    assert.equal(isBrandBookFile([], [], new Set(["brand.arvenne"]), ["brand.vellara"]), false); // not a portal brand
    assert.equal(isPublicMaterial({ linked: false, collections: ["kit-ferrante"], brandBook: isBrandBookFile([], [], new Set(), ["brand.vellara"]) }, KITS), true);
  });
  test("unchanged: linked, in a public collection, or in none — public", () => {
    assert.equal(isPublicMaterial({ linked: true, collections: ["kit-delacroix"] }, KITS), true);
    assert.equal(isPublicMaterial({ linked: false, collections: ["kit-delacroix", "press-kit"] }, KITS), true);
    assert.equal(isPublicMaterial({ linked: false, collections: [] }, KITS), true);
  });
});
