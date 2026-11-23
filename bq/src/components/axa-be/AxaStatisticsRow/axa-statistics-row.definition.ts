import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const statisticsRowDefinition = {
  kind: "component",
  definitionKey: "axa-statistics-row",
  name: "axa-statistics-row",
  displayName: "Statistics Row",
  componentName: "AxaStatisticsRow",
  icon: "Office/32x32/printer_network.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Statistics Rows"],
  },
  model: {
    folderTemplate: {
      name: "Statistics Row Folder",
      displayName: "Statistics Rows",
    },
    itemTemplate: {
      name: "Statistics Row",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Value", type: "Single-Line Text" },
            { name: "Label", type: "Single-Line Text" },
            { name: "Description", type: "Rich Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Statistics Rows"] },
    culture: "nl-BE",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Global Network Metric 1",
        displayName: "105 miljoen",
        fields: {
          Value: "105 miljoen",
          Label: "Klanten wereldwijd",
          Description: "<p>die op ons vertrouwen</p>",
        },
      },
      {
        name: "Global Network Metric 2",
        displayName: "54",
        fields: {
          Value: "54",
          Label: "Landen",
          Description: "<p>waar we onze producten verdelen en diensten leveren</p>",
        },
      },
      {
        name: "Global Network Metric 3",
        displayName: "120 000",
        fields: {
          Value: "120 000",
          Label: "Medewerkers",
          Description: "<p>zetten zich dagelijks in voor onze klanten</p>",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
