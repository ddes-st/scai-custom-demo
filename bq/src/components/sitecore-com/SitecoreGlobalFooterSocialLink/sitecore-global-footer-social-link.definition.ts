import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreGlobalFooterSocialLinkDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-global-footer-social-link",
  name: "sitecore-global-footer-social-link",
  componentName: "SitecoreGlobalFooterSocialLink",
  displayName: "Global Footer Social Link",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Global Footer Social Links'] },
  model: {
    folderTemplate: { name: 'Global Footer Social Link Folder' },
    itemTemplate: {
      name: 'Global Footer Social Link',
      sections: [{ name: 'Content', fields: [{ name: 'Icon', type: 'Image' }, { name: 'Link', type: 'General Link' }, { name: 'External', type: 'Checkbox' }] }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Global Footer Social Links'] },
    culture: "en",
    items: [
      { name: 'Email', fields: { Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/3975d178b048439b8eaf05f81baae3d2?t=sc34x34', alt: 'envelope-regular.svg' }, Link: { text: 'Email', url: 'mailto:webmaster@sitecore.net' }, External: false } },
      { name: 'LinkedIn', fields: { Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/40dc78e2bc3547539fe03a55ed1fc0ab?t=sc34x34', alt: 'linkedin-in.svg' }, Link: { text: 'LinkedIn', url: 'https://www.linkedin.com/company/sitecore/' }, External: true } },
      { name: 'X', fields: { Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/cde2794b95f8406a83ac5cd97fa0fee2?t=sc34x34', alt: 'x-twitter.svg' }, Link: { text: 'X', url: 'https://x.com/Sitecore' }, External: true } },
      { name: 'Facebook', fields: { Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/242ce04ffe164f98abf1428b3f99d488?t=sc34x34', alt: 'facebook-f.svg' }, Link: { text: 'Facebook', url: 'https://www.facebook.com/Sitecore' }, External: true } },
      { name: 'Instagram', fields: { Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/5a75dd774a354d5c98fc3239c69643b0?t=sc34x34', alt: 'instagram.svg' }, Link: { text: 'Instagram', url: 'https://www.instagram.com/sitecore/' }, External: true } },
      { name: 'YouTube', fields: { Icon: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/3714cdc442ba421eaf23cf3b56519c9a?t=sc34x34', alt: 'youtube.svg' }, Link: { text: 'YouTube', url: 'https://www.youtube.com/user/sitecorechannel' }, External: true } },
    ],
  },
} satisfies ComponentTemplateDefinition;
