import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityProductRelatedSoftwareDefinition = {
  kind: "component",
  definitionKey: "dom-security-product-related-software",
  name: "dom-security-product-related-software",
  displayName: "Product Related Software",
  componentName: "DomSecurityProductRelatedSoftware",
  icon: "Software/32x32/application.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Product Related Software Sections"],
  },
  model: {
    folderTemplate: {
      name: "Product Related Software Section Folder",
      displayName: "Product Related Software Sections",
    },
    itemTemplate: {
      name: "Product Related Software Section",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            {
              name: "Software Root",
              type: "Single-Line Text",
              shared: true,
              default: "/sitecore/content/domsecurity/domsecurity-com/Data/Product Software",
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
      folder: ["Product Related Software Sections"],
    },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Related Software",
        displayName: "Related Software",
        fields: {
          Heading: "Related software",
          "Software Root": "/sitecore/content/domsecurity/domsecurity-com/Data/Product Software",
          "Source Root": "/sitecore/content/domsecurity/domsecurity-com/Data/Products",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
