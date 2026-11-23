import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const utilityNavigationHeaderDefinition = {
  kind: "component",
  definitionKey: "axa-utility-navigation-header",
  name: "axa-utility-navigation-header",
  displayName: "Utility Navigation Header",
  componentName: "AxaUtilityNavigationHeader",
  icon: "Office/32x32/sign_warning_biohazard.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Utility Navigation Headers"] },
  model: {
    folderTemplate: { name: "Utility Navigation Header Folder" },
    itemTemplate: {
      name: "Utility Navigation Header",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Logo", type: "Image" },
            { name: "Search", type: "Single-Line Text" },
            { name: "Sign In", type: "General Link" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [{ key: "header-navigation", allowedControls: ["axa-navigation"] }],
  content: {
    location: { root: "data", folder: ["Utility Navigation Headers"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Particulieren Header",
        displayName: "Ga naar de hoofdinhoud",
        fields: {
          Heading: "Ga naar de hoofdinhoud",
          Logo: { url: "https://cdn.website.axa.be/-/media/shared/logos/axa%20logo%20solid%20rgb.svg?rev=4f6cb760a2cd42329840b9b2bc216240&savif=1&swebp=1&mh=0&la=nl-BE&h=48&mw=0&w=48&hash=AC1288D9BFFA11B7B02724420516B50B", alt: "Axa Verzekeringen, homepagina" },
          Search: "Ik zoek...",
          "Sign In": { text: "Meld je aan", url: "#dialog-user-menu-anonymous-" }
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
