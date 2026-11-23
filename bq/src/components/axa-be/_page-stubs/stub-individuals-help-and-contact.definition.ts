import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/help-en-contact → /individuals/help-and-contact */
export const stubIndividualsHelpAndContact = {
  kind: "page-stub",
  definitionKey: "stub-individuals-help-and-contact",
  name: "Help en contact",
  routePath: "/individuals/help-and-contact",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Help en contact",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
