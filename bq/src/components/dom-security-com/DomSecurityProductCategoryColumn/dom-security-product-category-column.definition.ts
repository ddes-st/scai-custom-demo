import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityProductCategoryColumnDefinition = {
  kind: "component",
  definitionKey: "dom-security-product-category-column",
  name: "dom-security-product-category-column",
  displayName: "Product Category Column",
  componentName: "DomSecurityProductCategoryColumn",
  icon: "Office/32x32/shopping_cart_full.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Link Lists"],
  },
  model: {
    folderTemplate: {
      name: "Product Category Column Folder",
      displayName: "Product Category Columns",
    },
    itemTemplate: {
      name: "Product Category Column",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [{ name: "Title", type: "Single-Line Text" }],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: {
      root: "data",
      folder: ["Link Lists"],
    },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Door Hardware",
        displayName: "Door Hardware",
        fields: {
          Title: "Door Hardware",
        },
        children: [
          {
            name: "Mechanical Cylinders",
            displayName: "Mechanical cylinders",
            fields: {
              Link: {
                text: "Mechanical cylinders",
                url: "/products/categories/mechanical-cylinders",
              },
            },
          },
          {
            name: "Mechanical Locks",
            displayName: "Mechanical Locks",
            fields: {
              Link: {
                text: "Mechanical Locks",
                url: "/products/categories/mechanical-locks",
              },
            },
          },
        ],
      },
      {
        name: "Access Control",
        displayName: "Access Control",
        fields: {
          Title: "Access Control",
        },
        children: [
          {
            name: "Digital Cylinders",
            displayName: "Digital Cylinders",
            fields: {
              Link: {
                text: "Digital Cylinders",
                url: "/products/categories/digital-cylinders",
              },
            },
          },
          {
            name: "Digital Handles",
            displayName: "Digital Handles",
            fields: {
              Link: {
                text: "Digital Handles",
                url: "/products/categories/digital-handles",
              },
            },
          },
          {
            name: "Wall Readers And Terminals",
            displayName: "Wall Readers & Terminals",
            fields: {
              Link: {
                text: "Wall Readers & Terminals",
                url: "/products/categories/wall-readers-and-terminals",
              },
            },
          },
          {
            name: "Programming Equipment",
            displayName: "Programming Equipment",
            fields: {
              Link: {
                text: "Programming Equipment",
                url: "/products/categories/apps-software",
              },
            },
          },
          {
            name: "Media",
            displayName: "Media",
            fields: {
              Link: {
                text: "Media",
                url: "/products/categories/transponders",
              },
            },
          },
        ],
      },
      {
        name: "Industrial Locking Equipment",
        displayName: "Industrial Locking Equipment",
        fields: {
          Title: "Industrial Locking Equipment",
        },
        children: [
          {
            name: "Digital Furniture Locks",
            displayName: "Digital Furniture Locks",
            fields: {
              Link: {
                text: "Digital Furniture Locks",
                url: "/products/categories/digital-furniture-locks",
              },
            },
          },
          {
            name: "Furniture Locks",
            displayName: "Furniture Locks",
            fields: {
              Link: {
                text: "Furniture Locks",
                url: "/products/categories/furniture-locks",
              },
            },
          },
          {
            name: "Trapped Key Interlocking Systems",
            displayName: "Trapped Key Interlocking Systems",
            fields: {
              Link: {
                text: "Trapped Key Interlocking Systems",
                url: "/products/categories/trapped-key-interlocking-systems",
              },
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
