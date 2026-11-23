import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityProductDetailDefinition = {
  kind: "component",
  definitionKey: "dom-security-product-detail",
  name: "dom-security-product-detail",
  displayName: "Product Detail",
  componentName: "DomSecurityProductDetail",
  icon: "People/32x32/product.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Product Details"],
  },
  model: {
    folderTemplate: {
      name: "Product Detail Folder",
      displayName: "Product Details",
    },
    itemTemplate: {
      name: "Product Detail",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "About Tab Label", type: "Single-Line Text" },
            { name: "Benefits Tab Label", type: "Single-Line Text" },
            { name: "Specs Tab Label", type: "Single-Line Text" },
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
      folder: ["Product Details"],
    },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Product Detail",
        displayName: "Product Detail",
        fields: {
          "About Tab Label": "About",
          "Benefits Tab Label": "Benefits",
          "Specs Tab Label": "Specifications",
          "Source Root": "/sitecore/content/domsecurity/domsecurity-com/Data/Products",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
