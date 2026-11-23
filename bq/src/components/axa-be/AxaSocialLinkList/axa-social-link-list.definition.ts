import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

const followUsChildren = [
  {
    name: "Facebook",
    fields: {
      Link: {
        text: "Facebook",
        url: "https://www.facebook.com/AXABelgium",
        target: "_blank",
        linktype: "external",
      },
      Icon: "facebook",
    },
  },
  {
    name: "Instagram",
    fields: {
      Link: {
        text: "Instagram",
        url: "https://www.instagram.com/axa_belgium/",
        target: "_blank",
        linktype: "external",
      },
      Icon: "instagram",
    },
  },
  {
    name: "TikTok",
    fields: {
      Link: {
        text: "TikTok",
        url: "https://www.tiktok.com/@axa_belgium",
        target: "_blank",
        linktype: "external",
      },
      Icon: "tiktok",
    },
  },
  {
    name: "YouTube",
    fields: {
      Link: {
        text: "YouTube",
        url: "https://www.youtube.com/user/AXAcomBelgium",
        target: "_blank",
        linktype: "external",
      },
      Icon: "youtube",
    },
  },
] as const;

export const SocialLinkListDefinition = {
  kind: "component",
  definitionKey: "axa-social-link-list",
  name: "axa-social-link-list",
  displayName: "Social Link List",
  componentName: "AxaSocialLinkList",
  icon: "Office/32x32/link.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Icon Link Lists"],
  },
  model: {
    folderTemplate: {
      name: "Social Link List Folder",
    },
    itemTemplate: {
      name: "Social Link List",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [{ name: "Title", type: "Single-Line Text" }],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: {
      root: "data",
      folder: ["Icon Link Lists"],
    },
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Follow Us",
        fields: { Title: "Follow us" },
        children: [...followUsChildren],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
