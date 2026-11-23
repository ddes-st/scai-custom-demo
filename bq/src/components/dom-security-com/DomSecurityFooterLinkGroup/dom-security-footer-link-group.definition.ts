import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityFooterLinkGroupDefinition = {
  kind: "component",
  definitionKey: "dom-security-footer-link-group",
  name: "dom-security-footer-link-group",
  displayName: "Footer Link Group",
  componentName: "DomSecurityFooterLinkGroup",
  icon: "Office/32x32/selection.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Link Lists"],
  },
  model: {
    folderTemplate: {
      name: "Footer Link Group Folder",
    },
    itemTemplate: {
      name: "Footer Link Group",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
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
      folder: ["Link Lists"],
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Main Navigation",
        displayName: "Main navigation",
        fields: {
          Title: "Main navigation"
        },
        children: [
          { name: "Homeowners",
            displayName: "Homeowners", fields: {
              Link: {
                text: "Homeowners",
                url: "https://www.dom-security.com/be/en/homeowners",
              }
            },
          },
          { name: "Professionals",
            displayName: "Professionals", fields: {
              Link: {
                text: "Professionals",
                url: "https://www.dom-security.com/be/en/professionals",
              }
            },
          },
          { name: "Manufacturers",
            displayName: "Manufacturers", fields: {
              Link: {
                text: "Manufacturers",
                url: "https://www.dom-security.com/be/en/industry",
              }
            },
          },
          { name: "Products",
            displayName: "Products", fields: {
              Link: {
                text: "Products",
                url: "https://www.dom-security.com/be/en/products",
              }
            },
          },
        ],
      },
      {
        name: "Company And Support",
        displayName: "Company and support",
        fields: {
          Title: "Company and support"
        },
        children: [
          { name: "Careers",
            displayName: "Careers", fields: {
              Link: {
                text: "Careers",
                url: "https://www.dom-security.com/be/en/carrieres",
              }
            },
          },
          { name: "Service And Support",
            displayName: "Service & Support", fields: {
              Link: {
                text: "Service & Support",
                url: "https://www.dom-security.com/be/en/service-en-support-2",
              }
            },
          },
          { name: "About Us",
            displayName: "About us", fields: {
              Link: {
                text: "About us",
                url: "https://www.dom-security.com/be/en/about-us",
              }
            },
          },
          { name: "Contact Us",
            displayName: "Contact us", fields: {
              Link: {
                text: "Contact us",
                url: "https://www.dom-security.com/be/en/contact-us-old",
              }
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
