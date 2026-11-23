import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const pillarCardSliderItemDefinition = {
  kind: "component",
  definitionKey: "axa-pillar-card-slider-item",
  name: "axa-pillar-card-slider-item",
  displayName: "PillarCardSliderItem",
  componentName: "AxaPillarCardSliderItem",
  icon: "Office/32x32/id_cards.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Pillar Card Slider Items"] },
  model: {
    folderTemplate: { name: "PillarCardSliderItem Folder" },
    itemTemplate: {
      name: "PillarCardSliderItem",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
              { name: "Title", type: "Single-Line Text" },
              { name: "Image", type: "Image" },
              { name: "Link", type: "General Link" },
            ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Pillar Card Slider Items"] },
    items: [
      {
        name: "Home PillarCardSliderItem",
        fields: {
          Title: "PillarCardSliderItem",
          Link: { text: "PillarCardSliderItem", url: "/" },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
