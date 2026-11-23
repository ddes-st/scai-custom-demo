import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/gezin/familiale-verzekering → /individuals/family/family-insurance */
export const stubIndividualsFamilyFamilyInsurance = {
  kind: "page-stub",
  definitionKey: "stub-individuals-family-family-insurance",
  name: "Familiale",
  routePath: "/individuals/family/family-insurance",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Familiale",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
