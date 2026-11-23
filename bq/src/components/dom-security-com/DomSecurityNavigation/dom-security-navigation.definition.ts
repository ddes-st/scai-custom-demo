import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

/** Country navigation bar — logo, L1 links, optional Products mega (Link List columns). */
export const navigationDefinition = {
  kind: "component",
  definitionKey: "dom-security-navigation",
  name: "dom-security-navigation",
  displayName: "Navigation",
  componentName: "DomSecurityNavigation",
  icon: "Office/32x32/navigate_right.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Navigations"],
  },
  model: {
    folderTemplate: { name: "Navigation Folder" },
    itemTemplate: {
      name: "Navigation",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Logo", type: "Image" },
            { name: "Home Link", type: "General Link" },
            { name: "Homeowners Link", type: "General Link" },
            { name: "Professionals Link", type: "General Link" },
            { name: "Industry Link", type: "General Link" },
            { name: "Products Label", type: "Single-Line Text" },
            { name: "Service Link", type: "General Link" },
            { name: "About Link", type: "General Link" },
            { name: "Newsroom Link", type: "General Link" },
            { name: "Search Label", type: "Single-Line Text" },
            { name: "Language En", type: "General Link" },
            { name: "Language Fr", type: "General Link" },
            { name: "Language Nl", type: "General Link" },
            { name: "Category Help Link", type: "General Link" },
            { name: "Homeowner Highlight Label", type: "Single-Line Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "nav-mega-columns",
      allowedControls: ["dom-security-footer-link-list"],
    },
  ],
  content: {
    location: { root: "data", folder: ["Navigations"] },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Main Navigation",
        displayName: "Navigation",
        fields: {
          Logo: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Logo/DOM-Hoberg_web_svg.svg?modified=20240524085418&extension=webp&modified=20240524085418",
            alt: "DOM Hoberg Logo",
          },
          "Home Link": { text: "home", url: "/be/en" },
          "Homeowners Link": {
            text: "Homeowners",
            url: "/be/en/homeowners",
          },
          "Professionals Link": {
            text: "Professionals",
            url: "/be/en/professionals",
          },
          "Industry Link": { text: "Industry", url: "/be/en/industry" },
          "Products Label": "Products",
          "Service Link": {
            text: "Service & Support",
            url: "/be/en/service-and-support",
          },
          "About Link": { text: "About Us", url: "/be/en/about-us" },
          "Newsroom Link": { text: "Newsroom", url: "/be/en/newsroom" },
          "Search Label": "Search",
          // Chip labels only — client rebuilds public hrefs (`/nl-BE/…`, no site segment).
          "Language En": { text: "en", url: "/" },
          "Language Fr": { text: "fr", url: "/fr-BE" },
          "Language Nl": { text: "nl", url: "/nl-BE" },
          "Category Help Link": {
            text: "Don't know the meaning of a category?",
            url: "",
          },
          "Homeowner Highlight Label": "Highlight Homeowners Products",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
