import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/gezin/bootverzekering → /individuals/family/boat-insurance */
export const stubIndividualsFamilyBoatInsurance = {
  kind: "page-stub",
  definitionKey: "stub-individuals-family-boat-insurance",
  name: "Bootverzekering",
  routePath: "/individuals/family/boat-insurance",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Bootverzekering",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
