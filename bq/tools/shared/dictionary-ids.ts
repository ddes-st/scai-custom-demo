/**
 * Dictionary entry / folder constants from CM-created samples under
 * `authoring/items/bq-demo/sai/sites/content/…/bq-demo/Dictionary` and
 * `…/systemDictionary/Dictionary`.
 */

/** Dictionary Entry template (`Example.yml`, system entry sample) */
export const DICTIONARY_ENTRY_TEMPLATE =
  "6d1cd897-1936-4a3a-a511-289a94c2a7b1";

/** Dictionary Folder template (`Global Dictionary folder.yml`) */
export const DICTIONARY_FOLDER_TEMPLATE =
  "267d9ac7-5d85-4e9d-af89-99ab296cc218";

/** `/sitecore/system/Dictionary` root item (parent of serialized descendants) */
export const SYSTEM_DICTIONARY_ROOT_ID =
  "504ae189-9f36-4c62-9767-66d73d6c3084";

/** `/sitecore/system` root item — parent of Dictionary, Enums, etc. (from CM `Dictionary.yml`) */
export const SYSTEM_SYSTEM_ROOT_ID =
  "13d6d6c6-c50b-4bbd-b331-2b04f1a58f21";

/** `/sitecore/content/…/bq-demo/Dictionary` folder item */
export const SITE_DICTIONARY_ROOT_ID =
  "afb8b073-2f7c-4474-a54a-1c84073db47a";

export const DICTIONARY_FIELD_IDS = {
  /** Shared — lookup key (not translated) */
  Key: "580c75a8-c01a-4580-83cb-987776ceb3af",
  /** Language-level unversioned phrase text */
  Phrase: "2ba3454a-9a9c-4cdf-a9f8-107fd484eb6e",
} as const;
