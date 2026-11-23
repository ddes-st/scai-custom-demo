import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const companyOverviewDefinition = {
  kind: "component",
  definitionKey: "dom-security-company-overview",
  name: "dom-security-company-overview",
  displayName: "Company Overview",
  componentName: "DomSecurityCompanyOverview",
  icon: "Office/32x32/hand_offer.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Company Overviews"],
  },
  model: {
    folderTemplate: { name: "Company Overview Folder" },
    itemTemplate: {
      name: "Company Overview",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Background Image", type: "Image" },
            { name: "Title", type: "Single-Line Text" },
            { name: "Body", type: "Rich Text" },
            { name: "Dealer Count", type: "Single-Line Text" },
            { name: "Dealer Label", type: "Single-Line Text" },
            { name: "CTA", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Company Overviews"] },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Company Overview Belgium",
        displayName: "We believe that everyone & everything of value deserves to be kept secure withou",
        fields: {
          "Background Image": { url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-UK/COUNTRIES-AND-FLAGS/COUNTRIES/Europe-Belgium.jpg?modified=20171031081738&extension=webp&modified=20171031081738", alt: "Belgium map background" },
          Title: "We believe that everyone & everything of value deserves to be kept secure withou",
          Body: "That's why here at DOM we focus on three essential areas of expertise: hardware, software and mechatronics, developing the highest quality mechanical and access control solutions as well as committing ourselves to the constant innovation of our technologies.",
          "Dealer Count": "150",
          "Dealer Label": "specialized DOM dealers in Belgium",
          CTA: {
            text: "Find a reseller",
            url: "https://www.dom-security.com/be/en#Dealer",
          }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
