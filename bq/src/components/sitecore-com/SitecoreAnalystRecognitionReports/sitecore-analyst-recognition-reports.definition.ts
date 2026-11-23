import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreAnalystRecognitionReportsDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-analyst-recognition-reports",
  name: "sitecore-analyst-recognition-reports",
  componentName: "SitecoreAnalystRecognitionReports",
  displayName: "Analyst Recognition Reports",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Analyst Recognition Reports'] },
  model: {
    folderTemplate: { name: 'Analyst Recognition Reports Folder' },
    itemTemplate: {
      name: 'Analyst Recognition Reports',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Eyebrow', type: 'Single-Line Text' },
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Description', type: 'Rich Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "report-cards", allowedControls: ["sitecore-analyst-recognition-report-card"] }],
  content: {
    location: { root: 'data', folder: ['Analyst Recognition Reports'] },
    culture: "en",
    items: [{
      name: 'Analyst Recognition Reports',
      fields: {
        Eyebrow: 'Analyst recognition',
        Heading: 'How leading analysts rate Sitecore solutions',
        Description: '<p>Analyst firms Forrester, Gartner, and IDC consistently rank us highly in vendor assessments.</p>',
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
