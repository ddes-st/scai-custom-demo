import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityCookieConsentModalDefinition = {
  kind: "component",
  definitionKey: "dom-security-cookie-consent-modal",
  name: "dom-security-cookie-consent-modal",
  displayName: "Cookie Consent Modal",
  componentName: "DomSecurityCookieConsentModal",
  icon: "Office/32x32/cookies.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Cookie Consent Modals"],
  },
  model: {
    folderTemplate: { name: "Cookie Consent Modal Folder" },
    itemTemplate: {
      name: "Cookie Consent Modal",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Intro", type: "Rich Text" },
            { name: "Body", type: "Rich Text" },
            { name: "Manage Cookies", type: "General Link" },
            { name: "Continue Label", type: "Single-Line Text" },
            { name: "Accept Label", type: "Single-Line Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Cookie Consent Modals"] },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Cookie Consent Modal",
        displayName: "We do more Cookies",
        fields: {
          Title: "We do more Cookies",
          Intro: "Our site uses cookies. By continuing to use our site you are agreeing to our <a href=\"https://www.dom-security.com/be/en/legal/data-protection\">Data Protection</a>.",
          Body: "We use cookies on our website. In addition to the mandatory cookies required for the basic technical functions of the website, this also includes optional additional cookies from our partners (Google Analytics, Facebook Connect, LinkedIn Analytics, LeadForensics), which help us to operate our website economically, to improve it and to analyse access to our website. Further information (incl. possible revocation at any time) under Data protection.",
          "Manage Cookies": {
            text: "Manage Cookies",
            url: "https://www.dom-security.com/be/en/legal/cookies",
          },
          "Continue Label": "Continue without cookies",
          "Accept Label": "Accept and close"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
