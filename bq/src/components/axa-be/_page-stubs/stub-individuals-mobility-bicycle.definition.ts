import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/mobiliteit/fiets → /individuals/mobility/bicycle */
export const stubIndividualsMobilityBicycle = {
  kind: "page-stub",
  definitionKey: "stub-individuals-mobility-bicycle",
  name: "(e-)Fietsen, e-steps en co",
  routePath: "/individuals/mobility/bicycle",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "(e-)Fietsen, e-steps en co",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
