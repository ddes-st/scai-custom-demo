import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisSupportFeatureCardDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-support-feature-card',
  name: 'menzis-benefits',
  componentName: 'MenzisSupportFeatureCard',
  displayName: 'Support Feature Card',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Health And Support Content'] },
  model: {
    folderTemplate: { name: 'Benefits Folder' },
    itemTemplate: {
      name: 'Benefits',
      sections: [{ name: 'Content', fields: [{ name: 'Heading', type: 'Single-Line Text' }] }],
    },
    childItemTemplate: {
      name: 'Benefit',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Heading', type: 'Single-Line Text' },
            { name: 'Body', type: 'Rich Text' },
            { name: 'Icon', type: 'Image' },
          ],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Health And Support Content'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Thats why you choose Menzis',
        displayName: 'Daarom kies je Menzis',
        fields: { Heading: 'Daarom kies je Menzis:' },
        children: [
          {
            name: 'Everyone is welcome',
            displayName: 'Iedereen is welkom',
            fields: {
              Heading: 'Iedereen is welkom',
              Body: '<p>We selecteren niet op gezondheid of leeftijd</p>',
              Icon: {
                svgMarkup:
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
                alt: 'Iedereen',
              },
            },
          },
          {
            name: 'Wait 18 weeks less',
            displayName: 'Wacht 18 weken korter',
            fields: {
              Heading: 'Wacht 18 weken korter',
              Body: '<p>Dankzij <a href="https://www.menzis.nl/zorg-en-gezondheid/wachtlijstbemiddeling">onze zorgadviseurs</a> kun je sneller terecht</p>',
              Icon: {
                svgMarkup:
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 3h10M7 21h10M8 4c0 4 8 4 8 8s-8 4-8 8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
                alt: 'Wachtlijst',
              },
            },
          },
          {
            name: 'Support your vitality',
            displayName: 'Zorg voor je vitaliteit',
            fields: {
              Heading: 'Zorg voor je vitaliteit',
              Body: '<p>Dé positieve kracht van het leven: ziek of gezond.</p>',
              Icon: {
                svgMarkup:
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
                alt: 'Vitaliteit',
              },
            },
          },
          {
            name: 'Insight into your healthcare matters',
            displayName: 'Inzicht in je zorgzaken',
            fields: {
              Heading: 'Inzicht in je zorgzaken',
              Body: '<p>Je regelt het in <a href="https://www.menzis.nl/mijn">Mijn Menzis</a> en onze handige <a href="https://www.menzis.nl/klantenservice/menzis-app">app</a></p>',
              Icon: {
                svgMarkup:
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 5h10v10H5zM15 9h4v10h-8v-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
                alt: 'Zorgzaken',
              },
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
