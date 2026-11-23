import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreCookieConsentPreferencesDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-cookie-consent-preferences",
  name: "sitecore-cookie-consent-preferences",
  componentName: "SitecoreCookieConsentPreferences",
  displayName: "Cookie Consent Preferences",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Cookie Preferences Banners'] },
  model: {
    folderTemplate: { name: 'Cookie Preferences Banner Folder' },
    itemTemplate: {
      name: 'Cookie Preferences Banner',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Message', type: 'Multi-Line Text' },
          { name: 'Privacy Link', type: 'General Link' },
          { name: 'Storage Preferences Label', type: 'Single-Line Text' },
          { name: 'Close Label', type: 'Single-Line Text' },
          { name: 'Dialog Label', type: 'Single-Line Text' },
          { name: 'Save Label', type: 'Single-Line Text' },
          { name: 'Accept All Label', type: 'Single-Line Text' },
          { name: 'Reject Non-Essential Label', type: 'Single-Line Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "cookie-categories", allowedControls: ["sitecore-cookie-preference-toggle"] }],
  content: {
    location: { root: 'data', folder: ['Cookie Preferences Banners'] },
    culture: "en",
    items: [{
      name: 'Cookie Preferences Banner',
      fields: {
        Message: 'This website utilizes technologies such as cookies to enable essential site functionality, as well as for analytics, personalization, and targeted advertising. You may change your settings at any time or accept the default settings. You may close this banner to continue with only essential cookies.',
        'Privacy Link': { text: 'Privacy Policy', url: 'https://www.sitecore.com/legal/privacy-policy' },
        'Storage Preferences Label': 'Storage Preferences',
        'Close Label': 'Close this consent banner',
        'Dialog Label': 'Cookie Consent Banner',
        'Save Label': 'Save',
        'Accept All Label': 'Accept All',
        'Reject Non-Essential Label': 'Reject Non-Essential',
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
