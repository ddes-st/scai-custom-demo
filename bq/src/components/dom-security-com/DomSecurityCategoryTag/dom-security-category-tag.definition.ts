import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityCategoryTagDefinition = {
  kind: "component",
  definitionKey: "dom-security-category-tag",
  name: "dom-security-category-tag",
  displayName: "Category Tag",
  componentName: "DomSecurityCategoryTag",
  icon: "Office/32x32/tag.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Category Tags"],
  },
  model: {
    folderTemplate: {
      name: "Category Tag Folder",
    },
    itemTemplate: {
      name: "Category Tag",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [{ name: "Label", type: "Single-Line Text" }],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: {
      root: "data",
      folder: ["Category Tags"],
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Group News",
        displayName: "Group News",
        fields: {
          Label: "Group News"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
