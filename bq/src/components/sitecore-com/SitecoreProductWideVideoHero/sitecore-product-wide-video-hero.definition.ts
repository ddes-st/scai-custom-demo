import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreProductWideVideoHeroDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-product-wide-video-hero",
  name: "sitecore-product-wide-video-hero",
  componentName: "SitecoreProductWideVideoHero",
  displayName: "Product Wide Video Hero",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Sitecore Ai Discovery Video Heros'] },
  model: {
    folderTemplate: { name: 'Sitecore Ai Discovery Video Hero Folder' },
    itemTemplate: {
      name: 'Sitecore Ai Discovery Video Hero',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Logo', type: 'Image' },
          { name: 'Heading Prefix', type: 'Single-Line Text' },
          { name: 'Heading Highlight', type: 'Single-Line Text' },
          { name: 'Heading Suffix', type: 'Single-Line Text' },
          { name: 'Body', type: 'Multi-Line Text' },
          { name: 'Primary CTA Label', type: 'Single-Line Text' },
          { name: 'Primary CTA', type: 'General Link' },
          { name: 'Secondary CTA Label', type: 'Single-Line Text' },
          { name: 'Secondary CTA', type: 'General Link' },
          { name: 'Video Thumbnail', type: 'Image' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Sitecore Ai Discovery Video Heros'] },
    culture: "en",
    items: [{
      name: 'Sitecore AI Discovery Video Hero',
      fields: {
        Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/cdf6d55ff6ca44c884cdfc8d804f68ab?t=sc24h', alt: 'sitecore ai' },
        'Heading Prefix': 'Turn',
        'Heading Highlight': 'discovery into experiences',
        'Heading Suffix': 'that convert',
        Body: 'SitecoreAI™ unifies content, data, and personalization in one enterprise-grade, AI-powered platform, helping teams deliver customer engagement and personalized experiences at scale. Add Scrunch to improve your visibility in AI search, so your brand shows up and stands out.',
        'Primary CTA Label': 'Explore use cases',
        'Primary CTA': { text: 'Explore use cases', url: 'https://www.sitecore.com/platform/use-cases' },
        'Secondary CTA Label': 'AEO in action',
        'Secondary CTA': { text: 'AEO in action', url: 'https://www.sitecore.com/platform/ai-search' },
        'Video Thumbnail': { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/7e979ea5fc344df5974aec643dcd2292?t=sc1200x630', alt: 'Thumbnail for SitecoreAI 3 minute demo' },
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
