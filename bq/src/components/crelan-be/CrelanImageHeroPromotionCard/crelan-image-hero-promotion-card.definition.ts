import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const crelanImageHeroPromotionCardDefinition = {
  kind: "component",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  definitionKey: "crelan-image-hero-promotion-card",
  name: "crelan-image-hero-promotion-card",
  componentName: "CrelanImageHeroPromotionCard",
  displayName: "Image Hero Promotion Card",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Image Hero Promotion Cards'] },
  model: {
    folderTemplate: { name: 'Image Hero Promotion Card Folder' },
    itemTemplate: {
      name: 'Image Hero Promotion Card',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Body', type: 'Rich Text' },
          { name: 'Image', type: 'Image' },
          { name: 'Mobile Image', type: 'Image' },
          { name: 'Tone', type: 'Single-Line Text' },
          { name: 'Show CTA', type: 'Checkbox' },
          { name: 'CTA', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Image Hero Promotion Cards'] },
    culture: "nl-BE",
    items: [
      {
        name: 'Promotion Card 2010',
        fields: {
          Title: 'Weet u nog wat u in 2010 met € 15 kon doen?',
          Body: '<p>De tijd verandert veel.</p><p>Ook wat uw geld waard is.</p>',
          Image: {
            url: 'https://www.crelan.be/sites/default/files/styles/hero_card_lg/public/2026-10/15-euro-2010.png.webp?h=2d08ade1&itok=B_sUZZzG',
            alt: 'Campagnebeeld waarbij een man volledig gladgeschoren is bij de barbier',
          },
          'Mobile Image': {
            url: 'https://www.crelan.be/sites/default/files/styles/hero_card_mobile/public/2026-10/15-euro-2010.png.webp?h=cb00bd34&itok=icnWDZV6',
            alt: 'Campagnebeeld waarbij een man volledig gladgeschoren is bij de barbier',
          },
          Tone: 'neutral',
          'Show CTA': false,
          CTA: { text: '', url: '' },
        },
      },
      {
        name: 'Promotion Card 2026',
        fields: {
          Title: 'Uw geld kan ook meer waard worden met de tijd.',
          Body: '<p>Ontdek de mogelijkheden van beleggen samen met uw Crelan-agent.</p>',
          Image: {
            url: 'https://www.crelan.be/sites/default/files/styles/hero_card_lg/public/2026-10/15-euro-2026.png.webp?h=4d347c64&itok=BkWa_0aK',
            alt: 'Campagnebeeld waarbij een man maar halfgeschoren is bij de barbier',
          },
          'Mobile Image': {
            url: 'https://www.crelan.be/sites/default/files/styles/hero_card_mobile/public/2026-10/15-euro-2026.png.webp?h=04850201&itok=FTN_RCJ8',
            alt: 'Campagnebeeld waarbij een man maar halfgeschoren is bij de barbier',
          },
          Tone: 'green',
          'Show CTA': true,
          CTA: { text: 'Plan uw adviesgesprek', url: 'https://www.crelan.be/nl/appointment-page?subject=3190' },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
