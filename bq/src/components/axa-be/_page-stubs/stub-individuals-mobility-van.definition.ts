import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/mobiliteit/bestelwagen → /individuals/mobility/van */
export const stubIndividualsMobilityVan = {
  kind: "page-stub",
  definitionKey: "stub-individuals-mobility-van",
  name: "Bestelwagen",
  routePath: "/individuals/mobility/van",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Bestelwagen",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
