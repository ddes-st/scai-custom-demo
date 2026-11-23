import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreBuiltByYouCustomerStoriesCarouselDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-built-by-you-customer-stories-carousel",
  name: "sitecore-built-by-you-customer-stories-carousel",
  componentName: "SitecoreBuiltByYouCustomerStoriesCarousel",
  displayName: "Built By You Customer Stories Carousel",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Customer Story Pillar Carousels'] },
  model: {
    folderTemplate: { name: 'Customer Story Pillar Carousel Folder' },
    itemTemplate: {
      name: 'Customer Story Pillar Carousel',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'CTA', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [{ key: "pillar-cards", allowedControls: ["sitecore-customer-story-pillar-card"] }],
  content: {
    location: { root: 'data', folder: ['Customer Story Pillar Carousels'] },
    culture: "en",
    items: [{
      name: 'Customer Story Pillar Carousel',
      fields: {
        Heading: 'Built by you. Powered by Sitecore.',
        CTA: { text: 'Discover customer stories', url: 'https://www.sitecore.com/solutions/customers' },
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
