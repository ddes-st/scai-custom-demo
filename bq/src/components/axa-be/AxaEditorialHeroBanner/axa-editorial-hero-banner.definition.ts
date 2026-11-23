import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const editorialHeroBannerDefinition = {
  kind: "component",
  definitionKey: "axa-editorial-hero-banner",
  name: "axa-editorial-hero-banner",
  displayName: "Editorial Hero Banner",
  componentName: "AxaEditorialHeroBanner",
  icon: "Office/32x32/photo_landscape.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Editorial Hero Banners"],
  },
  model: {
    folderTemplate: {
      name: "Editorial Hero Banner Folder",
      displayName: "Editorial Hero Banner",
    },
    itemTemplate: {
      name: "Editorial Hero Banner",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Desktop Image", type: "Image" },
            { name: "Mobile Image", type: "Image" },
            { name: "CTA", type: "General Link" },
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
      folder: ["Editorial Hero Banners"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Editorial Hero",
        displayName: "Wordt je kind gepest? Ontdek hoe AXA kan helpen",
        fields: {
          Heading: "Wordt je kind gepest? Ontdek hoe AXA kan helpen",
          "Desktop Image": { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-images/Banner_bullying_mobile.jpg?savif=1&swebp=1&ch=400&cx=0.26&la=nl-BE&cy=0.41&cw=2880&hash=2251E4064A9E7A7ED0BACF5F6C3798C2",
            alt: "" },
          "Mobile Image": { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-images/Banner_bullying_mobile.jpg?savif=1&swebp=1&ch=400&cx=0.37&la=nl-BE&cy=0.29&cw=2880&hash=A2B3CC35908E4A1E7FED3C8DCAD24BB6", alt: "" },
          CTA: { text: "Meer weten", url: "https://www.axa.be/nl/particulieren/gezin/pesten-op-school" }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
