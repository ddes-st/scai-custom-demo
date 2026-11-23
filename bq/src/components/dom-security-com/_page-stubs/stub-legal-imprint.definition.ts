import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /en/legal/imprint → /legal/imprint */
export const stubLegalImprint = {
  kind: "page-stub",
  definitionKey: "stub-legal-imprint",
  name: "Imprint",
  routePath: "/legal/imprint",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Imprint",
  culture: "be",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
