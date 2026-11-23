import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const footerSocialLinksDefinition = {
  kind: "component",
  definitionKey: "dom-security-footer-social-links",
  name: "dom-security-footer-social-links",
  displayName: "Footer Social Links",
  componentName: "DomSecurityFooterSocialLinks",
  icon: "Office/32x32/document_orientation_landscape.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Icon Link Lists"],
  },
  model: {
    folderTemplate: { name: "Footer Social Links Folder" },
    itemTemplate: {
      name: "Footer Social Links",
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
    location: { root: "data", folder: ["Icon Link Lists"] },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Footer Social Links",
        displayName: "Social links",
        fields: {
          Title: "Social links"
        },
        children: [
          {
            name: "Facebook",
            displayName: "Facebook",
            fields: {
              Icon: "facebook",
              Link: {
                text: "Facebook",
                url: "https://www.facebook.com/DOMHOBERG",
              }
            },
          },
          {
            name: "LinkedIn",
            displayName: "Linkedin",
            fields: {
              Icon: "linkedin",
              Link: {
                text: "Linkedin",
                url: "https://www.linkedin.com/company/313033",
              }
            },
          },
          {
            name: "YouTube",
            displayName: "Youtube",
            fields: {
              Icon: "youtube",
              Link: {
                text: "Youtube",
                url: "https://www.youtube.com/channel/UCZ3HaprkiEoBFQFosMCAoGQ/videos",
              }
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
