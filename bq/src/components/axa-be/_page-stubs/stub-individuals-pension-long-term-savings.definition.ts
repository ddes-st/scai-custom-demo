import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/pensioen/langetermijnsparen → /individuals/pension/long-term-savings */
export const stubIndividualsPensionLongTermSavings = {
  kind: "page-stub",
  definitionKey: "stub-individuals-pension-long-term-savings",
  name: "Langetermijnsparen",
  routePath: "/individuals/pension/long-term-savings",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Langetermijnsparen",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
