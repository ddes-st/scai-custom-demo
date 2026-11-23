import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecorePlatformCapabilitiesCarouselDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-platform-capabilities-carousel",
  name: "sitecore-platform-capabilities-carousel",
  componentName: "SitecorePlatformCapabilitiesCarousel",
  displayName: "Platform Capabilities Carousel",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Platform Capabilities Carousels'] },
  model: {
    folderTemplate: { name: 'Platform Capabilities Carousel Folder' },
    itemTemplate: {
      name: 'Platform Capabilities Carousel',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "capability-cards", allowedControls: ["sitecore-platform-capability-tile"] }],
  content: {
    location: { root: 'data', folder: ['Platform Capabilities Carousels'] },
    culture: "en",
    items: [{
      name: 'Platform Capabilities Carousel',
      fields: {
        Heading: 'One intelligent system, discovery to decision.',
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
