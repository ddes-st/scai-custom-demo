import type { SiteDefinition } from "../../../tools/definitions/types";

/** Auto-created by create:sectioncomponents for https://www.axa.be/nl/particulieren */
export const axaBeSite = {
  kind: "site",
  definitionKey: "axa-be-site",
  name: "AXA Belgium",
  systemName: "axa-be",
  description: "AXA’s web presence for the Belgian market.",
  descriptionSource: "ai",
  collectionSystem: "axa",
  api: {
    languages: ["en", "nl-BE", "fr-BE"],
  },
} satisfies SiteDefinition;
