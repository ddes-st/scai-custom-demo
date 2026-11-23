import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/gezin/dierenverzekering → /individuals/family/pet-insurance */
export const stubIndividualsFamilyPetInsurance = {
  kind: "page-stub",
  definitionKey: "stub-individuals-family-pet-insurance",
  name: "Dierenverzekering",
  routePath: "/individuals/family/pet-insurance",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Dierenverzekering",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
