import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /ekomi */
export const stubEkomi = {
  kind: "page-stub",
  definitionKey: "stub-ekomi",
  name: "Read All Reviews",
  routePath: "/ekomi",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Lees alle beoordelingen",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
