import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreAiWorkflowCardDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-ai-workflow-card",
  name: "sitecore-ai-workflow-card",
  componentName: "SitecoreAiWorkflowCard",
  displayName: "Ai Workflow Card",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['AI Workflow Cards'] },
  model: {
    folderTemplate: { name: 'AI Workflow Card Folder' },
    itemTemplate: {
      name: 'AI Workflow Card',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Eyebrow', type: 'Single-Line Text' },
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Description', type: 'Multi-Line Text' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['AI Workflow Cards'] },
    culture: "en",
    items: [
      {
        name: 'Always Included',
        fields: {
          Eyebrow: 'Always Included',
          Title: 'AI in every workflow, from day one.',
          Description: '20+ pre-built AI agents draft, tag, translate, and activate content without your team switching AI tools or losing context.',
        },
      },
      {
        name: 'Built to Extend',
        fields: {
          Eyebrow: 'Built to Extend',
          Title: 'Your processes. Your tools. Your way.',
          Description: "Open by design. Bring your own tools via API, build your own AI agents, ship your own apps, extend your ecosystem on Sitecore’s platform. That’s what Studio is for.",
        },
      },
      {
        name: 'Enterprise-Ready',
        fields: {
          Eyebrow: 'Enterprise-Ready',
          Title: 'You set guardrails. Agents follow.',
          Description: 'Role-based permissions, approval gates, and full audit logs keep your brand consistent and your team in control. Backed by enterprise-grade security and our partnership with Microsoft.',
        },
      },
      {
        name: 'Marketer Directed',
        fields: {
          Eyebrow: 'Marketer Directed',
          Title: 'Agents prepare. You make the call.',
          Description: 'Agents draft, tag, and prepare. You approve, refine, and publish. The output remains always on-brand.',
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
