import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityWildcardExperienceDefinition = {
  kind: "component",
  definitionKey: "dom-security-wildcard-experience",
  name: "dom-security-wildcard-experience",
  displayName: "Wildcard Experience",
  componentName: "DomSecurityWildcardExperience",
  icon: "LaunchPadIcons/32x32/contenteditor.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Wildcard Experiences"],
  },
  model: {
    folderTemplate: {
      name: "Wildcard Experience Folder",
      displayName: "Wildcard Experiences",
    },
    itemTemplate: {
      name: "Wildcard Experience",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            {
              name: "Source Root",
              type: "Single-Line Text",
              shared: true,
            },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "wildcard-content",
      allowedControls: [
        "dom-security-product-detail",
        "dom-security-product-accessories",
        "dom-security-product-related-software",
        "dom-security-product-category-header",
        "dom-security-share-bar",
      ],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Wildcard Experiences"],
    },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Product Wildcard",
        displayName: "Product Wildcard",
        fields: {
          "Source Root": "/sitecore/content/domsecurity/domsecurity-com/Data/Products",
        },
      },
      {
        name: "Category Wildcard",
        displayName: "Category Wildcard",
        fields: {
          "Source Root": "/sitecore/content/domsecurity/domsecurity-com/Data/Product Categories",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
