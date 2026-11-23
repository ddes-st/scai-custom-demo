import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const headerDefinition = {
  kind: "component",
  definitionKey: "dom-security-header",
  name: "dom-security-header",
  displayName: "Header",
  componentName: "DomSecurityHeader",
  icon: "Office/32x32/document_header.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Headers"],
  },
  model: {
    folderTemplate: { name: "Header Folder" },
    itemTemplate: {
      name: "Header",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Logo", type: "Image" },
            { name: "Tagline", type: "Single-Line Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Headers"] },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Header",
        displayName: "Header",
        fields: {
          Logo: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Logo/DOM-Hoberg_web_svg.svg?modified=20240524085418&extension=webp&modified=20240524085418",
            alt: "DOM Hoberg Logo",
          },
          Tagline: "We DOMore for security"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
