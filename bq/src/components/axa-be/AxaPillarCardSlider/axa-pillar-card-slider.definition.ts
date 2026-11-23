import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const pillarCardSliderDefinition = {
  kind: "component",
  definitionKey: "axa-pillar-card-slider",
  name: "axa-pillar-card-slider",
  displayName: "Pillar Card Slider",
  componentName: "AxaPillarCardSlider",
  icon: "Office/32x32/id_cards.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Pillar Card Sliders"],
  },
  model: {
    folderTemplate: {
      name: "Pillar Card Slider Folder",
    },
    itemTemplate: {
      name: "Pillar Card Slider",
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
      key: "pillar-cards",
      allowedControls: ["axa-pillar-card"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Pillar Card Sliders"],
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
