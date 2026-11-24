import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const centeredCopyDefinition = {
  kind: "component",
  definitionKey: "dom-security-centered-copy",
  name: "dom-security-centered-copy",
  displayName: "Centered Copy",
  componentName: "DomSecurityCenteredCopy",
  icon: "Office/32x32/about.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Centered Copy"] },
  model: {
    folderTemplate: { name: "Centered Copy Folder" },
    itemTemplate: {
      name: "Centered Copy",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Body", type: "Rich Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Centered Copy"] },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "We Domore For Security",
        displayName: "We DOMore for security",
        fields: {
          Title: "We DOMore for security",
          Body: "<p>We believe that everyone and everything of value deserves to be kept secure, without compromise. That's why we develop the highest quality security and access solutions. To enable us to provide these solutions we focus on three essential areas of expertise: hardware, software and mechatronics. We are also commitment to constant innovation of our technologies, to keep ourselves and our customers ahead of the competition. Always.</p>",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
