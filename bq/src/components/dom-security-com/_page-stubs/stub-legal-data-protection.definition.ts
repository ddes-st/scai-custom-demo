import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /en/legal/data-protection → /legal/data-protection */
export const stubLegalDataProtection = {
  kind: "page-stub",
  definitionKey: "stub-legal-data-protection",
  name: "Data Protection",
  routePath: "/legal/data-protection",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Data Protection",
  culture: "be",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
