import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren → /individuals */
export const stubAxaBeIndividuals = {
  kind: "page-stub",
  definitionKey: "stub-axa-be-individuals",
  name: "Bekijk al onze producten",
  routePath: "/individuals",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Bekijk al onze producten",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
