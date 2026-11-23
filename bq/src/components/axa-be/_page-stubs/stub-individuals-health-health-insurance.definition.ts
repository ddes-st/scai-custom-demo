import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/gezondheid/gezondheidsverzekering → /individuals/health/health-insurance */
export const stubIndividualsHealthHealthInsurance = {
  kind: "page-stub",
  definitionKey: "stub-individuals-health-health-insurance",
  name: "Gezondheidsverzekering",
  routePath: "/individuals/health/health-insurance",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Gezondheidsverzekering",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
