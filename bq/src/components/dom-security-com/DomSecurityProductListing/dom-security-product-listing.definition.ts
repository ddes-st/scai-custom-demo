import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityProductListingDefinition = {
  kind: "component",
  definitionKey: "dom-security-product-listing",
  name: "dom-security-product-listing",
  displayName: "Product Listing",
  componentName: "DomSecurityProductListing",
  icon: "Office/32x32/shopping_cart_full.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Product Listings"],
  },
  model: {
    folderTemplate: {
      name: "Product Listing Folder",
      displayName: "Product Listings",
    },
    itemTemplate: {
      name: "Product Listing",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Subtitle", type: "Single-Line Text" },
            { name: "Products Root", type: "Single-Line Text", shared: true, default: "/sitecore/content/domsecurity/domsecurity-com/Data/Products" },
            { name: "Categories Root", type: "Single-Line Text", shared: true, default: "/sitecore/content/domsecurity/domsecurity-com/Data/Product Categories" },
            { name: "Sort Label", type: "Single-Line Text" },
            { name: "Filter Label", type: "Single-Line Text" },
            { name: "Empty Message", type: "Single-Line Text" },
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
      folder: ["Product Listings"],
    },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Product Listing",
        displayName: "Products",
        fields: {
          Title: "Products",
          Subtitle: "Explore DOM Security locking and access solutions.",
          "Products Root": "/sitecore/content/domsecurity/domsecurity-com/Data/Products",
          "Categories Root": "/sitecore/content/domsecurity/domsecurity-com/Data/Product Categories",
          "Sort Label": "Sort alphabetically",
          "Filter Label": "Filter by category",
          "Empty Message": "No products found.",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
