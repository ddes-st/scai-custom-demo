import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const crelanNavigationAndOfficeFinderDefinition = {
  kind: "component",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  definitionKey: "crelan-navigation-and-office-finder",
  name: "crelan-navigation-and-office-finder",
  componentName: "CrelanNavigationAndOfficeFinder",
  displayName: "Navigation And Office Finder",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Navigation And Office Finders'] },
  model: {
    folderTemplate: { name: 'Navigation And Office Finder Folder' },
    itemTemplate: {
      name: 'Navigation And Office Finder',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Office Map', type: 'Image' },
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Body', type: 'Rich Text' },
          { name: 'CTA', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [{ key: "navigation-cards", allowedControls: ["crelan-navigation-card"] }, { key: "usp-items", allowedControls: ["crelan-usp-item"] }],
  content: {
    location: { root: 'data', folder: ['Navigation And Office Finders'] },
    culture: "nl-BE",
    items: [{
      name: 'Navigation And Office Finder',
      fields: {
        'Office Map': { url: 'https://www.crelan.be/sites/default/files/2026-06/Kaartje%20agentschappen.png', alt: 'landkaart met de Crelan-agentschappen' },
        Heading: 'Dichtbij en betrokken',
        Body: '<p>Bij Crelan geloven we in nabijheid en persoonlijk contact. Daarom vindt u altijd een kantoor in uw buurt, met adviseurs die niet alleen luisteren maar ook vooruitdenken. Ze helpen u om uw plannen helder te krijgen en ondersteunen u bij elke stap. Zo bouwen we samen aan een toekomst die klopt met uw leven.</p>',
        CTA: { text: 'Vind uw kantoor', url: 'https://www.crelan.be/nl/particulieren/appointment-page' },
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
