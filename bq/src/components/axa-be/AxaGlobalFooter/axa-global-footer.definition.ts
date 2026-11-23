import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const globalFooterDefinition = {
  kind: "component",
  definitionKey: "axa-global-footer",
  name: "axa-global-footer",
  displayName: "Global Footer",
  componentName: "AxaGlobalFooter",
  icon: "Office/32x32/link.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Global Footers"] },
  model: {
    folderTemplate: { name: "Global Footer Folder" },
    itemTemplate: {
      name: "Global Footer",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
              { name: "Title", type: "Single-Line Text" },
              { name: "Image", type: "Image" },
              { name: "Link", type: "General Link" },
            ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    cultures: ["nl-BE","fr-BE"],
    location: { root: "data", folder: ["Global Footers"] },
    items: [
      {
        name: "Home GlobalFooter",
        fields: {
          Title: "GlobalFooter",
          Link: { text: "GlobalFooter", url: "/" },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
