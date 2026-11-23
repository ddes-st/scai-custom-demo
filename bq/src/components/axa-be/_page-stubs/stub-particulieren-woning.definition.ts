import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/woning */
export const stubParticulierenWoning = {
  kind: "page-stub",
  definitionKey: "stub-particulieren-woning",
  name: "Home",
  routePath: "/individuals/property",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Woning",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
