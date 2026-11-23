import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const headerBlockDefinition = {
  kind: "component",
  definitionKey: "dom-security-header-block",
  name: "dom-security-header-block",
  displayName: "Header Block",
  componentName: "DomSecurityHeaderBlock",
  icon: "Office/32x32/document_header.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Header Blocks"],
  },
  model: {
    folderTemplate: { name: "Header Block Folder" },
    itemTemplate: {
      name: "Header Block",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Background Image", type: "Image" },
            { name: "Logo", type: "Image" },
            { name: "CTA", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "audience-links",
      allowedControls: ["dom-security-audience-link"],
    },
  ],
  content: {
    location: { root: "data", folder: ["Header Blocks"] },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Security Header",
        displayName: "We DOMore for security",
        fields: {
          Heading: "We DOMore for security",
          "Background Image": { url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-DE/Start-Page/S-background-first-visit.jpg?modified=20220412082310&extension=webp&modified=20220412082310",
            alt: "" },
          Logo: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Logo/DOM-Hoberg_web_svg.svg?modified=20240524085418&extension=webp&modified=20240524085418",
            alt: "DOM Hoberg Logo",
          },
          CTA: { text: "Go to the homepage", url: "#" }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
