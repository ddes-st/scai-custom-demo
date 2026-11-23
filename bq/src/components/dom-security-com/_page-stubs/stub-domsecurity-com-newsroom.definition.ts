import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /en/newsroom → /newsroom */
export const stubDomsecurityComNewsroom = {
  kind: "page-stub",
  definitionKey: "stub-domsecurity-com-newsroom",
  name: "Newsroom",
  routePath: "/newsroom",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Newsroom",
  culture: "be",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
