import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const crelanImageHeroPromotionsDefinition = {
  kind: "component",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  definitionKey: "crelan-image-hero-promotions",
  name: "crelan-image-hero-promotions",
  componentName: "CrelanImageHeroPromotions",
  displayName: "Image Hero Promotions",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Image Hero Promotions'] },
  model: {
    folderTemplate: { name: 'Image Hero Promotions Folder' },
    itemTemplate: {
      name: 'Image Hero Promotions',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Hero Image', type: 'Image' },
          { name: 'Hero Image Tablet', type: 'Image' },
          { name: 'Hero Image Mobile', type: 'Image' },
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Body', type: 'Rich Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "hero-cards", allowedControls: ["crelan-image-hero-promotion-card"] }],
  content: {
    location: { root: 'data', folder: ['Image Hero Promotions'] },
    culture: "nl-BE",
    items: [{
      name: 'Image Hero Promotions',
      fields: {
        'Hero Image': {
          url: 'https://www.crelan.be/sites/default/files/styles/header_homepage/public/2026-06/Maureen-Chloe-part-hero.jpg.webp?h=c0f40b7e&itok=0Q_jxNQB',
          alt: 'Foto van Maureen en Chloe voor het Crelan-logo',
        },
        'Hero Image Tablet': {
          url: 'https://www.crelan.be/sites/default/files/styles/marketing_banner/public/2026-06/Maureen-Chloe-part-hero.jpg?c=a88e02c0_3012&h=171bffe3&itok=e8pnPVs3',
          alt: 'Foto van Maureen en Chloe voor het Crelan-logo',
        },
        'Hero Image Mobile': {
          url: 'https://www.crelan.be/sites/default/files/styles/marketing_banner_400/public/2026-06/Maureen-Chloe-part-hero.jpg?c=a88e02c0_3012&h=171bffe3&itok=WPT7PKYz',
          alt: 'Foto van Maureen en Chloe voor het Crelan-logo',
        },
        Heading: 'Welkom bij Crelan, de bank die dicht bij haar klanten staat',
        Body: '<p>Een bank voor particulieren en voor lokale ondernemers, die vanuit een coöperatieve visie met u meedenkt.</p><p>Waar u online de diensten vindt die u het leven makkelijker maken. Maar ook met een agentschap in uw buurt waar u kunt rekenen op de persoonlijke service van echte mensen.</p><p><strong>En van zo’n bank, daar wordt u beter van</strong>.</p>',
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
