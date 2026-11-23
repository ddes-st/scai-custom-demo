import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityShareBarDefinition = {
  kind: "component",
  definitionKey: "dom-security-share-bar",
  name: "dom-security-share-bar",
  displayName: "Share Bar",
  componentName: "DomSecurityShareBar",
  icon: "Office/32x32/document_empty_landscape.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Share Bars"]
  },
  model: {
    folderTemplate: {
      name: "Share Bar Folder"
    },
    itemTemplate: {
      name: "Share Bar",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Label", type: "Single-Line Text" },
            { name: "LinkedIn", type: "General Link" },
            { name: "Twitter", type: "General Link" },
            { name: "Facebook", type: "General Link" },
            { name: "Email", type: "General Link" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: {
      root: "data",
      folder: ["Share Bars"]
    },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Article Share Bar",
        displayName: "Share this",
        fields: {
          Label: "Share this",
          LinkedIn: {
            text: "share to linkedin",
            url: "https://www.linkedin.com/shareArticle?url=https://www.dom-security.com/be/en/newsroom/group-news/new-silca-machine-dom-hoberg&title=DOM HOBERG's New \"Baby\": the Silca Key-cutting Machine&summary=https://www.dom-security.com/be/en/newsroom/group-news/new-silca-machine-dom-hoberg&",
            target: "_blank"
          },
          Twitter: {
            text: "share to twitter",
            url: "http://twitter.com/intent/tweet?url=https://www.dom-security.com/be/en/newsroom/group-news/new-silca-machine-dom-hoberg",
            target: "_blank"
          },
          Facebook: {
            text: "share to facebook",
            url: "https://www.facebook.com/sharer/sharer.php?u=https://www.dom-security.com/be/en/newsroom/group-news/new-silca-machine-dom-hoberg",
            target: "_blank"
          },
          Email: {
            text: "share to mail",
            url: "mailto:?subject=DOM HOBERG's New \"Baby\": the Silca Key-cutting Machine&body=https://www.dom-security.com/be/en/newsroom/group-news/new-silca-machine-dom-hoberg"
          }
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
