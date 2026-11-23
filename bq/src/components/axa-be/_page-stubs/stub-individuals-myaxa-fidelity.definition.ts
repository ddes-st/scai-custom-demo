import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/myaxa-fidelity → /individuals/myaxa-fidelity */
export const stubIndividualsMyaxaFidelity = {
  kind: "page-stub",
  definitionKey: "stub-individuals-myaxa-fidelity",
  name: "Ontdek MyAXA Fidelity",
  routePath: "/individuals/myaxa-fidelity",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Ontdek MyAXA Fidelity",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
