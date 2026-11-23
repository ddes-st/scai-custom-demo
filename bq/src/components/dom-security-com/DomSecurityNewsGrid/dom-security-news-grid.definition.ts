import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityNewsGridDefinition = {
  kind: "component",
  definitionKey: "dom-security-news-grid",
  name: "dom-security-news-grid",
  displayName: "Dom Security News Grid",
  componentName: "DomSecurityNewsGrid",
  icon: "Office/32x32/table.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Dom Security News Grids"] },
  model: {
    folderTemplate: { name: "Dom Security News Grid Folder", displayName: "Dom Security News Grids" },
    itemTemplate: {
      name: "Dom Security News Grid",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [{ name: "Title", type: "Single-Line Text" }],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [{ key: "news-grid", allowedControls: ["dom-security-news-teaser"] }],
  content: {
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    location: { root: "data", folder: ["Dom Security News Grids"] },
    items: [
      {
        name: "News",
        displayName: "BE - Tapkey Tapkey Event",
        fields: {
          Title: "BE - Tapkey Tapkey Event"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
