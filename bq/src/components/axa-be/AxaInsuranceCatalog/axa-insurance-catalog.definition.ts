import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const insuranceCatalogDefinition = {
  kind: "component",
  definitionKey: "axa-insurance-catalog",
  name: "axa-insurance-catalog",
  displayName: "Insurance Catalog",
  componentName: "AxaInsuranceCatalog",
  icon: "Office/32x32/shopping_cart_full.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Insurance Catalogs"],
  },
  model: {
    folderTemplate: {
      name: "Insurance Catalog Folder",
    },
    itemTemplate: {
      name: "Insurance Catalog",
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
      key: "insurance-categories",
      allowedControls: ["axa-insurance-category"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Insurance Catalogs"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Insurance Catalog",
        displayName: "Alle verzekeringen",
        fields: {
          Heading: "Alle verzekeringen"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
