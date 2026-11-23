import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreAiVisibilitySnapshotCtaDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-ai-visibility-snapshot-cta",
  name: "sitecore-ai-visibility-snapshot-cta",
  componentName: "SitecoreAiVisibilitySnapshotCta",
  displayName: "Ai Visibility Snapshot Cta",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['AI Visibility Snapshot CTAs'] },
  model: {
    folderTemplate: { name: 'AI Visibility Snapshot CTA Folder' },
    itemTemplate: {
      name: 'AI Visibility Snapshot CTA',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Body', type: 'Rich Text' },
          { name: 'CTA Label', type: 'Single-Line Text' },
          { name: 'CTA Link', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['AI Visibility Snapshot CTAs'] },
    culture: "en",
    items: [{
      name: 'AI Visibility Snapshot CTA',
      fields: {
        Heading: 'How does AI describe your brand?',
        Body: '<p>Most brands have never seen their own AI answers. Request a demo to get your free AI visibility snapshot and optimize how your brand appears across AI search.</p>',
        'CTA Label': 'Get your AI visibility snapshot',
        'CTA Link': { text: 'Get your AI visibility snapshot', url: 'https://www.sitecore.com/request-a-demo-scrunch' },
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
