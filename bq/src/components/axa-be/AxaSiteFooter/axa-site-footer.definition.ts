import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const siteFooterDefinition = {
  kind: "component",
  definitionKey: "axa-site-footer",
  name: "axa-site-footer",
  displayName: "Site Footer",
  componentName: "AxaSiteFooter",
  icon: "Office/32x32/link.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Site Footers"] },
  model: {
    folderTemplate: { name: "Site Footer Folder" },
    itemTemplate: {
      name: "Site Footer",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Social Heading", type: "Single-Line Text" },
            { name: "Social Links", type: "Rich Text" },
            { name: "Copyright", type: "Single-Line Text" },
            { name: "Sitemap Link", type: "General Link" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [
    { key: "footer-navigation", allowedControls: ["axa-footer-link-list"] }
  ],
  content: {
    location: { root: "data", folder: ["Site Footers"] },
    items: [
      {
        name: "Default Site Footer",
        fields: {
          "Social Heading": "Volg ons",
          "Social Links": "<p><a href=\"https://www.facebook.com/AXABelgium\" target=\"_blank\" rel=\"noreferrer\" aria-label=\"Facebook\"><span class=\"icon-facebook\" aria-hidden=\"true\"></span></a> <a href=\"https://www.instagram.com/axa_belgium/\" target=\"_blank\" rel=\"noreferrer\" aria-label=\"Instagram\"><span class=\"icon-instagram\" aria-hidden=\"true\"></span></a> <a href=\"https://www.tiktok.com/@axa_belgium\" target=\"_blank\" rel=\"noreferrer\" aria-label=\"TikTok\"><span class=\"icon-tiktok\" aria-hidden=\"true\"></span></a> <a href=\"https://www.youtube.com/user/AXAcomBelgium\" target=\"_blank\" rel=\"noreferrer\" aria-label=\"YouTube\"><span class=\"icon-youtube\" aria-hidden=\"true\"></span></a></p>",
          Copyright: "Copyright AXA 2026 ©",
          "Sitemap Link": { text: "https://www.axa.be/nl/Site-overzicht", url: "https://www.axa.be/nl/site-overzicht" }
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
