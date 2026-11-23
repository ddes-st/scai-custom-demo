import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/pensioen → /individuals/pension */
export const stubIndividualsPension = {
  kind: "page-stub",
  definitionKey: "stub-individuals-pension",
  name: "Pensioen",
  routePath: "/individuals/pension",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Pensioen",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
