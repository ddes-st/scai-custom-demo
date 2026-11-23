import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const consentBannerDefinition = {
  kind: "component",
  definitionKey: "dom-security-consent-banner",
  name: "dom-security-consent-banner",
  displayName: "Consent Banner",
  componentName: "DomSecurityConsentBanner",
  icon: "Office/32x32/lock.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Consent Banners"],
  },
  model: {
    folderTemplate: {
      name: "Consent Banner Folder",
    },
    itemTemplate: {
      name: "Consent Banner",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Intro", type: "Rich Text" },
            { name: "Body", type: "Rich Text" },
            { name: "Manage Cookies", type: "General Link" },
            { name: "Continue Without Cookies", type: "General Link" },
            { name: "Accept And Close", type: "General Link" },
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
      folder: ["Consent Banners"],
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Cookie Consent",
        displayName: "We do more Cookies",
        fields: {
          Heading: "We do more Cookies",
          Intro:
            "<p>Our site uses cookies. By continuing to use our site you are agreeing to our <a href=\"https://www.dom-security.com/be/en/legal/data-protection\">Data Protection</a>.</p>",
          Body:
            "<p>We use cookies on our website. In addition to the mandatory cookies required for the basic technical functions of the website, this also includes optional additional cookies from our partners (Google Analytics, Facebook Connect, LinkedIn Analytics, LeadForensics), which help us to operate our website economically, to improve it and to analyse access to our website. Further information (incl. possible revocation at any time) under Data protection.</p>",
          "Manage Cookies": {
            text: "Manage Cookies",
            url: "https://www.dom-security.com/be/en/legal/cookies",
          },
          "Continue Without Cookies": {
            text: "Continue without cookies",
            url: "/",
          },
          "Accept And Close": {
            text: "Accept and close",
            url: "/",
          }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
