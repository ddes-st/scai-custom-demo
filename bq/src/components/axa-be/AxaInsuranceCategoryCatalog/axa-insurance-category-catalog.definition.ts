import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const insuranceCategoryCatalogDefinition = {
  kind: "component",
  definitionKey: "axa-insurance-category-catalog",
  name: "axa-insurance-category-catalog",
  displayName: "Insurance Category Catalog",
  componentName: "AxaInsuranceCategoryCatalog",
  icon: "Office/32x32/table_selection_all.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Insurance Category Catalog"],
  },
  model: {
    folderTemplate: {
      name: "Insurance Category Catalog Folder",
    },
    itemTemplate: {
      name: "Insurance Category Catalog",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "insurance-category-catalog",
      allowedControls: ["axa-insurance-category"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Insurance Category Catalog"],
    },
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Alle Verzekeringen",
        fields: {
          Heading: "All insurance",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
