import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /pers → /press */
export const stubPress = {
  kind: "page-stub",
  definitionKey: "stub-press",
  name: "Pers",
  routePath: "/press",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Pers",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
