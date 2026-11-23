import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/reis */
export const stubParticulierenReis = {
  kind: "page-stub",
  definitionKey: "stub-particulieren-reis",
  name: "Travel",
  routePath: "/individuals/travel",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Reis",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
