import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

/** Thin rendering — Title/Date from shared News Teaser items. */
export const domSecurityArticleHeaderDefinition = {
  kind: "component",
  definitionKey: "dom-security-article-header",
  name: "dom-security-article-header",
  displayName: "Article Header",
  componentName: "DomSecurityArticleHeader",
  icon: "Office/32x32/document_header.png",
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
    folderTemplate: { name: "Article Header Folder" },
    itemTemplate: {
      name: "Article Header",
      sections: [],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
} satisfies ComponentTemplateDefinition;
