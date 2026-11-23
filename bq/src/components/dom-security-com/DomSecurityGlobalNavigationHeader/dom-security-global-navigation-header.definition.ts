import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityGlobalNavigationHeaderDefinition = {
  kind: "component",
  definitionKey: "dom-security-global-navigation-header",
  name: "dom-security-global-navigation-header",
  displayName: "Global Navigation Header",
  componentName: "DomSecurityGlobalNavigationHeader",
  icon: "Office/32x32/add_search.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Global Navigation Headers"] },
  model: {
    folderTemplate: { name: "Global Navigation Header Folder" },
    itemTemplate: {
      name: "Global Navigation Header",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Logo", type: "Image" },
            { name: "Logo Link", type: "General Link" },
            { name: "Navigation", type: "Rich Text" },
            { name: "Product Menu", type: "Rich Text" },
            { name: "Languages", type: "Rich Text" },
            { name: "Search Label", type: "Single-Line Text" },
            { name: "Search Placeholder", type: "Single-Line Text" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [{ key: "global-navigation", allowedControls: ["dom-security-global-navigation-header"] }],
  content: {
    location: { root: "data", folder: ["Global Navigation Headers"] },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Global Navigation Header",
        displayName: "Toggle navigation",
        fields: {
          Heading: "Toggle navigation",
          Logo: { url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Logo/DOM-Hoberg_web_svg.svg?modified=20240524085418&extension=webp&modified=20240524085418", alt: "DOM Hoberg Logo" },
          "Logo Link": { text: "home", url: "https://www.dom-security.com/be/en" },
          Navigation: "<ul><li><a href=\"https://www.dom-security.com/be/en/homeowners\">Homeowners</a></li><li><a href=\"https://www.dom-security.com/be/en/professionals\">Professionals</a></li><li><a href=\"https://www.dom-security.com/be/en/industry\">Industry</a></li><li><a href=\"#products\">Products</a></li><li><a href=\"https://www.dom-security.com/be/en/service-and-support\">Service &amp; Support</a></li><li><a href=\"https://www.dom-security.com/be/en/about-us\">About Us</a></li><li><a href=\"https://www.dom-security.com/be/en/newsroom\">Newsroom</a></li></ul>",
          "Product Menu": "<div><h3>Door Hardware</h3><ul><li><a href=\"/products/categories/mechanical-cylinders\">Mechanical cylinders</a></li><li><a href=\"/products/categories/mechanical-locks\">Mechanical Locks</a></li></ul></div><div><h3>Access Control</h3><ul><li><a href=\"/products/categories/digital-cylinders\">Digital Cylinders</a></li><li><a href=\"/products/categories/digital-handles\">Digital Handles</a></li><li><a href=\"/products/categories/wall-readers-and-terminals\">Wall Readers &amp; Terminals</a></li><li><a href=\"/products/categories/apps-software\">Programming Equipment</a></li><li><a href=\"/products/categories/transponders\">Media</a></li></ul></div><div><h3>Industrial Locking Equipment</h3><ul><li><a href=\"/products/categories/digital-furniture-locks\">Digital Furniture Locks</a></li><li><a href=\"/products/categories/furniture-locks\">Furniture Locks</a></li><li><a href=\"/products/categories/trapped-key-interlocking-systems\">Trapped Key Interlocking Systems</a></li></ul></div>",
          Languages: "<ul><li><a href=\"https://www.dom-security.com/be/en/newsroom\">en</a></li><li><a href=\"https://www.dom-security.com/be/fr/actualités\">fr</a></li><li><a href=\"https://www.dom-security.com/be/nl/nieuws\">nl</a></li></ul>",
          "Search Label": "Search",
          "Search Placeholder": "Type here"
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
