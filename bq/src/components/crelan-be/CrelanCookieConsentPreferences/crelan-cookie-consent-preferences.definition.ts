import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const crelanCookieConsentPreferencesDefinition = {
  kind: "component",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  definitionKey: "crelan-cookie-consent-preferences",
  name: "crelan-cookie-consent-preferences",
  componentName: "CrelanCookieConsentPreferences",
  displayName: "Cookie Consent Preferences",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Cookie Consent Preferences'] },
  model: {
    folderTemplate: { name: 'Cookie Consent Preferences Folder' },
    itemTemplate: {
      name: 'Cookie Consent Preferences',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Logo', type: 'Image' },
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Intro', type: 'Rich Text' },
          { name: 'Privacy Link', type: 'General Link' },
          { name: 'Categories Heading', type: 'Single-Line Text' },
          { name: 'Refuse Button', type: 'Single-Line Text' },
          { name: 'Manage Button', type: 'Single-Line Text' },
          { name: 'Powered By Logo', type: 'Image' },
          { name: 'Powered By Link', type: 'General Link' }
        ]
      }]
    }
  },
  placeholders: [{ key: "category-items", allowedControls: ["crelan-cookie-category"] }],
  content: {
    location: { root: 'data', folder: ['Cookie Consent Preferences'] },
    culture: "nl-BE",
    items: [{
      name: 'Cookie Consent Preferences',
      fields: {
        Logo: { url: 'https://cookie-cdn.cookiepro.com/logos/d6929209-baf1-48a5-93aa-b21e4fd12594/eb6f1d52-1ae3-4bef-a108-055cf486719f/e93584fa-dcec-4c40-9488-4950b0791e32/logo.png', alt: 'Crelan' },
        Heading: 'Voorkeurenmenu',
        Intro: '<p>Crelan maakt gebruik van cookies om uw gebruikservaring te verbeteren. Een cookie is een klein bestand dat op uw toestel wordt opgeslagen, en dat toelaat om uw toestel te identificeren. De informatie wordt gebruikt voor verschillende doeleinden: om de website correct te laten werken, om gemakkelijker te surfen, om de inhoud van de website te verbeteren, of om u relevante diensten aan te bieden. In dit menu kan u ervoor kiezen om bepaalde soorten cookies niet toe te laten.</p>',
        'Privacy Link': { text: 'Meer informatie vindt u in het cookiebeleid', url: 'https://www.crelan.be/nl/particulieren/privacy' },
        'Categories Heading': 'Cookievoorkeuren beheren',
        'Refuse Button': 'Weiger cookies',
        'Manage Button': 'Beheer cookies per doel',
        'Powered By Logo': { url: 'https://cookie-cdn.cookiepro.com/logos/static/poweredBy_cp_logo.svg', alt: 'Powered by Onetrust' },
        'Powered By Link': { text: 'Powered by OneTrust', url: 'https://www.cookiepro.com/products/cookie-consent/' }
      }
    }]
  }
} satisfies ComponentTemplateDefinition;
