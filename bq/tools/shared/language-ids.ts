/**
 * Legacy Language item constants (SCS samples / Authoring fallbacks).
 * Prefer Sites API `POST /api/v1/languages` via `ensure-languages.ts`
 * (@see https://api-docs.sitecore.com/sai/sites-api/languages/createlanguage).
 * Verified against live CM `/sitecore/system/Languages/nl-NL`.
 */

/** `/sitecore/templates/System/Language` */
export const LANGUAGE_TEMPLATE = "f68f13a6-3395-426a-b9a1-fa2dc60d94eb";

/** `/sitecore/system/Languages` folder (LanguageRoot in this environment) */
export const LANGUAGES_FOLDER_ID = "64c4f646-a3fa-4205-b98e-4de2c609b60f";

/** Fields on the Language template (Data section). */
export const LANGUAGE_FIELD_IDS = {
  RegionalIsoCode: "0620f810-9294-4f14-af9f-f5772efca0b2",
  Charset: "49e5e8f3-ed4a-4a06-abe1-b9408951dee9",
  Encoding: "8728d8ff-66d9-40c2-8b34-c4fc1466942e",
  CodePage: "990596ce-0024-43f3-bf4c-a991bfa69b45",
  Iso: "c437e416-8948-427d-a982-8ed37ae3f553",
} as const;
