import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const technologyHeroDefinition = {
  kind: "component",
  definitionKey: "dom-security-technology-hero",
  name: "dom-security-technology-hero",
  displayName: "Technology Hero",
  componentName: "DomSecurityTechnologyHero",
  icon: "Office/32x32/media_stop.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Technology Heroes"],
  },
  model: {
    folderTemplate: {
      name: "Technology Hero Folder",
    },
    itemTemplate: {
      name: "Technology Hero",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Subtitle", type: "Single-Line Text" },
            { name: "Video", type: "Single-Line Text" },
            { name: "Poster Image", type: "Image" },
            { name: "Desktop CTA", type: "General Link" },
            { name: "Mobile CTA", type: "General Link" },
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
      folder: ["Technology Heroes"],
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Smart Locking Solutions",
        displayName: "Smart Locking Solutions",
        fields: {
          Title: "Smart Locking Solutions",
          Subtitle: "We offer secure, smart en durable customized Access Control",
          Video: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-NL/Landingspages/Homepage/Extrait2_VDO_Site_v4.mp4?modified=20220315144633",
          "Poster Image": { url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-NL/Landingspages/Homepage/Hero_Image.jpg?modified=20220315150237&extension=webp&modified=20220315150237", alt: "Hero Image Homepage" },
          "Desktop CTA": {
            text: "Discover our solutions",
            url: "https://www.dom-security.com/be/en#Oplossingen",
          },
          "Mobile CTA": {
            text: "Discover our solutions",
            url: "https://www.dom-security.com/be/en#Oplossingen",
          }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
