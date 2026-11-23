import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/gezondheid/arbeidsongevallen → /individuals/health/occupational-accidents */
export const stubIndividualsHealthOccupationalAccidents = {
  kind: "page-stub",
  definitionKey: "stub-individuals-health-occupational-accidents",
  name: "Arbeidsongevallen",
  routePath: "/individuals/health/occupational-accidents",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Arbeidsongevallen",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
