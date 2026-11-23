import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /over-axa → /about-axa */
export const stubAboutAxa = {
  kind: "page-stub",
  definitionKey: "stub-about-axa",
  name: "Over AXA",
  routePath: "/about-axa",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Over AXA",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
