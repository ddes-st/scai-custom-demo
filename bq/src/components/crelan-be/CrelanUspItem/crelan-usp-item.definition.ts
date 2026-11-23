import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const crelanUspItemDefinition = {
  kind: "component",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  definitionKey: "crelan-usp-item",
  name: "crelan-usp-item",
  componentName: "CrelanUspItem",
  displayName: "Usp Item",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Usp Items'] },
  model: {
    folderTemplate: { name: 'Usp Item Folder' },
    itemTemplate: {
      name: 'Usp Item',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Body', type: 'Rich Text' },
          { name: 'Link', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Usp Items'] },
    culture: "nl-BE",
    items: [
      { name: 'Belgische bank', fields: { Title: 'Belgische bank', Body: '<p><strong>Dicht bij u, met lokale expertise en verankerd in België</strong></p>', Link: { text: 'Belgische bank', url: 'https://www.crelan.be/nl/appointment-page' } } },
      { name: 'Coöperatieve bank', fields: { Title: 'Coöperatieve bank', Body: '<p><strong>Meer dan 300.000 klanten zijn mede-eigenaar van onze bank</strong></p>', Link: { text: 'Coöperatieve bank', url: 'https://www.crelan.be/nl/cooperanten' } } },
      { name: 'Groot kantorennetwerk', fields: { Title: 'Groot kantorennetwerk', Body: '<p><strong>Altijd een kantoor in de buurt, waar persoonlijk advies centraal staat</strong></p>', Link: { text: 'Groot kantorennetwerk', url: 'https://www.crelan.be/nl/appointment-page' } } },
      { name: 'Steun aan projecten die ertoe doen', fields: { Title: 'Steun aan projecten die ertoe doen', Body: '<p><strong>Samen voor een betere buurt en maatschappij</strong></p>', Link: { text: 'Steun aan projecten die ertoe doen', url: 'https://www.crelan.be/nl/particulieren/crelan-sociaal-engagement' } } },
    ],
  },
} satisfies ComponentTemplateDefinition;
