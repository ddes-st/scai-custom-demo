import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

/**
 * Thin homepage card rendering — shares DomSecurityNewsTeaser datasources
 * (Data/News Teasers). Prefer wiring `dom-security-news-teaser` directly;
 * this component remains for backwards-compatible placements.
 */
export const newsTeaserCardDefinition = {
  kind: "component",
  definitionKey: "dom-security-news-teaser-card",
  name: "dom-security-news-teaser-card",
  displayName: "News Teaser Card",
  componentName: "DomSecurityNewsTeaserCard",
  icon: "Office/32x32/hand_count_three.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["News Teasers"],
  },
  datasourceTemplate:
    "/sitecore/templates/Project/domsecurity/DomSecurityNewsTeaser/News Teaser",
  model: {
    folderTemplate: { name: "News Teaser Card Folder" },
    itemTemplate: {
      name: "News Teaser Card",
      sections: [],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
} satisfies ComponentTemplateDefinition;
