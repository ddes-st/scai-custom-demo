import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';

export const sustainabilityPillarContainerDefinition = {
  kind: 'component',
  definitionKey: "axa-sustainability-pillar-container",
  name: "axa-sustainability-pillar-container",
  displayName: 'Sustainability Pillar Container',
  componentName: "AxaSustainabilityPillarContainer",
  icon: "Office/32x32/hand_count_three.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Sustainability Pillar Containers'] },
  model: {
    folderTemplate: { name: 'Sustainability Pillar Container Folder' },
    itemTemplate: {
      name: 'Sustainability Pillar Container',
      sections: [
        {
          name: 'Data',
          sortOrder: 100,
          fields: [
            { name: 'Heading', type: 'Single-Line Text' },
            { name: 'Subtitle', type: 'Single-Line Text' },
          ],
        },
      ],
    },
  },
  variants: [{ name: 'Default' }],
  placeholders: [
    {
      key: 'sustainability-pillars',
      allowedControls: ["axa-sustainability-pillar-card"],
    },
  ],
  content: {
    location: { root: 'data', folder: ['Sustainability Pillar Containers'] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: 'Sustainability Pillars',
        displayName: "Duurzaam ondernemen staat centraal in onze visie!",
        fields: {
          Heading: "Duurzaam ondernemen staat centraal in onze visie!",
          Subtitle: "Onze inspanningen komen tot uiting in deze 3 pijlers",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
