import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const globalStatisticDefinition = {
  kind: "component",
  definitionKey: "axa-global-statistic",
  name: "axa-global-statistic",
  displayName: "Global Statistic",
  componentName: "AxaGlobalStatistic",
  icon: "Office/32x32/cloud_network.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Global Statistics"],
  },
  model: {
    folderTemplate: {
      name: "Global Statistic Folder",
    },
    itemTemplate: {
      name: "Global Statistic",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Number", type: "Single-Line Text" },
            { name: "Unit", type: "Single-Line Text" },
            { name: "Title", type: "Single-Line Text" },
            { name: "Description", type: "Single-Line Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: {
      root: "data",
      folder: ["Global Statistics"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Worldwide Customers",
        displayName: "Klanten wereldwijd",
        fields: {
          Number: "105",
          Unit: "miljoen",
          Title: "Klanten wereldwijd",
          Description: "die op ons vertrouwen"
        },
      },
      {
        name: "Countries",
        displayName: "Landen",
        fields: {
          Number: "54",
          Title: "Landen",
          Description: "waar we onze producten verdelen en diensten leveren"
        },
      },
      {
        name: "Employees",
        displayName: "Medewerkers",
        fields: {
          Number: "120 000",
          Title: "Medewerkers",
          Description: "zetten zich dagelijks in voor onze klanten"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
