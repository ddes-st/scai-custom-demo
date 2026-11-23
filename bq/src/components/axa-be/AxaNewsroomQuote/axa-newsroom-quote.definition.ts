import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const newsroomQuoteDefinition = {
  kind: "component",
  definitionKey: "axa-newsroom-quote",
  name: "axa-newsroom-quote",
  displayName: "Newsroom Quote",
  componentName: "AxaNewsroomQuote",
  icon: "Office/32x32/history.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Newsroom Quotes"],
  },
  model: {
    folderTemplate: {
      name: "Newsroom Quote Folder",
    },
    itemTemplate: {
      name: "Newsroom Quote",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Subtitle", type: "Single-Line Text" },
            { name: "Quote", type: "Rich Text" },
            { name: "Primary CTA", type: "General Link" },
            { name: "Secondary CTA", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: {
      root: "data",
      folder: ["Newsroom Quotes"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Newsroom Quote",
        displayName: "Newsroom",
        fields: {
          Heading: "Newsroom",
          Subtitle: "AXA traint 1.250 verzekeringsmakelaars in klimaatadaptatie",
          Quote: "“Met de toenemende extreme weersomstandigheden in België, organiseren AXA Verzekeringen en AXA Climate acht regionale bijeenkomsten om makelaars bewust te maken rond de risico's van klimaatverandering. Deze trainingen zijn erop gericht makelaars in staat te stellen hun klanten op maat te ondersteunen en te sensibiliseren voor klimaatadaptatie, met een focus op toekomstige risico's zoals hittegolven, overstromingen en waterstress.”",
          "Primary CTA": {
            text: "Lees het persbericht",
            url: "https://www.axa.be/nl/pers/2025/1250-makelaars-warm-gemaakt-voor-klimaatadaptatie",
          },
          "Secondary CTA": {
            text: "Alle persberichten",
            url: "https://www.axa.be/nl/pers",
          }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
