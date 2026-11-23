import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /personeel-axa → /axa-staff */
export const stubAxaStaff = {
  kind: "page-stub",
  definitionKey: "stub-axa-staff",
  name: "AXA Personeel",
  routePath: "/axa-staff",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "AXA Personeel",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
