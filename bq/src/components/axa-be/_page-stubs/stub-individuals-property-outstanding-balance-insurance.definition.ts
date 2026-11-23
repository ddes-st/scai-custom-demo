import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/woning/schuldsaldoverzekering → /individuals/property/outstanding-balance-insurance */
export const stubIndividualsPropertyOutstandingBalanceInsurance = {
  kind: "page-stub",
  definitionKey: "stub-individuals-property-outstanding-balance-insurance",
  name: "Schuldsaldoverzekering",
  routePath: "/individuals/property/outstanding-balance-insurance",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Schuldsaldoverzekering",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
