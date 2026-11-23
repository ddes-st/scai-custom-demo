import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const trustMetricsDefinition = {
  kind: "component",
  definitionKey: "axa-trust-metrics",
  name: "axa-trust-metrics",
  displayName: "Trust Metrics",
  componentName: "AxaTrustMetrics",
  icon: "Office/32x32/standby.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Trust Metrics"] },
  model: {
    folderTemplate: { name: "Trust Metrics Folder" },
    itemTemplate: {
      name: "Trust Metrics",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Subtitle", type: "Single-Line Text" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [{ key: "trust-metrics", allowedControls: ["axa-trust-metric"] }],
  content: {
    location: { root: "data", folder: ["Trust Metrics"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Trust Metrics",
        displayName: "Waarom voor AXA Belgium kiezen?",
        fields: {
          Heading: "Waarom voor AXA Belgium kiezen?",
          Subtitle: "Enkele goede redenen"
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
