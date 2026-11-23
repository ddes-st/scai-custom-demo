import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const insuranceCategoryGridDefinition = {
  kind: "component",
  definitionKey: "axa-insurance-category-grid",
  name: "axa-insurance-category-grid",
  displayName: "Insurance Category Grid",
  componentName: "AxaInsuranceCategoryGrid",
  icon: "Office/32x32/shopping_cart_full.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Insurance Category Grids"] },
  model: {
    folderTemplate: { name: "Insurance Category Grid Folder" },
    itemTemplate: {
      name: "Insurance Category Grid",
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
      key: "insurance-category-grid",
      allowedControls: ["axa-insurance-category-card"],
    },
  ],
  content: {
    location: { root: "data", folder: ["Insurance Category Grids"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Insurance Category Grid",
        displayName: "Insurance Category Grid",
        fields: {},
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
