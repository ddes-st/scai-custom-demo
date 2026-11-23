import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisCookieOptionDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-cookie-option',
  name: 'menzis-cookie-option',
  componentName: 'MenzisCookieOption',
  displayName: 'Cookie Option',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Cookie Options'] },
  model: {
    folderTemplate: { name: 'Cookie Option Folder' },
    itemTemplate: {
      name: 'Cookie Option',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Label', type: 'Single-Line Text' },
            { name: 'Description', type: 'Multi-Line Text' },
            { name: 'Value', type: 'Single-Line Text' },
            { name: 'Selected', type: 'Checkbox' },
          ],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Cookie Options'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Functionele cookie',
        fields: {
          Label: 'Functionele cookie',
          Description: 'U geeft hiermee toestemming voor het plaatsen van functionele cookies.',
          Value: '1',
          Selected: true,
        },
      },
      {
        name: 'Analytische cookies',
        fields: {
          Label: 'Analytische cookies',
          Description:
            'U geeft hiermee toestemming voor het plaatsen van analytische cookies en functionele cookies.',
          Value: '2',
          Selected: false,
        },
      },
      {
        name: 'Marktonderzoek',
        fields: {
          Label: 'Marktonderzoek',
          Description:
            'U geeft hiermee toestemming voor het plaatsen van cookies voor marktonderzoek, analytische cookies en functionele cookies.',
          Value: '3',
          Selected: false,
        },
      },
      {
        name: 'Overige marketing cookies',
        fields: {
          Label: 'Overige (marketing) cookies',
          Description:
            'U geeft hiermee toestemming voor het plaatsen van alle soorten cookies (functionele, analytische, marktonderzoek, marketing en overige cookies).',
          Value: '4',
          Selected: true,
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
