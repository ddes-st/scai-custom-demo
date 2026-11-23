import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisInformationBandDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-information-band',
  name: 'menzis-information-band',
  componentName: 'MenzisInformationBand',
  displayName: 'Information Band',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Information Bands'] },
  model: {
    folderTemplate: { name: 'Information Band Folder' },
    itemTemplate: {
      name: 'Information Band',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Heading', type: 'Single-Line Text' },
            { name: 'Body', type: 'Rich Text' },
            { name: 'CTA', type: 'General Link' },
          ],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Information Bands'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Care Budgets',
        fields: {
          Heading: 'Zorgplafonds, hoe zit het nu precies?',
          Body: "<p>In de media verschijnen regelmatig berichten over zorgplafonds (ook wel budget- of omzetplafonds genoemd). Voor Menzis geldt dat er bij alle <em>grote</em> aanbieders (‘systeemaanbieders') in de Geestelijke Gezondheidszorg (GGZ), wijkverpleging en bij de ziekenhuizen nooit een omzetplafond wordt afgesproken dat tot een patiëntenstop leidt. Dat betekent dat nieuwe cliënten met een complexe zorgvraag altijd in zorg kunnen komen.</p>",
          CTA: {
            text: 'Lees meer over zorgplafonds De link zal worden geopend op een nieuwe pagina.',
            url: 'https://www.menzis.nl/over-menzis/publicaties/zorgplafonds',
          },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
