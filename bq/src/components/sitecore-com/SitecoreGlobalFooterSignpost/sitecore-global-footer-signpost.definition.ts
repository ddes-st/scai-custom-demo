import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreGlobalFooterSignpostDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-global-footer-signpost",
  name: "sitecore-global-footer-signpost",
  componentName: "SitecoreGlobalFooterSignpost",
  displayName: "Global Footer Signpost",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Global Footer Signposts'] },
  model: {
    folderTemplate: { name: 'Global Footer Signpost Folder' },
    itemTemplate: {
      name: 'Global Footer Signpost',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Icon', type: 'Image' },
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'CTA', type: 'Single-Line Text' },
          { name: 'Link', type: 'General Link' },
          { name: 'External', type: 'Checkbox' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Global Footer Signposts'] },
    culture: "en",
    items: [
      { name: 'Explore Use Cases', fields: { Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/85f6b0054fc841d3add3efdafa2e7f59?t=sc42h', alt: 'use case icon' }, Title: 'Explore use cases', CTA: 'See what’s possible', Link: { text: 'Explore use cases', url: 'https://www.sitecore.com/platform/use-cases' }, External: false } },
      { name: 'Learn With Sitecore', fields: { Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/cc9c461014e24868bc2543bed8f7263d?t=sc42h', alt: 'webinar icon' }, Title: 'Learn with Sitecore', CTA: 'Explore our webinars', Link: { text: 'Learn with Sitecore', url: 'https://www.sitecore.com/resources/events-webinars' }, External: false } },
      { name: 'Expert Guides And Reports', fields: { Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/197dbe8a5bb44153bb0bbae746c166cc?t=sc42h', alt: 'report icon' }, Title: 'Expert guides and reports', CTA: 'Browse the library', Link: { text: 'Expert guides and reports', url: 'https://www.sitecore.com/resources/insights?type=Analyst-report%2CGuides%2CReport&page=0' }, External: false } },
      { name: 'Sitecore Symposium 2026', fields: { Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/abf328f52fdd4fe2af7457d20fddeb27?t=sc42h', alt: 'white pin' }, Title: 'Sitecore Symposium 2026', CTA: 'Join us in Orlando', Link: { text: 'Sitecore Symposium 2026', url: 'https://symposium.sitecore.com/?utm_source=Sitecore_FooterSignpost&utm_campaign=Symposium_26' }, External: true } },
    ],
  },
} satisfies ComponentTemplateDefinition;
