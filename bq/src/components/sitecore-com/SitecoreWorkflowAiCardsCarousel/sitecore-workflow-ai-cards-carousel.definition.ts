import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreWorkflowAiCardsCarouselDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-workflow-ai-cards-carousel",
  name: "sitecore-workflow-ai-cards-carousel",
  componentName: "SitecoreWorkflowAiCardsCarousel",
  displayName: "Workflow Ai Cards Carousel",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['AI Workflow Cards Carousels'] },
  model: {
    folderTemplate: { name: 'AI Workflow Cards Carousel Folder' },
    itemTemplate: {
      name: 'AI Workflow Cards Carousel',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Body', type: 'Rich Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: "carousel-cards", allowedControls: ["sitecore-ai-workflow-card"] }],
  content: {
    location: { root: 'data', folder: ['AI Workflow Cards Carousels'] },
    culture: "en",
    items: [{
      name: 'AI Workflow Cards Carousel',
      fields: {
        Heading: 'AI that works the way your team does',
        Body: '<p>From day one, AI agents draft, tag, translate, and activate content inside your workflows. You approve and publish. Brand and security guardrails are yours to set. Open by design, ready to extend.</p>',
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
