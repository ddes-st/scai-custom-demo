import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityFooterDefinition = {
  kind: "component",
  definitionKey: "dom-security-footer",
  name: "dom-security-footer",
  displayName: "Footer",
  componentName: "DomSecurityFooter",
  icon: "Office/32x32/document_orientation_landscape.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Dom Security Footers"]
  },
  model: {
    folderTemplate: {
      name: "Footer Folder"
    },
    itemTemplate: {
      name: "Footer",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Brand Endorsement", type: "Image" },
            { name: "Country Selector", type: "General Link" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "footer-content",
      allowedControls: ["dom-security-footer-link-group", "dom-security-footer-link-list"]
    },
    {
      key: "footer-legal",
      allowedControls: ["dom-security-footer-link-list"]
    },
    {
      key: "footer-social",
      allowedControls: ["dom-security-footer-social-links"]
    }
  ],
  content: {
    location: {
      root: "data",
      folder: ["Dom Security Footers"]
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Dom Security Footer",
        displayName: "Footer",
        fields: {
          "Brand Endorsement": { url: "https://dxm.dam.dom-security.com/api/wedia/dam/transform/wbs6nh5j1izunwtdeheskj3jsy/sfpi-group-white-endorsement-logo-dom?t=crop&width=1.000&height=1.000", alt: "DOM From Sfpi Group" },
          "Country Selector": { text: "BE", url: "http://dom-security.com/global/en/choose-your-country" }
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
