import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/woning/blokpolis → /individuals/property/block-policy */
export const stubIndividualsPropertyBlockPolicy = {
  kind: "page-stub",
  definitionKey: "stub-individuals-property-block-policy",
  name: "Blokpolis",
  routePath: "/individuals/property/block-policy",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Blokpolis",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
