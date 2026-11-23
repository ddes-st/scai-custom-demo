import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisAppInformationBandDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-app-information-band',
  name: 'menzis-app-information-band',
  componentName: 'MenzisAppInformationBand',
  displayName: 'App Information Band',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['App Information Bands'] },
  model: {
    folderTemplate: { name: 'App Information Band Folder' },
    itemTemplate: {
      name: 'App Information Band',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Heading', type: 'Single-Line Text' },
            { name: 'Intro', type: 'Rich Text' },
            { name: 'Benefits', type: 'Rich Text' },
            { name: 'Body', type: 'Rich Text' },
            { name: 'Image', type: 'Image' },
            { name: 'IOS', type: 'General Link' },
            { name: 'Android', type: 'General Link' },
            { name: 'More', type: 'General Link' },
          ],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['App Information Bands'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Menzis App',
        fields: {
          Heading: 'Download de Menzis app',
          Intro:
            '<p>Inzicht in je zorg- en geldzaken? Met de handige Menzis app heb je je zorgverzekering altijd bij de hand.</p>',
          Benefits:
            '<ul><li>Snel en makkelijk declareren</li><li>Bekijk de stand van je eigen risico</li><li>Altijd inzicht in declaraties en betalingen</li></ul>',
          Body: '<p><strong>Nieuw!</strong> In de nieuwste versie van de Menzis app kun je in het najaar vanuit de app jouw polis wijzigen. Na klikken op ‘Pakket wijzigen’ onder ‘Verzekering &gt; Mijn polis’ sturen we je direct naar de juiste plek in de Mijn Omgeving. Je wordt automatisch ingelogd en kunt direct jouw polis aanpassen.</p>',
          Image: {
            url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/consument/infographics/2026/menzis-app-image-2025-960x960-(1).png',
            alt: '',
          },
          IOS: {
            text: 'Download voor iOS',
            url: 'https://apps.apple.com/nl/app/menzis-app/id922881474',
          },
          Android: {
            text: 'Download voor Android',
            url: 'https://play.google.com/store/apps/details?id=nl.menzis.android.declareren&hl=nl&gl=US',
          },
          More: {
            text: 'Lees meer over de Menzis app',
            url: 'https://www.menzis.nl/klantenservice/menzis-app',
          },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
