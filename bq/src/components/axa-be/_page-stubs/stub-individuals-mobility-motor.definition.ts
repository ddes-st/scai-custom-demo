import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/mobiliteit/motor → /individuals/mobility/motor */
export const stubIndividualsMobilityMotor = {
  kind: "page-stub",
  definitionKey: "stub-individuals-mobility-motor",
  name: "Motorverzekering",
  routePath: "/individuals/mobility/motor",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Motorverzekering",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
