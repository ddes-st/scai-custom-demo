import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const insuranceCategoryCardsDefinition = {
  kind: "component",
  definitionKey: "axa-insurance-category-cards",
  name: "axa-insurance-category-cards",
  displayName: "Insurance Category Cards",
  componentName: "AxaInsuranceCategoryCards",
  icon: "Office/32x32/credit_cards.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Insurance Category Cards"],
  },
  model: {
    folderTemplate: {
      name: "Insurance Category Cards Folder",
    },
    itemTemplate: {
      name: "Insurance Category Cards",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "insurance-categories",
      allowedControls: ["axa-insurance-category-card"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Insurance Category Cards"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Insurance Categories",
        displayName: "Insurance Category Cards",
        fields: {},
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
