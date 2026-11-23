import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreAnalystRecognitionReportSignpostDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-analyst-recognition-report-signpost",
  name: "sitecore-analyst-recognition-report-signpost",
  componentName: "SitecoreAnalystRecognitionReportSignpost",
  displayName: "Analyst Recognition Report Signpost",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Analyst Recognition Report Signposts'] },
  model: {
    folderTemplate: { name: 'Analyst Recognition Report Signposts Folder' },
    itemTemplate: {
      name: 'Analyst Recognition Report Signpost',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Logo', type: 'Image' },
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'CTA', type: 'Single-Line Text' },
          { name: 'Report Link', type: 'General Link' },
          { name: 'Open in New Window', type: 'Checkbox' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Analyst Recognition Report Signposts'] },
    culture: "en",
    items: [
      {
        name: 'Gartner Content Marketing Platforms Report',
        fields: {
          Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/e0e974312db94cf6ac19e5075164ea48?t=sc350', alt: 'logo' },
          Title: 'Sitecore named a Leader in the 2026 Gartner® Magic Quadrant for Content Marketing Platforms™',
          CTA: 'Download the report',
          'Report Link': { text: 'Sitecore named a Leader in the 2026 Gartner® Magic Quadrant for Content Marketing Platforms™', url: 'https://www.sitecore.com/solutions/analyst-reports/gartner-magic-quadrant-content-marketing-leader' },
          'Open in New Window': false,
        },
      },
      {
        name: 'Forrester Digital Experience Platforms Report',
        fields: {
          Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/4473eb12a9fb4e6e956c279e62940b87?t=sc350', alt: 'logo forrester' },
          Title: 'Sitecore named a Leader in The Forrester Wave™: Digital Experience Platforms, Q4 2025',
          CTA: 'Access the report',
          'Report Link': { text: 'Sitecore named a Leader in The Forrester Wave™: Digital Experience Platforms, Q4 2025', url: 'https://www.sitecore.com/solutions/analyst-reports/the-forrester-wave-digital-experience-platforms' },
          'Open in New Window': true,
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
