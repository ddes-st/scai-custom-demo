import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Wildcard page for /products/categories/{slug} — layout once on item `*`. */
export const stubProductsCategoriesWildcard = {
  kind: "page-stub",
  definitionKey: "stub-products-categories-wildcard",
  name: "*",
  routePath: "/products/categories/*",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Product Category",
  culture: "en",
  cultures: ["nl-BE", "fr-BE"],
} satisfies PageStubDefinition;
