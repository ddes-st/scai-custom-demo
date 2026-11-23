import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisReasonsBandDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-reasons-band',
  name: 'menzis-reasons-band',
  componentName: 'MenzisReasonsBand',
  displayName: 'Reasons Band',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Reasons Bands'] },
  model: {
    folderTemplate: { name: 'Reasons Band Folder' },
    itemTemplate: {
      name: 'Reasons Band',
      sections: [{ name: 'Content', fields: [{ name: 'Heading', type: 'Single-Line Text' }] }],
    },
    childItemTemplate: {
      name: 'Reason',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Title', type: 'Single-Line Text' },
            { name: 'Body', type: 'Rich Text' },
            { name: 'Icon', type: 'Image' },
          ],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Reasons Bands'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Why Choose Menzis',
        fields: { Heading: 'Daarom kies je Menzis:' },
        children: [
          {
            name: 'Everyone Welcome',
            fields: {
              Title: 'Iedereen is welkom',
              Body: '<p>We selecteren niet op gezondheid of leeftijd</p>',
              Icon: {
                svgMarkup:
                  '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 22c1-5 15-5 16 0"/></svg>',
                alt: 'Iedereen is welkom',
              },
            },
          },
          {
            name: 'Shorter Waiting',
            fields: {
              Title: 'Wacht 18 weken korter',
              Body: '<p>Dankzij <a href="https://www.menzis.nl/zorg-en-gezondheid/wachtlijstbemiddeling">onze zorgadviseurs</a> kun je sneller terecht</p>',
              Icon: {
                svgMarkup:
                  '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 3h10M7 21h10M8 4c0 4 8 4 8 8s-8 4-8 8"/></svg>',
                alt: 'Wacht 18 weken korter',
              },
            },
          },
          {
            name: 'Vitality',
            fields: {
              Title: 'Zorg voor je vitaliteit',
              Body: '<p>Dé positieve kracht van het leven: ziek of gezond.</p>',
              Icon: {
                svgMarkup:
                  '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>',
                alt: 'Zorg voor je vitaliteit',
              },
            },
          },
          {
            name: 'Care Insight',
            fields: {
              Title: 'Inzicht in je zorgzaken',
              Body: '<p>Je regelt het in <a href="https://www.menzis.nl/mijn">Mijn Menzis</a> en onze handige <a href="https://www.menzis.nl/klantenservice/menzis-app">app</a></p>',
              Icon: {
                svgMarkup:
                  '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h10v8H4zM17 10h3v5h-3zM14 9l3 3"/></svg>',
                alt: 'Inzicht in je zorgzaken',
              },
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
