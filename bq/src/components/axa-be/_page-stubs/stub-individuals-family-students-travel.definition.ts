import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/gezin/students-travel → /individuals/family/students-travel */
export const stubIndividualsFamilyStudentsTravel = {
  kind: "page-stub",
  definitionKey: "stub-individuals-family-students-travel",
  name: "Students Travel",
  routePath: "/individuals/family/students-travel",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Students Travel",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
