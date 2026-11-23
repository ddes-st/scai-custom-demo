import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const headerNavigationDefinition = {
  kind: "component",
  definitionKey: "axa-header-navigation",
  name: "axa-header-navigation",
  displayName: "Header Navigation",
  componentName: "AxaHeaderNavigation",
  icon: "Office/32x32/sign_warning_voltage.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Header Navigations"] },
  model: {
    folderTemplate: { name: "Header Navigation Folder" },
    itemTemplate: {
      name: "Header Navigation",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Logo Image", type: "Image" },
            { name: "Logo Link", type: "General Link" },
            { name: "Audience Segments", type: "Rich Text" },
            { name: "Utility Links", type: "Rich Text" },
            { name: "Primary Navigation", type: "Rich Text" },
            { name: "Category Navigation", type: "Rich Text" },
            { name: "Search", type: "Single-Line Text" },
            { name: "Search Results Link", type: "General Link" },
            { name: "Login Link", type: "General Link" },
            { name: "Menu Panels", type: "Rich Text" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Header Navigations"] },
    items: [
      {
        name: "AXA Belgium Header Navigation",
        fields: {
          "Logo Image": {
            url: "https://cdn.website.axa.be/-/media/shared/logos/axa%20logo%20solid%20rgb.svg?rev=4f6cb760a2cd42329840b9b2bc216240&savif=1&swebp=1&mh=0&la=nl-BE&h=48&mw=0&w=48&hash=AC1288D9BFFA11B7B02724420516B50B",
            alt: "Axa Verzekeringen, homepagina"
          },
          "Logo Link": { text: "https://www.axa.be/nl/Home", url: "https://www.axa.be/" },
          "Audience Segments": "<ul><li><a href=\"https://www.axa.be/nl/particulieren\">https://www.axa.be/nl/Particulieren</a></li><li><a href=\"https://www.axa.be/nl/ondernemers-kmo\">Ondernemers &amp; kmo's</a></li><li><a href=\"https://www.axa.be/nl/grote-ondernemingen\">Grote ondernemingen</a></li><li><a href=\"https://www.axa.be/nl/publieke-sector\">Publieke sector</a></li></ul>",
          "Utility Links": "<ul><li><a href=\"https://www.axa.be/nl/particulieren/services/bijstand/bijstand-auto\">Dringende bijstand</a></li><li><a href=\"https://www.axa.be/nl/particulieren/contact\">Hulp en contact</a></li><li><a href=\"https://www.axa.be/fr/particuliers\">https://www.axa.be/nl/Fran%C3%A7ais</a></li></ul>",
          "Primary Navigation": "<ul><li><a href=\"https://www.axa.be/nl/Verzekeringen\">https://www.axa.be/nl/Verzekeringen</a></li><li><a href=\"https://www.axa.be/nl/Schadegevallen\">https://www.axa.be/nl/Schadegevallen</a></li></ul>",
          "Category Navigation": "<ul><li><a href=\"https://www.axa.be/nl/Mobiliteit\">https://www.axa.be/nl/MobiliteitâŒ„</a></li><li><a href=\"https://www.axa.be/nl/Woning\">https://www.axa.be/nl/WoningâŒ„</a></li><li><a href=\"https://www.axa.be/nl/Gezin\">https://www.axa.be/nl/GezinâŒ„</a></li><li><a href=\"https://www.axa.be/nl/Gezondheid\">https://www.axa.be/nl/GezondheidâŒ„</a></li><li><a href=\"https://www.axa.be/nl/Pensioen\">https://www.axa.be/nl/PensioenâŒ„</a></li><li><a href=\"https://www.axa.be/nl/Beleggingen\">https://www.axa.be/nl/BeleggingenâŒ„</a></li></ul>",
          Search: "Ik zoek...",
          "Search Results Link": { text: "https://www.axa.be/nl/Zoekresultaten", url: "https://www.axa.be/nl/zoekresultaten" },
          "Login Link": { text: "Meld je aan", url: "https://www.axa.be/nl/particulieren" },
          "Menu Panels": "<section><h2>https://www.axa.be/nl/Mobiliteit</h2><ul><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/auto\">https://www.axa.be/nl/Auto</a></li><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/motor\">https://www.axa.be/nl/Motor</a></li><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/fiets\">(e)Fiets, e-Step &amp; Co</a></li><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/bestelwagen\">https://www.axa.be/nl/Bestelwagen</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/reisverzekering\">https://www.axa.be/nl/Reis</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/students-travel\">Students Travel</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/bootverzekering\">https://www.axa.be/nl/Boot</a></li></ul></section>"
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
