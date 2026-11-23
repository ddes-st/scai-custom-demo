import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const siteFooterDefinition = {
  kind: "component",
  definitionKey: "dom-security-site-footer",
  name: "dom-security-site-footer",
  displayName: "Site Footer",
  componentName: "DomSecuritySiteFooter",
  icon: "Office/32x32/document_orientation_landscape.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Site Footers"],
  },
  model: {
    folderTemplate: { name: "Site Footer Folder" },
    itemTemplate: {
      name: "Site Footer",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Brand Image", type: "Image" },
            { name: "Brand Link", type: "General Link" },
            { name: "Country Link", type: "General Link" },
            { name: "Scroll To Top Link", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "footer-nav",
      allowedControls: ["dom-security-footer-link-list"],
    },
    {
      key: "footer-legal",
      allowedControls: ["dom-security-footer-link-list"],
    },
    {
      key: "footer-social",
      allowedControls: ["dom-security-footer-social-links"],
    },
  ],
  content: {
    location: { root: "data", folder: ["Site Footers"] },
    culture: "be",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Main Site Footer",
        displayName: "Site Footer",
        fields: {
          "Brand Image": {
            url: "https://dxm.dam.dom-security.com/api/wedia/dam/transform/wbs6nh5j1izunwtdeheskj3jsy/sfpi-group-white-endorsement-logo-dom?t=crop&width=1.000&height=1.000",
            alt: "DOM From Sfpi Group",
          },
          "Brand Link": {
            text: "home",
            url: "https://www.sfpi-group.com/global/fr/industries/sfpi-access",
          },
          "Country Link": {
            text: "BE",
            url: "http://dom-security.com/global/en/choose-your-country",
          },
          "Scroll To Top Link": { text: "scroll to top", url: "#" },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
