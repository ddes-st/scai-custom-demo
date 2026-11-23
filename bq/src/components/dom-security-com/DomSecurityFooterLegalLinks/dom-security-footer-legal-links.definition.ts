import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const footerLegalLinksDefinition = {
  kind: "component",
  definitionKey: "dom-security-footer-legal-links",
  name: "dom-security-footer-legal-links",
  displayName: "Footer Legal Links",
  componentName: "DomSecurityFooterLegalLinks",
  icon: "Office/32x32/document_orientation_landscape.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Footer Legal Links"],
  },
  model: {
    folderTemplate: {
      name: "Footer Legal Links Folder",
    },
    itemTemplate: {
      name: "Footer Legal Links",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [{ name: "Link", type: "General Link" }],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: {
      root: "data",
      folder: ["Footer Legal Links"],
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Imprint",
        displayName: "Imprint",
        fields: {
          Link: {
            text: "Imprint",
            url: "https://www.dom-security.com/be/en/legal/imprint",
          }
        },
      },
      {
        name: "Terms And Conditions",
        displayName: "Terms and conditions",
        fields: {
          Link: {
            text: "Terms and conditions",
            url: "https://www.dom-security.com/be/en/legal/terms-and-conditions",
          }
        },
      },
      {
        name: "Data Protection",
        displayName: "Data Protection",
        fields: {
          Link: {
            text: "Data Protection",
            url: "https://www.dom-security.com/be/en/legal/data-protection",
          }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
