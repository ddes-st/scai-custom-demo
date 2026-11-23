import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/pensioen/groepsverzekering-medewerkers → /individuals/pension/employee-group-insurance */
export const stubIndividualsPensionEmployeeGroupInsurance = {
  kind: "page-stub",
  definitionKey: "stub-individuals-pension-employee-group-insurance",
  name: "Groepsverzekering",
  routePath: "/individuals/pension/employee-group-insurance",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Groepsverzekering",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
