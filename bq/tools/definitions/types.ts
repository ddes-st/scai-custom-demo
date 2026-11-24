/**

 * Definition contracts for BQ component authoring generation.

 * Emission rules are coded in tools/definitions (ported from .cursor/sitecore-yaml).

 * Local replacements for external definition packages — do not import @sitecoreai-labs/*.

 */



import type {
  DataFieldConstraints,
  DataFieldValidators,
  FieldValidatorRuleShorthand,
  FieldValidatorRuleSpec,
  FieldValidatorVersionDef,
} from "../shared/field-validators";
import type { DefinitionKeyRef } from "../shared/definition-ref";
import type {
  SitecoreGuidRef,
  SitecoreItemRef,
  SitecorePathRef,
} from "../shared/definition-ref";
import type { DefinitionKeyed } from "../shared/sai-handle";
import type { StandardItemFields } from "../shared/standard-fields";

export type { DefinitionKeyed } from "../shared/sai-handle";
export type {
  DefinitionKeyRef,
  SitecorePathRef,
  SitecoreGuidRef,
  FieldRuleRef,
  SitecoreItemRef,
} from "../shared/definition-ref";
export {
  isDefinitionKeyRef,
  isSitecorePathRef,
  isSitecoreGuidRef,
  isFieldRuleRef,
  definitionKeyFromRef,
  sitecorePathFromRef,
  sitecoreGuidFromRef,
  fieldRuleFromRef,
  isParametersModelDef,
  isInlineVariantsList,
} from "../shared/definition-ref";
export {
  saiHandleFrom,
  toSaiHandle,
  primarySaiHandle,
  minVersionNumber,
} from "../shared/sai-handle";

export type {
  DataFieldConstraints,
  DataFieldValidators,
  FieldValidatorRuleShorthand,
  FieldValidatorRuleSpec,
  FieldValidatorVersionDef,
} from "../shared/field-validators";
export type { DataFieldValidatorRef } from "../shared/field-validators";
export type { StandardItemFields, StandardFieldKey } from "../shared/standard-fields";



export type FieldShape = "link" | "text" | "richtext" | "image" | "checkbox" | "enum";



export type DefinitionField = {

  name: string;

  shape: FieldShape;

  default?: string;

  /** Template section name (default: Data) */

  section?: string;

  sitecore?: {

    type?: string;

    required?: boolean;

    hint?: string;

    sortOrder?: number;

    /** Cross-ref to a `kind: "enumeration"` definition or Sitecore item. */
    enumeration?: SitecoreItemRef;

    title?: string;

  };

};



export type DefinitionDatasourceLocation = {
  scope: "page" | "site";
  subfolder: string;
};

/**
 * Shared data template model (folder + item templates with sections/fields).
 * Used by `kind: "data"` and component datasource `model`.
 *
 * When `childItemTemplate` is set, nested content children use that template
 * (parent item keeps `itemTemplate` fields only — e.g. locator UI labels on
 * the parent, dealer rows on a Dealer child template).
 */
export type DataModelDef = {
  folderTemplate: DataFolderTemplateDef;
  itemTemplate: DataItemTemplateDef;
  /** Optional template for nested children under seeded parent items. */
  childItemTemplate?: DataItemTemplateDef;
};

/**
 * Rendering parameters template model (sections + fields).
 * Same field language as data item templates. Used by `kind: "parameters"`
 * and inline `parameters` on component definitions.
 *
 * Prefer `shared: true` on each field in the definition (rendering params
 * are almost always shared). The emitter does not invent a default.
 */
export type ParametersModelDef = {
  sections: DataSectionDef[];
};

/** Rendering / authoring options for a component datasource (sibling of `model`). */
export type ComponentDatasourceConfig = {
  autoCreate?: boolean;
  openPropertiesAfterAdd?: boolean;
  locations?: DefinitionDatasourceLocation[];
};

/** Datasource picker location for `kind: "rendering"` / component façade (v1: site scope only). */
export type RenderingDatasourceLocation = {
  scope: "site";
  root: DataPlacementRoot;
  folder?: string[];
};

/** Placeholder settings declared on a component/rendering definition. */
export type RenderingPlaceholderDef = {
  /**
   * Base placeholder key only (e.g. `trust-metrics`) — do not include `-{*}`.
   * Emit suffixes the Placeholder Settings "Placeholder Key" field to
   * `base-{*}`. TSX AppPlaceholder names use this base and append
   * `DynamicPlaceholderId` at runtime.
   */
  key: string;
  /** definitionKeys of renderings allowed in this placeholder. */
  allowedControls?: string[];
};

/**
 * UI component package — façade over rendering + optional params/content.
 *
 * Emit calls `applyRenderingDefinition` (same YAML as `kind: "rendering"`).
 * Prefer one file with inline `parameters` / `model` / `content`. When a piece is
 * shared, extract a standalone `parameters` or `data` definition and reference
 * it with `{ definitionKey: "…" }` on `parameters` / `variants`; do not duplicate emit logic.
 */
export type ComponentTemplateDefinition = DefinitionKeyed & {
  kind: "component";
  name: string;
  displayName: string;
  description?: string;
  /**
   * PascalCase React / rendering item name (e.g. CtaButton).
   * Used for the template branch and `Project/{collection}/{Name}.yml` path.
   * Emit writes the Sitecore `componentName` field as kebab `definitionKey` /
   * `name` so layout matches Content SDK component-map keys (`cta-button`).
   */
  componentName: string;
  /**
   * Collection system name under /sitecore/.../Project/{collectionSystem}/.
   * Temporary default until site.definition.ts owns this.
   */
  collectionSystem?: string;
  /**
   * Site system name under /sitecore/content/{collectionSystem}/{siteSystem}/.
   * Required when collection and site systemNames differ (e.g. axa / axa-be).
   * When omitted, content emit resolves via generate --site, unique site def, or disk.
   */
  siteSystem?: string;
  /** Datasource folder + item templates (same shape as data definitions). */
  model: DataModelDef;
  /**
   * Preferred datasource picker location (same shape as `kind: "rendering"`).
   * When omitted, derived from `datasource.locations` (site), then `content.location`.
   */
  datasourceLocation?: RenderingDatasourceLocation;
  /** Legacy picker / authoring options — prefer `datasourceLocation` + `openPropertiesAfterAdd`. */
  datasource?: ComponentDatasourceConfig;
  /**
   * Headless variants: inline list, or Sitecore item / definition ref
   * (`{ definitionKey }` | `{ path }` | `{ guid }`).
   */
  variants?: Array<{ name: string }> | SitecoreItemRef;
  /**
   * Inline rendering parameters (`{ sections }`), or Sitecore item / definition ref
   * (`{ definitionKey }` | `{ path }` | `{ guid }`).
   * Mutually exclusive with `parametersTemplateId` (prefer `{ guid }` instead).
   * When omitted, emit still creates an empty `{Component} Parameters` template
   * (SXA base templates only) and sets Parameters Template on the Json Rendering.
   * Declare `sections` only for extra custom parameter fields.
   */
  parameters?: ParametersModelDef | SitecoreItemRef;
  /**
   * @deprecated Prefer `parameters: { guid: "…" }`.
   * Reference CM-pulled parameters template by GUID.
   */
  parametersTemplateId?: string;
  renderingCssClass?: string;
  icon?: string;
  openPropertiesAfterAdd?: boolean;
  otherProperties?: Record<string, string | boolean>;
  cultures?: string[];
  /**
   * Optional seed content under the site tree (same shape as standalone `*.content.ts`).
   * Emitted with templates during `definitions:generate`.
   */
  content?: ComponentContentSeed;
  /**
   * Dynamic placeholders for this rendering (base key; TSX appends DynamicPlaceholderId).
   * `allowedControls` are other definitionKeys (resolved to rendering item IDs on emit).
   */
  placeholders?: RenderingPlaceholderDef[];
  /**
   * Override Datasource Template with a Sitecore path or GUID
   * (e.g. JSS Link List branch path).
   */
  datasourceTemplate?: string;
  /**
   * Json Rendering `ComponentQuery` — shapes layout service fields
   * (e.g. Title + children Link for platform Link Lists).
   */
  componentGraphQLQuery?: string;
  /**
   * When set, emit uses this Datasource Location query verbatim
   * (e.g. JSS LinkList `@@templatename='Link List Folder'`).
   */
  datasourceLocationQuery?: string;
  /**
   * Json Rendering Page Editor Buttons (core experience button IDs, `|`-joined).
   */
  pageEditorButtons?: string;
  /**
   * Json Rendering AddFieldEditorButton (`0` / `1`).
   */
  addFieldEditorButton?: string | number | boolean;
};

/**
 * Standalone headless rendering definition — canonical shape for layout +
 * datasource template branch + scaffolding insert rule.
 */
export type RenderingDefinition = DefinitionKeyed & {
  kind: "rendering";
  /** Sitecore item / branch name (e.g. `Example Rendering`). */
  name: string;
  displayName: string;
  description?: string;
  /**
   * Optional override; emit prefers kebab `definitionKey` for the Sitecore
   * `componentName` field (Content SDK map keys). Defaults via `name`.
   */
  componentName?: string;
  collectionSystem?: string;
  /**
   * Site system for Headless Variants emit under
   * `sites/content/{collection}/{site}/Presentation/Headless Variants/`.
   * When omitted, content-site-context resolves from generate scope / unique site.
   */
  siteSystem?: string;
  model: DataModelDef;
  datasourceLocation: RenderingDatasourceLocation;
  /**
   * Inline parameters (`{ sections }`), or `{ definitionKey }` / `{ path }` / `{ guid }`.
   * Mutually exclusive with `parametersTemplateId`.
   * When omitted, emit still creates an empty `{Component} Parameters` template
   * (SXA base templates only) and sets Parameters Template on the Json Rendering.
   */
  parameters?: ParametersModelDef | SitecoreItemRef;
  /**
   * @deprecated Prefer `parameters: { guid: "…" }`.
   * Reference CM-pulled parameters template by GUID (not managed by definitions).
   */
  parametersTemplateId?: string;
  renderingCssClass?: string;
  icon?: string;
  openPropertiesAfterAdd?: boolean;
  /** Merged with default `IsRenderingsWithDynamicPlaceholders=true`. */
  otherProperties?: Record<string, string | boolean>;
  cultures?: string[];
  content?: ComponentContentSeed;
  /**
   * Headless variant registrations under
   * `{site}/Presentation/Headless Variants/{componentName}/`.
   * Inline list, or `{ definitionKey }` / `{ path }` / `{ guid }`.
   */
  variants?: Array<{ name: string }> | SitecoreItemRef;
  /** Dynamic placeholders + Allowed Controls (definitionKeys). */
  placeholders?: RenderingPlaceholderDef[];
  /**
   * Override Datasource Template with a Sitecore path or GUID
   * (e.g. JSS Link List branch path).
   */
  datasourceTemplate?: string;
  /**
   * Json Rendering `ComponentQuery` — shapes layout service fields
   * (e.g. Title + children Link for platform Link Lists).
   */
  componentGraphQLQuery?: string;
  /**
   * When set, emit uses this Datasource Location query verbatim
   * (e.g. JSS LinkList `@@templatename='Link List Folder'`).
   */
  datasourceLocationQuery?: string;
  /**
   * Json Rendering Page Editor Buttons (core experience button IDs, `|`-joined).
   */
  pageEditorButtons?: string;
  /**
   * Json Rendering AddFieldEditorButton (`0` / `1`).
   */
  addFieldEditorButton?: string | number | boolean;
};

/** Scopes for localized content definitions (dictionaries). */

export type DictionaryScope = "site" | "system";



/**

 * Scopes for enumeration definitions (includes legacy shared/project stubs).

 */

export type EnumerationScope = DictionaryScope | "shared" | "project";



/**
 * Shared metadata on enumeration and dictionary definitions.
 * Field strings are in `culture` (default `en`); `cultures` lists extra
 * Sitecore languages. Emit always writes `en` and translates from `culture`.
 */
export type LocalizedContentDefinitionBase = DefinitionKeyed & {
  /** Definition / shard name (PascalCase recommended). */
  name: string;
  /** Author-facing label → definition metadata (not emitted as a Sitecore item). */
  displayName: string;
  /**
   * Author docs → Standard template `__Long description`.
   * Use `shortDescription` (StandardItemFields) for `__Short description`; both OK.
   */
  description?: string;
  /**
   * Sitecore culture of definition field strings (capture / source language).
   * Defaults to `en` when omitted.
   */
  culture?: string;
  /**
   * Extra Sitecore cultures to emit (e.g. `nl-BE`, `fr-BE`).
   * `en` is always emitted. When set, translatable fields are auto-translated
   * from `culture` (or `en`) and missing language items are created.
   */
  cultures?: string[];
} & StandardItemFields;



export type DictionaryLocation = {

  scope: DictionaryScope;

  /**

   * Path segments under the scope's dictionary root

   * (do not include "Dictionary" for site scope — added automatically).

   */

  folder: string[];

};



/** One Sitecore numbered version of dictionary definition metadata (English). */
export type DictionaryDefinitionVersionDef = {
  version: number;
  /** Author-facing label for the dictionary shard. */
  displayName: string;
  /** Author docs → leaf folder `__Long description` when `location.folder` is set. */
  description?: string;
  shortDescription?: string;
};

/** One Sitecore numbered version of a dictionary entry item (English). */
export type DictionaryEntryVersionDef = {
  version: number;
  /** English phrase → language `Phrase` field (auto-translated per culture). */
  phrase: string;
  /** Author docs → `__Long description`. */
  description?: string;
  shortDescription?: string;
};

/** One dictionary entry (Sitecore Dictionary Entry template — its own item). */
export type DictionaryEntry = {
  /** Shared lookup key (not translated). */
  key: string;
  /**
   * Sitecore item name / YAML file stem when different from `key`
   * (e.g. key `my-key`, item `Example`).
   */
  name?: string;
  /**
   * Sitecore numbered versions (always an array when multi-version).
   * English only — `cultures` drives auto-translated language versions.
   */
  versions?: DictionaryEntryVersionDef[];
  /**
   * Shorthand for a single v1 entry — equivalent to
   * `versions: [{ version: 1, phrase, description?, shortDescription? }]`.
   */
  phrase?: string;
  /** Shorthand v1 only (with `phrase`). */
  description?: string;
  /** Shorthand v1 only (with `phrase`). */
  shortDescription?: string;
} & StandardItemFields;

export type DictionaryDefinition = Omit<
  LocalizedContentDefinitionBase,
  "displayName" | "description"
> & {
  kind: "dictionary";
  location: DictionaryLocation;
  /**
   * Sitecore numbered versions for definition metadata
   * (`displayName` / `description`). Use when multi-version.
   * SAI handle and leaf-folder description use the lowest `version` number.
   */
  versions?: DictionaryDefinitionVersionDef[];
  /**
   * Shorthand for a single v1 definition — equivalent to
   * `versions: [{ version: 1, displayName, description?, shortDescription? }]`.
   */
  displayName?: string;
  /** Shorthand v1 only (with `displayName`). */
  description?: string;
  /** Shorthand v1 only (with `displayName`). */
  shortDescription?: string;
  entries: DictionaryEntry[];
};



export type EnumerationLocation = {

  scope: EnumerationScope;

  /**

   * Path segments under the scope's enumerationsRoot

   * (do not include "Enums" — that comes from ENUMERATIONS_ROOT).

   */

  folder: string[];

};



/** One Sitecore numbered version of an enumeration list item (English). */
export type EnumerationListVersionDef = {
  version: number;
  /** Author-facing label → `__Display name` on the enumeration list item. */
  displayName: string;
  /** Author docs → `__Long description`. */
  description?: string;
  shortDescription?: string;
  /** Default option `name` (must match one of `constants[].name`) → shared `Default`. */
  default?: string;
};

/** One Sitecore numbered version of an enumeration value item (English). */
export type EnumerationValueVersionDef = {
  version: number;
  /** Author-facing label → `__Display name`. */
  displayName: string;
  /** Author docs → `__Long description`. */
  description?: string;
  shortDescription?: string;
};

/** One option in a shared Sitecore enumeration (becomes its own item). */
export type EnumerationConstant = {
  /** Stored value / item name (e.g. `below`, `start`). */
  name: string;
  /**
   * Sitecore numbered versions (when multi-version).
   * English only — `cultures` drives auto-translated language versions.
   */
  versions?: EnumerationValueVersionDef[];
  /**
   * Shorthand for a single v1 constant — equivalent to
   * `versions: [{ version: 1, displayName, description?, shortDescription? }]`.
   */
  displayName?: string;
  /** Shorthand v1 only (with `displayName`). */
  description?: string;
  /** Shorthand v1 only (with `displayName`). */
  shortDescription?: string;
} & StandardItemFields;

/** @deprecated Use {@link EnumerationConstant}. */
export type EnumerationValue = EnumerationConstant;

export type EnumerationDefinition = Omit<
  LocalizedContentDefinitionBase,
  "displayName" | "description"
> & {
  kind: "enumeration";
  location: EnumerationLocation;
  /**
   * Sitecore numbered versions for the enumeration list item
   * (`displayName` / `description` / `default`). Use when multi-version.
   * SAI handle and shared `Default` use the lowest `version` number.
   */
  versions?: EnumerationListVersionDef[];
  /**
   * Shorthand for a single v1 list — equivalent to
   * `versions: [{ version: 1, displayName, description?, shortDescription?, default? }]`.
   */
  displayName?: string;
  /** Shorthand v1 only (with `displayName`). */
  description?: string;
  /** Shorthand v1 only (with `displayName`). */
  shortDescription?: string;
  /** Shorthand v1 only — default option `name` (must match a constant). */
  default?: string;
  constants: EnumerationConstant[];
};



/** Where data content lives under the site: Data folder or under Home. */
export type DataPlacementRoot = "data" | "home";

export type DataPlacement = {
  root: DataPlacementRoot;
  folder: string[];
};

/** Insert options on a data folder template (A+B). */
export type DataInsertOptions = {
  /** Allow this definition's itemTemplate — default true */
  items?: boolean;
  /** Allow nested folderTemplate — default true */
  folders?: boolean;
};

/**
 * Definition-friendly General Link value (emitter expands to Sitecore XML).
 * Prefer `{ text, url }`. Bare `"url"` string also accepted (text defaults to url).
 */
export type DataLinkValue = {
  text?: string;
  url: string;
  target?: string;
  anchor?: string;
  title?: string;
  class?: string;
  querystring?: string;
  linktype?:
    | "external"
    | "internal"
    | "anchor"
    | "mailto"
    | "javascript";
};

/**
 * Definition-friendly Image field value (emitter downloads / decodes → media YAML).
 *
 * Creates a media-library item (Blob) when needed and sets the content Image field to
 * `<image mediaid="…" />`.
 *
 * Sources (exactly one): `url` | `base64` | `svgMarkup` | `path` | `guid` | `definitionKey`.
 * - `path` / `guid` — existing Sitecore media (no blob emit)
 * - `definitionKey` — BQ `kind: "media"` (image-family)
 */
export type DataImageValue = {
  /** HTTP(S) URL — downloaded and serialized as media library YAML. */
  url?: string;
  /** Raw base64 or `data:…;base64,…` — written as media library YAML Blob. */
  base64?: string;
  /**
   * Raw SVG markup — UTF-8 encoded to Blob as `image/svg+xml`.
   * Use for inline SVG defaults on Image fields (same as on `kind: "media"`).
   */
  svgMarkup?: string;
  /** Sitecore content-tree path to an existing media item. */
  path?: string;
  /** Sitecore media item GUID. */
  guid?: string;
  /** Cross-ref to a `kind: "media"` definition. */
  definitionKey?: string;
  alt?: string;
  name?: string;
  extension?: string;
};

/**
 * Standalone media-library asset (`kind: "media"`).
 * Emits YAML under `/sitecore/media library/Project/{collection}/{site}/…`.
 * Template + fields depend on extension (jpg/svg/webp/pdf/zip/doc/docx/txt/…).
 *
 * Sources (exactly one): `url` | `base64` | `svgMarkup`.
 */
export type MediaDefinition = {
  kind: "media";
  definitionKey: string;
  /** Sitecore media item name. */
  name: string;
  /** HTTP(S) URL — downloaded and stored as Blob. */
  url?: string;
  /** Raw base64 or data-URL — stored as Blob. */
  base64?: string;
  /**
   * Raw SVG markup — emitter UTF-8 encodes to base64 Blob (`image/svg+xml`).
   * Prefer this over hand-written `base64` for SVG assets.
   */
  svgMarkup?: string;
  /** Image Alt (image-family media). */
  alt?: string;
  /** Media Title (e.g. PDF). */
  title?: string;
  extension?: string;
  /**
   * Folder segments under the site media root
   * (e.g. `["Samples"]` → `…/bq-demo/Samples/{name}`).
   */
  location?: {
    folder?: string[];
    collectionSystem?: string;
    siteName?: string;
  };
  collectionSystem?: string;
};

/** Field values on data items / defaults (structured link/image preferred). */
export type DataFieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | DataLinkValue
  | DataImageValue;

export type DataFieldDef = {
  name: string;
  /** Sitecore field type name (e.g. Single-Line Text, Droplink, Image). */
  type: string;
  /** When true → template Shared + item SharedFields (not translated). */
  shared?: boolean;
  /** Structured Source for list fields → `query:$site/Data/…` or `query:$home/…`. */
  source?: DataPlacement;
  /**
   * Enumeration for Droplink-style Source:
   * `{ definitionKey }` → `enum:{key}@1`; `{ path }` / `{ guid }` → existing Sitecore item.
   */
  enumeration?: SitecoreItemRef;
  description?: string;
  /** → `__Short description` (can be used with `description`). */
  shortDescription?: string;
  /**
   * Field Rules: `{ rule: "Required" }` / `{ rule: "Common/Is Email" }` or
   * `{ definitionKey: "at-least-two-words" }` (also `{ path }` / `{ guid }`).
   * Always attached to Validate Button + Quick Action Bar + Validator Bar.
   */
  validators?: DataFieldValidators;
  /**
   * Declarative constraints. Missing BQ rules are created under
   * Field Rules/BQ on emit (stock `Required` is referenced, not recreated).
   */
  constraints?: DataFieldConstraints;
  default?: DataFieldValue;
  sortOrder?: number;
};

export type DataSectionDef = {
  name: string;
  sortOrder?: number;
  fields: DataFieldDef[];
};

/** Folder template under a data (or component datasource) model. */
export type DataFolderTemplateDef = {
  name: string;
  /** Author-facing label for the data folder (→ content folder `__Display name`). */
  displayName?: string;
  /** Author docs → content folder `__Long description`. */
  description?: string;
  shortDescription?: string;
  /** Omitted → { items: true, folders: true }. */
  insert?: DataInsertOptions;
  /** Optional template sections + fields (same shape as itemTemplate). */
  sections?: DataSectionDef[];
};

/** Item template under a data (or component datasource) model. */
export type DataItemTemplateDef = {
  name: string;
  sections?: DataSectionDef[];
};

/** @deprecated Use {@link DataFolderTemplateDef} or {@link DataItemTemplateDef}. */
export type DataTemplateDef = DataFolderTemplateDef | DataItemTemplateDef;

/** One Sitecore numbered version of a data item (English field bag only). */
export type DataItemVersionDef = {
  /** Sitecore version number (1, 2, …). */
  version: number;
  /** English field values. Shared / versioned placement comes from the template. */
  fields?: Record<string, DataFieldValue>;
};

export type DataItemDef = {
  name: string;
  /**
   * Marketer-facing Sitecore `__Display name`.
   * Emit writes this on every language version (`en` + `cultures`).
   * Prefer Title/Heading seed phrasing; item `name` stays path-safe.
   */
  displayName?: string;
  /**
   * Sitecore numbered versions (when multi-version).
   * English only — `cultures` drives auto-translated language versions.
   */
  versions?: DataItemVersionDef[];
  /**
   * Shorthand for a single v1 item — equivalent to
   * `versions: [{ version: 1, fields }]`.
   */
  fields?: Record<string, DataFieldValue>;
};

/** Seed content item — supports nested `children` (component content trees). */
export type ComponentContentItemDef = DataItemDef & {
  children?: ComponentContentItemDef[];
  /**
   * Headless variant name matching `variants[].name` / TSX `export const`.
   * Used by presentation wiring (`FieldNames`). Omit or `"Default"` → no FieldNames.
   * Not a Sitecore field; content emit ignores it.
   */
  variant?: string;
  /**
   * Capture root HTML `id` for this instance → presentation `renderingIdentifier`.
   * Not a Sitecore field; content emit ignores it.
   */
  renderingIdentifier?: string;
};

export type ComponentContentVersionDef = {
  version: number;
  items: ComponentContentItemDef[];
};

/**
 * Dual-write sidecar: flat link groups mirrored under site `Data/Link Lists`
 * while FE still reads Multi-Line Text JSON bags on the component datasource.
 * Does not replace `items` / rendering datasource wiring.
 */
export type ComponentContentLinkListLinkDef = {
  /** Path leaf under the Link List (EN Path from link text preferred). */
  name: string;
  link: DataLinkValue;
};

export type ComponentContentLinkListDef = {
  /** Path under `Data/Link Lists` (EN spaced Title Case). */
  name: string;
  /** Title field on the Link List group (capture lang OK). */
  title?: string;
  /** Source Multi-Line Text field name (traceability), e.g. `"Context Links"`. */
  sourceField?: string;
  links: ComponentContentLinkListLinkDef[];
};

/** Seed content block on a component definition (or standalone *.content.ts). */
export type ComponentContentSeed = {
  location: DataPlacement;
  /**
   * Sitecore culture of seed field strings (capture / source language).
   * Defaults to `en` when omitted. Emit always also writes an `en` version.
   */
  culture?: string;
  /** Extra Sitecore cultures to emit (e.g. `nl-BE`, `fr-BE`). `en` is always emitted. */
  cultures?: string[];
  /**
   * @deprecated Prefer `location.folder: ["Link Lists"]` only.
   * When `"link-list"`, emit under platform Link List templates
   * (group `60c9ac62-…` + child `6f108e3c-…`) instead of BQ item templates.
   * Also implied when `location.folder` is `["Link Lists"]`.
   */
  platform?: "link-list";
  items?: ComponentContentItemDef[];
  versions?: ComponentContentVersionDef[];
  /**
   * @deprecated Dual-write retired. Flat link lists use dedicated LinkList
   * packages under `folder: ["Link Lists"]`. Sidecars are stripped on normalize.
   */
  linkLists?: ComponentContentLinkListDef[];
};

/**
 * Data definition: content templates (folder + item) + items under Data or Home.
 * Does not use enum/dictionary `location.scope`.
 */
export type DataDefinition = DefinitionKeyed & {
  kind: "data";
  /** Template group / shard name (PascalCase recommended). */
  name: string;
  /**
   * Sitecore culture of item field strings (default `en`).
   * Emit always writes `en` and translates from this culture into `cultures`.
   */
  culture?: string;
  cultures?: string[];
  /**
   * Project templates collection segment
   * (default: build-quick-demos-and-proof-of-concepts).
   */
  collectionSystem?: string;
  /** Site system for Data/Home content placement (required when a collection has multiple sites). */
  siteSystem?: string;
  location: DataPlacement;
  model: DataModelDef;
  items?: DataItemDef[];
} & StandardItemFields;



/**
 * Rendering parameters template under Project templates.
 * Creates `{name}.yml` parent folder if missing, then `{name} Parameters` + sections/fields.
 * Does not emit site Data items.
 */
export type ParametersDefinition = DefinitionKeyed & {
  kind: "parameters";
  /**
   * Template branch / parent folder name (e.g. `Example Rendering`).
   * Parameters template is always `{name} Parameters`.
   */
  name: string;
  collectionSystem?: string;
  model: ParametersModelDef;
};

/**
 * Dedicated Field Rules under `/sitecore/system/Settings/Validation Rules/Field Rules/{folder}`.
 * One definition = one validator item. Default folder: `BQ`.
 * English-only `versions`; `cultures` auto-translates Title / Description.
 */
export type FieldValidatorDefinition = DefinitionKeyed & {
  kind: "field-validator";
  /** Sitecore item name under Field Rules/{folder}. */
  name: string;
  /** Folder under Field Rules (default `BQ`). */
  folder?: string;
  /**
   * Sitecore culture of Title / Description strings (default `en`).
   * Emit always writes `en` and translates from this culture into `cultures`.
   */
  culture?: string;
  /**
   * Extra Sitecore cultures for Title / Description
   * (e.g. `nl-BE`, `fr-BE`). English is always emitted.
   */
  cultures?: string[];
  /**
   * Sitecore numbered versions. Use when multi-version.
   * Title and Description live here (versioned fields).
   */
  versions?: FieldValidatorVersionDef[];
} & StandardItemFields &
  FieldValidatorRuleShorthand;

/**
 * Headless Variants set (`kind: "variants"`).
 * Emits `{site}/Presentation/Headless Variants/{componentName}/` + one item per name.
 */
export type VariantsDefinition = DefinitionKeyed & {
  kind: "variants";
  /**
   * Sitecore folder name under Headless Variants (also Content SDK component name).
   * Example: `CtaButton`, `Custom Card`.
   */
  componentName: string;
  /** Variant item names (e.g. Default, Variant2). */
  variants: Array<{ name: string }>;
  /** Optional `__Icon` on the component variants folder. */
  icon?: string;
};

/**
 * Sites API options for collection/site definitions.
 * Auth: Environment automation client via
 * `SITECORE_AUTH_CLIENT_ID` / `SITECORE_AUTH_CLIENT_SECRET` (same pair as Content SDK).
 * See https://api-docs.sitecore.com/sai/sites-api/sites
 */
export type SitesApiOptions = {
  /**
   * XM Cloud / SitecoreAI environment id (`environmentId` / `sc_env` query param).
   * Prefer `BQ_SITECORE_ENVIRONMENT_ID` / `SITECORE_ENVIRONMENT_ID` in `.env.local`
   * (resolved by emitters). Use this field only to override per definition.
   */
  environmentId?: string;
  /**
   * Named Sitecore CLI endpoint (e.g. `bqAuthoring`) for delete/restore ser sessions.
   * Prefer `BQ_SITECORE_ENDPOINT` or `--endpoint`; must match `.sitecore/user.json` endpoints.
   * Normal create/apply is Authoring GraphQL and does not expand module.json or run ser.
   */
  endpointName?: string;
  /**
   * Environment automation client id (Sites API requires `xmcloud.cm:admin`).
   * Interactive `dotnet sitecore cloud login` tokens are usually deploy-scoped and get 401.
   * Falls back to `SITECORE_AUTH_CLIENT_ID` (Environment automation client).
   * Create: Deploy → Credentials → Environment → Automation.
   */
  clientId?: string;
  /** Automation client secret — prefer env `SITECORE_AUTH_CLIENT_SECRET`, do not commit. */
  clientSecret?: string;
  /**
   * @deprecated Create/apply never pulls. Delete/restore own their ser sessions.
   * Kept for CLI compat.
   */
  skipPull?: boolean;
  /**
   * @deprecated Create/apply never pushes. Delete/restore own their ser sessions.
   * Kept for CLI compat.
   */
  skipPush?: boolean;
  /** Force Sites API sync even when the remote entity already matches. */
  forceSync?: boolean;
};

/**
 * Headless collection scaffold (`kind: "collection"`).
 * Synced via Sites API when local YAML is missing/mismatched (or `api.forceSync`);
 * otherwise uses the pulled blueprint tree. Removing this definition deletes the
 * remote collection on the next generate (`bq-sites-api-owned.json`).
 * Updates the sibling `*.module.json` include rules.
 */
export type CollectionDefinition = DefinitionKeyed & {
  kind: "collection";
  /** Display name (Sitecore Name field), e.g. `Demo Collection`. */
  name: string;
  /**
   * Item / path system name. Defaults to alphanumeric lowercase of `name`.
   * Example: `democollection`.
   */
  systemName?: string;
  /**
   * Optional override when renaming. Prefer omitting this: ownership state
   * (`bq-sites-api-owned.json`) supplies the previous system name from the
   * last generate for the same `definitionKey`.
   */
  previousSystemName?: string;
  /** Sitecore Description field. */
  description?: string;
  /**
   * How `description` was authored. When `"ai"` or `"manual"`,
   * create:sectioncomponents will not regenerate it across runs.
   * `"capture"` = hostname placeholder (eligible for one-time AI upgrade).
   */
  descriptionSource?: "ai" | "manual" | "capture";
  /** Sites API auth / environment overrides. */
  api?: SitesApiOptions;
};

/** Inline collection fields when a site creates (or reuses) a collection. */
export type SiteInlineCollection = {
  name: string;
  systemName?: string;
  description?: string;
  /** Optional key for logging; not required for emit. */
  definitionKey?: string;
};

/**
 * Headless site scaffold (`kind: "site"`).
 * Synced via Sites API when local YAML is missing/mismatched (or `api.forceSync`);
 * otherwise uses the pulled blueprint tree. Removing this definition deletes the
 * remote site on the next generate (`bq-sites-api-owned.json`).
 * Sites must live under a collection: `collectionSystem` or inline `collection`.
 */
/**
 * Definition image/thumbnail source — same shape as content Image seeds
 * (`MediaSourceInput`) plus a capture-local `path`.
 * Resolve order at apply: `base64` → `url` → `path`.
 */
export type DefinitionThumbnail = {
  /** Capture-page-relative or absolute filesystem path. */
  path?: string;
  /** HTTP(S) URL — download + upload. */
  url?: string;
  /** Raw or data-URL base64. */
  base64?: string;
  alt?: string;
  name?: string;
};

export type SiteDefinition = DefinitionKeyed & {
  kind: "site";
  /** Display name (Sitecore Name field), e.g. `Marketing Site`. */
  name: string;
  /** Item / path system name. Defaults from `name`. */
  systemName?: string;
  /**
   * Optional site thumbnail (Sites UI / Home `__Thumbnail`).
   * CSC stamps `{ path: "screenshots/desktop-clean.png" }` (or equivalent).
   */
  thumbnail?: DefinitionThumbnail;
  /**
   * Optional override when renaming. Prefer omitting this: ownership state
   * (`bq-sites-api-owned.json`) supplies the previous system name from the
   * last generate for the same `definitionKey`.
   */
  previousSystemName?: string;
  description?: string;
  /**
   * How `description` was authored. When `"ai"` or `"manual"`,
   * create:sectioncomponents will not regenerate it across runs.
   * `"capture"` = hostname placeholder (eligible for one-time AI upgrade).
   */
  descriptionSource?: "ai" | "manual" | "capture";
  /** Sites API options (language, template, auth overrides). */
  api?: SitesApiOptions & {
    /** Default language (required by Sites API create). Default `en`. */
    language?: string;
    /**
     * Site languages for Sites API create/update.
     * Must include the default `language` (emit always ensures `en` is present).
     */
    languages?: string[];
    /**
     * Site template id (Sites API `templateId`).
     * If omitted, resolves `templateName` (default `Basic`) via list templates.
     */
    templateId?: string;
    /** Template name to resolve when `templateId` is omitted. Default `Basic`. */
    templateName?: string;
    /** Optional hostname (Sites API `hostName`). */
    hostName?: string;
    /**
     * Sitecore Stream brand kit id linked to this site (Sites API `brandKitId`).
     * Set by create:sectioncomponents when `BQ_CREATE_BRANDKIT` / `--brandkit` is on.
     */
    brandKitId?: string;
  };
} & (
  | {
      /** Existing collection system name (must already exist or be emitted earlier). */
      collectionSystem: string;
      collection?: never;
    }
  | {
      collectionSystem?: never;
      /**
       * Create this collection if missing; if it already exists, reuse it.
       * May be created in the same create-site call when the collection is new.
       */
      collection: SiteInlineCollection;
    }
);

/**
 * Site presentation wiring (Available Renderings, Partial Designs, Home layout).
 * Emitted only via definitions:generate — never hand-edit YAML.
 */
export type SitePresentationDefinition = DefinitionKeyed & {
  kind: "site-presentation";
  siteSystem: string;
  collectionSystem: string;
  /**
   * Extra Sitecore cultures for partial / page-design / foundation display
   * versions (e.g. `nl-BE`, `fr-BE`). `en` is always emitted.
   */
  cultures?: string[];
  availableRenderings?: Record<string, string[]>;
  partialDesigns?: Array<{
    signature: string;
    placeholder: string;
    definitionKey: string;
    /** Override which content item to bind as s:ds (default: first content.items[0].name). */
    datasourceItem?: string;
    /**
     * Partial Design `__Thumbnail` source (path | url | base64).
     * CSC stamps e.g. `{ path: "sections/section-02/section-02-desktop.png" }`
     * from the chrome band’s desktop PNG. Emit skips when unset.
     */
    thumbnail?: DefinitionThumbnail;
    /**
     * @deprecated Prefer `thumbnail: { path }`. Still read once as `{ path }` at apply.
     */
    thumbnailCaptureRel?: string;
    /**
     * Capture / author HTML id for this placement → layout `RenderingIdentifier`.
     * Omit when the section root has no id.
     */
    renderingIdentifier?: string;
    /**
     * Detected section index from capture (`detected-sections.json`).
     * Used to place earlier partial-header bands into `siblingsBefore`.
     */
    sectionIndex?: number;
    /**
     * Whether this partial root can nest children (placeholder host).
     * Stamped by create:sectioncomponents merge; prefer over name heuristics on re-merge.
     * Ignored by site-presentation emit (uses children / siblingsBefore).
     */
    canHostChildren?: boolean;
    /**
     * Extra root renderings on the same partial placeholder, ordered before
     * `definitionKey` (e.g. notification bar before main navigation on headless-header).
     */
    siblingsBefore?: Array<{
      definitionKey: string;
      datasourceItem?: string;
      renderingIdentifier?: string;
      /** Capture section index when known (document-order sibling wiring). */
      sectionIndex?: number;
      /**
       * Nested children when this sibling is itself a composite chrome root
       * (e.g. announcement messages under an announcement sibling on headless-header).
       */
      children?: PresentationNestedChild[];
    }>;
    /**
     * Nested renderings for the partial's dynamic placeholder
     * (e.g. footer-groups-{DynamicPlaceholderId}).
     * May nest further `children` when a child is itself a composite.
     */
    children?: PresentationNestedChild[];
  }>;
  /**
   * @deprecated Page bodies live in `kind: "page"` defs under `pages/`.
   * create:sectioncomponents no longer writes this map; emit ignores it when empty.
   */
  pages?: {
    [pageKey: string]: {
      routePath?: string;
      navigationTitle?: string;
      pageTemplateId?: string;
      pageTemplate?: PageTemplateBinding;
      fields?: PageContentFields;
      renderings?: PageRenderingEntry[];
    };
  };
};

/**
 * Page-item field value. Image fields use `{ url, alt }`; everything else is
 * the raw field value (plain text or HTML).
 */
export type PageFieldValue = string | { url: string; alt?: string };

export type PageContentFields = Record<string, PageFieldValue>;

/**
 * Custom page template (inherits the site Page template).
 * `insertOnlyUnder` routes are the only places that offer this template
 * in Insert Options.
 */
export type PageTemplateBinding = {
  name: string;
  insertOnlyUnder: string[];
  /**
   * `shell` keeps the item layout empty (shared page design, e.g. News Page).
   * `composed` builds a page design from this page's renderings so each
   * Landing Page can have its own body while the template stays empty.
   */
  presentation?: "shell" | "composed";
  /** Template sections. Omitted templates keep the article field set. */
  sections?: Array<{
    name: string;
    fields: Array<{ name: string; type: string }>;
  }>;
};

/** One headless-main (or nested) rendering placement on a page or legacy presentation.pages entry. */
export type PageRenderingEntry = {
  definitionKey: string;
  placeholder: string;
  role?: "page" | "partial-header" | "partial-footer" | "partial-cookie";
  /**
   * Content item name (s:ds), or `"$page"` to bind the page item itself
   * so the rendering reads this page template's fields.
   */
  datasourceItem?: string;
  /**
   * Headless variant name matching `variants[].name` / TSX `export const`.
   * Omit or `"Default"` → no `FieldNames` param.
   */
  variant?: string;
  renderingIdentifier?: string;
  children?: PresentationNestedChild[];
};

/**
 * Nested layout child under a dynamic-placeholder parent (partial or page).
 * Recursive: a child that is itself a composite may declare further `children`.
 */
export type PresentationNestedChild = {
  definitionKey: string;
  /** Override which content item to bind as s:ds (default: first content.items[0].name). */
  datasourceItem?: string;
  /**
   * Parent dynamic placeholder base key (e.g. `footer-navigation`).
   * Defaults to the parent component's first `placeholders[].key`.
   */
  placeholder?: string;
  /**
   * Headless variant name matching `variants[].name` / TSX `export const`.
   * Omit or `"Default"` → no `FieldNames` param. Any other name → emit
   * `FieldNames={variantGuid}` on that layout placement.
   */
  variant?: string;
  /**
   * Capture root HTML id for this child placement → `RenderingIdentifier`.
   * Only from the repeating-block root (never nested descendants).
   */
  renderingIdentifier?: string;
  /** Grandchildren when this child is itself a composite with AppPlaceholders. */
  children?: PresentationNestedChild[];
};

/**
 * Per-route page under `src/components/{host}/pages/`.
 * Empty / omitted `renderings` = link shell; with `renderings` = full layout.
 * One file per siteSystem+routePath (neutral name — no stub-/page- prefix).
 */
export type PageDefinition = DefinitionKeyed & {
  kind: "page";
  name: string;
  routePath: string;
  siteSystem: string;
  collectionSystem: string;
  navigationTitle?: string;
  culture?: string;
  cultures?: string[];
  pageTemplateId?: string;
  /**
   * Create this template (inheriting the site Page template) and limit
   * Insert Options to `insertOnlyUnder`. The page item uses the template.
   */
  pageTemplate?: PageTemplateBinding;
  /** Field values stored on the page item (the template's own fields). */
  fields?: PageContentFields;
  /** headless-main body only — cookie/header/footer live on site-presentation partialDesigns. */
  renderings?: PageRenderingEntry[];
};

/**
 * @deprecated Use `PageDefinition` (`kind: "page"`) under `pages/`.
 * Still accepted by emit as an empty-renderings page shell.
 */
export type PageStubDefinition = DefinitionKeyed & {
  kind: "page-stub";
  name: string;
  routePath: string;
  siteSystem: string;
  collectionSystem: string;
  navigationTitle?: string;
  culture?: string;
  cultures?: string[];
  pageTemplateId?: string;
  renderings?: PageRenderingEntry[];
};

/** Any definition kind discovered under `src/components`. */

export type Definition =
  | ComponentTemplateDefinition
  | RenderingDefinition
  | ParametersDefinition
  | EnumerationDefinition
  | DictionaryDefinition
  | DataDefinition
  | FieldValidatorDefinition
  | MediaDefinition
  | VariantsDefinition
  | CollectionDefinition
  | SiteDefinition
  | SitePresentationDefinition
  | PageDefinition
  | PageStubDefinition;


