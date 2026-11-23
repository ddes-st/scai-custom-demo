import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreCustomerLogoMarqueeDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-customer-logo-marquee",
  name: "sitecore-customer-logo-marquee",
  componentName: "SitecoreCustomerLogoMarquee",
  displayName: "Customer Logo Marquee",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Customer Logo Marquees'] },
  model: {
    folderTemplate: { name: 'Customer Logo Marquee Folder' },
    itemTemplate: {
      name: 'Customer Logo Marquee',
      sections: [{
        name: 'Content',
        fields: [],
      }],
    },
  },
  placeholders: [{ key: "logo-items", allowedControls: ["sitecore-customer-logo-item"] }],
  content: {
    location: { root: 'data', folder: ['Customer Logo Marquees'] },
    culture: "en",
    items: [{
      name: 'Customer Logo Marquee',
      fields: {},
    }],
  },
} satisfies ComponentTemplateDefinition;
