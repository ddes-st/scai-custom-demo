import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityMainMenuDefinition = {
  kind: "component",
  definitionKey: "dom-security-main-menu",
  name: "dom-security-main-menu",
  displayName: "Main Menu",
  componentName: "DomSecurityMainMenu",
  icon: "Office/32x32/filter_and_sort.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Main Menus"] },
  model: {
    folderTemplate: { name: "Main Menu Folder" },
    itemTemplate: {
      name: "Main Menu",
      sections: [{ name: "Data", sortOrder: 100, fields: [
        { name: "Logo", type: "Image" },
        { name: "Logo Link", type: "General Link" },
        { name: "Navigation", type: "Rich Text" },
        { name: "Products Menu", type: "Rich Text" },
        { name: "Product Help", type: "General Link" },
        { name: "Highlight Homeowners Products", type: "Rich Text" },
        { name: "Highlight Homeowners Products Enabled", type: "Checkbox" }
      ]}]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [{ key: "header-navigation", allowedControls: ["dom-security-main-menu"] }],
  content: {
    location: { root: "data", folder: ["Main Menus"] },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [{
      name: "Main Menu",
      displayName: "Main Menu",
      fields: {
        Logo: { url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Logo/DOM-Hoberg_web_svg.svg?modified=20240524085418&extension=webp&modified=20240524085418", alt: "DOM Hoberg Logo" },
        "Logo Link": { text: "home", url: "https://www.dom-security.com/be/en" },
        Navigation: "<ul><li><a href=\"https://www.dom-security.com/be/en/homeowners\">Homeowners</a></li><li><a href=\"https://www.dom-security.com/be/en/professionals\">Professionals</a></li><li><a href=\"https://www.dom-security.com/be/en/industry\">Industry</a></li><li><a href=\"\" data-products-trigger=\"true\">Products</a></li><li><a href=\"https://www.dom-security.com/be/en/service-and-support\">Service &amp; Support</a></li><li><a href=\"https://www.dom-security.com/be/en/about-us\">About Us</a></li><li><a href=\"https://www.dom-security.com/be/en/newsroom\" data-active=\"true\">Newsroom</a></li></ul>",
        "Products Menu": "<section><h3>Door Hardware</h3><ul><li><a href=\"/products/categories/mechanical-cylinders\">Mechanical cylinders</a></li><li><a href=\"/products/categories/mechanical-locks\">Mechanical Locks</a></li></ul></section><section><h3>Access Control</h3><ul><li><a href=\"/products/categories/digital-cylinders\">Digital Cylinders</a></li><li><a href=\"/products/categories/digital-handles\">Digital Handles</a></li><li><a href=\"/products/categories/wall-readers-and-terminals\">Wall Readers &amp; Terminals</a></li><li><a href=\"/products/categories/apps-software\">Programming Equipment</a></li><li><a href=\"/products/categories/transponders\">Media</a></li></ul></section><section><h3>Industrial Locking Equipment</h3><ul><li><a href=\"/products/categories/digital-furniture-locks\">Digital Furniture Locks</a></li><li><a href=\"/products/categories/furniture-locks\">Furniture Locks</a></li><li><a href=\"/products/categories/trapped-key-interlocking-systems\">Trapped Key Interlocking Systems</a></li></ul></section>",
        "Product Help": { text: "Don't know the meaning of a category?", url: "" },
        "Highlight Homeowners Products": false,
        "Highlight Homeowners Products Enabled": false
      }
    }]
  }
} satisfies ComponentTemplateDefinition;
