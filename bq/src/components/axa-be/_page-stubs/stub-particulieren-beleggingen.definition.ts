import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/beleggingen */
export const stubParticulierenBeleggingen = {
  kind: "page-stub",
  definitionKey: "stub-particulieren-beleggingen",
  name: "Investments",
  routePath: "/individuals/investments",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Beleggingen",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
