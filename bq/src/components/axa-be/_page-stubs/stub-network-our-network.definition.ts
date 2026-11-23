import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /netwerk/ons-netwerk → /network/our-network */
export const stubNetworkOurNetwork = {
  kind: "page-stub",
  definitionKey: "stub-network-our-network",
  name: "Ons netwerk",
  routePath: "/network/our-network",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Ons netwerk",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
