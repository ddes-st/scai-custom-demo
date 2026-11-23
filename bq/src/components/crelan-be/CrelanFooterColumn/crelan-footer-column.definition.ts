import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const crelanFooterColumnDefinition = {
  kind: "component",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  definitionKey: "crelan-footer-column",
  name: "crelan-footer-column",
  componentName: "CrelanFooterColumn",
  displayName: "Footer Column",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Footer Columns'] },
  model: {
    folderTemplate: { name: 'Footer Column Folder' },
    itemTemplate: {
      name: 'Footer Column',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Links', type: 'Multi-Line Text' },
          { name: 'Social Links', type: 'Multi-Line Text' },
          { name: 'Card Stop Link', type: 'General Link' },
          { name: 'Show Preferences', type: 'Checkbox' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Footer Columns'] },
    culture: "nl-BE",
    items: [
      {
        name: 'Ons aanbod',
        fields: {
          Title: 'Ons aanbod',
          Links: JSON.stringify([
            { text: 'Beleggen', url: 'https://www.crelan.be/nl/particulieren/sparen-en-beleggen/beleggen' },
            { text: 'Betalen', url: 'https://www.crelan.be/nl/particulieren/betalen' },
            { text: 'Lenen', url: 'https://www.crelan.be/nl/particulieren/lenen' },
            { text: 'Verzekeren', url: 'https://www.crelan.be/nl/particulieren/verzekeren' },
            { text: 'Tarieven', url: 'https://www.crelan.be/nl/tarieflijst' },
          ]),
          'Social Links': '[]',
          'Card Stop Link': { text: '', url: '' },
          'Show Preferences': false,
        },
      },
      {
        name: "Thema's",
        fields: {
          Title: "Thema's",
          Links: JSON.stringify([
            { text: 'Gezin', url: 'https://www.crelan.be/nl/particulieren/gezin' },
            { text: 'Pensioen', url: 'https://www.crelan.be/nl/particulieren/pensioen-successie' },
            { text: 'Blogs', url: 'https://www.crelan.be/nl/particulieren/blog' },
          ]),
          'Social Links': '[]',
          'Card Stop Link': { text: '', url: '' },
          'Show Preferences': false,
        },
      },
      {
        name: 'Directe links',
        fields: {
          Title: 'Directe links',
          Links: JSON.stringify([
            { text: 'myCrelan', url: 'https://www.crelan.be/nl/particulieren/betalen/online-bankieren/product/mycrelan-zelf-thuis-bankieren' },
            { text: 'Reglementaire info', url: 'https://www.crelan.be/nl/reglementaire-info' },
            { text: 'Privacy', url: 'https://www.crelan.be/nl/privacy' },
            { text: 'Toegankelijkheid', url: 'https://www.crelan.be/nl/toegankelijkheid' },
            { text: 'Corporate info', url: 'https://www.crelan.be/nl/corporate/over-crelan' },
            { text: 'Investor Relations', url: 'https://www.crelan.be/nl/particulieren/sparen-en-beleggen/beleggen/investor-relations' },
            { text: 'Jobs', url: 'https://www.crelan.be/nl/jobs' },
            { text: 'Newsroom', url: 'https://www.crelan.be/nl/newsroom' },
          ]),
          'Social Links': '[]',
          'Card Stop Link': { text: '', url: '' },
          'Show Preferences': true,
        },
      },
      {
        name: 'Contacteer ons',
        fields: {
          Title: 'Contacteer ons',
          Links: JSON.stringify([
            { text: 'Vind uw dichtstbijzijnde kantoor', url: 'https://www.crelan.be/nl/kantoorzoeker' },
            { text: 'Contact', url: 'https://www.crelan.be/nl/contact' },
            { text: 'Klachten', url: 'https://www.crelan.be/nl/klachtenbehandeling' },
          ]),
          'Social Links': JSON.stringify([
            { text: 'Facebook', url: 'https://www.facebook.com/crelan.bank', icon: 'facebook' },
            { text: 'Instagram', url: 'https://www.instagram.com/crelan_bank/', icon: 'instagram' },
            { text: 'LinkedIn', url: 'https://www.linkedin.com/company/crelan/', icon: 'linkedin' },
            { text: 'Twitter', url: 'https://twitter.com/crelanbank', icon: 'twitter' },
          ]),
          'Card Stop Link': { text: 'Card Stop 078 170 170', url: 'https://www.cardstop.be' },
          'Show Preferences': false,
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
