import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /en/legal/terms-and-conditions → /legal/terms-and-conditions */
export const stubLegalTermsAndConditions = {
  kind: "page-stub",
  definitionKey: "stub-legal-terms-and-conditions",
  name: "Terms and conditions",
  routePath: "/legal/terms-and-conditions",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Terms and conditions",
  culture: "be",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
