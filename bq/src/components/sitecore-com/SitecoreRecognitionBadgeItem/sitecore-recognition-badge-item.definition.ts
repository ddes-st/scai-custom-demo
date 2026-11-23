import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreRecognitionBadgeItemDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-recognition-badge-item",
  name: "sitecore-recognition-badge-item",
  componentName: "SitecoreRecognitionBadgeItem",
  displayName: "Recognition Badge Item",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Recognition Badge Items'] },
  model: {
    folderTemplate: { name: 'Recognition Badge Item Folder' },
    itemTemplate: {
      name: 'Recognition Badge Item',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Image', type: 'Image' },
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Height', type: 'Single-Line Text' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Recognition Badge Items'] },
    culture: "en",
    items: [
      { name: 'CMS Critic Awards 2025 Best Enterprise Badge', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/5819c979ab6a499990cff717d69d7467?t=sc120h', alt: 'CMS Critic Awards 2025 Best Enterprise Badge' }, Title: 'CMS Critic Awards 2025 Best Enterprise Badge', Height: '69' } },
      { name: 'G2 Fall 2026 - Momentum Leader', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/959f9bf5420f4c1d8857eb1fc9af1acd?t=sc120h', alt: 'G2 Fall 2026 - Momentum Leader' }, Title: 'G2 Fall 2026 - Momentum Leader', Height: '81' } },
      { name: "TrustRadius 2026 Buyer's Choice Badge", fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/39df36f107c34e949d41995d2b20ca30?t=sc120h', alt: "TrustRadius 2026 Buyer's Choice Badge" }, Title: "TrustRadius 2026 Buyer's Choice Badge", Height: '77' } },
      { name: 'G2 Fall 2026 - Best Results Enterprise', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/ff7162564bb7480e9bd682fa366cf35d?t=sc120h', alt: 'G2 Fall 2026 - Best Results Enterprise' }, Title: 'G2 Fall 2026 - Best Results Enterprise', Height: '81' } },
      { name: 'CMS Critic Awards 2025 Best AI Badge', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/66f7cec215f04db19e2c1bb88a5872e2?t=sc120h', alt: 'CMS Critic Awards 2025 Best AI Badge' }, Title: 'CMS Critic Awards 2025 Best AI Badge', Height: '69' } },
      { name: 'TrustRadius Fall 2026 Tech Cares Badge', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/029c1873a6344cbb9018cff9db091b2a?t=sc120h', alt: 'TrustRadius Fall 2026 Tech Cares Badge' }, Title: 'TrustRadius Fall 2026 Tech Cares Badge', Height: '81' } },
      { name: 'G2 Fall 2026 - Best Relationship Enterprise', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/81ecc0861e7b48b993cba8f5d13ff11a?t=sc120h', alt: 'G2 Fall 2026 - Best Relationship Enterprise' }, Title: 'G2 Fall 2026 - Best Relationship Enterprise', Height: '81' } },
      { name: 'CMS Critic Awards 2025 Best CDP Badge', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/60311da87f334bf39dd3be53653b9047?t=sc120h', alt: 'CMS Critic Awards 2025 Best CDP Badge' }, Title: 'CMS Critic Awards 2025 Best CDP Badge', Height: '69' } },
      { name: 'G2 Fall 2026 - Best Usability Enterprise', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/0e90f05e73974b12ac57ac385c171110?t=sc120h', alt: 'G2 Fall 2026 - Best Usability Enterprise' }, Title: 'G2 Fall 2026 - Best Usability Enterprise', Height: '81' } },
      { name: 'CMS Critic Awards 2025 Best DAM Badge', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/971e7b2d941a497396f453033621fdf8?t=sc120h', alt: 'CMS Critic Awards 2025 Best DAM Badge' }, Title: 'CMS Critic Awards 2025 Best DAM Badge', Height: '69' } },
      { name: 'G2 Fall 2026 - Leader', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/d306a622f92b4ec4865fe1ac17c15c77?t=sc120h', alt: 'G2 Fall 2026 - Leader' }, Title: 'G2 Fall 2026 - Leader', Height: '81' } },
      { name: 'CMS Critic Awards 2025 Best DXP Badge', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/85e7e61001cf479a98cf31796df0c2b5?t=sc120h', alt: 'CMS Critic Awards 2025 Best DXP Badge' }, Title: 'CMS Critic Awards 2025 Best DXP Badge', Height: '69' } },
      { name: 'G2 2026 - Users Love Us', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/1c9a6a26d20948fb85a1e3ed35f87985?t=sc120h', alt: 'G2 2026 - Users Love Us' }, Title: 'G2 2026 - Users Love Us', Height: '81' } },
      { name: 'TrustRadius 2025 Top Rated Badge', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/c42e631b468f45ba94aa05368d82ee4a?t=sc120h', alt: 'TrustRadius 2025 Top Rated Badge' }, Title: 'TrustRadius 2025 Top Rated Badge', Height: '77' } },
      { name: 'CMS Critic Awards 2025 Best Headless CMS Badge', fields: { Image: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/99aa671fcb32491ebf452c715131c8d2?t=sc120h', alt: 'CMS Critic Awards 2025 Best Headless CMS Badge' }, Title: 'CMS Critic Awards 2025 Best Headless CMS Badge', Height: '69' } },
    ],
  },
} satisfies ComponentTemplateDefinition;
