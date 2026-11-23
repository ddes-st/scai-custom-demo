import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const pillarCardDefinition = {
  kind: "component",
  definitionKey: "axa-pillar-card",
  name: "axa-pillar-card",
  displayName: "Pillar Card",
  componentName: "AxaPillarCard",
  icon: "Office/32x32/id_cards.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Pillar Cards"] },
  model: {
    folderTemplate: { name: "Pillar Card Folder" },
    itemTemplate: {
      name: "Pillar Card",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Image", type: "Image" },
            { name: "Title", type: "Single-Line Text" },
            { name: "Content", type: "Rich Text" },
            { name: "Link", type: "General Link" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Pillar Cards"] },
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Climate Change And Mobility",
        fields: {
          Image: {
            url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/illustration_climate_change.png?savif=1&swebp=1&ch=200&cx=0.5&la=nl-BE&cy=0.5&cw=350&hash=827915DA9E37EF7A83CF2444270181C1",
            alt: "Climate change and mobility"
          },
          Title: "Climate change and mobility",
          Content: "<p>Leverage our core businesses - investments and insurance - to help the world meet climate change and environmental challenges.</p>",
          Link: {
            text: "Read more",
            url: "https://www.axa.be/nl/over-axa/strategy"
          }
        }
      },
      {
        name: "Health And Disease Prevention",
        fields: {
          Image: {
            url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/illustration_health.png?savif=1&swebp=1&ch=200&cx=0.5&la=nl-BE&cy=0.5&cw=350&hash=90AA23836A0FB6D22D80B479C55FA093",
            alt: "Health and disease prevention"
          },
          Title: "Health and disease prevention",
          Content: "<p>Become a reliable health partner for our customers and society through health promotion and disease prevention.</p>",
          Link: {
            text: "Read more",
            url: "https://www.axa.be/nl/over-axa/axa-research-fund"
          }
        }
      },
      {
        name: "Social Inclusion",
        fields: {
          Image: {
            url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/about/illustration_Diversity_2.png?savif=1&swebp=1&ch=200&cx=0.5&la=nl-BE&cy=0.5&cw=350&hash=47D2424652CC14BFD1D2872540FAAA42",
            alt: "Social inclusion"
          },
          Title: "Social inclusion",
          Content: "<p>Encourage social inclusion to protect vulnerable populations. Promote volunteering through AXA Hearts in Action.</p>",
          Link: {
            text: "Read more",
            url: "https://www.axa.be/nl/over-axa/diversity-en-inclusion"
          }
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
