import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreAnalystRecognitionReportCardDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-analyst-recognition-report-card",
  name: "sitecore-analyst-recognition-report-card",
  componentName: "SitecoreAnalystRecognitionReportCard",
  displayName: "Analyst Recognition Report Card",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Analyst Recognition Report Cards'] },
  model: {
    folderTemplate: { name: 'Analyst Recognition Report Cards Folder' },
    itemTemplate: {
      name: 'Analyst Recognition Report Card',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Logo', type: 'Image' },
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'CTA Label', type: 'Single-Line Text' },
          { name: 'Link', type: 'General Link' },
          { name: 'Target', type: 'Single-Line Text' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Analyst Recognition Report Cards'] },
    culture: "en",
    items: [
      {
        name: 'Gartner Magic Quadrant Report',
        fields: {
          Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/e0e974312db94cf6ac19e5075164ea48?t=sc350', alt: 'logo' },
          Title: 'Sitecore named a Leader in the 2026 Gartner® Magic Quadrant for Content Marketing Platforms™',
          'CTA Label': 'Download the report',
          Link: { text: 'Download the report', url: 'https://www.sitecore.com/solutions/analyst-reports/gartner-magic-quadrant-content-marketing-leader' },
          Target: '',
        },
      },
      {
        name: 'Forrester Wave Report',
        fields: {
          Logo: { url: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/4473eb12a9fb4e6e956c279e62940b87?t=sc350', alt: 'lofo forrester' },
          Title: 'Sitecore named a Leader in The Forrester Wave™: Digital Experience Platforms, Q4 2025',
          'CTA Label': 'Access the report',
          Link: { text: 'Access the report', url: 'https://www.sitecore.com/solutions/analyst-reports/the-forrester-wave-digital-experience-platforms' },
          Target: '_blank',
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
