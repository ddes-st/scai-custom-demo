import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const navigationDefinition = {
  kind: "component",
  definitionKey: "axa-navigation",
  name: "axa-navigation",
  displayName: "Navigation",
  componentName: "AxaNavigation",
  icon: "Office/32x32/sign_warning_biohazard.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Navigations"] },
  model: {
    folderTemplate: { name: "Navigation Folder" },
    itemTemplate: {
      name: "Navigation",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Logo", type: "Image" },
            { name: "Logo Link", type: "General Link" },
            { name: "Segment Retail", type: "General Link" },
            { name: "Segment Business", type: "General Link" },
            { name: "Segment Enterprise", type: "General Link" },
            { name: "Segment Public", type: "General Link" },
            { name: "Urgent Assistance", type: "General Link" },
            { name: "Help And Contact", type: "General Link" },
            { name: "Language", type: "General Link" },
            { name: "Insurances", type: "Single-Line Text" },
            { name: "Claims", type: "Single-Line Text" },
            { name: "Search", type: "Single-Line Text" },
            { name: "Sign In", type: "General Link" },
            { name: "Mobility", type: "Single-Line Text" },
            { name: "Property", type: "Single-Line Text" },
            { name: "Family", type: "Single-Line Text" },
            { name: "Health", type: "Single-Line Text" },
            { name: "Pension", type: "Single-Line Text" },
            { name: "Investments", type: "Single-Line Text" },
            { name: "All Insurances", type: "General Link" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Navigations"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Main Navigation",
        displayName: "Navigation",
        fields: {
          Logo: { url: "https://cdn.website.axa.be/-/media/shared/logos/axa%20logo%20solid%20rgb.svg?rev=4f6cb760a2cd42329840b9b2bc216240&savif=1&swebp=1&mh=0&la=nl-BE&h=48&mw=0&w=48&hash=AC1288D9BFFA11B7B02724420516B50B", alt: "Axa Verzekeringen, homepagina" },
          "Logo Link": { text: "Axa Verzekeringen, homepagina", url: "/" },
          "Segment Retail": { text: "Particulieren", url: "/nl/particulieren" },
          "Segment Business": { text: "Ondernemers & kmo's", url: "/nl/ondernemers-kmo" },
          "Segment Enterprise": { text: "Grote ondernemingen", url: "/nl/grote-ondernemingen" },
          "Segment Public": { text: "Publieke sector", url: "/nl/publieke-sector" },
          "Urgent Assistance": { text: "Dringende bijstand", url: "/nl/particulieren/services/bijstand/bijstand-auto" },
          "Help And Contact": { text: "Help en contact", url: "/nl/particulieren/help-en-contact" },
          Language: { text: "Français", url: "/fr/particuliers" },
          Insurances: "Verzekeringen",
          Claims: "Schadegevallen",
          Search: "Ik zoek...",
          "Sign In": { text: "Meld je aan", url: "#dialog-user-menu-anonymous-" },
          Mobility: "Mobiliteit",
          Property: "Woning",
          Family: "Gezin",
          Health: "Gezondheid",
          Pension: "Pensioen",
          Investments: "Beleggingen",
          "All Insurances": { text: "Al onze verzekeringen", url: "/nl/particulieren/verzekeringen" }
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
