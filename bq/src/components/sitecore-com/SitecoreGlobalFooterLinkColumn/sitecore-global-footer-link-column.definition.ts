import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreGlobalFooterLinkColumnDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-global-footer-link-column",
  name: "sitecore-global-footer-link-column",
  componentName: "SitecoreGlobalFooterLinkColumn",
  displayName: "Global Footer Link Column",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Global Footer Link Columns'] },
  model: {
    folderTemplate: { name: 'Global Footer Link Column Folder' },
    itemTemplate: {
      name: 'Global Footer Link Column',
      sections: [{ name: 'Content', fields: [{ name: 'Title', type: 'Single-Line Text' }, { name: 'Links', type: 'Multi-Line Text' }] }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Global Footer Link Columns'] },
    culture: "en",
    items: [
      { name: 'Platform', fields: { Title: 'Platform', Links: JSON.stringify([{ text: 'Platform overview', url: 'https://www.sitecore.com/platform' }, { text: 'AI Search', url: 'https://www.sitecore.com/platform/ai-search', tag: 'NEW' }, { text: 'AI and agents', url: 'https://www.sitecore.com/platform/ai-and-agents' }, { text: 'Content Management System', url: 'https://www.sitecore.com/platform/content-management-system' }, { text: 'Digital Asset Management', url: 'https://www.sitecore.com/platform/digital-asset-management' }, { text: 'Content operations', url: 'https://www.sitecore.com/platform/content-operations' }, { text: 'Audience and insights', url: 'https://www.sitecore.com/platform/audience-and-insights' }, { text: 'Conversion optimization', url: 'https://www.sitecore.com/platform/conversion-optimization' }, { text: 'Commerce', url: 'https://www.sitecore.com/platform/commerce' }, { text: 'Experience Manager (XM)', url: 'https://www.sitecore.com/platform/experience-manager' }, { text: 'Experience Platform (XP)', url: 'https://www.sitecore.com/platform/experience-platform' }, { text: 'Connect', url: 'https://www.sitecore.com/platform/connect' }, { text: 'Send', url: 'https://www.sitecore.com/platform/send' }]) } },
      { name: 'Solutions', fields: { Title: 'Solutions', Links: JSON.stringify([{ text: 'Product strategy', url: 'https://www.sitecore.com/platform/product-strategy' }, { text: 'Modernize your DX', url: 'https://www.sitecore.com/solutions/modernize-your-dx' }, { text: 'Manage global content', url: 'https://www.sitecore.com/solutions/manage-global-content' }, { text: 'Deliver limitless commerce', url: 'https://www.sitecore.com/solutions/deliver-limitless-commerce' }, { text: 'Optimize with data', url: 'https://www.sitecore.com/solutions/optimize-with-data' }, { text: 'All Customer Stories', url: 'https://www.sitecore.com/solutions/customers' }, { text: 'All Experience Awards', url: 'https://www.sitecore.com/solutions/customer-awards' }, { text: 'All Analyst Reports', url: 'https://www.sitecore.com/solutions/analyst-reports' }, { text: 'Sitecore Symposium', url: 'https://symposium.sitecore.com', external: true }]) } },
      { name: 'Resources', fields: { Title: 'Resources', Links: JSON.stringify([{ text: 'Thought leadership', url: 'https://www.sitecore.com/solutions/topics' }, { text: 'Use case library', url: 'https://www.sitecore.com/platform/use-cases', tag: 'NEW' }, { text: 'Resource Hub', url: 'https://www.sitecore.com/resources' }, { text: 'Insights', url: 'https://www.sitecore.com/resources/insights' }, { text: 'Events & Webinars', url: 'https://www.sitecore.com/resources/events-webinars' }, { text: 'Trust Center', url: 'https://trust.sitecore.com/', external: true }, { text: 'Support', url: 'https://www.sitecore.com/resources/support' }]) } },
      { name: 'Services', fields: { Title: 'Services', Links: JSON.stringify([{ text: 'Managed Cloud', url: 'https://www.sitecore.com/platform/managed-cloud' }, { text: 'Sitecore Services', url: 'https://www.sitecore.com/platform/sitecore-services' }, { text: 'Sitecore360', url: 'https://www.sitecore.com/platform/sitecore360' }, { text: 'Sitecore Learning', url: 'https://www.sitecore.com/platform/sitecore-training' }, { text: 'AI Innovation Lab', url: 'https://www.sitecore.com/platform/ai-innovation-lab' }]) } },
      { name: 'Company', fields: { Title: 'Company', Links: JSON.stringify([{ text: 'About Us', url: 'https://www.sitecore.com/company' }, { text: 'Contact us', url: 'https://www.sitecore.com/company/contact-us' }, { text: 'Newsroom', url: 'https://www.sitecore.com/company/newsroom' }, { text: 'Careers', url: 'https://jobs.ashbyhq.com/sitecore', external: true }]) } },
    ],
  },
} satisfies ComponentTemplateDefinition;
