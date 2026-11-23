import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const newsTeasersDefinition = {
  kind: "component",
  definitionKey: "dom-security-news-teasers",
  name: "dom-security-news-teasers",
  displayName: "News Teasers",
  componentName: "DomSecurityNewsTeasers",
  icon: "Office/32x32/hand_count_three.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    // Section chrome only — article teasers live under News Teasers (shared with newsroom).
    folder: ["News Teaser Sections"],
  },
  model: {
    folderTemplate: {
      name: "News Teaser Sections Folder",
    },
    itemTemplate: {
      name: "News Teasers",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "More Link", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "news-teasers",
      // Shared news items (same datasources as newsroom DomSecurityNewsGrid).
      allowedControls: ["dom-security-news-teaser", "dom-security-news-teaser-card"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["News Teaser Sections"],
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Latest News",
        displayName: "BE - Tapkey Tapkey Event",
        renderingIdentifier: "latestnews",
        fields: {
          Heading: "Latest news",
          "More Link": { text: "See more news", url: "https://www.dom-security.com/be/en/newsroom" }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
