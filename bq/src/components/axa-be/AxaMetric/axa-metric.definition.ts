import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const metricDefinition = {
  kind: "component",
  definitionKey: "axa-metric",
  name: "axa-metric",
  displayName: "Metric",
  componentName: "AxaMetric",
  icon: "Office/32x32/standby.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Metrics"] },
  model: {
    folderTemplate: { name: "Metric Folder" },
    itemTemplate: {
      name: "Metric",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Value", type: "Single-Line Text" },
            { name: "Label", type: "Single-Line Text" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Metrics"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Loyal Customers",
        displayName: "Trouwe klanten",
        fields: {
          Value: "3 miljoen",
          Label: "Trouwe klanten"
        }
      },
      {
        name: "Brokers By Your Side",
        displayName: "Makelaars aan je zijde",
        fields: {
          Value: "3 200",
          Label: "Makelaars aan je zijde"
        }
      },
      {
        name: "Engaged Employees",
        displayName: "Geëngageerde medewerkers",
        fields: {
          Value: "3 000",
          Label: "Geëngageerde medewerkers"
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
