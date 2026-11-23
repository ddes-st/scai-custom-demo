import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreTransformMarketingTilesDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-transform-marketing-tiles",
  name: "sitecore-transform-marketing-tiles",
  componentName: "SitecoreTransformMarketingTiles",
  displayName: "Transform Marketing Tiles",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Trusted Answer Cards'] },
  model: {
    folderTemplate: { name: 'Trusted Answer Cards Folder' },
    itemTemplate: {
      name: 'Trusted Answer Cards',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Eyebrow', type: 'Single-Line Text' },
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Description', type: 'Rich Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "trusted-answer-cards", allowedControls: ["sitecore-trusted-answer-card"] }],
  content: {
    location: { root: 'data', folder: ['Trusted Answer Cards'] },
    culture: "en",
    items: [{
      name: 'Trusted Answer Cards',
      fields: {
        Eyebrow: 'Transform marketing ambition',
        Heading: 'Be the answer your customer trusts',
        Description: '<p>Connect AI visibility with content creation and digital experiences so every customer interaction becomes an opportunity to grow.</p>',
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
