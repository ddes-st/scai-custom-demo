import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const contactInformationSectionDefinition = {
  kind: "component",
  definitionKey: "dom-security-contact-information-section",
  name: "dom-security-contact-information-section",
  displayName: "Contact Information Section",
  componentName: "DomSecurityContactInformationSection",
  icon: "Office/32x32/information.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Contact Information Sections"],
  },
  model: {
    folderTemplate: { name: "Contact Information Section Folder" },
    itemTemplate: {
      name: "Contact Information Section",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Section Title", type: "Single-Line Text" },
            { name: "Organization", type: "Single-Line Text" },
            { name: "Contact Heading", type: "Single-Line Text" },
            { name: "Phone", type: "General Link" },
            { name: "Email", type: "General Link" },
            { name: "Address Heading", type: "Single-Line Text" },
            { name: "Address", type: "Rich Text" },
            { name: "Directions Link", type: "General Link" },
            { name: "Call Me Back", type: "General Link" },
            { name: "Fill Out The Form", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Contact Information Sections"] },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Dom Hoberg Contact Information",
        displayName: "link",
        renderingIdentifier: "Contact",
        fields: {
          "Section Title": "DOM HOBERG",
          Organization: "HOBERG S.A.",
          "Contact Heading": "Contact Information",
          Phone: { text: "+ 32 (0) 10 23 22 20", url: "tel:+ 32 (0) 10 23 22 20" },
          Email: { text: "dom@hoberg.be", url: "mailto:dom@hoberg.be" },
          "Address Heading": "Address",
          Address: "Avenue Edison 27\nB-1300 Wavre\nBelgium",
          "Directions Link": { text: "How do I get here?", url: "http://maps.google.com/?q=Avenue+Edison+27+B-1300+Wavre+Belgium" },
          "Call Me Back": {
            text: "Call me back",
            url: "https://www.dom-security.com/be/en#",
          },
          "Fill Out The Form": {
            text: "Fill out the form",
            url: "https://www.dom-security.com/be/en#",
          }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
