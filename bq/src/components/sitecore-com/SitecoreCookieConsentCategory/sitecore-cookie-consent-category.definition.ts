import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreCookieConsentCategoryDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-cookie-consent-category",
  name: "sitecore-cookie-consent-category",
  componentName: "SitecoreCookieConsentCategory",
  displayName: "Cookie Consent Category",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Cookie Consent Categories'] },
  model: {
    folderTemplate: { name: 'Cookie Consent Category Folder' },
    itemTemplate: {
      name: 'Cookie Consent Category',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Enabled', type: 'Checkbox' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Cookie Consent Categories'] },
    culture: "en",
    items: [
      {
        name: 'Targeted Advertising',
        fields: {
          Title: 'Targeted Advertising',
          Enabled: true,
        },
      },
      {
        name: 'Personalization',
        fields: {
          Title: 'Personalization',
          Enabled: true,
        },
      },
      {
        name: 'Analytics',
        fields: {
          Title: 'Analytics',
          Enabled: true,
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
