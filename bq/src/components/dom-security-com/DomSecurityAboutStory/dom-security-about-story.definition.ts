import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

const BODY = `
<p><strong>DOM HOBERG</strong> has stood for quality, innovation and reliable security products for more than 50 years. Whether you need mechanical locking systems or smart digital access control, we offer <strong>solutions</strong> for homes, businesses and complex buildings that meet the highest standards of security and reliability.</p>
<p>We are part of <strong>DOM Security</strong>, founded by Henri Morel in Paris. DOM Security is represented throughout Europe, with more than 20 sales and service offices and more than 10 production sites.</p>
<p><strong>Together, we are building a safer future.</strong></p>
`.trim();

export const aboutStoryDefinition = {
  kind: "component",
  definitionKey: "dom-security-about-story",
  name: "dom-security-about-story",
  displayName: "About Story",
  componentName: "DomSecurityAboutStory",
  icon: "Office/32x32/about.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["About Stories"] },
  model: {
    folderTemplate: { name: "About Story Folder" },
    itemTemplate: {
      name: "About Story",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Body", type: "Rich Text" },
            { name: "Video Id", type: "Single-Line Text" },
            { name: "Video Title", type: "Single-Line Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["About Stories"] },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "About Us Story",
        displayName: "About us",
        fields: {
          Title: "About us",
          Body: BODY,
          "Video Id": "Xc8pqZAvKxo",
          "Video Title": "DOM corporate film",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
