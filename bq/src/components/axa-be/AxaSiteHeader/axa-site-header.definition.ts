import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const siteHeaderDefinition = {
  kind: "component",
  definitionKey: "axa-site-header",
  name: "axa-site-header",
  displayName: "Site Header",
  componentName: "AxaSiteHeader",
  icon: "Office/32x32/sign_warning_voltage.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Site Headers"] },
  model: {
    folderTemplate: { name: "Site Header Folder" },
    itemTemplate: {
      name: "Site Header",
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
    location: { root: "data", folder: ["Site Headers"] },
    items: [
      {
        name: "Home SiteHeader",
        fields: {
          Title: "SiteHeader",
          Link: { text: "SiteHeader", url: "/" },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
