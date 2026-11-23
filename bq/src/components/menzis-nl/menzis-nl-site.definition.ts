import type { SiteDefinition } from "../../../tools/definitions/types";

/** Auto-created by create:sectioncomponents for https://www.menzis.nl/ */
export const menzisNlSite = {
  kind: "site",
  definitionKey: "menzis-nl-site",
  name: "Menzis Netherlands",
  systemName: "menzis-nl",
  description: "Menzis’s web presence for the Dutch market.",
  descriptionSource: "ai",
  collectionSystem: "menzis",
  api: {
    languages: ["en","nl-NL"],
  },
  thumbnail: {"path":"screenshots/desktop-clean.png"},
} satisfies SiteDefinition;
