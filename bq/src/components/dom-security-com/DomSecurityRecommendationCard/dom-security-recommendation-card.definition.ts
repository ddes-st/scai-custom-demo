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
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-NL/Image/Products/Mechanical/Locks/Lifestyle-Pictures-IX/IX-bro-story-lifestyle40-0519_activities.jpg?h=1287&iar=0&w=1928&modified=20190808122635&extension=webp",
            alt: "ix-mailbox",
          },
          Label: "Mechanical Locking Systems",
          Title: "We develop high-quality mechanical locking systems that ensure durability, precision, and optimal security. Discover our mechanical locking solutions."
        },
      },
      {
        name: "Eniq Security Ecosystem",
        displayName: "Create a tailor-made security solution for your building",
        fields: {
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-NL/Landingspages/Elektronisch-deurbeslag/Card.jpg?h=2505&iar=0&w=3750&modified=20230728135314&extension=webp",
            alt: "DOM Guard on black door",
          },
          Label: "Access Control System",
          Title: "Loss of keys, unauthorized access, and inefficient key management are a thing of the past with our digital locking systems. Manage your access control system with an App or Software."
        },
      },
      {
        name: "Dom Ix Twinstar",
        displayName: "Our most intelligent mechanical security system",
        fields: {
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/image/About-us.jpg?h=800&iar=0&w=1920&modified=20211231080756&extension=webp",
            alt: "Building DOM Belgium",
          },
          Label: "DOM Hoberg",
          Title: "We offer over 50 years of experience in security technology. With more than 150 reliable dealers, there's always one nearby."
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
