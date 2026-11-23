/**
 * Datasource CM path lookup for presentation emit (s:ds).
 * Run: npx tsx --test tools/definitions/apply/datasource-resolve.test.ts
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { clearAuthoringPathCache } from "../../shared/authoring-path-cache";
import { clearItemIdByPathCmCache } from "../../shared/resolve-item-id-by-path";
import {
  collectDatasourceFolderCandidates,
  expectsDatasource,
  formatDatasourceLookupFailure,
  normalizeItemNameKey,
  resolveDatasourceByPath,
} from "./datasource-resolve";
import type { ComponentTemplateDefinition } from "../types";

function componentDef(
  overrides: Partial<ComponentTemplateDefinition> & {
    definitionKey: string;
    folder: string[];
    items?: { name: string }[];
  },
): ComponentTemplateDefinition {
  const { folder, items, definitionKey, ...rest } = overrides;
  const spacedFolder = folder
    .map((s) =>
      s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim(),
    )
    .join(" ");
  return {
    kind: "component",
    definitionKey,
    name: definitionKey,
    displayName: definitionKey,
    componentName: "Test",
    collectionSystem: "crelan",
    siteSystem: "crelan-be",
    datasourceLocation: { scope: "site", root: "data", folder },
    model: {
      folderTemplate: { name: `${spacedFolder} Folder` },
      itemTemplate: {
        name: "Item",
        sections: [{ name: "Data", sortOrder: 100, fields: [] }],
      },
    },
    variants: [{ name: "Default" }],
    content: {
      location: { root: "data", folder },
      culture: "nl-BE",
      items: items || [{ name: "Seed" }],
    },
    ...rest,
  } as ComponentTemplateDefinition;
}

describe("normalizeItemNameKey", () => {
  it("collapses spaces and case", () => {
    assert.equal(
      normalizeItemNameKey("Footer Link Columns"),
      normalizeItemNameKey("FooterLinkColumns"),
    );
  });

  it("treats website as site for folder drift", () => {
    assert.equal(
      normalizeItemNameKey("Crelan Website Footers"),
      normalizeItemNameKey("Crelan Site Footers"),
    );
  });
});

describe("collectDatasourceFolderCandidates", () => {
  it("spaces PascalCase folder segments", () => {
    const def = componentDef({
      definitionKey: "crelan-footer-link-column",
      folder: ["FooterLinkColumns"],
    });
    const folders = collectDatasourceFolderCandidates(def);
    assert.ok(
      folders.some((f) => f.join("/") === "Footer Link Columns"),
      JSON.stringify(folders),
    );
  });
});

describe("resolveDatasourceByPath (CM path lookup)", () => {
  const SITE = { collectionSystem: "crelan", siteSystem: "crelan-be" };

  /** Build a lookupPath stub from `{ sitecorePath: id }` (case-insensitive). */
  function cmWith(items: Record<string, string>) {
    const map = new Map(
      Object.entries(items).map(([p, id]) => [p.toLowerCase(), id]),
    );
    const seen: string[] = [];
    return {
      seen,
      lookupPath: async (p: string) => {
        seen.push(p);
        return map.get(p.toLowerCase());
      },
    };
  }

  beforeEach(() => {
    clearItemIdByPathCmCache();
    clearAuthoringPathCache();
  });

  it("finds Our Offer under spaced Footer Link Columns from FooterLinkColumns def", async () => {
    const cm = cmWith({
      "/sitecore/content/crelan/crelan-be/Data/Footer Link Columns/Our Offer":
        "11111111111111111111111111111111",
    });
    const def = componentDef({
      definitionKey: "crelan-footer-link-column",
      folder: ["FooterLinkColumns"],
      items: [{ name: "Our Offer" }],
    });
    const hit = await resolveDatasourceByPath({
      ...SITE,
      def,
      datasourceItem: "Our Offer",
      englishItemNameHint: "Our Offer",
      lookupPath: cm.lookupPath,
    });
    assert.ok(hit);
    assert.match(hit!.sitecorePath, /Footer Link Columns\/Our Offer$/);
    assert.match(hit!.itemId, /^1{32}$/);
  });

  it("Dutch hero name finds English item via englishItemNameHint", async () => {
    const cm = cmWith({
      "/sitecore/content/crelan/crelan-be/Data/Crelan Hero With Promotional Cards/Welcome to Crelan Hero":
        "22222222222222222222222222222222",
    });
    const def = componentDef({
      definitionKey: "crelan-hero-with-promotional-cards",
      folder: ["Crelan Hero With Promotional Cards"],
      items: [{ name: "Welkom bij Crelan Hero" }],
    });
    const hit = await resolveDatasourceByPath({
      ...SITE,
      def,
      datasourceItem: "Welkom bij Crelan Hero",
      englishItemNameHint: "Welcome to Crelan Hero",
      lookupPath: cm.lookupPath,
    });
    assert.ok(hit);
    assert.equal(hit!.itemNameUsed, "Welcome to Crelan Hero");
  });

  it("strips apostrophes so Thema's resolves Themas", async () => {
    const cm = cmWith({
      "/sitecore/content/crelan/crelan-be/Data/Theme Footer Columns/Themas":
        "77777777777777777777777777777777",
    });
    const def = componentDef({
      definitionKey: "crelan-theme-footer-column",
      folder: ["Theme Footer Columns"],
      items: [{ name: "Thema's" }],
    });
    const hit = await resolveDatasourceByPath({
      ...SITE,
      def,
      datasourceItem: "Thema's",
      englishItemNameHint: "Thema's",
      lookupPath: cm.lookupPath,
    });
    assert.ok(hit);
    assert.equal(hit!.itemNameUsed, "Themas");
    assert.match(hit!.itemId, /^7{32}$/);
  });

  it("uses Home root when content location root is home", async () => {
    const cm = cmWith({
      "/sitecore/content/crelan/crelan-be/Home/Promos/Spring":
        "99999999999999999999999999999999",
    });
    const def = componentDef({
      definitionKey: "crelan-promo",
      folder: ["Promos"],
      items: [{ name: "Spring" }],
    });
    def.content = {
      location: { root: "home", folder: ["Promos"] },
      culture: "nl-BE",
      items: [{ name: "Spring" }],
    };
    def.datasourceLocation = { scope: "site", root: "home", folder: ["Promos"] };
    const hit = await resolveDatasourceByPath({
      ...SITE,
      def,
      datasourceItem: "Spring",
      englishItemNameHint: "Spring",
      lookupPath: cm.lookupPath,
    });
    assert.ok(hit);
    assert.match(hit!.sitecorePath, /\/Home\/Promos\/Spring$/);
  });

  it("missing item with expected DS is null so emit must fail closed", async () => {
    const cm = cmWith({});
    const def = componentDef({
      definitionKey: "crelan-footer-link-column",
      folder: ["FooterLinkColumns"],
      items: [{ name: "Our Offer" }],
    });
    assert.equal(expectsDatasource(def, "Our Offer"), true);
    const hit = await resolveDatasourceByPath({
      ...SITE,
      def,
      datasourceItem: "Our Offer",
      englishItemNameHint: "Our Offer",
      lookupPath: cm.lookupPath,
    });
    assert.equal(hit, null);
    assert.ok(cm.seen.length > 0, "should have probed CM paths");
  });
});

describe("expectsDatasource / fail message", () => {
  it("expects DS when datasourceItem or content items present", () => {
    const def = componentDef({
      definitionKey: "x",
      folder: ["X"],
      items: [{ name: "A" }],
    });
    assert.equal(expectsDatasource(def, undefined), true);
    assert.equal(expectsDatasource(def, "A"), true);
    const empty = componentDef({
      definitionKey: "y",
      folder: ["Y"],
      items: [],
    });
    // Override empty items
    empty.content = {
      location: { root: "data", folder: ["Y"] },
      items: [],
    };
    assert.equal(expectsDatasource(empty, undefined), false);
    assert.equal(expectsDatasource(empty, "Still Wanted"), true);
  });

  it("formatDatasourceLookupFailure mentions item and folders", () => {
    const def = componentDef({
      definitionKey: "crelan-footer-link-column",
      folder: ["FooterLinkColumns"],
    });
    const msg = formatDatasourceLookupFailure({
      definitionKey: "crelan-footer-link-column",
      itemName: "Our Offer",
      collectionSystem: "crelan",
      siteSystem: "crelan-be",
      def,
    });
    assert.match(msg, /Our Offer/);
    assert.match(msg, /Footer Link Columns/);
    assert.match(msg, /\/sitecore\/content\/crelan\/crelan-be\/Data/);
    assert.match(msg, /refusing to omit s:ds/);
  });
});
