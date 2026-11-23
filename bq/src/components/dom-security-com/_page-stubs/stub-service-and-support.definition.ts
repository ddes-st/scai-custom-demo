import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /en/service-and-support → /service-and-support */
export const stubServiceAndSupport = {
  kind: "page-stub",
  definitionKey: "stub-service-and-support",
  name: "Service & Support",
  routePath: "/service-and-support",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Service & Support",
  culture: "be",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
