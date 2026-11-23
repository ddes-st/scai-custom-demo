import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisHealthCardsBandDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-health-cards-band',
  name: 'menzis-health-cards-band',
  componentName: 'MenzisHealthCardsBand',
  displayName: 'Health Cards Band',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Health Cards Bands'] },
  model: {
    folderTemplate: { name: 'Health Cards Band Folder' },
    itemTemplate: {
      name: 'Health Cards Band',
      sections: [{ name: 'Content', fields: [{ name: 'Heading', type: 'Single-Line Text' }] }],
    },
    childItemTemplate: {
      name: 'Health Card',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Title', type: 'Single-Line Text' },
            { name: 'Text', type: 'Rich Text' },
            { name: 'Image', type: 'Image' },
            { name: 'Link', type: 'General Link' },
            { name: 'CTA', type: 'General Link' },
          ],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Health Cards Bands'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'More Health',
        fields: { Heading: 'Meer gezondheid' },
        children: [
          {
            name: 'Sleep',
            fields: {
              Title: 'Kan het lekkerder? Slapen...',
              Text: '<p>Het lukt de ene beter dan de ander. Slapen. Stel je slaapt niet zo lekker. Hoe zorg je ervoor dat het (beter) lukt?</p>',
              Image: {
                url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/consument/beeldbank/actie-en-vrije-tijd/beweging/mensen-sporten-buiten-silhouette.jpg',
                alt: 'Mensen sporten buiten silhouette',
              },
              Link: { text: 'Sleep', url: 'https://www.menzis.nl/podcast/slimmereten' },
              CTA: {
                text: 'Lees of luister: Slaap',
                url: 'https://www.menzis.nl/podcast/lekker-slapen',
              },
            },
          },
          {
            name: 'Therapieland',
            fields: {
              Title: 'Zit je niet lekker in je vel?',
              Text: "<p>Met de online programma's van Therapieland krijg je oefeningen en praktische tips om zelf aan de slag te gaan. Gratis voor jou via de Menzis app.</p>",
              Image: {
                url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/consument/beeldbank/beelden/extra/therapieland-1000x667.jpg',
                alt: "Bekijk alle programma's",
              },
              Link: {
                text: 'Therapieland',
                url: 'https://www.menzis.nl/extra-voordelen/zelfhulpprogramma',
              },
              CTA: {
                text: "Bekijk alle programma's",
                url: 'https://www.menzis.nl/extra-voordelen/zelfhulpprogramma',
              },
            },
          },
          {
            name: 'Treatment Waiting',
            fields: {
              Title: 'Wacht je op een behandeling?',
              Text: '<p>Wachten op je behandeling is nooit fijn. Daarom helpen we je met zoeken naar mogelijkheden om sneller bij een zorgaanbieder terecht te kunnen.</p>',
              Image: {
                url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/over-menzis/nieuws/2020/corporate/man-en-vrouw-in-wachtkamer-ziekenhuis.jpg',
                alt: 'Kijk waar je sneller terecht kunt',
              },
              Link: {
                text: 'Treatment waiting',
                url: 'https://www.menzis.nl/zorg-en-gezondheid/wachtlijstbemiddeling',
              },
              CTA: {
                text: 'Kijk waar je sneller terecht kunt',
                url: 'https://www.menzis.nl/zorg-en-gezondheid/wachtlijstbemiddeling',
              },
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
