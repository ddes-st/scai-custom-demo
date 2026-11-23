import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const insuranceCategoryGridItemDefinition = {
  kind: "component",
  definitionKey: "axa-insurance-category-grid-item",
  name: "axa-insurance-category-grid-item",
  displayName: "Insurance Category Grid Item",
  componentName: "AxaInsuranceCategoryGridItem",
  icon: "Office/32x32/shopping_cart_full.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Insurance Category Grid Items"] },
  model: {
    folderTemplate: { name: "Insurance Category Grid Item Folder" },
    itemTemplate: {
      name: "Insurance Category Grid Item",
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
    cultures: ["nl-BE","fr-BE"],
    location: { root: "data", folder: ["Insurance Category Grid Items"] },
    items: [
      {
        name: "Home InsuranceCategoryGridItem",
        fields: {
          Title: "InsuranceCategoryGridItem",
          Link: { text: "InsuranceCategoryGridItem", url: "/" },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
