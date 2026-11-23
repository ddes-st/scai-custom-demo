import type { PageStubDefinition } from "../../../../tools/definitions/types";

/** Stub page for same-site link /en/newsroom/local-news/be---guard-s → /newsroom/local-news/be-guards */
export const stubNewsroomLocalNewsBeGuards = {
  kind: "page-stub",
  definitionKey: "stub-newsroom-local-news-be-guards",
  name: "Read article",
  routePath: "/newsroom/local-news/be-guards",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Read article",
  culture: "be",
  cultures: ["nl-BE","fr-BE"],
} satisfies PageStubDefinition;
