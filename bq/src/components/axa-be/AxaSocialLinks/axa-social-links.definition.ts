import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const socialLinksDefinition = {
  kind: "component",
  definitionKey: "axa-social-links",
  name: "axa-social-links",
  displayName: "Social Links",
  componentName: "AxaSocialLinks",
  icon: "Office/32x32/hand_point_left.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Icon Link Lists"],
  },
  model: {
    folderTemplate: { name: "Social Links Folder" },
    itemTemplate: {
      name: "Social Links",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Link", type: "General Link" },
            { name: "Icon", type: "Single-Line Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Icon Link Lists"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Follow Us",
        displayName: "Volg ons",
        fields: {
          Title: "Volg ons", Link: { text: "Lees meer", url: "/" } },
        children: [
          {
            name: "Facebook",
            displayName: "facebook",
            fields: {
              Icon: "facebook",
              Link: {
                text: "facebook",
                url: "https://www.facebook.com/AXABelgium",
                target: "_blank",
              }
            },
          },
          {
            name: "Instagram",
            displayName: "Instagram",
            fields: {
              Icon: "instagram",
              Link: {
                text: "Instagram",
                url: "https://www.instagram.com/axa_belgium/",
                target: "_blank",
              }
            },
          },
          {
            name: "TikTok",
            displayName: "TikTok",
            fields: {
              Icon: "tiktok",
              Link: {
                text: "TikTok",
                url: "https://www.tiktok.com/@axa_belgium",
                target: "_blank",
              }
            },
          },
          {
            name: "YouTube",
            displayName: "YouTube",
            fields: {
              Icon: "youtube",
              Link: {
                text: "YouTube",
                url: "https://www.youtube.com/user/AXAcomBelgium",
                target: "_blank",
              }
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
