import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const recommendationCardDefinition = {
  kind: "component",
  definitionKey: "axa-recommendation-card",
  name: "axa-recommendation-card",
  displayName: "Recommendation Card",
  componentName: "AxaRecommendationCard",
  icon: "Office/32x32/id_cards.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Recommendation Cards"] },
  model: {
    folderTemplate: { name: "Recommendation Card Folder" },
    itemTemplate: {
      name: "Recommendation Card",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Category", type: "Single-Line Text" },
            { name: "Title", type: "Single-Line Text" },
            { name: "Content", type: "Rich Text" },
            { name: "Rating", type: "Single-Line Text" },
            { name: "Rating Maximum", type: "Single-Line Text" },
            { name: "Rating Summary", type: "Single-Line Text" },
            { name: "Image", type: "Image" },
            { name: "Link", type: "General Link" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Recommendation Cards"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Customer Reviews",
        displayName: "Wat onze klanten denken",
        fields: {
          Category: "Woonverzekering - Afsluiten",
          Title: "Wat onze klanten denken",
          Content: "<p>Om de authenticiteit van de klantenbeoordelingen te garanderen, worden ze verzameld door eKomi, een onafhankelijk en gespecialiseerd bedrijf, en in alle transparantie gepubliceerd.</p>",
          Rating: "4.7",
          "Rating Maximum": "5",
          "Rating Summary": "Gemiddelde van 253 beoordelingen",
          Link: { text: "Lees alle beoordelingen", url: "https://www.axa.be/nl/ekomi" }
        }
      },
      {
        name: "MyAXA Fidelity",
        displayName: "Wil je lid worden van ons getrouwheidsprogramma?",
        fields: {
          Category: "MyAXA Fidelity",
          Title: "Wil je lid worden van ons getrouwheidsprogramma?",
          Content: "<p>MyAXA Fidelity, aangeboden door je makelaar en AXA, beloont, beschermt en adviseert je elke dag dankzij een heel pak voordelen. Je kan lid worden als je 3 smileys hebt. Meer weten? Contacteer snel je makelaar.</p>",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/myaf/MY%20AF%20Illustration%20small.svg?rev=43c3efe8b84742c7bd40e5ae29891949&savif=1&swebp=1&mh=200&la=nl-BE&h=200&mw=350&w=144&hash=8CD51B0D4E4C870D40EB7A2A151903BF",
            alt: "" },
          Link: { text: "Ontdek MyAXA Fidelity", url: "https://www.axa.be/nl/particulieren/myaxa-fidelity" }
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
