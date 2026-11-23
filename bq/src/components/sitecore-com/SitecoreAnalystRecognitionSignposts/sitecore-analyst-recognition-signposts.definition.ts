import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreAnalystRecognitionSignpostsDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-analyst-recognition-signposts",
  name: "sitecore-analyst-recognition-signposts",
  componentName: "SitecoreAnalystRecognitionSignposts",
  displayName: "Analyst Recognition Signposts",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Analyst Recognition Signposts'] },
  model: {
    folderTemplate: { name: 'Analyst Recognition Signposts Folder' },
    itemTemplate: {
      name: 'Analyst Recognition Signposts',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Description', type: 'Rich Text' },
          { name: 'All Reports Link', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [{ key: "report-cards", allowedControls: ["sitecore-analyst-recognition-report-signpost"] }],
  content: {
    location: { root: 'data', folder: ['Analyst Recognition Signposts'] },
    culture: "en",
    items: [{
      name: 'Analyst Recognition Signposts',
      fields: {
        Heading: 'Analyst recognition',
        Description: '<p>How leading analysts rate Sitecore solutions for experience management.</p>',
        'All Reports Link': { text: 'See all Analyst Reports', url: 'https://www.sitecore.com/solutions/analyst-reports' },
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
