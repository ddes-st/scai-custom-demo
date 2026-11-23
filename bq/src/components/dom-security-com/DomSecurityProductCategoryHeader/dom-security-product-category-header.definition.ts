import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityProductCategoryHeaderDefinition = {
  kind: "component",
  definitionKey: "dom-security-product-category-header",
  name: "dom-security-product-category-header",
  displayName: "Product Category Header",
  componentName: "DomSecurityProductCategoryHeader",
  icon: "People/32x32/product.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Product Category Headers"],
  },
  model: {
    folderTemplate: {
      name: "Product Category Header Folder",
      displayName: "Product Category Headers",
    },
    itemTemplate: {
      name: "Product Category Header",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Fallback Title", type: "Single-Line Text" },
            {
              name: "Source Root",
              type: "Single-Line Text",
              shared: true,
              default: "/sitecore/content/domsecurity/domsecurity-com/Data/Product Categories",
            },
            {
              name: "Products Root",
              type: "Single-Line Text",
              shared: true,
              default: "/sitecore/content/domsecurity/domsecurity-com/Data/Products",
            },
            {
              name: "Categories Root",
              type: "Single-Line Text",
              shared: true,
              default: "/sitecore/content/domsecurity/domsecurity-com/Data/Product Categories",
            },
            { name: "Back Label", type: "Single-Line Text" },
            { name: "Read More Label", type: "Single-Line Text" },
            { name: "Read Less Label", type: "Single-Line Text" },
            { name: "Sort Label", type: "Single-Line Text" },
            { name: "Results Label", type: "Single-Line Text" },
            { name: "Load More Label", type: "Single-Line Text" },
            { name: "Related Label", type: "Single-Line Text" },
            { name: "Page Size", type: "Single-Line Text", shared: true, default: "12" },
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
      folder: ["Product Category Headers"],
    },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Product Category Header",
        displayName: "Product Category Header",
        fields: {
          "Fallback Title": "Product category",
          "Source Root": "/sitecore/content/domsecurity/domsecurity-com/Data/Product Categories",
          "Products Root": "/sitecore/content/domsecurity/domsecurity-com/Data/Products",
          "Categories Root":
            "/sitecore/content/domsecurity/domsecurity-com/Data/Product Categories",
          "Back Label": "All products",
          "Read More Label": "Read more",
          "Read Less Label": "Read less",
          "Sort Label": "Sort by",
          "Results Label": "results",
          "Load More Label": "Load more",
          "Related Label": "Other",
          "Page Size": "12",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
