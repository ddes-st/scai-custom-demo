import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisCookiePreferenceModalDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-cookie-preference-modal',
  name: 'menzis-cookie-preference-modal',
  componentName: 'MenzisCookiePreferenceModal',
  displayName: 'Cookie Preference Modal',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Cookie Preference Modals'] },
  model: {
    folderTemplate: { name: 'Cookie Preference Modal Folder' },
    itemTemplate: {
      name: 'Cookie Preference Modal',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Heading', type: 'Single-Line Text' },
            { name: 'Description', type: 'Multi-Line Text' },
            { name: 'Settings Label', type: 'Single-Line Text' },
            { name: 'Decline Label', type: 'Single-Line Text' },
            { name: 'Accept Label', type: 'Single-Line Text' },
            { name: 'Save Label', type: 'Single-Line Text' },
          ],
        },
      ],
    },
    childItemTemplate: {
      name: 'Cookie Option',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Label', type: 'Single-Line Text' },
            { name: 'Value', type: 'Single-Line Text' },
            { name: 'Help', type: 'Multi-Line Text' },
          ],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Cookie Preference Modals'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Cookie Preference Modal',
        fields: {
          Heading: 'Cookie instellingen',
          Description:
            'Bij Menzis onderscheiden we vier cookieniveaus. Je stelt hieronder zelf in welke cookies je accepteert. De instellingen kun je altijd wijzigen via onze cookiepolicy. Door het niet accepteren van cookies is jouw website-ervaring mogelijk niet optimaal.',
          'Settings Label': 'Instellingen',
          'Decline Label': 'Weigeren',
          'Accept Label': 'Accepteren',
          'Save Label': 'Instellingen opslaan',
        },
        children: [
          {
            name: 'Functional Cookies',
            fields: {
              Label: 'Functionele cookie',
              Value: '1',
              Help: 'U geeft hiermee toestemming voor het plaatsen van functionele cookies.',
            },
          },
          {
            name: 'Analytical Cookies',
            fields: {
              Label: 'Analytische cookies',
              Value: '2',
              Help: 'U geeft hiermee toestemming voor het plaatsen van analytische cookies en functionele cookies.',
            },
          },
          {
            name: 'Market Research Cookies',
            fields: {
              Label: 'Marktonderzoek',
              Value: '3',
              Help: 'U geeft hiermee toestemming voor het plaatsen van cookies voor marktonderzoek, analytische cookies en functionele cookies.',
            },
          },
          {
            name: 'Marketing Cookies',
            fields: {
              Label: 'Overige (marketing) cookies',
              Value: '4',
              Help: 'U geeft hiermee toestemming voor het plaatsen van alle soorten cookies (functionele, analytische, marktonderzoek, marketing en overige cookies)',
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
