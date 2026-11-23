import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /en/homeowners → /homeowners */
export const stubHomeowners = {
  kind: "page-stub",
  definitionKey: "stub-homeowners",
  name: "Are you looking for a new security solution for your home?",
  routePath: "/homeowners",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Are you looking for a new security solution for your home?",
  culture: "be",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
