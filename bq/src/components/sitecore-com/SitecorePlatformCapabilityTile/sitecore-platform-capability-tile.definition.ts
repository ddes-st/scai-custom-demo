import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecorePlatformCapabilityTileDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-platform-capability-tile",
  name: "sitecore-platform-capability-tile",
  componentName: "SitecorePlatformCapabilityTile",
  displayName: "Platform Capability Tile",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Platform Capability Tiles'] },
  model: {
    folderTemplate: { name: 'Platform Capability Tile Folder' },
    itemTemplate: {
      name: 'Platform Capability Tile',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Link', type: 'General Link' },
          { name: 'Aria Label', type: 'Single-Line Text' },
          { name: 'Icon', type: 'Image' },
          { name: 'Eyebrow', type: 'Single-Line Text' },
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Description', type: 'Multi-Line Text' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Platform Capability Tiles'] },
    culture: "en",
    items: [
      { name: 'AI Search', fields: { Link: { text: 'Go to AI search', url: 'https://www.sitecore.com/platform/ai-search' }, 'Aria Label': 'Go to AI search', Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/332ff1e3077e4a31be42b4d4e4e1f0ff?v=7dcf07ce', alt: 'AI search icon' }, Eyebrow: 'AI search - Powered by Scrunch', Title: 'Win the AI-first buyer', Description: 'Bridge AI discovery with personalized experiences to move buyers from search to engagement and conversion.' } },
      { name: 'AI And Agents', fields: { Link: { text: 'Go to AI and agents', url: 'https://www.sitecore.com/platform/ai-and-agents' }, 'Aria Label': 'Go to AI and agents', Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/d29c81fe9c3b4c85b91ea6838890f310?v=d34c6d61', alt: 'SitecoreAI Agentic Studio AI and agents icon' }, Eyebrow: 'AI and agents', Title: 'Work with brand-aware AI', Description: 'Create on-brand with AI and 20+ agents included in SitecoreAI. Stay in control, with no add-ons or per-token fees.' } },
      { name: 'Digital Asset Management', fields: { Link: { text: 'Go to Digital Asset Management', url: 'https://www.sitecore.com/platform/digital-asset-management' }, 'Aria Label': 'Go to Digital Asset Management', Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/a382c54596d24ea5a8b11c89cf5dca8a?v=4a4d76d9', alt: 'Digital Asset Management' }, Eyebrow: 'Digital Asset Management', Title: 'Shape the message', Description: 'Connect content, data, governance, and workflows so your teams can move faster without losing control.' } },
      { name: 'Content Management System', fields: { Link: { text: 'Go to Content Management System', url: 'https://www.sitecore.com/platform/content-management-system' }, 'Aria Label': 'Go to Content Management System', Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/c918b34864ad4924a696c63db3caeebe?v=b218ea6b', alt: 'Content Management System' }, Eyebrow: 'Content Management System', Title: 'Close the loop', Description: 'Bridge AI discovery with personalized experiences to move buyers from search to engagement and conversion.' } },
      { name: 'Content Operations', fields: { Link: { text: 'Go to Content operations', url: 'https://www.sitecore.com/platform/content-operations' }, 'Aria Label': 'Go to Content operations', Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/b82a2cd5ba694a0fb29abf9c89d31cfc?v=f04e10fc', alt: 'Content operations' }, Eyebrow: 'Content operations', Title: 'Put content to work', Description: 'Plan, create, manage, and reuse content more efficiently with connected operations built to support enterprise scale.' } },
      { name: 'Audience And Insights', fields: { Link: { text: 'Go to Audience and insights', url: 'https://www.sitecore.com/platform/audience-and-insights' }, 'Aria Label': 'Go to Audience and insights', Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/0420167544864a04880e546a91cf8e83?v=7e4d7857', alt: 'Audiences intelligence' }, Eyebrow: 'Audience and insights', Title: 'Know your audience', Description: 'Build a richer understanding of every customer with unified data and insights that reveal behavior, intent, and opportunity.' } },
      { name: 'Conversion Optimization', fields: { Link: { text: 'Go to Conversion optimization', url: 'https://www.sitecore.com/platform/conversion-optimization' }, 'Aria Label': 'Go to Conversion optimization', Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/0f8e55dbff0a405ebf895017f2b41d13?v=1f87c538', alt: 'Conversion optimization' }, Eyebrow: 'Conversion optimization', Title: 'Build better experiences', Description: 'Use experimentation and performance insights to continually refine experiences and improve conversion outcomes.' } },
    ],
  },
} satisfies ComponentTemplateDefinition;
