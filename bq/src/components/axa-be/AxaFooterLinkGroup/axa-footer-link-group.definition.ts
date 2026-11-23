import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const footerLinkGroupDefinition = {
  kind: "component",
  definitionKey: "axa-footer-link-group",
  name: "axa-footer-link-group",
  displayName: "Footer Link Group",
  componentName: "AxaFooterLinkGroup",
  icon: "Office/32x32/link.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Icon Link Lists"] },
  model: {
    folderTemplate: { name: "Footer Link Group Folder" },
    itemTemplate: {
      name: "Footer Link Group",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Link", type: "General Link" },
            { name: "Icon", type: "Single-Line Text" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Icon Link Lists"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Axa",
        displayName: "AXA",
        fields: { Title: "AXA", Link: { text: "Lees meer", url: "/" } },
        children: [
          { name: "Jobs", displayName: "Jobs", fields: { Link: { text: "Jobs", url: "https://www.axa.be/nl/jobs" } } },
          { name: "Pers", displayName: "Pers", fields: { Link: { text: "Pers", url: "https://www.axa.be/nl/pers" } } },
          { name: "Over Axa", displayName: "Over AXA", fields: { Link: { text: "Over AXA", url: "https://www.axa.be/nl/over-axa" } } },
          { name: "Axa Personeel", displayName: "AXA Personeel", fields: { Link: { text: "AXA Personeel", url: "https://www.axa.be/nl/personeel-axa" } } },
          { name: "Axa Com", displayName: "AXA.com", fields: { Link: { text: "AXA.com", url: "https://www.axa.com/" } } },
          { name: "Bank", displayName: "Bank", fields: { Link: { text: "Bank", url: "https://www.crelan.be/nl/particulieren?popup=axa" } } }
        ]
      },
      {
        name: "Important Information",
        displayName: "Belangrijke info",
        fields: { Title: "Belangrijke info", Link: { text: "Lees meer", url: "/" } },
        children: [
          { name: "General Terms And Legal Information", displayName: "Algemene voorwaarden & juridische info", fields: { Link: { text: "Algemene voorwaarden & juridische info", url: "https://www.axa.be/nl/juridische-info/wettelijke-documenten/algemene-voorwaarden-en-productfiches" } } },
          { name: "Privacy And Cookie Policy", displayName: "Privacy en cookiebeleid", fields: { Link: { text: "Privacy en cookiebeleid", url: "https://www.axa.be/nl/privacy-cookiebeleid/privacy-clausule" } } },
          { name: "Cookie Preferences", displayName: "Cookies voorkeuren", fields: { Link: { text: "Cookies voorkeuren", url: "javascript:tC.privacyCenter.showPrivacyCenter();" } } },
          { name: "Faq", displayName: "FAQ", fields: { Link: { text: "FAQ", url: "https://www.axa.be/nl/veelgestelde-vragen" } } },
          { name: "Blog", displayName: "Blog", fields: { Link: { text: "Blog", url: "https://www.axa.be/nl/blog" } } },
          { name: "Lexicon", displayName: "Lexicon", fields: { Link: { text: "Lexicon", url: "https://www.axa.be/nl/lexicon" } } },
          { name: "Accessibility Statement", displayName: "Verklaring Accessibility", fields: { Link: { text: "Verklaring Accessibility", url: "https://www.axa.be/nl/digitale-toegankelijkheid" } } }
        ]
      },
      {
        name: "Contact Us",
        displayName: "Contacteer ons",
        fields: { Title: "Contacteer ons", Link: { text: "Lees meer", url: "/" } },
        children: [
          { name: "Help And Contact", displayName: "Help en contact", fields: { Link: { text: "Help en contact", url: "https://www.axa.be/nl/particulieren/help-en-contact" } } },
          { name: "Our Network", displayName: "Ons netwerk", fields: { Link: { text: "Ons netwerk", url: "https://www.axa.be/nl/netwerk/ons-netwerk" } } }
        ]
      },
      {
        name: "Follow Us",
        displayName: "Volg ons",
        fields: { Title: "Volg ons", Link: { text: "Lees meer", url: "/" } },
        children: [
          { name: "Facebook", displayName: "Facebook", fields: { Link: { text: "Facebook", url: "/" }, Icon: "facebook" } },
          { name: "Instagram", displayName: "Instagram", fields: { Link: { text: "Instagram", url: "/" }, Icon: "instagram" } },
          { name: "Tiktok", displayName: "TikTok", fields: { Link: { text: "TikTok", url: "/" }, Icon: "tiktok" } },
          { name: "Youtube", displayName: "YouTube", fields: { Link: { text: "YouTube", url: "/" }, Icon: "youtube" } }
        ]
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
