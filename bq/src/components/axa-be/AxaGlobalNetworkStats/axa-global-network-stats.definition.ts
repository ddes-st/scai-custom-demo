import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const globalNetworkStatsDefinition = {
  kind: "component",
  definitionKey: "axa-global-network-stats",
  name: "axa-global-network-stats",
  displayName: "Global Network Stats",
  componentName: "AxaGlobalNetworkStats",
  icon: "Office/32x32/cloud_network.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Global Network Stats"],
  },
  model: {
    folderTemplate: {
      name: "Global Network Stats Folder",
    },
    itemTemplate: {
      name: "Global Network Stats",
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
      key: "global-network-stats",
      allowedControls: ["axa-global-statistic"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Global Network Stats"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Global Network Stats",
        displayName: "We maken deel uit van een globaal netwerk",
        fields: {
          Heading: "We maken deel uit van een globaal netwerk",
          Subtitle: "Enkele cijfers waarop we best trots zijn"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
