import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityNewsTeaserDefinition = {
  kind: "component",
  definitionKey: "dom-security-news-teaser",
  name: "dom-security-news-teaser",
  displayName: "Dom Security News Teaser",
  componentName: "DomSecurityNewsTeaser",
  icon: "Office/32x32/table.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Dom Security News Teasers"] },
  model: {
    folderTemplate: { name: "Dom Security News Teaser Folder", displayName: "Dom Security News Teasers" },
    itemTemplate: {
      name: "Dom Security News Teaser",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
              { name: "Title", type: "Single-Line Text" },
              { name: "Image", type: "Image" },
              { name: "Link", type: "General Link" },
            ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    location: { root: "data", folder: ["Dom Security News Teasers"] },
    items: [
      {
        name: "News",
        displayName: "BE - Tapkey Tapkey Event",
        fields: {
          Title: "BE - Tapkey Tapkey Event",
          Link: { text: "News 24 May 2024 BE - Tapkey Tapkey Event", url: "/be/en/newsroom/local-news/be---tapkey-tapkey-event" }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
