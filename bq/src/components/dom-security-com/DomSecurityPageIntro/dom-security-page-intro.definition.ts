import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityPageIntroDefinition = {
  kind: "component",
  definitionKey: "dom-security-page-intro",
  name: "dom-security-page-intro",
  displayName: "Page Intro",
  componentName: "DomSecurityPageIntro",
  icon: "Office/32x32/document_empty_landscape.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Page Intros"],
  },
  model: {
    folderTemplate: {
      name: "Page Intro Folder",
    },
    itemTemplate: {
      name: "Page Intro",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Subtitle", type: "Single-Line Text" },
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
      folder: ["Page Intros"],
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Newsroom Page Intro",
        displayName: "Newsroom",
        fields: {
          Title: "Newsroom",
          Subtitle: "Be the first to know"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
