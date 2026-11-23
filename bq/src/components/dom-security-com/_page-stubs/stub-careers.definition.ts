import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /en/carrieres → /careers */
export const stubCareers = {
  kind: "page-stub",
  definitionKey: "stub-careers",
  name: "Careers",
  routePath: "/careers",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Careers",
  culture: "be",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
