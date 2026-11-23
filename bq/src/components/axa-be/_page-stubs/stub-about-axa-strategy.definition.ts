import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /over-axa/strategy → /about-axa/strategy */
export const stubAboutAxaStrategy = {
  kind: "page-stub",
  definitionKey: "stub-about-axa-strategy",
  name: "Lees meer",
  routePath: "/about-axa/strategy",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Lees meer",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
