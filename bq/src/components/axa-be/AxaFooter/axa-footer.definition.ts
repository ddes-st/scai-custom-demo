import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const footerDefinition = {
  kind: "component",
  definitionKey: "axa-footer",
  name: "axa-footer",
  displayName: "Footer",
  componentName: "AxaFooter",
  icon: "Office/32x32/hand_point_left.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Footers"],
  },
  model: {
    folderTemplate: {
      name: "Footer Folder",
    },
    itemTemplate: {
      name: "Footer",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Copyright", type: "Single-Line Text" },
            { name: "Site Map Link", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "footer-navigation",
      allowedControls: ["axa-footer-column"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Footers"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Footer",
        displayName: "Footer",
        fields: {
          Copyright: "Copyright AXA 2026 ©",
          "Site Map Link": { text: "Site-overzicht", url: "https://www.axa.be/nl/site-overzicht" }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
