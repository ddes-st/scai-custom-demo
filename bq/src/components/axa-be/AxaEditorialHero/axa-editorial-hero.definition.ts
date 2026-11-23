import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const editorialHeroDefinition = {
  kind: "component",
  definitionKey: "axa-editorial-hero",
  name: "axa-editorial-hero",
  displayName: "Editorial Hero",
  componentName: "AxaEditorialHero",
  icon: "Office/32x32/photo_landscape.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Editorial Heroes"] },
  model: {
    folderTemplate: { name: "Editorial Hero Folder" },
    itemTemplate: {
      name: "Editorial Hero",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Rich Text" },
            { name: "CTA", type: "General Link" },
            { name: "Desktop Image", type: "Image" },
            { name: "Tablet Image", type: "Image" },
            { name: "Mobile Image", type: "Image" },
            { name: "Alignment", type: "Single-Line Text" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Editorial Heroes"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Bullying Guidance Hero",
        displayName: "Wordt je kind gepest? Ontdek hoe AXA kan helpen",
        fields: {
          Heading: "Wordt je kind gepest? Ontdek hoe AXA kan helpen",
          CTA: {
            text: "Meer weten",
            url: "https://www.axa.be/nl/particulieren/gezin/pesten-op-school"
          },
          "Desktop Image": { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-images/Banner_bullying_mobile.jpg?savif=1&swebp=1&ch=400&cx=0.26&la=nl-BE&cy=0.41&cw=2880&hash=2251E4064A9E7A7ED0BACF5F6C3798C2", alt: "" },
          "Tablet Image": {
            url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-images/Banner_bullying_mobile.jpg?savif=1&swebp=1&ch=400&cx=0.26&la=nl-BE&cy=0.41&cw=768&hash=43F06EFF40066B8935AA246A687BE3EB",
            alt: ""
          },
          "Mobile Image": { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-images/Banner_bullying_mobile.jpg?savif=1&swebp=1&ch=400&cx=0.37&la=nl-BE&cy=0.29&cw=2880&hash=A2B3CC35908E4A1E7FED3C8DCAD24BB6", alt: "" },
          Alignment: "right"
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
