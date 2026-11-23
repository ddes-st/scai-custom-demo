import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisSupportCardsBandDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-support-cards-band',
  name: 'menzis-support-cards-band',
  componentName: 'MenzisSupportCardsBand',
  displayName: 'Support Cards Band',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Support Cards Bands'] },
  model: {
    folderTemplate: { name: 'Support Cards Band Folder' },
    itemTemplate: {
      name: 'Support Cards Band',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Heading', type: 'Single-Line Text' },
            { name: 'Tone', type: 'Single-Line Text' },
          ],
        },
      ],
    },
    childItemTemplate: {
      name: 'Link',
      sections: [{ name: 'Content', fields: [{ name: 'Link', type: 'General Link' }] }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Support Cards Bands'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Support Cards',
        fields: { Heading: 'We helpen je graag verder', Tone: 'mint' },
        children: [
          {
            name: 'Declaration',
            fields: {
              Link: {
                text: 'Declaratie indienen',
                url: 'https://www.menzis.nl/mijn/geldzaken/declaraties/declaratie-indienen',
              },
            },
          },
          {
            name: 'Changes',
            fields: {
              Link: {
                text: 'Wijzigingen doorgeven',
                url: 'https://www.menzis.nl/klantenservice/wijziging-doorgeven',
              },
            },
          },
          {
            name: 'Care Use',
            fields: {
              Link: {
                text: 'Mijn zorggebruik bekijken',
                url: 'https://www.menzis.nl/mijn/mijnzorggebruik',
              },
            },
          },
          {
            name: 'Care Finder',
            fields: {
              Link: {
                text: 'De Zorgvinder',
                url: 'https://www.menzis.nl/zorg-en-vergoedingen/de-zorgvinder',
              },
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
