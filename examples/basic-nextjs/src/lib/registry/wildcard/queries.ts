export const WILDCARD_ITEM_QUERY = /* GraphQL */ `
  query WildcardItem($path: String!, $language: String!) {
    item(path: $path, language: $language) {
      id
      name
      displayName
      template {
        name
      }
      url {
        path
      }
      fields(ownFields: true) {
        name
        jsonValue
      }
    }
  }
`;

/** One `{ name, jsonValue }` entry from the Edge `fields` selection. */
export interface WildcardFieldJson {
  name?: string;
  /**
   * Layout-service-shaped value. Text/rich-text: `{ value: string }`.
   * Image: `{ value: { src, alt } }`. Link: `{ value: { href, text } }`.
   * Reference fields: an item object or array of item objects — see
   * `normalizeReferenceField` in ./normalize.ts.
   */
  jsonValue?: unknown;
}

/** Raw item shape Edge returns for {@link WILDCARD_ITEM_QUERY}. */
export interface WildcardItemRaw {
  id?: string;
  name?: string;
  displayName?: string;
  template?: { name?: string };
  url?: { path?: string };
  fields?: WildcardFieldJson[];
}

/** `data` shape of the {@link WILDCARD_ITEM_QUERY} response. */
export interface WildcardItemResponse {
  item?: WildcardItemRaw | null;
}
