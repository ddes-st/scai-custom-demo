/**
 * Edge defaults `children` to first:10 and caps query complexity (~250).
 * Paginate children with small pages instead of raising `first`.
 */
export const CHILDREN_PAGE_SIZE = 10;

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
  jsonValue?: unknown;
}

/** Named field alias returned on child items (avoids Edge complexity limits). */
export interface WildcardNamedField {
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
  children?: {
    results?: Array<WildcardChildRaw>;
    pageInfo?: {
      endCursor?: string;
      hasNext?: boolean;
    };
  };
}

export interface WildcardChildRaw {
  id?: string;
  name?: string;
  displayName?: string;
  url?: { path?: string } | string;
  fields?: WildcardFieldJson[];
  label?: WildcardNamedField;
  group?: WildcardNamedField;
  image?: WildcardNamedField;
  imageUrl?: WildcardNamedField;
  href?: WildcardNamedField;
  isDefault?: WildcardNamedField;
  title?: WildcardNamedField;
  tagline?: WildcardNamedField;
  category1?: WildcardNamedField;
}

/** `data` shape of the {@link WILDCARD_ITEM_QUERY} response. */
export interface WildcardItemResponse {
  item?: WildcardItemRaw | null;
}

/**
 * Paginated children page. Pass `after` from the previous pageInfo.endCursor.
 */
export const WILDCARD_CHILDREN_QUERY = /* GraphQL */ `
  query WildcardChildren($path: String!, $language: String!, $after: String) {
    item(path: $path, language: $language) {
      children(first: ${CHILDREN_PAGE_SIZE}, after: $after) {
        pageInfo {
          endCursor
          hasNext
        }
        results {
          id
          name
          displayName
          fields(ownFields: true) {
            name
            jsonValue
          }
        }
      }
    }
  }
`;
