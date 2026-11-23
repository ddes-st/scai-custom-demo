import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/gezin/reisverzekering → /individuals/family/travel-insurance */
export const stubIndividualsFamilyTravelInsurance = {
  kind: "page-stub",
  definitionKey: "stub-individuals-family-travel-insurance",
  name: "Reis",
  routePath: "/individuals/family/travel-insurance",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Reis",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
