import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreStudioExtensionTabDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-studio-extension-tab",
  name: "sitecore-studio-extension-tab",
  componentName: "SitecoreStudioExtensionTab",
  displayName: "Studio Extension Tab",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Studio Extension Tabs'] },
  model: {
    folderTemplate: { name: 'Studio Extension Tab Folder' },
    itemTemplate: {
      name: 'Studio Extension Tab',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Label', type: 'Single-Line Text' },
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Description', type: 'Rich Text' },
          { name: 'Image', type: 'Image' },
          { name: 'Tab Index', type: 'Single-Line Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "tabpanel", allowedControls: [] }, { key: "tab", allowedControls: [] }, { key: "studio-tabs", allowedControls: ["sitecore-studio-extension-tab"] }],
  content: {
    location: { root: 'data', folder: ['Studio Extension Tabs'] },
    culture: "en",
    items: [
      {
        name: 'Agentic Studio',
        fields: {
          Label: 'Agentic Studio',
          Title: 'Automate work with custom generative AI, LLMs, and gen AI agents.',
          Description: '<p>Use pre-built agents and templates or create your own with a visual builder. From content creation to workflow execution, move faster with control.</p><div><h4>What makes it possible:</h4></div><ul><li><p>No token limits.</p></li><li><p>Visual, no-code agent builder.</p></li><li><p>Agents grounded in your brand context and guardrails.</p></li><li><p>Clear reasoning and review at every step of the decision-making process.</p></li></ul>',
          Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/9cfe19b67d644949a59e9cde1b7db4b9?t=sc1200', alt: 'SitecoreAI Studio screenshot of Agentic Studio SaaS platform UI' },
          'Tab Index': '0',
        },
      },
      {
        name: 'App Studio',
        fields: {
          Label: 'App Studio',
          Title: 'Turn ideas into working apps.',
          Description: '<p>Build what your business needs, keep it private, or publish it to the Marketplace.</p><div><h4>What makes it possible:</h4></div><ul><li><p>A partner ecosystem ready to build with you.</p></li><li><p>APIs and MCPs for AI-powered, agent-driven apps.</p></li><li><p>A direct path to publish to Marketplace.</p></li></ul>',
          Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/09d397ade6ed46a69a2adb20098a7a22?t=sc1200', alt: 'SitecoreAI Studio screenshot of App Studio SaaS platform UI' },
          'Tab Index': '1',
        },
      },
      {
        name: 'Marketplace',
        fields: {
          Label: 'Marketplace',
          Title: 'Extend SitecoreAI in one click.',
          Description: '<p>Apps built by Sitecore, certified partners, and the community. Find what you need, install in one click, and start using it right away.</p><div><h4>What makes it possible:</h4></div><ul><li><p>Curated by Sitecore.</p></li><li><p>Built by partners and the community.</p></li><li><p>One-click install, governed by your admins.</p></li></ul>',
          Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/79459321e3d7427ea86c1ce9561e7909?t=sc1200', alt: 'SitecoreAI Studio screenshot of Sitecore Marketplace SaaS platform UI' },
          'Tab Index': '2',
        },
      },
      {
        name: 'Connect',
        fields: {
          Label: 'Connect',
          Title: 'Bring your tools together.',
          Description: '<p>Connect CRM, analytics, and the rest of your stack to SitecoreAI so customer data and workflows stay in sync.</p><div><h4>What makes it possible:</h4></div><ul><li><p>Pre-built connectors for the tools you already use.</p></li><li><p>Two-way sync for data and workflows.</p></li><li><p>Govern access at the connection level.</p></li></ul>',
          Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/1e32548a864f4ef6b0a71968a21a2d55?t=sc1200', alt: 'SitecoreAI Studio screenshot of Sitecore Connect SaaS platform UI' },
          'Tab Index': '3',
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
