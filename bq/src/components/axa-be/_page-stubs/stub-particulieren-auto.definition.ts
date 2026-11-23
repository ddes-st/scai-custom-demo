import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/auto */
export const stubParticulierenAuto = {
  kind: "page-stub",
  definitionKey: "stub-particulieren-auto",
  name: "Car",
  routePath: "/individuals/car",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Auto",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
