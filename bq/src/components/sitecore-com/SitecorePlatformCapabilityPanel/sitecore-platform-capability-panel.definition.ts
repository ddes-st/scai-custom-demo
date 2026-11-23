import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecorePlatformCapabilityPanelDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-platform-capability-panel",
  name: "sitecore-platform-capability-panel",
  componentName: "SitecorePlatformCapabilityPanel",
  displayName: "Platform Capability Panel",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Sitecore Platform Capability Panels'] },
  model: {
    folderTemplate: { name: 'Platform Capability Panel Folder' },
    itemTemplate: {
      name: 'Platform Capability Panel',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Action', type: 'Single-Line Text' },
          { name: 'Tagline', type: 'Single-Line Text' },
          { name: 'Description', type: 'Rich Text' },
          { name: 'CTA', type: 'General Link' },
          { name: 'Icon', type: 'Image' },
          { name: 'Foundation', type: 'Single-Line Text' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Sitecore Platform Capability Panels'] },
    culture: "en",
    items: [
      {
        name: 'Content Management System',
        fields: {
          Title: 'Content Management System',
          Action: 'Create',
          Tagline: 'Content that moves at the speed of marketing',
          Description: '<p>Create, manage, and publish digital experiences faster with a CMS designed for high-volume, multi-brand, multi-region, and omnichannel delivery. As part of SitecoreAI, CMS connects directly to DAM, Audience Insight, and Content Optimization, making every experience easier to tailor, test, and update.</p><ul><li><strong>Visual authoring and fast publishing built for fast‑moving teams</strong></li><li><strong>Scalable delivery across brands, regions, and channels, including highly regulated industries like healthcare</strong></li><li><strong>Built-in connection to personalization and testing across the platform</strong></li></ul>',
          CTA: { text: 'Master the CMS', url: 'https://www.sitecore.com/platform/content-management-system' },
          Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/c918b34864ad4924a696c63db3caeebe?v=128ef3b3', alt: 'Content Management' },
          Foundation: 'Agents draft, tag, and translate in real-time.',
        },
      },
      {
        name: 'Digital Asset Management',
        fields: {
          Title: 'Digital Asset Management',
          Action: 'Organize',
          Tagline: 'On-brand assets, ready for every experience and every AI answer.',
          Description: '<p>Keep every approved asset in one governed library your teams can search by what\'s inside. Within SitecoreAI, DAM connects those assets to campaigns and experiences, and Scrunch Knowledge Studio uses them to check what AI says about your brand.</p><ul><li><strong>Visual AI search and auto-tagging on every asset</strong></li><li><strong>Rights and approvals enforced before anything goes live</strong></li><li><strong>Approved content connected to Scrunch Knowledge Studio for AI discovery</strong></li></ul>',
          CTA: { text: 'Dive into DAM', url: 'https://www.sitecore.com/platform/digital-asset-management' },
          Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/a382c54596d24ea5a8b11c89cf5dca8a?v=f7ac1e24', alt: 'Digital Asset Management' },
          Foundation: 'Search, auto-tagging, and metadata enrichment built in.',
        },
      },
      {
        name: 'Content Operations',
        fields: {
          Title: 'Content Operations',
          Action: 'Orchestrate',
          Tagline: 'Bring clarity and control to every workflow',
          Description: '<p>Plan, brief, coordinate, and move work forward in one governed workspace. As part of SitecoreAI, Content Operations connects planning to assets, content creation, approvals, and performance so marketing can execute with more clarity and less friction.</p><ul><li><strong>Connected briefs, workflows, and approvals in one place</strong></li><li><strong>Strong alignment across teams, timelines, and production</strong></li><li><strong>Shared context for content, assets, and execution across the platform</strong></li></ul>',
          CTA: { text: 'Fuel your content', url: 'https://www.sitecore.com/platform/content-operations' },
          Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/b82a2cd5ba694a0fb29abf9c89d31cfc?v=81837914', alt: 'Content Operations' },
          Foundation: 'Agents draft briefs, route approvals, and chase the work forward.',
        },
      },
      {
        name: 'Audience and Insights',
        fields: {
          Title: 'Audience and Insights',
          Action: 'Listen',
          Tagline: 'Turn real-time signals into actionable insights and smarter action',
          Description: '<p>Unified profiles, behavior, and intent come together in one dashboard view. Within SitecoreAI, Audience and Insights connect profiles, behavior, and intent to the content and experiences teams deliver.</p><ul><li><strong>Unified profiles that bring customer context into one view</strong></li><li><strong>Real-time signals for smarter segmentation and targeting</strong></li><li><strong>Governance and privacy controls built into activation</strong></li></ul>',
          CTA: { text: 'Transform with AI', url: 'https://www.sitecore.com/platform/audience-and-insights' },
          Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/0420167544864a04880e546a91cf8e83?v=d906fc45', alt: 'Audience and Intelligence' },
          Foundation: 'Real-time signals turned into insightful segments.',
        },
      },
      {
        name: 'Conversion Optimization',
        fields: {
          Title: 'Conversion Optimization',
          Action: 'Respond',
          Tagline: 'Make every user experience work harder',
          Description: '<p>Run personalization, testing, and search together inside one platform. Conversion Optimization helps teams act on insight faster and refine experiences in real time.</p><ul><li><strong>Real-time personalization based on audience and context</strong></li><li><strong>Testing, A/B tests, and experimentation to improve results, retention, and key metrics over time</strong></li><li><strong>Search and recommendations that help customers find what matters</strong></li></ul>',
          CTA: { text: 'Power up your personalization', url: 'https://www.sitecore.com/platform/conversion-optimization' },
          Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/0f8e55dbff0a405ebf895017f2b41d13?v=4d1a9db7', alt: 'Search and Personalization' },
          Foundation: 'AI-powered variant testing that uses machine learning to run experiments and learn what works.',
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
