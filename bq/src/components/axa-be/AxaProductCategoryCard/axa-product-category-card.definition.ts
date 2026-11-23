import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const productCategoryCardDefinition = {
  kind: "component",
  definitionKey: "axa-product-category-card",
  name: "axa-product-category-card",
  displayName: "Product Category Card",
  componentName: "AxaProductCategoryCard",
  icon: "Office/32x32/shopping_cart_full.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Product Category Cards"] },
  model: {
    folderTemplate: { name: "Product Category Cards Folder" },
    itemTemplate: {
      name: "Product Category Card",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Image", type: "Image" },
            { name: "Link", type: "General Link" },
            { name: "Promotion Label", type: "Single-Line Text" },
            { name: "Show Promotion", type: "Checkbox" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Product Category Cards"] },
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Home",
        fields: {
          Title: "Home",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-icons/houses.svg?rev=068a259fddb747e3bacb11f76c32e9cb&savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=28D3FD04279CB332D8E12648B6545812", alt: "Home insurance" },
          Link: { text: "Home", url: "https://www.axa.be/nl/particulieren/woning/woonverzekering-brandverzekering" },
          "Promotion Label": "Discover our discount",
          "Show Promotion": true
        }
      },
      {
        name: "Auto",
        fields: {
          Title: "Car",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/auto.svg?rev=18eea8c6bd094f64810af964280af6cd&savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=F47B89B9DF40C2997E1513A16BA00EB2", alt: "Car insurance" },
          Link: { text: "Car", url: "https://www.axa.be/nl/particulieren/mobiliteit/auto" },
          "Promotion Label": "Discover our discounts",
          "Show Promotion": true
        }
      },
      {
        name: "Travel",
        fields: {
          Title: "Travel",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-icons/travel%20new.svg?rev=e570f632aa554bd6a56be921e3de2891&savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=469B5ABC4CD303505EC7838DE09A8D29", alt: "Travel insurance" },
          Link: { text: "Travel", url: "https://www.axa.be/nl/particulieren/gezin/reisverzekering" },
          "Promotion Label": "",
          "Show Promotion": false
        }
      },
      {
        name: "Pension",
        fields: {
          Title: "Pension",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/pension.svg?rev=403c064069d8483f81b05e82ecca8f17&savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=C21128E6457FE240BABAD56F408A8EDD", alt: "Pension" },
          Link: { text: "Pension", url: "https://www.axa.be/nl/particulieren/pensioen" },
          "Promotion Label": "",
          "Show Promotion": false
        }
      },
      {
        name: "Family",
        fields: {
          Title: "Family",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/familly%20hp.svg?savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=30664809CC2C62001C8149A587EB0BEE", alt: "Family insurance" },
          Link: { text: "Family", url: "https://www.axa.be/nl/particulieren/gezin/familiale-verzekering" },
          "Promotion Label": "",
          "Show Promotion": false
        }
      },
      {
        name: "Bicycles",
        fields: {
          Title: "(e-)Bicycles, e-scooters and co",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-icons/new%20bike.svg?rev=1fa578a8e11442bf99b083e23c260d35&savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=99&hash=F66ED246FA2C9252C43D9FDC8F7E2E33", alt: "Bicycle insurance" },
          Link: { text: "(e-)Bicycles, e-scooters and co", url: "https://www.axa.be/nl/particulieren/mobiliteit/fiets" },
          "Promotion Label": "",
          "Show Promotion": false
        }
      },
      {
        name: "Investments",
        fields: {
          Title: "Investments",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-icons/investissement.svg?savif=1&swebp=1&mh=100&la=nl-BE&h=100&mw=255&w=100&hash=9A25484D37027A63EFF7D718E2965DD3", alt: "Investments" },
          Link: { text: "Investments", url: "https://www.axa.be/nl/particulieren/beleggingen/spaar-en-of-beleggingsverzekering" },
          "Promotion Label": "",
          "Show Promotion": false
        }
      },
      {
        name: "All Products",
        fields: {
          Title: "View all our products",
          Link: { text: "View all our products", url: "https://www.axa.be/nl/particulieren#all" },
          "Promotion Label": "",
          "Show Promotion": false
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
