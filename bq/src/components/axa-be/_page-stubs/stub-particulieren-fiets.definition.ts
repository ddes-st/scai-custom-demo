import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/fiets */
export const stubParticulierenFiets = {
  kind: "page-stub",
  definitionKey: "stub-particulieren-fiets",
  name: "E-Bikes E-Scooters And Co",
  routePath: "/individuals/bicycle",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "(e-)Fietsen, e-steps en co",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
