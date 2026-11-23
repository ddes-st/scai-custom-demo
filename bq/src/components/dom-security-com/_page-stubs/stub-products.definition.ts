import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /en/products → /products */
export const stubProducts = {
  kind: "page-stub",
  definitionKey: "stub-products",
  name: "Products",
  routePath: "/products",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Products",
  culture: "be",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
