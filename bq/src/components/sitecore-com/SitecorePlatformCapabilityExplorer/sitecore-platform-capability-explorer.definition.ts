import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecorePlatformCapabilityExplorerDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-platform-capability-explorer",
  name: "sitecore-platform-capability-explorer",
  componentName: "SitecorePlatformCapabilityExplorer",
  displayName: "Platform Capability Explorer",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Sitecore Platform Capability Explorers'] },
  model: {
    folderTemplate: { name: 'Platform Capability Explorer Folder' },
    itemTemplate: {
      name: 'Platform Capability Explorer',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Highlight', type: 'Single-Line Text' },
          { name: 'Description', type: 'Rich Text' },
          { name: 'Watermark Image', type: 'Image' },
        ],
      }],
    },
  },
  placeholders: [{ key: "capability-panels", allowedControls: ["sitecore-platform-capability-panel"] }],
  content: {
    location: { root: 'data', folder: ['Sitecore Platform Capability Explorers'] },
    culture: "en",
    items: [{
      name: 'Platform Capability Explorer',
      fields: {
        Heading: 'The platform built around your team.',
        Highlight: 'Every capability working together.',
        Description: '<p>Discover one connected, AI-driven DXP where content, data, and personalization work together from day one. Automate and streamline the work that slows your team down. Start where it matters most across the customer journey touchpoints and specific use cases, and expand as your priorities grow, without switching tools or adding complexity. Because everything is part of SitecoreAI, it all works together to deliver speed, scale, and impact.</p>',
        'Watermark Image': { url: 'https://www.sitecore.com/static/sitecore-ai-logo-mark-color.svg', alt: '' },
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
