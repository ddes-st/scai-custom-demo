import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /netwerk/vind-je-makelaar → /network/find-your-real-estate-agent */
export const stubNetworkFindYourRealEstateAgent = {
  kind: "page-stub",
  definitionKey: "stub-network-find-your-real-estate-agent",
  name: "Vind je makelaar",
  routePath: "/network/find-your-real-estate-agent",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Vind je makelaar",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
