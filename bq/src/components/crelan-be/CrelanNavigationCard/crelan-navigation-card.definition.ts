import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const crelanNavigationCardDefinition = {
  kind: "component",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  definitionKey: "crelan-navigation-card",
  name: "crelan-navigation-card",
  componentName: "CrelanNavigationCard",
  displayName: "Navigation Card",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Navigation Cards'] },
  model: {
    folderTemplate: { name: 'Navigation Card Folder' },
    itemTemplate: {
      name: 'Navigation Card',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Icon', type: 'Single-Line Text' },
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Link', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Navigation Cards'] },
    culture: "nl-BE",
    items: [
      { name: 'Zichtrekeningen', fields: { Icon: 'account', Title: 'Zichtrekeningen', Link: { text: 'Zichtrekeningen', url: 'https://www.crelan.be/nl/particulieren/betalen/zichtrekeningen/product/zichtrekeningen-vergelijken' } } },
      { name: 'Spaarrekeningen', fields: { Icon: 'piggy', Title: 'Spaarrekeningen', Link: { text: 'Spaarrekeningen', url: 'https://www.crelan.be/nl/particulieren/sparen-en-beleggen/sparen/product/spaarrekeningen' } } },
      { name: 'Starten met beleggen', fields: { Icon: 'chart', Title: 'Starten met beleggen', Link: { text: 'Starten met beleggen', url: 'https://www.crelan.be/nl/particulieren/sparen-en-beleggen/beleggen/product/starten-met-beleggen' } } },
      { name: 'Beleggingsadvies', fields: { Icon: 'handshake', Title: 'Beleggingsadvies', Link: { text: 'Beleggingsadvies', url: 'https://www.crelan.be/nl/particulieren/sparen-en-beleggen/beleggen/product/beleggingsadvies' } } },
      { name: 'Hypothecaire lening', fields: { Icon: 'home', Title: 'Hypothecaire lening', Link: { text: 'Hypothecaire lening', url: 'https://www.crelan.be/nl/particulieren/lenen/woning/product/hypothecaire-lening' } } },
      { name: 'Renovatielening', fields: { Icon: 'building', Title: 'Renovatielening', Link: { text: 'Renovatielening', url: 'https://www.crelan.be/nl/particulieren/lenen/woning/product/renovatielening' } } },
      { name: 'Autolening', fields: { Icon: 'car', Title: 'Autolening', Link: { text: 'Autolening', url: 'https://www.crelan.be/nl/particulieren/lenen/mobiliteit/product/autolening' } } },
      { name: 'Persoonlijke lening', fields: { Icon: 'person', Title: 'Persoonlijke lening', Link: { text: 'Persoonlijke lening', url: 'https://www.crelan.be/nl/particulieren/lenen/andere-doelen/product/persoonlijke-lening' } } },
    ],
  },
} satisfies ComponentTemplateDefinition;
