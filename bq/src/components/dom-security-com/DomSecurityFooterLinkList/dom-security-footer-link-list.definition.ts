import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const footerLinkListDefinition = {
  kind: "component",
  definitionKey: "dom-security-footer-link-list",
  name: "dom-security-footer-link-list",
  displayName: "Footer Link List",
  componentName: "DomSecurityFooterLinkList",
  icon: "Office/32x32/document_orientation_landscape.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Link Lists"],
  },
  model: {
    folderTemplate: {
      name: "Footer Link List Folder",
      displayName: "Footer Link List Folder",
    },
    itemTemplate: {
      name: "Footer Link List",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [{ name: "Title", type: "Single-Line Text" }],
        },
      ],
    },
  },
  variants: [{ name: "Default" }, { name: "Horizontal" }, { name: "NavMega" }],
  placeholders: [],
  content: {
    location: {
      root: "data",
      folder: ["Link Lists"],
    },
    culture: "be",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Primary Links Left",
        displayName: "Primary Links Left",
        fields: { Title: "" },
        children: [
          {
            name: "Homeowners",
            displayName: "Homeowners",
            fields: {
              Link: {
                text: "Homeowners",
                url: "/homeowners",
              },
            },
          },
          {
            name: "Professionals",
            displayName: "Professionals",
            fields: {
              Link: {
                text: "Professionals",
                url: "/professionals",
              },
            },
          },
          {
            name: "Manufacturers",
            displayName: "Manufacturers",
            fields: {
              Link: {
                text: "Manufacturers",
                url: "/industry",
              },
            },
          },
          {
            name: "Products",
            displayName: "Products",
            fields: {
              Link: {
                text: "Products",
                url: "/products",
              },
            },
          },
        ],
      },
      {
        name: "Primary Links Right",
        displayName: "Primary Links Right",
        fields: { Title: "" },
        children: [
          {
            name: "Careers",
            displayName: "Careers",
            fields: {
              Link: {
                text: "Careers",
                url: "/careers",
              },
            },
          },
          {
            name: "Service And Support",
            displayName: "Service & Support",
            fields: {
              Link: {
                text: "Service & Support",
                url: "/service-en-support-2",
              },
            },
          },
          {
            name: "About Us",
            displayName: "About us",
            fields: {
              Link: {
                text: "About us",
                url: "/about-us",
              },
            },
          },
          {
            name: "Contact Us",
            displayName: "Contact us",
            fields: {
              Link: {
                text: "Contact us",
                url: "/contact-us-old",
              },
            },
          },
        ],
      },
      {
        name: "Legal Links",
        displayName: "Legal Links",
        fields: { Title: "" },
        children: [
          {
            name: "Imprint",
            displayName: "Imprint",
            fields: {
              Link: {
                text: "Imprint",
                url: "/legal/imprint",
              },
            },
          },
          {
            name: "Terms And Conditions",
            displayName: "Terms and conditions",
            fields: {
              Link: {
                text: "Terms and conditions",
                url: "/legal/terms-and-conditions",
              },
            },
          },
          {
            name: "Data Protection",
            displayName: "Data Protection",
            fields: {
              Link: {
                text: "Data Protection",
                url: "/legal/data-protection",
              },
            },
          },
        ],
      },
      {
        name: "Door Hardware",
        displayName: "Door Hardware",
        fields: { Title: "Door Hardware" },
        children: [
          {
            name: "Mechanical Cylinders",
            fields: {
              Link: {
                text: "Mechanical cylinders",
                url: "/products/categories/mechanical-cylinders",
              },
            },
          },
          {
            name: "Mechanical Locks",
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
        fields: { Title: "Access Control" },
        children: [
          {
            name: "Digital Cylinders",
            fields: {
              Link: {
                text: "Digital Cylinders",
                url: "/products/categories/digital-cylinders",
              },
            },
          },
          {
            name: "Digital Handles",
            fields: {
              Link: {
                text: "Digital Handles",
                url: "/products/categories/digital-handles",
              },
            },
          },
          {
            name: "Wall Readers And Terminals",
            fields: {
              Link: {
                text: "Wall Readers & Terminals",
                url: "/products/categories/wall-readers-and-terminals",
              },
            },
          },
          {
            name: "Programming Equipment",
            fields: {
              Link: {
                text: "Apps & Software",
                url: "/products/categories/apps-software",
              },
            },
          },
          {
            name: "Media",
            fields: {
              Link: {
                text: "Transponders",
                url: "/products/categories/transponders",
              },
            },
          },
        ],
      },
      {
        name: "Industrial Locking Equipment",
        displayName: "Industrial Locking Equipment",
        fields: { Title: "Industrial Locking Equipment" },
        children: [
          {
            name: "Digital Furniture Locks",
            fields: {
              Link: {
                text: "Digital Furniture Locks",
                url: "/products/categories/digital-furniture-locks",
              },
            },
          },
          {
            name: "Furniture Locks",
            fields: {
              Link: {
                text: "Furniture Locks",
                url: "/products/categories/furniture-locks",
              },
            },
          },
          {
            name: "Trapped Key Interlocking Systems",
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
