import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const crelanFooterLinksDefinition = {
  kind: "component",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  definitionKey: "crelan-footer-links",
  name: "crelan-footer-links",
  componentName: "CrelanFooterLinks",
  displayName: "Footer Links",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Footer Links'] },
  model: {
    folderTemplate: { name: 'Footer Links Folder' },
    itemTemplate: {
      name: 'Footer Links',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Background Graphic', type: 'Image' },
        ],
      }],
    },
  },
  placeholders: [{ key: "footer-columns", allowedControls: ["crelan-footer-column"] }],
  content: {
    location: { root: 'data', folder: ['Footer Links'] },
    culture: "nl-BE",
    items: [{
      name: 'Footer Links',
      fields: {
        'Background Graphic': {
          url: 'https://www.crelan.be/themes/custom/calibr8_easytheme/images/graphic-device/Crelan-two_shape_device-01-C-rgb-rotate.png',
          alt: '',
        },
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
