import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityPrimaryNavigationDefinition = {
  kind: "component",
  definitionKey: "dom-security-primary-navigation",
  name: "dom-security-primary-navigation",
  displayName: "Primary Navigation",
  componentName: "DomSecurityPrimaryNavigation",
  icon: "Office/32x32/shopping_cart_full.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Primary Navigations"],
  },
  model: {
    folderTemplate: {
      name: "Primary Navigation Folder",
    },
    itemTemplate: {
      name: "Primary Navigation",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Logo", type: "Image" },
            { name: "Home Link", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "primary-navigation",
      allowedControls: ["dom-security-navigation-item"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Primary Navigations"],
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Primary Navigation",
        displayName: "Primary Navigation",
        fields: {
          Logo: { url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Logo/DOM-Hoberg_web_svg.svg?modified=20240524085418&extension=webp&modified=20240524085418", alt: "DOM Hoberg Logo" },
          "Home Link": { text: "home", url: "https://www.dom-security.com/be/en" }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
