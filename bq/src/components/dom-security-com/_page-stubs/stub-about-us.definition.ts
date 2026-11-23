import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /en/about-us → /about-us */
export const stubAboutUs = {
  kind: "page-stub",
  definitionKey: "stub-about-us",
  name: "About us",
  routePath: "/about-us",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "About us",
  culture: "be",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
