import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /digitale-toegankelijkheid → /digital-accessibility */
export const stubDigitalAccessibility = {
  kind: "page-stub",
  definitionKey: "stub-digital-accessibility",
  name: "Verklaring Accessibility",
  routePath: "/digital-accessibility",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Verklaring Accessibility",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
