import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const footerNavigationDefinition = {
  kind: "component",
  definitionKey: "axa-footer-navigation",
  name: "axa-footer-navigation",
  displayName: "Footer Navigation",
  componentName: "AxaFooterNavigation",
  icon: "Office/32x32/hand_point_left.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Footer Navigations"],
  },
  model: {
    folderTemplate: { name: "Footer Navigation Folder" },
    itemTemplate: {
      name: "Footer Navigation",
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
    location: { root: "data", folder: ["Footer Navigations"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Main Footer Navigation",
        displayName: "Footer Navigation",
        fields: {
          Copyright: "Copyright AXA 2026 ©",
          "Site Map Link": { text: "Site-overzicht", url: "https://www.axa.be/nl/site-overzicht" },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
