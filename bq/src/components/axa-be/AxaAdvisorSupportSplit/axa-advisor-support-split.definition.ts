import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const advisorSupportSplitDefinition = {
  kind: "component",
  definitionKey: "axa-advisor-support-split",
  name: "axa-advisor-support-split",
  displayName: "Advisor Support Split",
  componentName: "AxaAdvisorSupportSplit",
  icon: "Office/32x32/stockbroker.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Advisor Support Splits"] },
  model: {
    folderTemplate: { name: "Advisor Support Split Folder" },
    itemTemplate: {
      name: "Advisor Support Split",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "CTA", type: "General Link" },
            { name: "Partner Logo", type: "Image" },
            { name: "Desktop Image", type: "Image" },
            { name: "Mobile Image", type: "Image" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [
    { key: "advisor-benefits", allowedControls: ["axa-advisor-benefit"] }
  ],
  content: {
    location: { root: "data", folder: ["Advisor Support Splits"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Advisor Support Split",
        displayName: "Je makelaar staat altijd aan je zijde",
        fields: {
          Heading: "Je makelaar staat altijd aan je zijde",
          CTA: { text: "Vind je makelaar", url: "https://www.axa.be/nl/netwerk/vind-je-makelaar" },
          "Partner Logo": { url: "https://cdn.website.axa.be/nl-be/-/media/projects/axabe/axabeweb/brocom/Broker%20Brocom.svg?sc_lang=nl-BE&savif=1&swebp=1&w=314&rev=1d9aa2af00da43339490898cb8c56e19&hash=F0614CF71B9C308C2F7DCD37E3A4F63C", alt: "Je Makelaar Je beste Verzekering" },
          "Desktop Image": { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/photos/broker%20woman.jpg?savif=1&swebp=1&ch=964&cx=0.5&la=nl-BE&cy=0.5&cw=1264&hash=991840CE9305BBC08641A6DF90216ED4", alt: "" },
          "Mobile Image": { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/photos/broker%20woman%20mobile.jpg?savif=1&swebp=1&ch=468&cx=0.5&la=nl-BE&cy=0.5&cw=718&hash=8A610BC4397A1E65D8AC29549237EFDF", alt: "" }
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
