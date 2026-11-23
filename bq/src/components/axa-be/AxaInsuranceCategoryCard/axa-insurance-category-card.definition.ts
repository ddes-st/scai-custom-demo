import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const insuranceCategoryCardDefinition = {
  kind: "component",
  definitionKey: "axa-insurance-category-card",
  name: "axa-insurance-category-card",
  displayName: "Insurance Category Card",
  componentName: "AxaInsuranceCategoryCard",
  icon: "Office/32x32/credit_cards.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Insurance Category Cards"] },
  model: {
    folderTemplate: { name: "Insurance Category Card Folder" },
    itemTemplate: {
      name: "Insurance Category Card",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Image", type: "Image" },
            { name: "Link", type: "General Link" },
            { name: "Promo Label", type: "Single-Line Text" },
            { name: "Promo Link", type: "General Link" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }, { name: "Promo" }, { name: "Teaser" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Insurance Category Cards"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Home",
        displayName: "Woning",
        variant: "Promo",
        fields: {
          Title: "Woning",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-icons/houses.svg?rev=068a259fddb747e3bacb11f76c32e9cb&savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=28D3FD04279CB332D8E12648B6545812", alt: "" },
          Link: { text: "Woning", url: "https://www.axa.be/nl/particulieren/woning/woonverzekering-brandverzekering" },
          "Promo Label": "Ontdek onze korting",
          "Promo Link": { text: "Ontdek onze korting", url: "https://www.axa.be/nl/particulieren/woning/woonverzekering-brandverzekering#promo" }
        }
      },
      {
        name: "Auto",
        displayName: "Auto",
        variant: "Promo",
        fields: {
          Title: "Auto",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/auto.svg?rev=18eea8c6bd094f64810af964280af6cd&savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=F47B89B9DF40C2997E1513A16BA00EB2", alt: "" },
          Link: { text: "Auto", url: "https://www.axa.be/nl/particulieren/mobiliteit/auto" },
          "Promo Label": "Ontdek onze kortingen",
          "Promo Link": { text: "Ontdek onze kortingen", url: "https://www.axa.be/nl/particulieren/mobiliteit/auto#promo" }
        }
      },
      {
        name: "Travel",
        displayName: "Reis",
        fields: {
          Title: "Reis",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-icons/travel%20new.svg?rev=e570f632aa554bd6a56be921e3de2891&savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=469B5ABC4CD303505EC7838DE09A8D29", alt: "" },
          Link: { text: "Reis", url: "https://www.axa.be/nl/particulieren/gezin/reisverzekering" }
        }
      },
      {
        name: "Pension",
        displayName: "Pensioen",
        fields: {
          Title: "Pensioen",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/pension.svg?rev=403c064069d8483f81b05e82ecca8f17&savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=C21128E6457FE240BABAD56F408A8EDD", alt: "" },
          Link: { text: "Pensioen", url: "https://www.axa.be/nl/particulieren/pensioen" }
        }
      },
      {
        name: "Family",
        displayName: "Familiale",
        fields: {
          Title: "Familiale",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/familly%20hp.svg?savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=30664809CC2C62001C8149A587EB0BEE", alt: "" },
          Link: { text: "Familiale", url: "https://www.axa.be/nl/particulieren/gezin/familiale-verzekering" }
        }
      },
      {
        name: "Bicycles E Scooters And More",
        displayName: "(e-)Fietsen, e-steps en co",
        fields: {
          Title: "(e-)Fietsen, e-steps en co",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-icons/new%20bike.svg?rev=1fa578a8e11442bf99b083e23c260d35&savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=99&hash=F66ED246FA2C9252C43D9FDC8F7E2E33", alt: "" },
          Link: { text: "(e-)Fietsen, e-steps en co", url: "https://www.axa.be/nl/particulieren/mobiliteit/fiets" }
        }
      },
      {
        name: "Investments",
        displayName: "Beleggingen",
        fields: {
          Title: "Beleggingen",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-icons/investissement.svg?savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=9A25484D37027A63EFF7D718E2965DD3", alt: "" },
          Link: { text: "Beleggingen", url: "https://www.axa.be/nl/particulieren/beleggingen/spaar-en-of-beleggingsverzekering" }
        }
      },
      {
        name: "View All Products",
        displayName: "Bekijk al onze producten",
        variant: "Teaser",
        fields: {
          Title: "Bekijk al onze producten",
          Link: { text: "Bekijk al onze producten", url: "https://www.axa.be/nl/particulieren#all" }
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
