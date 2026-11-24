import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

const CDN = "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/image/About-us";

export const competenceSlideDefinition = {
  kind: "component",
  definitionKey: "dom-security-competence-slide",
  name: "dom-security-competence-slide",
  displayName: "Competence Slide",
  componentName: "DomSecurityCompetenceSlide",
  icon: "Apps/32x32/Carousel.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Competence Slides"] },
  model: {
    folderTemplate: { name: "Competence Slide Folder" },
    itemTemplate: {
      name: "Competence Slide",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Text", type: "Rich Text" },
            { name: "Image", type: "Image" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Competence Slides"] },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Tailor-made Advice",
        displayName: "Tailor-made advice",
        fields: {
          Title: "Tailor-made advice",
          Text: "<p>We understand that no two companies are the same. Hence, we strive to work on unique solutions catered to each of our clients. Our experienced team members will advise you on the solutions based on your needs.</p>",
          Image: { url: `${CDN}/HOBERG-About-Us-2.jpg?modified=20211231080705&extension=webp`, alt: "DOM Hoberg team" },
        },
      },
      {
        name: "Local Assembly",
        displayName: "Local assembly",
        fields: {
          Title: "Local assembly",
          Text: "<p>We assemble our products locally in Wavre. At our production site, our employees work with innovative machines to produce innovative products. With a clearly defined production cycle, we can offer you fast and well-maintained service.</p>",
          Image: { url: `${CDN}/DOM-HOBERG-Montage.jpg?modified=20240524085452&extension=webp`, alt: "Local assembly in Wavre" },
        },
      },
      {
        name: "Dom Xl Masterkey",
        displayName: "DOM XL masterkey plan software",
        fields: {
          Title: "DOM XL masterkey plan software",
          Text: "<p>DOM partners can use DOM XL, our own masterkey software, when issuing an order. This software has been developed in-house to provide our customers with optimal support. It forms the basis of a masterkey plan and provides insight into cost efficiency. The program is customer-oriented — easy to use and easy to convert into an order.</p>",
          Image: { url: `${CDN}/HOBERG-About-Us-4.jpg?modified=20240524085411&extension=webp`, alt: "Masterkey planning" },
        },
      },
      {
        name: "Quick Delivery",
        displayName: "Quick delivery",
        fields: {
          Title: "Quick delivery",
          Text: "<p>For single orders and masterkey plans, we ensure a smooth and prompt delivery to your doorstep.</p>",
          Image: { url: `${CDN}/HOBERG-About-Us-5.jpg?modified=20240524085445&extension=webp`, alt: "Quick delivery" },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
