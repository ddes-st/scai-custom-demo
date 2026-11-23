import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreCookieConsentBannerDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-cookie-consent-banner",
  name: "sitecore-cookie-consent-banner",
  componentName: "SitecoreCookieConsentBanner",
  displayName: "Cookie Consent Banner",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Cookie Consent Banners'] },
  model: {
    folderTemplate: { name: 'Cookie Consent Banner Folder' },
    itemTemplate: {
      name: 'Cookie Consent Banner',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Message', type: 'Multi-Line Text' },
          { name: 'Privacy Policy', type: 'General Link' },
          { name: 'Storage Preferences', type: 'Single-Line Text' },
          { name: 'Save', type: 'Single-Line Text' },
          { name: 'Accept All', type: 'Single-Line Text' },
          { name: 'Reject Non-Essential', type: 'Single-Line Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "cookie-categories", allowedControls: ["sitecore-cookie-consent-category"] }],
  content: {
    location: { root: 'data', folder: ['Cookie Consent Banners'] },
    culture: "en",
    items: [{
      name: 'Cookie Consent Banner',
      fields: {
        Message: 'This website utilizes technologies such as cookies to enable essential site functionality, as well as for analytics, personalization, and targeted advertising. You may change your settings at any time or accept the default settings. You may close this banner to continue with only essential cookies.',
        'Privacy Policy': { text: 'Privacy Policy', url: 'https://www.sitecore.com/legal/privacy-policy' },
        'Storage Preferences': 'Storage Preferences',
        Save: 'Save',
        'Accept All': 'Accept All',
        'Reject Non-Essential': 'Reject Non-Essential',
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
