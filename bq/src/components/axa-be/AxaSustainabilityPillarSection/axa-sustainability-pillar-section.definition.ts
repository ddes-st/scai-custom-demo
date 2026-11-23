import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const sustainabilityPillarSectionDefinition = {
  kind: "component",
  definitionKey: "axa-sustainability-pillar-section",
  name: "axa-sustainability-pillar-section",
  displayName: "Sustainability Pillar Section",
  componentName: "AxaSustainabilityPillarSection",
  icon: "Office/32x32/id_cards.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Sustainability Pillar Sections"],
  },
  model: {
    folderTemplate: { name: "Sustainability Pillar Section Folder" },
    itemTemplate: {
      name: "Sustainability Pillar Section",
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
      key: "sustainability-pillar-cards",
      allowedControls: ["axa-sustainability-pillar-card"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Sustainability Pillar Sections"],
    },
    items: [
      {
        name: "Sustainability Pillars",
        fields: {
          Heading: "Sustainable entrepreneurship is central to our vision!",
          Subtitle: "Our efforts are reflected in these 3 pillars",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
