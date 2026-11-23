import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const partnerPortalCardDefinition = {
  kind: "component",
  definitionKey: "dom-security-partner-portal-card",
  name: "dom-security-partner-portal-card",
  displayName: "Partner Portal Card",
  componentName: "DomSecurityPartnerPortalCard",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Partner Portal Cards"],
  },
  model: {
    folderTemplate: {
      name: "Partner Portal Card Folder",
    },
    itemTemplate: {
      name: "Partner Portal Card",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Description", type: "Rich Text" },
            { name: "Card Subtitle", type: "Single-Line Text" },
            { name: "Card Title", type: "Single-Line Text" },
            { name: "Portal Link", type: "General Link" },
            { name: "Portal Image", type: "Image" },
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
      folder: ["Partner Portal Cards"],
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Partner Portal Card",
        displayName: "DOM Keystone®",
        fields: {
          Heading: "DOM Keystone®",
          Description: "Login credentials are required for the partner portal. Please contact your Account Manager for more information about this partner program.",
          "Card Subtitle": "DOM Keystone®",
          "Card Title": "Log in to our partner portal",
          "Portal Link": { text: "Log in to our partner portal", url: "https://www.domextranet.de" },
          "Portal Image": { url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-DE/Newsletter/2021/Keystone/01-2021/Keystone-Monitor.JPG?mw=900&crop=1&modified=20210301144056&extension=webp", alt: "Log in to our partner portal" }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
