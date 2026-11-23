import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /en/contact-us-old → /contact-us-old */
export const stubContactUsOld = {
  kind: "page-stub",
  definitionKey: "stub-contact-us-old",
  name: "Contact us",
  routePath: "/contact-us-old",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Contact us",
  culture: "be",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
