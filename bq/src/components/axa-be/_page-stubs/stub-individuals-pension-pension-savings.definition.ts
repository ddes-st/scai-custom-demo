import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/pensioen/pensioensparen → /individuals/pension/pension-savings */
export const stubIndividualsPensionPensionSavings = {
  kind: "page-stub",
  definitionKey: "stub-individuals-pension-pension-savings",
  name: "Pensioensparen",
  routePath: "/individuals/pension/pension-savings",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Pensioensparen",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
