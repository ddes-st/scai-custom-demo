import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreScrunchAiVisibilityMediaDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-scrunch-ai-visibility-media",
  name: "sitecore-scrunch-ai-visibility-media",
  componentName: "SitecoreScrunchAiVisibilityMedia",
  displayName: "Scrunch Ai Visibility Media",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Scrunch AI Visibility Video CTAs'] },
  model: {
    folderTemplate: { name: 'Scrunch AI Visibility Video CTA Folder' },
    itemTemplate: {
      name: 'Scrunch AI Visibility Video CTA',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Body', type: 'Rich Text' },
          { name: 'CTA', type: 'General Link' },
          { name: 'Video Thumbnail', type: 'Image' },
          { name: 'Close Icon', type: 'Image' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Scrunch AI Visibility Video CTAs'] },
    culture: "en",
    items: [{
      name: 'Scrunch AI Visibility Video CTA',
      fields: {
        Heading: 'Show up and stand out in AI search',
        Body: "<p>Scrunch, now part of Sitecore, works with your existing technology stack to reveal how AI describes your brand, where you're missing from buying conversations, and where you can improve. Then SitecoreAI puts those insights to work. Personalize every experience, and put agentic AI to work, closing the loop between AI discovery and customer acquisition.</p>",
        CTA: { text: 'Start with your AI visibility', url: 'https://www.sitecore.com/platform/ai-search' },
        'Video Thumbnail': { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/0f8db9d732e84a3c8e5a1b440870406c?t=sc1600', alt: 'frame from Scrunch and Sitecore Content machine video' },
        'Close Icon': { url: 'https://www.sitecore.com/static/close-black.svg', alt: 'Close menu' },
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
