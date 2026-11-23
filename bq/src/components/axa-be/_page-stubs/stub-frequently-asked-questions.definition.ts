import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /veelgestelde-vragen → /frequently-asked-questions */
export const stubFrequentlyAskedQuestions = {
  kind: "page-stub",
  definitionKey: "stub-frequently-asked-questions",
  name: "FAQ",
  routePath: "/frequently-asked-questions",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "FAQ",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
