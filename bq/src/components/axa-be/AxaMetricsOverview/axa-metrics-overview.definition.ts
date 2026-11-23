import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const metricsOverviewDefinition = {
  kind: "component",
  definitionKey: "axa-metrics-overview",
  name: "axa-metrics-overview",
  displayName: "Metrics Overview",
  componentName: "AxaMetricsOverview",
  icon: "Office/32x32/printer_network.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Metrics Overviews"],
  },
  model: {
    folderTemplate: {
      name: "Metrics Overview Folder",
    },
    itemTemplate: {
      name: "Metrics Overview",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Subtitle", type: "Single-Line Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "metrics",
      allowedControls: ["axa-metric"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Metrics Overviews"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Global Network Metrics",
        displayName: "We maken deel uit van een globaal netwerk",
        fields: {
          Heading: "We maken deel uit van een globaal netwerk",
          Subtitle: "Enkele cijfers waarop we best trots zijn",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
