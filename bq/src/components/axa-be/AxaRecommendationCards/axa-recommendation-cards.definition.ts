import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const recommendationCardsDefinition = {
  kind: "component",
  definitionKey: "axa-recommendation-cards",
  name: "axa-recommendation-cards",
  displayName: "Recommendation Cards",
  componentName: "AxaRecommendationCards",
  icon: "Office/32x32/id_cards.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Recommendation Cards"],
  },
  model: {
    folderTemplate: {
      name: "Recommendation Cards Folder",
    },
    itemTemplate: {
      name: "Recommendation Cards",
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
      allowedControls: ["axa-recommendation-card"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Recommendation Cards"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Recommendation Cards",
        displayName: "Interessant voor jou",
        fields: {
          Heading: "Interessant voor jou"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
