import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreAiAssistedHeroBannerDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-ai-assisted-hero-banner",
  name: "sitecore-ai-assisted-hero-banner",
  componentName: "SitecoreAiAssistedHeroBanner",
  displayName: "Ai Assisted Hero Banner",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['AI Assisted Hero Banners'] },
  model: {
    folderTemplate: { name: 'AI Assisted Hero Banner Folder' },
    itemTemplate: {
      name: 'AI Assisted Hero Banner',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading Intro', type: 'Single-Line Text' },
          { name: 'Heading Emphasis', type: 'Single-Line Text' },
          { name: 'Lead', type: 'Multi-Line Text' },
          { name: 'Primary CTA', type: 'General Link' },
          { name: 'Primary CTA Label', type: 'Single-Line Text' },
          { name: 'Secondary CTA', type: 'General Link' },
          { name: 'Secondary CTA Label', type: 'Single-Line Text' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['AI Assisted Hero Banners'] },
    culture: "en",
    items: [{
      name: 'AI Assisted Hero Banner',
      fields: {
        'Heading Intro': 'AI is deciding who gets discovered.',
        'Heading Emphasis': "Sitecore makes sure you're the answer.",
        Lead: 'Sitecore is a leading content and digital experience platform that connects CMS, DAM and AI-search visibility. See how AI describes your brand, fix gaps at the source, create trusted content at scale, and turn discovery into revenue.',
        'Primary CTA': { text: 'Explore the platform', url: 'https://www.sitecore.com/platform' },
        'Primary CTA Label': 'Explore the platform',
        'Secondary CTA': { text: 'Join us at Symposium', url: 'https://symposium.sitecore.com/?utm_source=Sitecore_Homepage&utm_campaign=Symposium_26' },
        'Secondary CTA Label': 'Join us at Symposium',
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
