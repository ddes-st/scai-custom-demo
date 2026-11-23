import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisIntroductionHeroDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-introduction-hero',
  name: 'menzis-introduction-hero',
  componentName: 'MenzisIntroductionHero',
  displayName: 'Introduction Hero',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Introduction Heroes'] },
  model: {
    folderTemplate: { name: 'Introduction Hero Folder' },
    itemTemplate: {
      name: 'Introduction Hero',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Heading', type: 'Single-Line Text' },
            { name: 'Body', type: 'Rich Text' },
            { name: 'Desktop Image', type: 'Image' },
            { name: 'Tablet Image', type: 'Image' },
            { name: 'Mobile Image', type: 'Image' },
            { name: 'Desktop Pebble Shape', type: 'Image' },
            { name: 'Mobile Pebble Shape', type: 'Image' },
            { name: 'CTA', type: 'General Link' },
          ],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Introduction Heroes'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Introduction Hero',
        fields: {
          Heading: 'Hulp bij je zorg en gezondheid? Dan is er Menzis',
          Body: '<p>Of het nu gaat om zorg, een vraag over je verzekering of je situatie in 2027: we denken met je mee. We helpen je met duidelijke informatie, persoonlijk advies en ondersteuning als je die nodig hebt.</p>',
          'Desktop Image': {
            url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/consument/beeldbank/merk-campagne/campagnebeelden/web-250901_menzis0396_v4-bril-300dpi-extended.jpg?cx=73&cy=13&cw=992&ch=500&hash=9177BEB028CCE2AB299FFE0F3A94A16D',
            alt: '',
          },
          'Tablet Image': {
            url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/consument/beeldbank/merk-campagne/campagnebeelden/web-250901_menzis0396_v4-bril-300dpi-extended.jpg?cx=73&cy=13&cw=768&ch=400&hash=5D7AC12BD1E0E889B24EF9C39C90CD84',
            alt: '',
          },
          'Mobile Image': {
            url: 'https://www.menzis.nl/-/m/publieke-sites/menzis/consument/beeldbank/merk-campagne/campagnebeelden/web-250901_menzis0396_v4-bril-300dpi-extended.jpg?cx=73&cy=13&cw=340&ch=300&hash=2A8D9DF7ED15923AB686AF8AC3D33267',
            alt: '',
          },
          'Desktop Pebble Shape': {
            url: 'https://www.menzis.nl/Resources/Foundation/Branding/content/images/menzis/hero-pebble-container-mask.svg',
            alt: '',
          },
          'Mobile Pebble Shape': {
            url: 'https://www.menzis.nl/Resources/Foundation/Branding/content/images/menzis/hero-pebble-container-mask-mobile.svg',
            alt: '',
          },
          CTA: {
            text: 'Ontdek wat Menzis voor jou kan doen',
            url: 'https://www.menzis.nl/dan-is-er-menzis',
          },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
