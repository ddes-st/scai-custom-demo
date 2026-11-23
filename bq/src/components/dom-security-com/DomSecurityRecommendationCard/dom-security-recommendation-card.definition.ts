import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const recommendationCardDefinition = {
  kind: "component",
  definitionKey: "dom-security-recommendation-card",
  name: "dom-security-recommendation-card",
  displayName: "Recommendation Card",
  componentName: "DomSecurityRecommendationCard",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Recommendation Cards"],
  },
  model: {
    folderTemplate: {
      name: "Recommendation Card Folder",
    },
    itemTemplate: {
      name: "Recommendation Card",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Image", type: "Image" },
            { name: "Label", type: "Single-Line Text" },
            { name: "Title", type: "Single-Line Text" },
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
      folder: ["Recommendation Cards"],
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Dom Tapkey",
        displayName: "Open and close the frontdoor with your smartphone",
        fields: {
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-Global/Image/Products/DOM-Tapkey/Dom-Tapkey-door-bike-small.png?mw=900&crop=1&modified=20180110122433&extension=webp",
            alt: "DOM Tapkey door bike small",
          },
          Label: "DOM Tapkey",
          Title: "Open and close the frontdoor with your smartphone"
        },
      },
      {
        name: "Eniq Security Ecosystem",
        displayName: "Create a tailor-made security solution for your building",
        fields: {
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-NL/Image/Products/Digital/ENiQ/teaser_eniq.jpg?mw=900&crop=1&modified=20181218135334&extension=webp",
            alt: "Create a tailor-made security solution for your building",
          },
          Label: "ENiQ Security Ecosystem",
          Title: "Create a tailor-made security solution for your building"
        },
      },
      {
        name: "Dom Ix Twinstar",
        displayName: "Our most intelligent mechanical security system",
        fields: {
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-NL/Image/Professionals/Cards/twinstar_card_prof_1.jpg?mw=900&crop=1&modified=20190809064531&extension=webp",
            alt: "door open with key and office background",
          },
          Label: "DOM ix TwinStar",
          Title: "Our most intelligent mechanical security system"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
