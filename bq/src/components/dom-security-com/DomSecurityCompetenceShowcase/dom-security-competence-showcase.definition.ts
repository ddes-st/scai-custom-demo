import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const competenceShowcaseDefinition = {
  kind: "component",
  definitionKey: "dom-security-competence-showcase",
  name: "dom-security-competence-showcase",
  displayName: "Competence Showcase",
  componentName: "DomSecurityCompetenceShowcase",
  icon: "Apps/32x32/Carousel.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Competence Showcases"] },
  model: {
    folderTemplate: { name: "Competence Showcase Folder" },
    itemTemplate: {
      name: "Competence Showcase",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [{ name: "Title", type: "Single-Line Text" }],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "competence-slides",
      allowedControls: ["dom-security-competence-slide"],
    },
  ],
  content: {
    location: { root: "data", folder: ["Competence Showcases"] },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Dom Belgium Competences",
        displayName: "DOM Belgium competences",
        fields: { Title: "DOM Belgium competences" },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
