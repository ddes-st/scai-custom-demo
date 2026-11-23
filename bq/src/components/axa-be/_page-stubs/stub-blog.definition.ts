import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /blog */
export const stubBlog = {
  kind: "page-stub",
  definitionKey: "stub-blog",
  name: "Blog",
  routePath: "/blog",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  navigationTitle: "Blog",
  culture: "nl-BE",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
