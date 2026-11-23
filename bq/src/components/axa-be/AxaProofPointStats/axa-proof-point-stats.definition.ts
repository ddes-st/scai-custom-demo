import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const proofPointStatsDefinition = {
  kind: "component",
  definitionKey: "axa-proof-point-stats",
  name: "axa-proof-point-stats",
  displayName: "Proof Point Stats",
  componentName: "AxaProofPointStats",
  icon: "Office/32x32/layout_northeast.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Proof Point Stats"],
  },
  model: {
    folderTemplate: {
      name: "Proof Point Stats Folder",
    },
    itemTemplate: {
      name: "Proof Point Stats",
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
      key: "proof-point-stats-items",
      allowedControls: ["axa-proof-point-stat"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Proof Point Stats"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Proof Point Stats",
        displayName: "Waarom voor AXA Belgium kiezen?",
        fields: {
          Heading: "Waarom voor AXA Belgium kiezen?",
          Subtitle: "Enkele goede redenen"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
