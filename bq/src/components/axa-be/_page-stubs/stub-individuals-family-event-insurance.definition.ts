import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/gezin/evenementenverzekering → /individuals/family/event-insurance */
export const stubIndividualsFamilyEventInsurance = {
  kind: "page-stub",
  definitionKey: "stub-individuals-family-event-insurance",
  name: "Evenementenverzekering",
  routePath: "/individuals/family/event-insurance",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Evenementenverzekering",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
