import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /lexicon */
export const stubLexicon = {
  kind: "page-stub",
  definitionKey: "stub-lexicon",
  name: "Lexicon",
  routePath: "/lexicon",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Lexicon",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
