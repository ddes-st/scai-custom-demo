import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const statisticsSummaryDefinition = {
  kind: "component",
  definitionKey: "axa-statistics-summary",
  name: "axa-statistics-summary",
  displayName: "Statistics Summary",
  componentName: "AxaStatisticsSummary",
  icon: "Office/32x32/printer_network.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Statistics Summaries"] },
  model: {
    folderTemplate: { name: "Statistics Summary Folder" },
    itemTemplate: {
      name: "Statistics Summary",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Value", type: "Single-Line Text" },
            { name: "Label", type: "Single-Line Text" },
            { name: "Description", type: "Single-Line Text" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Statistics Summaries"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Global Customers",
        displayName: "Klanten wereldwijd",
        fields: {
          Value: "105 miljoen",
          Label: "Klanten wereldwijd",
          Description: "die op ons vertrouwen"
        }
      },
      {
        name: "Countries",
        displayName: "Landen",
        fields: {
          Value: "54",
          Label: "Landen",
          Description: "waar we onze producten verdelen en diensten leveren"
        }
      },
      {
        name: "Employees",
        displayName: "Medewerkers",
        fields: {
          Value: "120 000",
          Label: "Medewerkers",
          Description: "zetten zich dagelijks in voor onze klanten"
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
