import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const sustainabilityPillarCardsDefinition = {
  kind: "component",
  definitionKey: "axa-sustainability-pillar-cards",
  name: "axa-sustainability-pillar-cards",
  displayName: "Sustainability Pillar Cards",
  componentName: "AxaSustainabilityPillarCards",
  icon: "Office/32x32/id_cards.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Sustainability Pillar Cards"] },
  model: {
    folderTemplate: { name: "Sustainability Pillar Cards Folder" },
    itemTemplate: {
      name: "Sustainability Pillar Cards",
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
      key: "sustainability-pillars",
      allowedControls: ["axa-sustainability-pillar-card"],
    },
  ],
  content: {
    location: { root: "data", folder: ["Sustainability Pillar Cards"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Sustainability Pillar Cards",
        displayName: "Duurzaam ondernemen staat centraal in onze visie!",
        fields: {
          Heading: "Duurzaam ondernemen staat centraal in onze visie!",
          Subtitle: "Onze inspanningen komen tot uiting in deze 3 pijlers",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
