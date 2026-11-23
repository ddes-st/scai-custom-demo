import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityProductAccessoriesDefinition = {
  kind: "component",
  definitionKey: "dom-security-product-accessories",
  name: "dom-security-product-accessories",
  displayName: "Product Accessories",
  componentName: "DomSecurityProductAccessories",
  icon: "People/32x32/product.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Product Accessory Sections"],
  },
  model: {
    folderTemplate: {
      name: "Product Accessory Section Folder",
      displayName: "Product Accessory Sections",
    },
    itemTemplate: {
      name: "Product Accessory Section",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            {
              name: "Accessories Root",
              type: "Single-Line Text",
              shared: true,
              default: "/sitecore/content/domsecurity/domsecurity-com/Data/Product Accessories",
            },
            {
              name: "Source Root",
              type: "Single-Line Text",
              shared: true,
              default: "/sitecore/content/domsecurity/domsecurity-com/Data/Products",
            },
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
      folder: ["Product Accessory Sections"],
    },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Optional Accessories",
        displayName: "Optional Accessories",
        fields: {
          Heading: "Optional accessories",
          "Accessories Root":
            "/sitecore/content/domsecurity/domsecurity-com/Data/Product Accessories",
          "Source Root": "/sitecore/content/domsecurity/domsecurity-com/Data/Products",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
