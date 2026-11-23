import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const consentBannerDefinition = {
  kind: "component",
  definitionKey: "axa-consent-banner",
  name: "axa-consent-banner",
  displayName: "Consent Banner",
  componentName: "AxaConsentBanner",
  icon: "Office/32x32/filter_and_sort.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
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
            { name: "Description", type: "Rich Text" },
            { name: "Policy Link", type: "General Link" },
            { name: "Accept Label", type: "Single-Line Text" },
            { name: "Personalize Label", type: "Single-Line Text" },
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
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Cookie Consent",
        displayName: "Onze cookies, jouw keuze",
        renderingIdentifier: "popin_tc_privacy",
        fields: {
          Heading: "Onze cookies, jouw keuze",
          Description: "Onze website maakt gebruik van cookies. Bepaalde cookies zijn noodzakelijk voor de goede werking van de website of kunnen gebruikt worden voor analyses. Dankzij andere cookies kunnen wij onder andere gepersonaliseerde inhoud of publiciteit tonen, die dus beter aansluit bij je profiel en je interesses.\nJe kan deze cookies aanvaarden of weigeren en je beslissing steeds aanpassen via de ‘cookies voorkeuren’. Weet dat door ze te aanvaarden, je surfervaring heel wat zal verbeteren.",
          "Policy Link": { text: "Ons cookiebeleid", url: "https://www.axa.be/nl/privacy-cookiebeleid/cookies" },
          "Accept Label": "Ik aanvaard alle cookies",
          "Personalize Label": "Ik personaliseer de cookies"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
