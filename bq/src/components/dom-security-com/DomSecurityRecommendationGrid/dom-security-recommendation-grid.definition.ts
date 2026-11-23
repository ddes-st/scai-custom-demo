import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const recommendationGridDefinition = {
  kind: "component",
  definitionKey: "dom-security-recommendation-grid",
  name: "dom-security-recommendation-grid",
  displayName: "Recommendation Grid",
  componentName: "DomSecurityRecommendationGrid",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Recommendation Grids"],
  },
  model: {
    folderTemplate: { name: "Recommendation Grid Folder" },
    itemTemplate: {
      name: "Recommendation Grid",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [{ name: "Heading", type: "Single-Line Text" }],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "recommendation-cards",
      allowedControls: ["dom-security-recommendation-card"],
    },
  ],
  content: {
    location: { root: "data", folder: ["Recommendation Grids"] },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Product Recommendations",
        displayName: "Our product recommendations",
        fields: {
          Heading: "Our product recommendations"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
