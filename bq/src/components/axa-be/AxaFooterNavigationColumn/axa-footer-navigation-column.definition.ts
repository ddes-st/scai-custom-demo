import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const footerNavigationColumnDefinition = {
  kind: "component",
  definitionKey: "axa-footer-navigation-column",
  name: "axa-footer-navigation-column",
  displayName: "Footer Navigation Column",
  componentName: "AxaFooterNavigationColumn",
  icon: "Office/32x32/link.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Footer Navigation Columns"],
  },
  model: {
    folderTemplate: { name: "Footer Navigation Columns Folder" },
    itemTemplate: {
      name: "Footer Navigation Column",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Links", type: "Rich Text" },
            { name: "Mobile Collapsible", type: "Checkbox" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Footer Navigation Columns"] },
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "AXA",
        fields: {
          Title: "AXA",
          Links: "<ul><li><a href=\"https://www.axa.be/nl/jobs\">Jobs</a></li><li><a href=\"https://www.axa.be/nl/pers\">Press</a></li><li><a href=\"https://www.axa.be/nl/over-axa\">About AXA</a></li><li><a href=\"https://www.axa.be/nl/personeel-axa\">AXA Staff</a></li><li><a href=\"https://www.axa.com/\">AXA.com</a></li><li><a href=\"https://www.crelan.be/nl/particulieren?popup=axa\">Bank</a></li></ul>",
          "Mobile Collapsible": true,
        },
      },
      {
        name: "Important Information",
        fields: {
          Title: "Important info",
          Links: "<ul><li><a href=\"https://www.axa.be/nl/juridische-info/wettelijke-documenten/algemene-voorwaarden-en-productfiches\">Terms and conditions &amp; legal info</a></li><li><a href=\"https://www.axa.be/nl/privacy-cookiebeleid/privacy-clausule\">Privacy and cookies policy</a></li><li><a href=\"javascript:tC.privacyCenter.showPrivacyCenter();\">Cookie preferences</a></li><li><a href=\"https://www.axa.be/nl/veelgestelde-vragen\">FAQ</a></li><li><a href=\"https://www.axa.be/nl/blog\">Blog</a></li><li><a href=\"https://www.axa.be/nl/lexicon\">Lexicon</a></li><li><a href=\"https://www.axa.be/nl/digitale-toegankelijkheid\">Accessibility statement</a></li></ul>",
          "Mobile Collapsible": true,
        },
      },
      {
        name: "Contact Us",
        fields: {
          Title: "Contact us",
          Links: "<ul><li><a href=\"https://www.axa.be/nl/particulieren/contact\">Help and contact</a></li><li><a href=\"https://www.axa.be/nl/netwerk/ons-netwerk\">Our network</a></li></ul>",
          "Mobile Collapsible": true,
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
