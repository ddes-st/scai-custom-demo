import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityNavigationItemDefinition = {
  kind: "component",
  definitionKey: "dom-security-navigation-item",
  name: "dom-security-navigation-item",
  displayName: "Navigation Item",
  componentName: "DomSecurityNavigationItem",
  icon: "Office/32x32/shopping_cart_full.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Navigation Items"],
  },
  model: {
    folderTemplate: {
      name: "Navigation Item Folder",
    },
    itemTemplate: {
      name: "Navigation Item",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Link", type: "General Link" },
            { name: "Active", type: "Checkbox" },
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
      folder: ["Navigation Items"],
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Homeowners",
        displayName: "Homeowners",
        fields: {
          Link: {
            text: "Homeowners",
            url: "https://www.dom-security.com/be/en/homeowners",
          },
          Active: false
        },
      },
      {
        name: "Professionals",
        displayName: "Professionals",
        fields: {
          Link: {
            text: "Professionals",
            url: "https://www.dom-security.com/be/en/professionals",
          },
          Active: false
        },
      },
      {
        name: "Industry",
        displayName: "Industry",
        fields: {
          Link: {
            text: "Industry",
            url: "https://www.dom-security.com/be/en/industry",
          },
          Active: false
        },
      },
      {
        name: "Products",
        displayName: "Products",
        fields: {
          Link: {
            text: "Products",
            url: "https://www.dom-security.com/be/en/products",
          },
          Active: false
        },
      },
      {
        name: "Service And Support",
        displayName: "Service & Support",
        fields: {
          Link: {
            text: "Service & Support",
            url: "https://www.dom-security.com/be/en/service-and-support",
          },
          Active: false
        },
      },
      {
        name: "About Us",
        displayName: "About Us",
        fields: {
          Link: {
            text: "About Us",
            url: "https://www.dom-security.com/be/en/about-us",
          },
          Active: false
        },
      },
      {
        name: "Newsroom",
        displayName: "Newsroom",
        fields: {
          Link: {
            text: "Newsroom",
            url: "https://www.dom-security.com/be/en/newsroom",
          },
          Active: true
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
