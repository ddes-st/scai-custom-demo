import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreCookiePreferenceToggleDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-cookie-preference-toggle",
  name: "sitecore-cookie-preference-toggle",
  componentName: "SitecoreCookiePreferenceToggle",
  displayName: "Cookie Preference Toggle",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Cookie Preference Toggles'] },
  model: {
    folderTemplate: { name: 'Cookie Preference Toggle Folder' },
    itemTemplate: {
      name: 'Cookie Preference Toggle',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Category', type: 'Single-Line Text' },
          { name: 'Enabled', type: 'Checkbox' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Cookie Preference Toggles'] },
    culture: "en",
    items: [
      { name: 'Targeted Advertising', fields: { Category: 'Targeted Advertising', Enabled: true } },
      { name: 'Personalization', fields: { Category: 'Personalization', Enabled: true } },
      { name: 'Analytics', fields: { Category: 'Analytics', Enabled: true } },
    ],
  },
} satisfies ComponentTemplateDefinition;
