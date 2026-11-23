import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisEditorialContentBandDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-editorial-content-band',
  name: 'menzis-editorial-content-band',
  componentName: 'MenzisEditorialContentBand',
  displayName: 'Editorial Content Band',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Editorial Content Bands'] },
  model: {
    folderTemplate: { name: 'Editorial Content Band Folder' },
    itemTemplate: {
      name: 'Editorial Content Band',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Heading', type: 'Single-Line Text' },
            { name: 'Body', type: 'Rich Text' },
            { name: 'Image', type: 'Image' },
            { name: 'CTA', type: 'General Link' },
            { name: 'Layout', type: 'Single-Line Text' },
          ],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Editorial Content Bands'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Anderzorg becomes Menzis',
        displayName: 'Anderzorg Becomes Menzis',
        fields: {
          Heading: 'Anderzorg wordt Menzis',
          Body: '<p>Vanaf 1 januari 2027 fuseert Anderzorg met Menzis. Anderzorg is al jaren onderdeel van Menzis. Verzekerden van Anderzorg zijn per 1 januari 2027 verzekerd bij Menzis. Met dezelfde vertrouwde service. Meer informatie over deze verandering vind je op de website van Anderzorg.</p>',
          Image: {
            url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/consument/beeldbank/headerbeelden-2026---2030/stel-kijkt-op-een-laptop.png',
            alt: '',
          },
          CTA: { text: 'Meer over de verandering', url: 'http://anderzorg.nl/menzis' },
          Layout: 'text-image',
        },
      },
      {
        name: 'Then Menzis',
        fields: {
          Heading: 'Dan is er Menzis.',
          Body: '<p>Of je nu vragen hebt, hulp zoekt of wacht op zorg. We staan voor je klaar.</p>',
          Image: {
            url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/consument/beeldbank/merk-campagne/campagnebeelden/web-250901_menzis1231_v1_wachtlijst.jpg',
            alt: '',
          },
          CTA: { text: 'Dan is er Menzis', url: 'https://www.menzis.nl/dan-is-er-menzis' },
          Layout: 'image-text',
        },
      },
      {
        name: 'Personal Contact',
        fields: {
          Heading: 'Persoonlijk contact',
          Body: '<p>Is het ingewikkeld om je zaken online te regelen? Kom dan naar ons mobiele kantoor. Je vindt ons op verschillende locaties in Noord of Oost-Nederland. In ons mobiele kantoor wacht een medewerker van Menzis die een antwoord geeft op je vraag.</p>',
          Image: {
            url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/consument/beeldbank/portret/dame-glimlacht.png',
            alt: '',
          },
          CTA: {
            text: 'Bekijk de data en locaties',
            url: 'https://www.menzis.nl/persoonlijk-contact',
          },
          Layout: 'text-image',
        },
      },
      {
        name: 'Medicine Shortages',
        fields: {
          Heading: 'Medicijntekorten: dit is er aan de hand',
          Body: '<p>Soms is jouw medicijn niet beschikbaar bij de apotheek, bijvoorbeeld door productieproblemen, vertraagd vervoer of een grotere vraag. Medicijntekorten komen helaas voor en kunnen verschillende oorzaken hebben. We leggen je uit hoe het zit en wat we hieraan doen.</p>',
          Image: {
            url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/consument/beeldbank/headerbeelden-2026---2030/kinderen-spelen-in-de-tuin.png',
            alt: '',
          },
          CTA: {
            text: 'Lees het artikel',
            url: 'https://www.menzis.nl/over-menzis/publicaties/medicijntekorten',
          },
          Layout: 'text-image',
        },
      },
      {
        name: 'Waiting List Mediation',
        fields: {
          Heading: 'Wachtlijstbemiddeling, zo helpen we onze leden',
          Body: '<p>Door meer vraag en minder zorgprofessionals wachten meer mensen op zorg. Onze Zorgadviseurs helpen met wachtlijstbemiddeling. In 2025 hielpen ze ruim 7.500 leden aan kortere wachttijden. Met succes!</p>',
          Image: {
            url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/consument/beeldbank/portret/jonge-vrouw-kijkt-in-camera-close-up.jpg',
            alt: '',
          },
          CTA: {
            text: 'Lees het artikel',
            url: 'https://www.menzis.nl/over-menzis/nieuws-en-blogs/wachtlijsten/meer-dan-122-dagen-wachttijdwinst-per-verzekerde',
          },
          Layout: 'image-text',
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
