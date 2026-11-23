import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /jobs */
export const stubAxaBeJobs = {
  kind: "page-stub",
  definitionKey: "stub-axa-be-jobs",
  name: "Jobs",
  routePath: "/jobs",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Jobs",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
