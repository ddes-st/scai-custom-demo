import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const sustainabilityPillarCardDefinition = {
  kind: "component",
  definitionKey: "axa-sustainability-pillar-card",
  name: "axa-sustainability-pillar-card",
  displayName: "Sustainability Pillar Card",
  componentName: "AxaSustainabilityPillarCard",
  icon: "Office/32x32/hand_count_three.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Sustainability Pillar Cards"],
  },
  model: {
    folderTemplate: { name: "Sustainability Pillar Card Folder" },
    itemTemplate: {
      name: "Sustainability Pillar Card",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Image", type: "Image" },
            { name: "Title", type: "Single-Line Text" },
            { name: "Description", type: "Rich Text" },
            { name: "Link", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Sustainability Pillar Cards"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Climate Change And Mobility",
        displayName: "Klimaatverandering en mobiliteit",
        fields: {
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/illustration_climate_change.png?savif=1&swebp=1&ch=200&cx=0.5&la=nl-BE&cy=0.5&cw=350&hash=827915DA9E37EF7A83CF2444270181C1",
            alt: "" },
          Title: "Klimaatverandering en mobiliteit",
          Description: "<p>Gebruik maken van onze kernactiviteiten - investeringen en verzekeringen - om de wereld te helpen het hoofd te bieden aan de klimaatverandering en milieu-uitdagingen.</p>",
          Link: {
            text: "Lees meer",
            url: "https://www.axa.be/nl/over-axa/strategy",
          }
        },
      },
      {
        name: "Health And Disease Prevention",
        displayName: "Gezondheids- en ziektepreventie",
        fields: {
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/illustration_health.png?savif=1&swebp=1&ch=200&cx=0.5&la=nl-BE&cy=0.5&cw=350&hash=90AA23836A0FB6D22D80B479C55FA093",
            alt: "" },
          Title: "Gezondheids- en ziektepreventie",
          Description: "<p>Een betrouwbare gezondheidspartner voor onze klanten en de maatschappij worden door middel van gezondheidsbevordering en ziektepreventie.</p>",
          Link: {
            text: "Lees meer",
            url: "https://www.axa.be/nl/over-axa/axa-research-fund",
          }
        },
      },
      {
        name: "Social Inclusion",
        displayName: "Sociale inclusie",
        fields: {
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/about/illustration_Diversity_2.png?savif=1&swebp=1&ch=200&cx=0.5&la=nl-BE&cy=0.5&cw=350&hash=47D2424652CC14BFD1D2872540FAAA42",
            alt: "" },
          Title: "Sociale inclusie",
          Description: "<p>Sociale inclusie aanmoedigen om kwetsbare bevolkingsgroepen te beschermen. Bevorderen van vrijwilligerswerk via AXA Hearts in Action.</p>",
          Link: {
            text: "Lees meer",
            url: "https://www.axa.be/nl/over-axa/diversity-en-inclusion",
          }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
