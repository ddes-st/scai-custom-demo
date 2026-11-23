import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreCustomerStoriesMediaSliderDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-customer-stories-media-slider",
  name: "sitecore-customer-stories-media-slider",
  componentName: "SitecoreCustomerStoriesMediaSlider",
  displayName: "Customer Stories Media Slider",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Customer Story Media Items'] },
  model: {
    folderTemplate: { name: 'Customer Story Media Item Folder' },
    itemTemplate: {
      name: 'Customer Story Media Item',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Logo', type: 'Image' },
          { name: 'Logo Alt', type: 'Single-Line Text' },
          { name: 'Thumbnail', type: 'Image' },
          { name: 'Thumbnail Alt', type: 'Single-Line Text' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Customer Story Media Items'] },
    culture: "en",
    items: [
      { name: 'How ENMAX transformed their digital experience', fields: { Title: 'How ENMAX transformed their digital experience', Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/b96440d2b9a74eb09ed5cfe8feefa44b?t=sc96h', alt: 'Enmax logo' }, 'Logo Alt': 'Enmax logo', Thumbnail: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/b465b0f49b834549b86767b4c5244380?t=sc1200', alt: 'SitecoreAI customer video thumbnail for ENMAX digital experience video' }, 'Thumbnail Alt': 'SitecoreAI customer video thumbnail for ENMAX digital experience video' } },
      { name: "Shriners Children's modernized care through DX", fields: { Title: "Shriners Children's modernized care through DX", Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/9f1c469a57ec44aaa262536a0366f0e9?t=sc96h', alt: "Shriner's children logo" }, 'Logo Alt': "Shriner's children logo", Thumbnail: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/39f615424f93440ebe4b56a766235260?t=sc1200', alt: "SitecoreAI customer video thumbnail for Shriner's Children modernizing care digital experience video" }, 'Thumbnail Alt': "SitecoreAI customer video thumbnail for Shriner's Children modernizing care digital experience video" } },
      { name: 'How GoTo Technologies modernized its digital experience', fields: { Title: 'How GoTo Technologies modernized its digital experience', Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/4272c19c000b4500a1745357ce27eb8f?t=sc96h', alt: 'GoTo Technologies logo' }, 'Logo Alt': 'GoTo Technologies logo', Thumbnail: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/d6ee167c6c3c4f9fb82e578ed7975250?t=sc1200', alt: 'SitecoreAI customer video thumbnail for GoTo Technologies transformed digital experience video' }, 'Thumbnail Alt': 'SitecoreAI customer video thumbnail for GoTo Technologies transformed digital experience video' } },
      { name: "The backbone of AFL's martech stack", fields: { Title: "The backbone of AFL's martech stack", Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/6b3ebe50dab04bc1b837ccd2bbe384f6?t=sc96h', alt: 'AFL logo' }, 'Logo Alt': 'AFL logo', Thumbnail: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/b28637b815bc4fc29be4773d660c5370?t=sc1200', alt: 'SitecoreAI customer video thumbnail for AFL martech stack video' }, 'Thumbnail Alt': 'SitecoreAI customer video thumbnail for AFL martech stack video' } },
      { name: "Powering Atkore's digital growth", fields: { Title: "Powering Atkore's digital growth", Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/4a7b290eec094d3c988f929765e4a6dc?t=sc96h', alt: 'Atkore logo' }, 'Logo Alt': 'Atkore logo', Thumbnail: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/1fdcb2f05cce418285070eef2a5f73b3?t=sc1200', alt: 'SitecoreAI customer video thumbnail for Atkore powering digital growth video' }, 'Thumbnail Alt': 'SitecoreAI customer video thumbnail for Atkore powering digital growth video' } },
      { name: 'Hexagon’s digital transformation', fields: { Title: 'Hexagon’s digital transformation', Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/6b5cc0d58c51452cac3db0e068f4c1cf?t=sc96h', alt: 'Hexagon logo' }, 'Logo Alt': 'Hexagon logo', Thumbnail: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/51736af1ddf04982ba5c19ae7d5ddeba?t=sc1200', alt: 'SitecoreAI customer video thumbnail for Hexagon digital transformation video' }, 'Thumbnail Alt': 'SitecoreAI customer video thumbnail for Hexagon digital transformation video' } },
      { name: 'Transforming the Travel Money experience', fields: { Title: 'Transforming the Travel Money experience', Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/a1ba983e13e841378a963c1216735324?t=sc96h', alt: 'Travel Money Group logo' }, 'Logo Alt': 'Travel Money Group logo', Thumbnail: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/8245003de6d34278ab42e0dabe456818?t=sc1200', alt: 'SitecoreAI customer video thumbnail for Travel Money Group Oz transforming experience video' }, 'Thumbnail Alt': 'SitecoreAI customer video thumbnail for Travel Money Group Oz transforming experience video' } },
      { name: "Modernizing BOK Financial's digital experience", fields: { Title: "Modernizing BOK Financial's digital experience", Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/fd290c7afa7043d3bf8f743750fe60fd?t=sc96h', alt: 'Sitecore customer BOK Financial logo' }, 'Logo Alt': 'Sitecore customer BOK Financial logo', Thumbnail: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/efc51d605a1644598e8af3774f905734?t=sc1200', alt: 'SitecoreAI customer video thumbnail for BOK Financial modernising digital experience video' }, 'Thumbnail Alt': 'SitecoreAI customer video thumbnail for BOK Financial modernising digital experience video' } },
    ],
  },
} satisfies ComponentTemplateDefinition;
