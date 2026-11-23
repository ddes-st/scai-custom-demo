import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreAwardsLogoCarouselDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-awards-logo-carousel",
  name: "sitecore-awards-logo-carousel",
  componentName: "SitecoreAwardsLogoCarousel",
  displayName: "Awards Logo Carousel",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Recognition Badge Carousels'] },
  model: {
    folderTemplate: { name: 'Recognition Badge Carousel Folder' },
    itemTemplate: {
      name: 'Recognition Badge Carousel',
      sections: [{
        name: 'Content',
        fields: [],
      }],
    },
  },
  placeholders: [{ key: "badge-items", allowedControls: ["sitecore-recognition-badge-item"] }],
  content: {
    location: { root: 'data', folder: ['Recognition Badge Carousels'] },
    culture: "en",
    items: [{
      name: 'Recognition Badge Carousel',
      fields: {},
    }],
  },
} satisfies ComponentTemplateDefinition;
