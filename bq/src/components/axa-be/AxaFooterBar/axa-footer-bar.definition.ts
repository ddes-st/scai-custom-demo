import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const footerBarDefinition = {
  kind: "component",
  definitionKey: "axa-footer-bar",
  name: "axa-footer-bar",
  displayName: "Footer Bar",
  componentName: "AxaFooterBar",
  icon: "Office/32x32/hand_point_left.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Footer Bars"] },
  model: {
    folderTemplate: { name: "Footer Bar Folder" },
    itemTemplate: {
      name: "Footer Bar",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Copyright", type: "Single-Line Text" },
            { name: "Site Map Link", type: "General Link" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Footer Bars"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Footer Bar",
        displayName: "Footer Bar",
        fields: {
          Copyright: "Copyright AXA 2026 ©",
          "Site Map Link": { text: "Site-overzicht", url: "https://www.axa.be/nl/site-overzicht" }
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
