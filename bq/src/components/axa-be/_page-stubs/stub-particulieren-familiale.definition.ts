import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/familiale */
export const stubParticulierenFamiliale = {
  kind: "page-stub",
  definitionKey: "stub-particulieren-familiale",
  name: "Family Liability",
  routePath: "/individuals/family-related",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Familiale",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
