import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreSpeedOfAmbitionDemoCtaDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-speed-of-ambition-demo-cta",
  name: "sitecore-speed-of-ambition-demo-cta",
  componentName: "SitecoreSpeedOfAmbitionDemoCta",
  displayName: "Speed Of Ambition Demo Cta",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Speed Of Ambition Demo Ctas'] },
  model: {
    folderTemplate: { name: 'Speed Of Ambition Demo Cta Folder' },
    itemTemplate: {
      name: 'Speed Of Ambition Demo Cta',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'CTA Label', type: 'Single-Line Text' },
          { name: 'CTA', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Speed Of Ambition Demo Ctas'] },
    culture: "en",
    items: [{
      name: 'Speed Of Ambition Demo Cta',
      fields: {
        Heading: 'Ready to move at the speed of your ambition?',
        'CTA Label': 'Book a demo',
        CTA: { text: 'Book a demo', url: 'https://www.sitecore.com/request-a-demo' },
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
