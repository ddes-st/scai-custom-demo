import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreEventsWebinarsCarouselDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-events-webinars-carousel",
  name: "sitecore-events-webinars-carousel",
  componentName: "SitecoreEventsWebinarsCarousel",
  displayName: "Events Webinars Carousel",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Events Webinar Cards'] },
  model: {
    folderTemplate: { name: 'Events Webinar Card Folder' },
    itemTemplate: {
      name: 'Events Webinar Card',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Type', type: 'Single-Line Text' },
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Description', type: 'Rich Text' },
          { name: 'Image', type: 'Image' },
          { name: 'Link', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Events Webinar Cards'] },
    culture: "en",
    items: [
      { name: 'Sitecore Symposium on Tour London 2026', fields: { Type: 'Event', Title: 'Sitecore Symposium on Tour London 2026', Description: '<p>Marketing Rewired comes to London on 26 November 2026. See SitecoreAI and Scrunch in action and hear from customers at Symposium on Tour.</p>', Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/5f36612c8a67431cac626d7e7e743e48?v=e01b88f4&t=sc600x315', alt: 'Sitecore Symposium on Tour London 2026 | Sitecore' }, Link: { text: 'Sitecore Symposium on Tour London 2026', url: 'https://www.sitecore.com/resources/events-webinars/2026/11/sitecore-symposium-on-tour-london' } } },
      { name: 'Sitecore Symposium 2026', fields: { Type: 'Event', Title: 'Sitecore Symposium 2026', Description: '<p>Join us November 10 to 12 in Orlando to explore the ideas and strategies helping marketers lead in the new era of AI discoverability and digital experience.</p>', Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/639325f1a6d1405ab47e21cc6e5a5377?v=122687ea&t=sc600x315', alt: 'Sitecore Symposium 2026 | Marketing Rewired' }, Link: { text: 'Sitecore Symposium 2026', url: 'https://symposium.sitecore.com/' } } },
      { name: 'How AI Is Rewiring the Customer Journey', fields: { Type: 'Webinar', Title: 'How AI Is Rewiring the Customer Journey', Description: '<p>Customers are researching, comparing, and deciding with AI before they ever reach your website. Join this webinar to explore five major shifts in the customer journey and how marketers can adapt.</p>', Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/849051a5ce57432fb4a5e706db55215b?v=7277cf69&t=sc600x315', alt: 'How AI Is Rewiring the Customer Journey | Sitecore' }, Link: { text: 'How AI Is Rewiring the Customer Journey', url: 'https://www.sitecore.com/resources/events-webinars/2026/10/five-shifts-in-the-customer-journey' } } },
      { name: 'DAM’s role in agentic content systems', fields: { Type: 'Webinar', Title: 'DAM’s role in agentic content systems', Description: '<p>Join Sitecore and guest analyst Phyllis Davidson of Forrester to learn how DAM, metadata and governance help make content discoverable and usable by AI.</p>', Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/178c39f30cac4454ad9fecf9065964f8?v=65faf27e&t=sc600x315', alt: 'DAM’s role in agentic content systems | Sitecore' }, Link: { text: 'DAM’s role in agentic content systems', url: 'https://www.sitecore.com/resources/events-webinars/2026/10/dam-agentic-content-systems' } } },
      { name: 'Turn AI visibility insights into action', fields: { Type: 'Webinar', Title: 'Turn AI visibility insights into action', Description: '<p>See how marketers can connect AI visibility insights, trusted content, and publishing workflows to turn recommendations into measurable results.</p>', Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/b3a9edf6591b4fa0b743f6ea9107b86d?v=e380943d&t=sc600x315', alt: 'Turn AI visibility insights into action | Sitecore' }, Link: { text: 'Turn AI visibility insights into action', url: 'https://www.sitecore.com/resources/events-webinars/2026/10/ai-visibility-to-action' } } },
      { name: 'Build an AI-ready content foundation', fields: { Type: 'Webinar', Title: 'Build an AI-ready content foundation', Description: '<p>Turn your DAM from an asset library into a trusted content foundation that people and AI can rely on.</p>', Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/e9d6eaebe7d04f57add1b82e38767a80?v=18ee433e&t=sc600x315', alt: 'Build an AI-ready content foundation | Webinar | Sitecore' }, Link: { text: 'Build an AI-ready content foundation', url: 'https://www.sitecore.com/resources/events-webinars/2026/09/dam-readiness-ai-ready-content-foundation' } } },
      { name: 'AI visibility and your DAM', fields: { Type: 'Webinar', Title: 'AI visibility and your DAM', Description: '<p>Catch up Sitecore’s DAM readiness webinar to see how AI-powered discovery is changing content governance, discoverability, and the future of DAM.</p>', Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/e82c35f083ee4796a180fce795eaa6a7?v=7ed292ff&t=sc600x315', alt: 'AI visibility and your DAM | On-demand webinar | Sitecore' }, Link: { text: 'AI visibility and your DAM', url: 'https://www.sitecore.com/resources/events-webinars/2026/09/your-dam-may-not-be-broken-but-the-world-it-was-built-for-has-changed' } } },
      { name: 'Back-to-School Bootcamp: AI, Content & Customer Experience', fields: { Type: 'Webinar', Title: 'Back-to-School Bootcamp: AI, Content & Customer Experience', Description: '<p>Join Sitecore for Back-to-School Bootcamp: AI, Content & Customer Experience, a three-hour virtual summit designed to help marketing, digital, and customer experience leaders cut through the noise and focus on the strategies that will drive meaningful results in the year ahead.</p>', Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/eef3c79c0dfa4c029c1ea5678193e021?v=3a983f77&t=sc600x315', alt: 'Back-to-School Bootcamp: AI, Content & Customer Experience | Sitecore' }, Link: { text: 'Back-to-School Bootcamp: AI, Content & Customer Experience', url: 'https://www.sitecore.com/resources/events-webinars/2026/09/back-to-school-bootcamp' } } },
    ],
  },
} satisfies ComponentTemplateDefinition;
