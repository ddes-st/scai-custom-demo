import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreCustomerStoryCardDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-customer-story-card",
  name: "sitecore-customer-story-card",
  componentName: "SitecoreCustomerStoryCard",
  displayName: "Customer Story Card",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Customer Story Pillar Cards'] },
  model: {
    folderTemplate: { name: 'Customer Story Pillar Card Folder' },
    itemTemplate: {
      name: 'Customer Story Pillar Card',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Background Image', type: 'Image' },
          { name: 'Logo', type: 'Image' },
          { name: 'Eyebrow', type: 'Single-Line Text' },
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Description', type: 'Single-Line Text' },
          { name: 'Link', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Customer Story Pillar Cards'] },
    culture: "en",
    items: [
      {
        name: 'United Airlines',
        fields: {
          'Background Image': { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/9cddb80103c842ba86b3c2a45a9bcfbd?v=473c5499', alt: 'United Airlines customer story' },
          Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/91c5a7501df34217a85d66c4a4a40fab?t=sc42h', alt: 'United Airlines logo white' },
          Eyebrow: 'Travel and Hospitality',
          Title: 'United Airlines delivers personalized travel experiences with Sitecore',
          Description: 'Digital signage for smoother travel.',
          Link: { text: 'United Airlines customer story', url: 'https://www.sitecore.com/solutions/customers/united-airlines/united-airlines-delivers-82-percent-better-travel-experience-with-sitecore' },
        },
      },
      {
        name: 'VELUX',
        fields: {
          'Background Image': { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/34d92eaa56a54b08a652f2398e4083ab?v=0e272cb1', alt: 'VELUX customer story' },
          Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/fdee8e75b638454d9c395027b57621e5?t=sc42h', alt: 'Velux logo white' },
          Eyebrow: 'Manufacturing',
          Title: 'VELUX governs content across 190 sites with SitecoreAI',
          Description: 'Consistent global digital experiences.',
          Link: { text: 'VELUX customer story', url: 'https://www.sitecore.com/solutions/customers/velux/velux-transforms-digital-engagement-with-sitecore' },
        },
      },
      {
        name: 'WellSpan',
        fields: {
          'Background Image': { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/f597528df9d6415ab5f3a9a3553415b2?v=989d470e', alt: 'WellSpan customer story' },
          Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/cf26009480c04b51bb6f224708b6b148?t=sc42h', alt: 'Wellspan logo in white' },
          Eyebrow: 'Healthcare',
          Title: 'WellSpan optimizes online user experiences with Sitecore',
          Description: 'Unified, personalized, secure care experiences.',
          Link: { text: 'WellSpan customer story', url: 'https://www.sitecore.com/solutions/customers/wellspan/wellspan-health-customer-success-story' },
        },
      },
      {
        name: 'Sparebanken Vest',
        fields: {
          'Background Image': { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/1c22f8acae0b4dbab1b263daec7b08f0?v=c0df0730', alt: 'Sparebanken Vest customer story' },
          Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/cc068d40462e4aea80fe0b1cc00ce0fe?t=sc42h', alt: 'Sparebanken logo white' },
          Eyebrow: 'Financial Services',
          Title: 'Norwegian bank drives up productivity by 80% with Sitecore',
          Description: 'Higher customer satisfaction with SaaS CMS.',
          Link: { text: 'Sparebanken Vest customer story', url: 'https://www.sitecore.com/solutions/customers/sparebanken-vest/norwegian-bank-drives-up-productivity-by-80-percent-with-sitecore-xm-cloud' },
        },
      },
      {
        name: 'Emirates',
        fields: {
          Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/adffbb223a7543d7a554d3afdf001a8d?t=sc42h', alt: 'White Emirates logo' },
          Eyebrow: 'Travel and Hospitality',
          Title: '',
          Description: 'Faster insights into customer friction.',
        },
      },
      {
        name: 'Foodstuffs NZ',
        fields: {
          'Background Image': { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/5337a40899b74aa3ba6800af70068f8a?v=b86e763a', alt: 'Foodstuffs NZ customer story' },
          Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/48324dd670f14bcfb5ca918202b0fd94?t=sc42h', alt: 'Foodstuffs NZ logo white' },
          Eyebrow: 'Retail',
          Title: 'Foodstuffs boosts digital agility and efficiency',
          Description: 'Scalable digital growth foundation.',
          Link: { text: 'Foodstuffs NZ customer story', url: 'https://www.sitecore.com/solutions/customers/foodstuffs-nz/foodstuffs-launches-new-sites-25-percent-faster-with-sitecore' },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
