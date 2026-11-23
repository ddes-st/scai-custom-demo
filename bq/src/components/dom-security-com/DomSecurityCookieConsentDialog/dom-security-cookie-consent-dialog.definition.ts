import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityCookieConsentDialogDefinition = {
  kind: "component",
  definitionKey: "dom-security-cookie-consent-dialog",
  name: "dom-security-cookie-consent-dialog",
  displayName: "Cookie Consent Dialog",
  componentName: "DomSecurityCookieConsentDialog",
  icon: "Office/32x32/information.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Cookie Consent Dialogs"],
  },
  model: {
    folderTemplate: { name: "Cookie Consent Dialog Folder" },
    itemTemplate: {
      name: "Cookie Consent Dialog",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Intro", type: "Rich Text" },
            { name: "Body", type: "Rich Text" },
            { name: "Privacy Link", type: "General Link" },
            { name: "Manage Cookies Link", type: "General Link" },
            { name: "Continue Action", type: "Single-Line Text" },
            { name: "Accept Action", type: "Single-Line Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Cookie Consent Dialogs"] },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Cookie Consent Dialog",
        displayName: "We do more Cookies",
        fields: {
          Title: "We do more Cookies",
          Intro: "Our site uses cookies. By continuing to use our site you are agreeing to our Data Protection.",
          Body: "We use cookies on our website. In addition to the mandatory cookies required for the basic technical functions of the website, this also includes optional additional cookies from our partners (Google Analytics, Facebook Connect, LinkedIn Analytics, LeadForensics), which help us to operate our website economically, to improve it and to analyse access to our website. Further information (incl. possible revocation at any time) under Data protection.",
          "Privacy Link": { text: "Data Protection", url: "https://www.dom-security.com/be/en/legal/data-protection" },
          "Manage Cookies Link": { text: "Manage Cookies", url: "https://www.dom-security.com/be/en/legal/cookies" },
          "Continue Action": "Continue without cookies",
          "Accept Action": "Accept and close"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
