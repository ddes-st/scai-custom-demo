import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecuritySiteHeaderDefinition = {
  kind: "component",
  definitionKey: "dom-security-site-header",
  name: "dom-security-site-header",
  displayName: "Site Header",
  componentName: "DomSecuritySiteHeader",
  icon: "Office/32x32/add_search.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Site Headers"] },
  model: {
    folderTemplate: { name: "Site Header Folder" },
    itemTemplate: {
      name: "Site Header",
      sections: [{
        name: "Data",
        sortOrder: 100,
        fields: [
          { name: "Logo", type: "Image" },
          { name: "Home Link", type: "General Link" },
          { name: "Heading", type: "Single-Line Text" },
          { name: "Navigation", type: "Rich Text" },
          { name: "Products Menu", type: "Rich Text" },
          { name: "Language", type: "Single-Line Text" },
          { name: "Language Options", type: "Rich Text" },
          { name: "Search Label", type: "Single-Line Text" },
          { name: "Search Endpoint", type: "Single-Line Text" }
        ]
      }]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [{ key: "header-utility-and-navigation", allowedControls: ["dom-security-site-header"] }],
  content: {
    location: { root: "data", folder: ["Site Headers"] },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [{
      name: "Site Header",
      displayName: "Toggle navigation",
      fields: {
        Logo: { url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Logo/DOM-Hoberg_web_svg.svg?modified=20240524085418&extension=webp&modified=20240524085418", alt: "DOM Hoberg Logo" },
        "Home Link": { text: "home", url: "https://www.dom-security.com/be/en" },
        Heading: "Toggle navigation",
        Navigation: "<ul><li><a href=\"https://www.dom-security.com/be/en/homeowners\">Homeowners</a></li><li><a href=\"https://www.dom-security.com/be/en/professionals\">Professionals</a></li><li><a href=\"https://www.dom-security.com/be/en/industry\">Industry</a></li><li><a href=\"https://www.dom-security.com/be/en/products\">Products</a></li><li><a href=\"https://www.dom-security.com/be/en/service-and-support\">Service &amp; Support</a></li><li><a href=\"https://www.dom-security.com/be/en/about-us\">About Us</a></li><li><a href=\"https://www.dom-security.com/be/en/newsroom\">Newsroom</a></li></ul>",
        "Products Menu": "<div><h3>Door Hardware</h3><ul><li><a href=\"/products/categories/mechanical-cylinders\">Mechanical cylinders</a></li><li><a href=\"/products/categories/mechanical-locks\">Mechanical Locks</a></li></ul></div><div><h3>Access Control</h3><ul><li><a href=\"/products/categories/digital-cylinders\">Digital Cylinders</a></li><li><a href=\"/products/categories/digital-handles\">Digital Handles</a></li><li><a href=\"/products/categories/wall-readers-and-terminals\">Wall Readers &amp; Terminals</a></li><li><a href=\"/products/categories/apps-software\">Programming Equipment</a></li><li><a href=\"/products/categories/transponders\">Media</a></li></ul></div><div><h3>Industrial Locking Equipment</h3><ul><li><a href=\"/products/categories/digital-furniture-locks\">Digital Furniture Locks</a></li><li><a href=\"/products/categories/furniture-locks\">Furniture Locks</a></li><li><a href=\"/products/categories/trapped-key-interlocking-systems\">Trapped Key Interlocking Systems</a></li></ul></div>",
        Language: "en",
        "Language Options": "<ul><li><a href=\"https://www.dom-security.com/be/en/newsroom/group-news/new-silca-machine-dom-hoberg\">en</a></li><li><a href=\"https://www.dom-security.com/be/fr/actualités/actualités-générales/new-silca-machine-dom-hoberg\">fr</a></li><li><a href=\"https://www.dom-security.com/be/nl/nieuws/group-news/new-silca-machine-dom-hoberg\">nl</a></li></ul>",
        "Search Label": "Search",
        "Search Endpoint": "https://www.dom-security.com/be/en/api/search/searchglobal"
      }
    }]
  }
} satisfies ComponentTemplateDefinition;
