import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const footerColumnDefinition = {
  kind: "component",
  definitionKey: "axa-footer-column",
  name: "axa-footer-column",
  displayName: "Footer Column",
  componentName: "AxaFooterColumn",
  icon: "Office/32x32/hand_point_left.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Link Lists"],
  },
  model: {
    folderTemplate: {
      name: "Footer Column Folder",
    },
    itemTemplate: {
      name: "Footer Column",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
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
      folder: ["Link Lists"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "AXA",
        displayName: "AXA",
        fields: {
          Title: "AXA"
        },
        children: [
          { name: "Jobs", displayName: "Jobs", fields: { Link: { text: "Jobs", url: "https://www.axa.be/nl/jobs" } } },
          { name: "Press", displayName: "Pers", fields: { Link: { text: "Pers", url: "https://www.axa.be/nl/pers" } } },
          { name: "About AXA", displayName: "Over AXA", fields: { Link: { text: "Over AXA", url: "https://www.axa.be/nl/over-axa" } } },
          { name: "AXA Personnel", displayName: "AXA Personeel", fields: { Link: { text: "AXA Personeel", url: "https://www.axa.be/nl/personeel-axa" } } },
          { name: "AXA Com", displayName: "AXA.com", fields: { Link: { text: "AXA.com", url: "https://www.axa.com/" } } },
          { name: "Bank", displayName: "Bank", fields: { Link: { text: "Bank", url: "https://www.crelan.be/nl/particulieren?popup=axa", target: "_blank" } } },
        ],
      },
      {
        name: "Important Information",
        displayName: "Belangrijke info",
        fields: {
          Title: "Belangrijke info"
        },
        children: [
          { name: "General Terms And Legal Information", displayName: "Algemene voorwaarden & juridische info", fields: { Link: { text: "Algemene voorwaarden & juridische info", url: "https://www.axa.be/nl/juridische-info/wettelijke-documenten/algemene-voorwaarden-en-productfiches" } } },
          { name: "Privacy And Cookie Policy", displayName: "Privacy en cookiebeleid", fields: { Link: { text: "Privacy en cookiebeleid", url: "https://www.axa.be/nl/privacy-cookiebeleid/privacy-clausule" } } },
          { name: "Cookie Preferences", displayName: "Cookies voorkeuren", fields: { Link: { text: "Cookies voorkeuren", url: "javascript:tC.privacyCenter.showPrivacyCenter();" } } },
          { name: "Frequently Asked Questions", displayName: "FAQ", fields: { Link: { text: "FAQ", url: "https://www.axa.be/nl/veelgestelde-vragen" } } },
          { name: "Blog", displayName: "Blog", fields: { Link: { text: "Blog", url: "https://www.axa.be/nl/blog" } } },
          { name: "Lexicon", displayName: "Lexicon", fields: { Link: { text: "Lexicon", url: "https://www.axa.be/nl/lexicon" } } },
          { name: "Accessibility Statement", displayName: "Verklaring Accessibility", fields: { Link: { text: "Verklaring Accessibility", url: "https://www.axa.be/nl/digitale-toegankelijkheid" } } },
        ],
      },
      {
        name: "Contact Us",
        displayName: "Contacteer ons",
        fields: {
          Title: "Contacteer ons"
        },
        children: [
          { name: "Help And Contact", displayName: "Help en contact", fields: { Link: { text: "Help en contact", url: "https://www.axa.be/nl/particulieren/help-en-contact" } } },
          { name: "Our Network", displayName: "Ons netwerk", fields: { Link: { text: "Ons netwerk", url: "https://www.axa.be/nl/netwerk/ons-netwerk" } } },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
