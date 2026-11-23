import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreTrustedAnswerCardDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-trusted-answer-card",
  name: "sitecore-trusted-answer-card",
  componentName: "SitecoreTrustedAnswerCard",
  displayName: "Trusted Answer Card",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Trusted Answer Cards'] },
  model: {
    folderTemplate: { name: 'Trusted Answer Card Folder' },
    itemTemplate: {
      name: 'Trusted Answer Card',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Eyebrow', type: 'Single-Line Text' },
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Description', type: 'Rich Text' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Trusted Answer Cards'] },
    culture: "en",
    items: [
      {
        name: 'Be Unmistakable',
        fields: {
          Eyebrow: 'Be unmistakable',
          Title: 'Show up in AI answers',
          Description: '<p>Buyers now ask ChatGPT before they ever reach your site. SitecoreAI structures your content, so AI engines find it, trust it, and cite it accurately, before your competitors are the answer instead.</p>',
        },
      },
      {
        name: 'A Thriving Network of Innovators',
        fields: {
          Eyebrow: 'A thriving network of innovators',
          Title: 'Learn from the largest DX community',
          Description: '<p>Thousands of practitioners, partners and MVPs have built on Sitecore for over two decades. Learn from their playbooks and shared expertise.</p>',
        },
      },
      {
        name: 'Stay in Control',
        fields: {
          Eyebrow: 'Stay in control',
          Title: 'AI with guardrails built in',
          Description: '<p>Approval workflows, brand-voice controls and enterprise-grade security define what AI can do and what stays human. Your team moves at AI speed. Your brand never leaves your hands.</p>',
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
