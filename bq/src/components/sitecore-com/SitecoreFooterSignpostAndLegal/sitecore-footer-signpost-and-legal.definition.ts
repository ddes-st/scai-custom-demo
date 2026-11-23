import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreFooterSignpostAndLegalDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-footer-signpost-and-legal",
  name: "sitecore-footer-signpost-and-legal",
  componentName: "SitecoreFooterSignpostAndLegal",
  displayName: "Footer Signpost And Legal",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Global Footer Signposts'] },
  model: {
    folderTemplate: { name: 'Global Footer Signposts Folder' },
    itemTemplate: {
      name: 'Global Footer Signposts',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Body', type: 'Rich Text' },
          { name: 'Primary CTA', type: 'General Link' },
          { name: 'Secondary CTA', type: 'General Link' },
          { name: 'Logo', type: 'Image' },
          { name: 'Copyright', type: 'Single-Line Text' },
          { name: 'Legal Links', type: 'Multi-Line Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "signposts", allowedControls: ["sitecore-global-footer-signpost"] }, { key: "link-columns", allowedControls: ["sitecore-global-footer-link-column"] }, { key: "social-links", allowedControls: ["sitecore-global-footer-social-link"] }],
  content: {
    location: { root: 'data', folder: ['Global Footer Signposts'] },
    culture: "en",
    items: [{
      name: 'Global Footer Signposts',
      fields: {
        Heading: 'Own the moments that matter.',
        Body: '<p>Now you can close the loop between visibility and action. Discover how SitecoreAI empowers marketing teams to act on insights and make every customer interaction count.</p>',
        'Primary CTA': { text: 'Request a demo', url: 'https://www.sitecore.com/request-a-demo' },
        'Secondary CTA': { text: 'Contact us', url: 'https://www.sitecore.com/company/contact-us' },
        Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/1a4cb6c5678d4a66a51589f568e71e08?t=sc42h', alt: 'Sitecore Corporate Logo' },
        Copyright: '© Copyright 2026, Sitecore A/S or a Sitecore affiliated company. All rights reserved.',
        'Legal Links': JSON.stringify([
          { text: 'Legal Hub', url: 'https://www.sitecore.com/legal' },
          { text: 'Privacy', url: 'https://www.sitecore.com/legal/privacy-policy' },
          { text: 'Your privacy choices', url: 'https://www.sitecore.com/legal/your-privacy-choices' },
          { text: 'webmaster@sitecore.net', url: 'mailto:webmaster@sitecore.net?subject=Sitecore.com inquiry' },
        ]),
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
