import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const audienceLinkDefinition = {
  kind: "component",
  definitionKey: "dom-security-audience-link",
  name: "dom-security-audience-link",
  displayName: "Audience Link",
  componentName: "DomSecurityAudienceLink",
  icon: "Office/32x32/document_header.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Audience Links"],
  },
  model: {
    folderTemplate: {
      name: "Audience Link Folder",
    },
    itemTemplate: {
      name: "Audience Link",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Link", type: "General Link" },
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
      folder: ["Audience Links"],
    },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Professionals Audience Link",
        displayName: "Curious how DOM can support you in selling locking solutions?",
        fields: {
          Link: {
            text: "Curious how DOM can support you in selling locking solutions?",
            url: "https://www.dom-security.com/be/en/professionals",
          }
        },
      },
      {
        name: "Industry Audience Link",
        displayName: "Looking to collaborate with DOM for tailormade solutions?",
        fields: {
          Link: {
            text: "Looking to collaborate with DOM for tailormade solutions?",
            url: "https://www.dom-security.com/be/en/industry",
          }
        },
      },
      {
        name: "Homeowners Audience Link",
        displayName: "Are you looking for a new security solution for your home?",
        fields: {
          Link: {
            text: "Are you looking for a new security solution for your home?",
            url: "https://www.dom-security.com/be/en/homeowners",
          }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
