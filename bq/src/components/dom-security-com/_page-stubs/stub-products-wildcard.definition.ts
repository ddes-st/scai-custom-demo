import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Wildcard page for /products/{sku-slug} — layout once on item `*`. */
export const stubProductsWildcard = {
  kind: "page-stub",
  definitionKey: "stub-products-wildcard",
  name: "*",
  routePath: "/products/*",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Product",
  culture: "en",
  cultures: ["nl-BE", "fr-BE"],
} satisfies PageStubDefinition;
