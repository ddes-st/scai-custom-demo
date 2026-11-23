import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisFooterHelpBandDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-footer-help-band',
  name: 'menzis-footer-help-band',
  componentName: 'MenzisFooterHelpBand',
  displayName: 'Footer Help Band',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Footer Help Bands'] },
  model: {
    folderTemplate: { name: 'Footer Help Band Folder' },
    itemTemplate: {
      name: 'Footer Help Band',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Heading', type: 'Single-Line Text' },
            { name: 'Body', type: 'Rich Text' },
            { name: 'CTA', type: 'General Link' },
            { name: 'Pebble Line', type: 'Image' },
          ],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Footer Help Bands'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Help Band',
        fields: {
          Heading: 'Wij helpen je graag verder',
          Body: '<p>We helpen je met je zorgverzekering, het kiezen van een zorgaanbieder of wachtlijstbemiddeling. Stel je vraag aan onze chatbot Sarah of</p>',
          CTA: {
            text: 'bekijk onze contactmogelijkheden',
            url: 'https://www.menzis.nl/klantenservice',
          },
          'Pebble Line': {
            url: 'https://www.menzis.nl/Resources/Foundation/Branding/content/images/menzis/foot-pebble-line.svg',
            alt: '',
          },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
