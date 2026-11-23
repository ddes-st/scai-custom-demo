import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /particulieren/gezondheid/arbeidsongeschiktheid → /individuals/health/incapacity-for-work */
export const stubIndividualsHealthIncapacityForWork = {
  kind: "page-stub",
  definitionKey: "stub-individuals-health-incapacity-for-work",
  name: "Arbeidsongeschiktheid",
  routePath: "/individuals/health/incapacity-for-work",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Arbeidsongeschiktheid",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
