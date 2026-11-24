import type { PageDefinition } from "../../../../tools/definitions/types";

/** About us page, matching https://www.dom-security.com/be/en/about-us */
export const aboutUsPage = {
  kind: "page",
  definitionKey: "about-us",
  name: "About us",
  routePath: "/about-us",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "About us",
  culture: "en",
  cultures: ["nl-BE", "fr-BE"],
  renderings: [
    {
      definitionKey: "dom-security-technology-hero",
      placeholder: "headless-main",
      datasourceItem: "About Us Hero",
    },
    {
      definitionKey: "dom-security-about-story",
      placeholder: "headless-main",
      datasourceItem: "About Us Story",
    },
    {
      definitionKey: "dom-security-competence-showcase",
      placeholder: "headless-main",
      datasourceItem: "Dom Belgium Competences",
      children: [
        {
          definitionKey: "dom-security-competence-slide",
          placeholder: "competence-slides",
          datasourceItem: "Tailor-made Advice",
        },
        {
          definitionKey: "dom-security-competence-slide",
          placeholder: "competence-slides",
          datasourceItem: "Local Assembly",
        },
        {
          definitionKey: "dom-security-competence-slide",
          placeholder: "competence-slides",
          datasourceItem: "Dom Xl Masterkey",
        },
        {
          definitionKey: "dom-security-competence-slide",
          placeholder: "competence-slides",
          datasourceItem: "Quick Delivery",
        },
      ],
    },
    {
      definitionKey: "dom-security-centered-copy",
      placeholder: "headless-main",
      datasourceItem: "We Domore For Security",
    },
  ],
} satisfies PageDefinition;
