import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

/** Thin rendering — article body fields from shared News Teaser items. */
export const domSecurityEditorialArticleBodyDefinition = {
  kind: "component",
  definitionKey: "dom-security-editorial-article-body",
  name: "dom-security-editorial-article-body",
  displayName: "Editorial Article Body",
  componentName: "DomSecurityEditorialArticleBody",
  icon: "Office/32x32/document_empty_landscape.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["News Teasers"],
  },
  datasourceTemplate:
    "/sitecore/templates/Project/domsecurity/DomSecurityNewsTeaser/News Teaser",
  model: {
    folderTemplate: { name: "Editorial Article Body Folder" },
    itemTemplate: {
      name: "Editorial Article Body",
      sections: [],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
} satisfies ComponentTemplateDefinition;
