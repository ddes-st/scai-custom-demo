import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreFrequentlyAskedQuestionItemDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-frequently-asked-question-item",
  name: "sitecore-frequently-asked-question-item",
  componentName: "SitecoreFrequentlyAskedQuestionItem",
  displayName: "Frequently Asked Question Item",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Frequently Asked Question Items'] },
  model: {
    folderTemplate: { name: 'Frequently Asked Question Item Folder' },
    itemTemplate: {
      name: 'Frequently Asked Question Item',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Question', type: 'Single-Line Text' },
          { name: 'Answer', type: 'Rich Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "faq-panel", allowedControls: [] }, { key: "faq-items", allowedControls: ["sitecore-frequently-asked-question-item"] }],
  content: {
    location: { root: 'data', folder: ['Frequently Asked Question Items'] },
    culture: "en",
    items: [
      {
        name: 'What is SitecoreAI?',
        fields: {
          Question: 'What is SitecoreAI?',
          Answer: '<p>SitecoreAI is a fully cloud-native SaaS digital experience platform that connects <a href="https://www.sitecore.com/platform/ai-search">AI visibility</a> and content management to personalization and conversion optimization. AI is built into every workflow, with 20+ pre-built AI-powered agents helping teams create, tag, translate, personalize, and activate content. AI capabilities are included from day one.</p>',
        },
      },
      {
        name: 'How is SitecoreAI different from a traditional CMS?',
        fields: {
          Question: 'How is SitecoreAI different from a traditional CMS?',
          Answer: '<p>A traditional CMS primarily manages and publishes content. SitecoreAI connects content management with digital assets, content operations, audience insights, personalization, conversion optimization, and AI-powered workflows in one platform. That gives marketing teams the capabilities to create, manage, personalize, and optimize digital experiences without stitching together disconnected point solutions.</p>',
        },
      },
      {
        name: 'How is AI built into SitecoreAI?',
        fields: {
          Question: 'How is AI built into SitecoreAI?',
          Answer: '<p>AI is built across SitecoreAI rather than added as a separate layer. AI and agents help teams create and translate content, tag and manage assets, understand customer intent, personalize experiences, optimize performance, and automate workflows. Because AI operates within connected SitecoreAI workflows, marketers can use it as part of their everyday work rather than moving between separate AI tools.</p>',
        },
      },
      {
        name: 'How does SitecoreAI deliver personalization at scale?',
        fields: {
          Question: 'How does SitecoreAI deliver personalization at scale?',
          Answer: '<p>SitecoreAI uses AI and agents to generate localized, account-aware, and segment-specific content variants at scale. Connected content and audience insights help teams tailor experiences for different audiences, while brand guardrails help keep every variation consistent. This removes the manual bottleneck that has traditionally limited personalization at scale.</p>',
        },
      },
      {
        name: 'How does SitecoreAI keep AI-generated content on brand?',
        fields: {
          Question: 'How does SitecoreAI keep AI-generated content on brand?',
          Answer: '<p><a href="https://www.sitecore.com/platform/product-strategy">Marketing IQ</a> gives SitecoreAI agents a shared context across your content, brand, customers, and performance. This carries your approved voice, rules, and standards into each task. Permissions, approval steps, and audit logs keep your team in control of what reaches the customer.</p>',
        },
      },
      {
        name: 'How does SitecoreAI give marketers control over AI?',
        fields: {
          Question: 'How does SitecoreAI give marketers control over AI?',
          Answer: '<p>SitecoreAI puts AI inside governed marketing workflows rather than operating it as a separate black box. Teams can use permissions, approval gates, brand guardrails, and human oversight to control how AI and agents contribute to content and experiences. AI helps accelerate the work while marketers remain in control of what reaches the customer.</p>',
        },
      },
      {
        name: 'How does SitecoreAI fit with the rest of my technology stack?',
        fields: {
          Question: 'How does SitecoreAI fit with the rest of my technology stack?',
          Answer: '<p>SitecoreAI connects with CRM, analytics, and other technologies through pre-built connectors and integrations. Data and workflows can move across systems, while APIs, SDKs, apps, webhooks, and App Studio give organizations ways to extend SitecoreAI around their existing technology and workflows.</p>',
        },
      },
      {
        name: 'How does SitecoreAI balance AI, ease of use, and extensibility?',
        fields: {
          Question: 'How does SitecoreAI balance AI, ease of use, and extensibility?',
          Answer: '<p>SitecoreAI combines built-in AI with marketer-friendly workflows and an open, extensible architecture. Marketing teams can use AI and agents to create, personalize, and optimize experiences without moving between disconnected tools, while developers can extend the platform through APIs, SDKs, webhooks, apps, and integrations. This gives organizations the ease of an integrated SaaS platform without sacrificing the flexibility to connect SitecoreAI to their wider technology stack.</p>',
        },
      },
      {
        name: 'How does SitecoreAI work for both marketers and developers?',
        fields: {
          Question: 'How does SitecoreAI work for both marketers and developers?',
          Answer: '<p>SitecoreAI gives marketers connected, AI-powered workflows for creating, personalizing, and optimizing experiences, while giving developers the tools to extend the platform through APIs, SDKs, webhooks, apps, and integrations. Teams get the simplicity of an integrated SaaS platform without giving up the flexibility to connect and extend it.</p>',
        },
      },
      {
        name: 'Does SitecoreAI charge by tokens?',
        fields: {
          Question: 'Does SitecoreAI charge by tokens?',
          Answer: '<p>No. AI capabilities in SitecoreAI are included in the software, with no separate token charges, per-agent fees, or AI add-ons for included capabilities. That’s why the AI in SitecoreAI stands for <strong>Already Included.</strong></p>',
        },
      },
      {
        name: 'How do I get started with SitecoreAI?',
        fields: {
          Question: 'How do I get started with SitecoreAI?',
          Answer: '<p>New to Sitecore? <a href="https://www.sitecore.com/request-a-demo">Request a demo</a> or explore our <a href="https://www.sitecore.com/solutions/customers">customer stories</a>. Already on XP, XM? Talk to your account team, many SitecoreAI capabilities may already be in your entitlements.</p>',
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
