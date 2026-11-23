import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreStudioExtensibilityTabsDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-studio-extensibility-tabs",
  name: "sitecore-studio-extensibility-tabs",
  componentName: "SitecoreStudioExtensibilityTabs",
  displayName: "Studio Extensibility Tabs",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Studio Extension Tabs'] },
  model: {
    folderTemplate: { name: 'Studio Extension Tabs Folder' },
    itemTemplate: {
      name: 'Studio Extension Tabs',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Intro', type: 'Rich Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "studio-tabs", allowedControls: ["sitecore-studio-extension-tab"] }],
  content: {
    location: { root: 'data', folder: ['Studio Extension Tabs'] },
    culture: "en",
    items: [{
      name: 'Studio Extension Tabs',
      fields: {
        Heading: 'Customize SitecoreAI your way with Studio',
        Intro: '<p>Extend SitecoreAI into your ecosystem. Automate workflows, build apps, and connect every tool that powers your customer experience.</p>',
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
