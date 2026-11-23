import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const assistanceSplitPanelDefinition = {
  kind: "component",
  definitionKey: "axa-assistance-split-panel",
  name: "axa-assistance-split-panel",
  displayName: "Assistance Split Panel",
  componentName: "AxaAssistanceSplitPanel",
  icon: "Office/32x32/window_split_hor.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Assistance Split Panels"] },
  model: {
    folderTemplate: { name: "Assistance Split Panel Folder" },
    itemTemplate: {
      name: "Assistance Split Panel",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Description", type: "Rich Text" },
            { name: "Image", type: "Image" },
            { name: "CTA", type: "General Link" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Assistance Split Panels"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Urgent Assistance",
        displayName: "Dringende bijstand",
        fields: {
          Title: "Dringende bijstand",
          Description: "Heb je dringende hulp nodig voor je voertuig, je woning of je reis? We staan aan jouw zijde.",
          Image: { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/assistance%20homepage%20illu.svg?savif=1&swebp=1&mh=0&la=nl-BE&h=190&mw=570&w=330&hash=3D023724B30712A7A75E609EF35B4EB4", alt: "" },
          CTA: { text: "Ontdek je bijstand", url: "https://www.axa.be/nl/particulieren/services/bijstand/bijstand-auto" }
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
