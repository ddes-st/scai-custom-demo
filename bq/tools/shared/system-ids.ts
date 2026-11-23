/**
 * Sitecore foundation / system GUIDs — ported from
 * `.cursor/sitecore-yaml/generators/sitecore-new-rendering-yaml/references/system-ids.md`
 * and `Generate-SitecoreRendering.mjs`. These are NEVER remapped.
 */

/** Template branch root */
export const TEMPLATE_BRANCH = "0437fee2-44c9-46a6-abe9-28858d9fee8c";

/** Datasource / folder / rendering-params template */
export const TEMPLATE = "ab86861a-6030-46c5-b394-e8f99e8b87db";

/** Data section */
export const DATA_SECTION = "e269fbb5-3750-427a-9149-7aa950b49301";

/** Field definition */
export const FIELD_DEFINITION = "455a3e98-a627-4b40-8035-e683a0331ac7";

/** Json rendering */
export const JSON_RENDERING = "04646a89-996f-4ee7-878a-ffdbf1f0ef0d";

/** Insert options rule */
export const INSERT_OPTIONS_RULE = "3aea335c-d06d-45b1-841a-cbc8d2d1ce40";

/** Project scaffolding / settings folder under `/sitecore/system/Settings/Project/{collection}/` */
export const SCAFFOLDING_PROJECT_SETTINGS =
  "bed31d6f-d968-45a9-b54e-12d7f977d861";

/** Standard template */
export const BASE_STANDARD_TEMPLATE = "{1930BBEB-7805-471A-A3BE-4858AC7CF696}";

/** Page content / headless base */
export const BASE_PAGE_CONTENT = "{44A022DB-56D3-419A-B43B-E27E4D8E9C41}";

/** Rendering parameters (SXA) */
export const BASE_RENDERING_PARAMS_SXA = "{4247AAD4-EBDE-4994-998F-E067A51B1FE4}";

/** Rendering parameters (styling) */
export const BASE_RENDERING_PARAMS_STYLING =
  "{5C74E985-E055-43FF-B28C-DB6C6A6450A2}";

/** Rendering parameters (common) */
export const BASE_RENDERING_PARAMS_COMMON =
  "{3DB3EB10-F8D0-4CC9-BE26-18CE7B139EC8}";

/** Headless data-bucket insert-options Location */
export const INSERT_OPTIONS_LOCATION = "{BA2F959D-A614-4C92-8B57-F1FC1A323ABE}";

/** Shared field definition IDs */
export const FIELD_IDS = {
  Type: "ab162cc0-dc80-4abf-8871-998ee5d7ba32",
  Sortorder: "ba3f86a2-4a1c-4d78-b63d-91c2779c1b5e",
  Title: "19a69332-a23e-4e70-8d16-b2640cb24cc8",
  Icon: "06d5295c-ed2f-4a54-9bf2-26228d113318",
  BaseTemplate: "12c33f3f-86c5-43a5-aeb4-5598cec45116",
  StandardValues: "f7d48a55-2158-4f02-9356-756654404f73",
  Masters: "1172f251-dad4-4efb-a329-0c63500e4f1e",
  Created: "25bed78c-4957-4165-998a-ca1b52f67497",
  CreatedBy: "5dd74568-4d4b-44c1-b513-0af5f4cda34f",
  Owner: "52807595-0f8f-4b20-8d2a-cb71d28c6103",
  Updated: "d9cf14b1-fa16-4ba6-9288-e8a174d4d522",
  UpdatedBy: "badd9cf9-53e0-4d0c-bcc0-2d784c282f6a",
  Revision: "8cdc337e-a112-42fb-bbb4-4143751e123f",
  /** Shared-field revision token (preserve on CM-pulled items). */
  SharedRevision: "dbbbeca1-21c7-4906-9dd2-493c1efa59a2",
  /** Final layout / presentation details (__Renderings). */
  Renderings: "f1a1fe9e-a60c-4ddb-a3a0-bb5b29fe732e",
  ComponentName: "037fe404-dd19-4bf7-8e30-4dadf68b27b0",
  DatasourceTemplate: "1a7c85e5-dc0b-490d-9187-bb1dbcb4c72f",
  ParametersTemplate: "a77e8568-1ab3-44f1-a664-b7c37ec7810d",
  DatasourceLocation: "b5b27af1-25ef-405c-87ce-369b3a004016",
  OpenPropertiesAfterAdd: "7d8ae35f-9ed1-43b5-96a2-0a5f040d4e4e",
  RenderingCssClass: "34e81e40-1d4d-45b0-bcf1-a0ffe5521685",
  OtherProperties: "e829c217-5e94-4306-9c48-2634b094fdc2",
  /**
   * JsonRendering Layout Service Placeholders TreeList (placeholder setting item IDs).
   * Authoring GraphQL raw value is `|`-separated braced GUIDs.
   * Sitecore platform field — do not load from authoring/items/items.
   */
  Placeholders: "069a8361-b1cd-437c-8c32-a3be78941446",
  /**
   * Json Rendering "Page Editor Buttons" (core experience buttons multilist).
   * Sitecore platform field — do not load from authoring/items/items.
   */
  PageEditorButtons: "a2f5d9df-8cba-4a1d-99eb-51acb94cb057",
  /**
   * Json Rendering "AddFieldEditorButton" checkbox.
   * Sitecore platform field — do not load from authoring/items/items.
   */
  AddFieldEditorButton: "c39a90ce-0035-41bb-90f6-3c8a6ea87797",
  /**
   * Placeholder Settings item "Placeholder Key".
   * Sitecore platform field — do not load from authoring/items/items.
   */
  PlaceholderKey: "7256bdab-1fd2-49dd-b205-cb4873d2917c",
  /**
   * Placeholder Settings item "Allowed Controls".
   * Sitecore platform field — do not load from authoring/items/items.
   */
  PlaceholderAllowedControls: "e391b526-d0c5-439d-803e-17512eae6222",
  InsertOptionsLocation: "52c91c75-6698-4701-a8a2-242ace59a8d6",
  InsertOptionsName: "7868e6bc-525c-4fce-ab8a-77da3e09b171",
  InsertOptionsTemplate: "e62c28f0-9d3b-46e2-8bec-a5e120542499",
  /** Template field "Source" (datasource / rendering) */
  Source: "1eb76861-db5d-4f02-ad69-bf1728ec4321",
  /**
   * Template field definition "Source" (list field query / root).
   * From CM field samples (e.g. Related avatars Droplink).
   */
  TemplateFieldSource: "1eb8ae32-e190-44a6-968d-ed904c794ebf",
  /** Template field definition "Shared" checkbox */
  TemplateFieldShared: "be351a73-fcb0-4213-93fa-c302d8ab4f51",
  /** Language unversioned display name */
  DisplayName: "b5e02ad9-d56f-4c41-a065-a133db87bdeb",
} as const;

/** `/sitecore/content/.../Presentation/Headless Variants` folder (site item) */
export const HEADLESS_VARIANTS_ROOT_ID = "59094595-5773-4679-9a24-478e01efbd97";

/** Headless Variants component folder template (e.g. `Custom Card` under Headless Variants) */
export const HEADLESS_VARIANTS_FOLDER_TEMPLATE =
  "49c111d0-6867-4798-a724-1f103166e6e9";

/** Headless variant definition item (e.g. `Default`, `Variant2`) */
export const HEADLESS_VARIANT_TEMPLATE = "4d50cdae-c2d9-4de8-b080-8f992bfb1b55";

/**
 * Sitecore Placeholder Settings leaf item template
 * (`/sitecore/layout/Placeholder Settings/...`).
 * Platform ID on every CM — do not load from authoring/items/items.
 */
export const PLACEHOLDER_SETTINGS_TEMPLATE =
  "5c547d4e-7111-4995-95b0-6b561751bf2e";

/** Sitecore Folder template (base for data folder templates) */
export const BASE_FOLDER_TEMPLATE = "a87a00b1-e6db-45ab-8b54-636fec3b5523";

/** `/sitecore/templates/Project/{collection}` root (bq-demo) */
export const PROJECT_TEMPLATES_ROOT_ID =
  "12d6e35e-fc80-4919-a9cb-8de0c88b4d5f";

/** Site `Data` folder item */
export const SITE_DATA_FOLDER_ID = "f50b4dae-45ad-4c21-a5ad-a3532a4960e3";

/** Site `Home` item */
export const SITE_HOME_ID = "5a56808c-eb00-447e-b9c2-a5010297fea7";

/** `/sitecore/media library/Project` (system) */
export const MEDIA_LIBRARY_PROJECT_ROOT_ID =
  "90ae357f-6171-4ea9-808c-5600b678f726";

/** Media folder template */
export const MEDIA_FOLDER_TEMPLATE = "fe5dd826-48c6-436d-b87a-7c4210c7413b";

/**
 * Unversioned image / generic image file template (jpg, png, gif, svg, …).
 * Kept as `MEDIA_FILE_TEMPLATE` for callers that historically meant this ID.
 */
export const MEDIA_FILE_TEMPLATE = "f1828a2c-7e5d-4bbd-98ca-320474871548";

/** Sitecore media templates by asset kind (from Media Library Samples). */
export const MEDIA_TEMPLATES = {
  /** Jpeg / unversioned image (also used for svg in CM samples). */
  Image: MEDIA_FILE_TEMPLATE,
  Webp: "309eb383-99b6-4722-9fab-58d8ae802d72",
  Pdf: "0603f166-35b8-469f-8123-e8d87bedc171",
  Zip: "4f4a3a3b-239f-4988-98e1-da3779749cbc",
  Doc: "16692733-9a61-45e6-b0d4-4c0c06f8dd3c",
  Docx: "7bb0411f-50cd-4c21-ad8f-1fcde7c3affe",
  /** Generic File (e.g. txt). */
  File: "962b53c4-f93b-4df9-9821-415c867b8903",
} as const;

/** Media item field IDs */
export const MEDIA_FIELD_IDS = {
  Width: "22eac599-f13b-4607-a89d-c091763a467d",
  Blob: "40e50ed9-ba07-4702-992e-a912738d32dc",
  Size: "6954b7c7-2487-423f-8600-436cb3b6dc0e",
  MimeType: "6f47a0a5-9c94-4b48-abeb-42d38def6054",
  Extension: "c06867fe-9a43-4c7d-b739-48780492d06f",
  Dimensions: "cb09946f-3218-4823-87d2-d5007c199a96",
  Height: "de2ca9e4-c117-4c8a-a139-1ff4b199d15a",
  Alt: "65885c44-8fcd-4a7f-94f1-ee63703fe193",
  /** Versioned Title (e.g. PDF media items). */
  Title: "3f4b20e9-36e6-4d45-a423-c86567373f82",
} as const;

/** SAI / BQ enumeration list item template */
export const ENUMERATION = "ada51198-89a7-4a34-bed4-9f104bef82a0";

/** SAI / BQ enumeration value item template */
export const ENUMERATION_VALUE = "33b6fd7f-edcf-4088-a665-6c9b13e3eb6a";

/** Fields on enumeration list / value templates */
export const ENUM_FIELD_IDS = {
  ScaiHandle: "29f5bff2-1d66-4f75-b0ae-d5ee0d4a8def",
  Default: "2f6ae042-5af2-4a45-bd42-3679361f0903",
  Value: "d43abd5b-7351-4026-8258-a0f3706fe08d",
} as const;

/**
 * Logical placeholder keys used only to seed deterministic remappable IDs
 * (same roles as PLACEHOLDER_IDS in Generate-SitecoreRendering.mjs).
 */
export const PLACEHOLDER_KEYS = {
  rendering: "rendering",
  branch: "branch",
  datasource: "datasource",
  dataSection: "data-section",
  datasourceStdValues: "datasource-std-values",
  childDatasource: "child-datasource",
  childDatasourceStdValues: "child-datasource-std-values",
  folder: "folder",
  folderStdValues: "folder-std-values",
  parameters: "parameters",
  parametersStdValues: "parameters-std-values",
  parametersDataSection: "parameters-data-section",
  insertOptions: "insert-options",
  headlessVariantsFolder: "headless-variants-folder",
  headlessVariant: "headless-variant",
} as const;
