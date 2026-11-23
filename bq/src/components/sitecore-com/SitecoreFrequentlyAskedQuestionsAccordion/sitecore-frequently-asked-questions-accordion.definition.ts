import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreFrequentlyAskedQuestionsAccordionDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-frequently-asked-questions-accordion",
  name: "sitecore-frequently-asked-questions-accordion",
  componentName: "SitecoreFrequentlyAskedQuestionsAccordion",
  displayName: "Frequently Asked Questions Accordion",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Frequently Asked Questions Accordions'] },
  model: {
    folderTemplate: { name: 'Frequently Asked Questions Accordion Folder' },
    itemTemplate: {
      name: 'Frequently Asked Questions Accordion',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Intro', type: 'Rich Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "faq-items", allowedControls: ["sitecore-frequently-asked-question-item"] }],
  content: {
    location: { root: 'data', folder: ['Frequently Asked Questions Accordions'] },
    culture: "en",
    items: [{
      name: 'Frequently Asked Questions Accordion',
      fields: {
        Heading: 'Frequently asked questions',
        Intro: '<p>Straight answers to the questions buyers, evaluators, and AI assistants ask most about SitecoreAI.</p>',
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
