import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/verzekeringen */
export const stubParticulierenVerzekeringen = {
  kind: "page-stub",
  definitionKey: "stub-particulieren-verzekeringen",
  name: "View All Our Products",
  routePath: "/individuals/insurance",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Bekijk al onze producten",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
