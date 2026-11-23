import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/mobiliteit/auto → /individuals/mobility/car */
export const stubIndividualsMobilityCar = {
  kind: "page-stub",
  definitionKey: "stub-individuals-mobility-car",
  name: "Auto",
  routePath: "/individuals/mobility/car",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Auto",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
