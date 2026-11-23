import type { ScsField } from "./provenance";

/**
 * Sitecore Standard Template field metadata for definition → YAML emission.
 * `shared` from Sitecore.FakeDb StandardFieldsReference:
 * - shared → SharedFields
 * - unversioned → Languages.en.Fields
 * - versioned → Languages.en.Versions[].Fields
 */
export type StandardFieldPlacement = "shared" | "unversioned" | "versioned";

export type StandardFieldDef = {
  /** Sitecore field ID (lowercase, no braces) */
  id: string;
  /** SCS Hint (exact) */
  hint: string;
  placement: StandardFieldPlacement;
  kind: "text" | "checkbox" | "multiline" | "datetime" | "number";
};

/**
 * Definition camelCase keys → standard `__*` fields.
 * Statistics / provenance fields are intentionally omitted (BQ owns those).
 */
export const STANDARD_FIELDS = {
  // Advanced
  enableItemFallback: {
    id: "fd4e2050-186c-4375-8b99-e8a85dd7436e",
    hint: "__Enable item fallback",
    placement: "shared",
    kind: "checkbox",
  },
  enforceVersionPresence: {
    id: "61cf7151-0cbd-4db4-9738-d753a55a6e65",
    hint: "__Enforce version presence",
    placement: "shared",
    kind: "checkbox",
  },
  sourceItem: {
    id: "19b597d3-2edd-4ae2-aefe-4a94c7f10e31",
    hint: "__Source Item",
    placement: "shared",
    kind: "text",
  },
  source: {
    id: "1b86697d-60ca-4d80-83fb-7555a2e6ce1c",
    hint: "__Source",
    placement: "unversioned",
    kind: "text",
  },

  // Appearance
  contextMenu: {
    id: "d3ae7222-425d-4b77-95d8-ee33ac2b6730",
    hint: "__Context Menu",
    placement: "shared",
    kind: "text",
  },
  displayName: {
    id: "b5e02ad9-d56f-4c41-a065-a133db87bdeb",
    /** Authoring GraphQL field name (confirmed via item fields query). */
    hint: "__Display name",
    placement: "unversioned",
    kind: "text",
  },
  editor: {
    id: "d85db4ec-ff89-4f9c-9e7c-a9e0654797fc",
    hint: "__Editor",
    placement: "shared",
    kind: "text",
  },
  editors: {
    id: "a0cb3965-8884-4c7a-8815-b6b2e5ced162",
    hint: "__Editors",
    placement: "shared",
    kind: "multiline",
  },
  hidden: {
    id: "39c4902e-9960-4469-aeef-e878e9c8218f",
    hint: "__Hidden",
    placement: "shared",
    kind: "checkbox",
  },
  icon: {
    id: "06d5295c-ed2f-4a54-9bf2-26228d113318",
    hint: "__Icon",
    placement: "shared",
    kind: "text",
  },
  originator: {
    id: "f6d8a61c-2f84-4401-bd24-52d2068172bc",
    hint: "__Originator",
    placement: "shared",
    kind: "text",
  },
  preview: {
    id: "41c6cc0e-389f-4d51-9990-fe35417b6666",
    hint: "__Preview",
    placement: "unversioned",
    kind: "text",
  },
  readOnly: {
    id: "9c6106ea-7a5a-48e2-8cad-f0f693b1e2d4",
    hint: "__Read Only",
    placement: "shared",
    kind: "checkbox",
  },
  ribbon: {
    id: "0c894aab-962b-4a84-b923-cb24b05e60d2",
    hint: "__Ribbon",
    placement: "shared",
    kind: "text",
  },
  skin: {
    id: "079afcfe-8aca-4863-bda7-07893541e2f5",
    hint: "__Skin",
    placement: "shared",
    kind: "text",
  },
  sortOrder: {
    id: "ba3f86a2-4a1c-4d78-b63d-91c2779c1b5e",
    hint: "__Sortorder",
    placement: "shared",
    kind: "number",
  },
  style: {
    id: "a791f095-2521-4b4d-bef9-21dda221f608",
    hint: "__Style",
    placement: "shared",
    kind: "text",
  },
  subitemsSorting: {
    id: "6fd695e7-7f6d-4ca5-8b49-a829e5950ae9",
    hint: "__Subitems Sorting",
    placement: "shared",
    kind: "text",
  },
  thumbnail: {
    id: "c7c26117-dbb1-42b2-ab5e-f7223845cca3",
    hint: "__Thumbnail",
    placement: "shared",
    kind: "text",
  },
  autoThumbnails: {
    id: "4a749557-242b-4372-8a20-b2db9d406301",
    hint: "__AutoThumbnails",
    placement: "shared",
    kind: "checkbox",
  },

  // Help
  helpLink: {
    id: "56776edf-261c-4abc-9fe7-70c618795239",
    hint: "__Help link",
    placement: "shared",
    kind: "multiline",
  },
  longDescription: {
    id: "577f1689-7de4-4ad2-a15f-7fdc1759285f",
    hint: "__Long description",
    placement: "unversioned",
    kind: "multiline",
  },
  shortDescription: {
    id: "9541e67d-ce8c-4225-803d-33f7f29f09ef",
    hint: "__Short description",
    placement: "unversioned",
    kind: "text",
  },

  // Layout (raw values — authors supply SCS-ready strings)
  controllerAction: {
    id: "9fb734cc-8952-4072-a2d4-40f890e16f56",
    hint: "__Controller Action",
    placement: "shared",
    kind: "text",
  },
  controller: {
    id: "4c9312a5-2e4e-42f8-ab6f-b8db8b82bf22",
    hint: "__Controller",
    placement: "shared",
    kind: "text",
  },
  finalRenderings: {
    id: "04bf00db-f5fb-41f7-8ab7-22408372a981",
    hint: "__Final Renderings",
    placement: "unversioned",
    kind: "multiline",
  },
  presets: {
    id: "a4879e42-0270-458d-9c19-a20af3c2b765",
    hint: "__Presets",
    placement: "shared",
    kind: "multiline",
  },
  renderers: {
    id: "b03569b1-1534-43f2-8c83-bd064b7d782c",
    hint: "__Renderers",
    placement: "shared",
    kind: "multiline",
  },
  renderings: {
    id: "f1a1fe9e-a60c-4ddb-a3a0-bb5b29fe732e",
    hint: "__Renderings",
    placement: "shared",
    kind: "multiline",
  },

  // Lifetime
  hideVersion: {
    id: "b8f42732-9cb8-478d-ae95-07e25345fb0f",
    hint: "__Hide version",
    placement: "versioned",
    kind: "checkbox",
  },
  validFrom: {
    id: "c8f93afe-bfd4-4e8f-9c61-152559854661",
    hint: "__Valid from",
    placement: "versioned",
    kind: "datetime",
  },
  validTo: {
    id: "4c346442-e859-4efd-89b2-44aedf467d21",
    hint: "__Valid to",
    placement: "versioned",
    kind: "datetime",
  },

  // Indexing
  boost: {
    id: "93d1b217-b8f4-462e-babf-68298c9ce667",
    hint: "__Boost",
    placement: "shared",
    kind: "text",
  },
  boostingRules: {
    id: "8c181989-2794-4b28-8ee4-6bb5cb928dc2",
    hint: "__Boosting Rules",
    placement: "shared",
    kind: "multiline",
  },
  facets: {
    id: "21f74f6e-42d4-42a2-a4b4-4cefbcfbd2bb",
    hint: "__Facets",
    placement: "shared",
    kind: "multiline",
  },

  // Insert Options
  insertRules: {
    id: "83798d75-df25-4c28-9327-e8bac2b75292",
    hint: "__Insert Rules",
    placement: "shared",
    kind: "multiline",
  },
  masters: {
    id: "1172f251-dad4-4efb-a329-0c63500e4f1e",
    hint: "__Masters",
    placement: "shared",
    kind: "multiline",
  },

  // Item Buckets
  bucketParentReference: {
    id: "9dafca1d-d618-4616-86b8-a8acd6b28a63",
    hint: "__Bucket Parent Reference",
    placement: "shared",
    kind: "text",
  },
  bucketable: {
    id: "c9283d9e-7c29-4419-9c28-5a5c8ff53e84",
    hint: "__Bucketable",
    placement: "shared",
    kind: "checkbox",
  },
  defaultBucketQuery: {
    id: "ac51462c-8a8d-493b-9492-34d1f26f20f1",
    hint: "__Default Bucket Query",
    placement: "shared",
    kind: "multiline",
  },
  defaultView: {
    id: "3607f9c7-dda3-43c3-9720-39a7a5b3a4c3",
    hint: "__Default View",
    placement: "shared",
    kind: "text",
  },
  enabledViews: {
    id: "f2db8ba1-e477-41f5-8ef5-22eefa8d2f6e",
    hint: "__Enabled Views",
    placement: "shared",
    kind: "multiline",
  },
  isBucket: {
    id: "d312103c-b36c-4ca5-864a-c85f9abda503",
    hint: "__Is Bucket",
    placement: "shared",
    kind: "checkbox",
  },
  persistentBucketFilter: {
    id: "c7815f60-96e1-40cb-bb06-b5f833f73b61",
    hint: "__Persistent Bucket Filter",
    placement: "shared",
    kind: "multiline",
  },
  quickActions: {
    id: "c0e276bb-8807-40aa-8138-e5c38b0c5dab",
    hint: "__Quick Actions",
    placement: "shared",
    kind: "multiline",
  },
  shouldNotOrganizeInBucket: {
    id: "f7b94d8c-a842-49f8-ab7a-2169d00426b0",
    hint: "__Should Not Organize In Bucket",
    placement: "shared",
    kind: "checkbox",
  },

  // Publishing
  neverPublish: {
    id: "9135200a-5626-4dd8-ab9d-d665b8c11748",
    hint: "__Never publish",
    placement: "shared",
    kind: "checkbox",
  },
  publish: {
    id: "86fe4f77-4d9a-4ec3-9ed9-263d03bd1965",
    hint: "__Publish",
    placement: "shared",
    kind: "datetime",
  },
  publishingGroups: {
    id: "74484bdf-7c86-463c-b49f-7b73b9afc965",
    hint: "__Publishing groups",
    placement: "shared",
    kind: "multiline",
  },
  unpublish: {
    id: "7ead6fd6-6cf1-4aca-ac6b-b200e7bafe88",
    hint: "__Unpublish",
    placement: "shared",
    kind: "datetime",
  },

  // Security (owner only — __Security is rarely hand-authored)
  owner: {
    id: "52807595-0f8f-4b20-8d2a-cb71d28c6103",
    hint: "__Owner",
    placement: "unversioned",
    kind: "text",
  },

  // Tagging
  semantics: {
    id: "a14f1b0c-4384-49ec-8790-28a440f3670c",
    hint: "__Semantics",
    placement: "unversioned",
    kind: "multiline",
  },

  // Tasks
  archiveDate: {
    id: "56c15c6d-fd5a-40ca-bb37-64ceec6a9bd5",
    hint: "__Archive date",
    placement: "shared",
    kind: "datetime",
  },
  archiveVersionDate: {
    id: "1d99005e-65ca-45ca-9d9a-fd7016e23f1e",
    hint: "__Archive Version date",
    placement: "versioned",
    kind: "datetime",
  },
  reminderDate: {
    id: "abe5d54c-59d7-41e6-8d3f-c1a3e4ec9b9e",
    hint: "__Reminder date",
    placement: "versioned",
    kind: "datetime",
  },
  reminderRecipients: {
    id: "2ed9c4d0-9eff-490d-a40a-b5d856499c40",
    hint: "__Reminder recipients",
    placement: "versioned",
    kind: "text",
  },
  reminderText: {
    id: "bb6c8540-118e-4c49-9157-830576d7345a",
    hint: "__Reminder text",
    placement: "versioned",
    kind: "multiline",
  },

  // Validators
  quickActionBarValidationRules: {
    id: "c2f5b2b5-71c1-431e-bf7f-dbdc1e5a2f83",
    hint: "__Quick Action Bar Validation Rules",
    placement: "shared",
    kind: "multiline",
  },
  suppressedValidationRules: {
    id: "f47c0d78-61f9-479c-96df-1159727d32c6",
    hint: "__Suppressed Validation Rules",
    placement: "shared",
    kind: "multiline",
  },
  validateButtonValidationRules: {
    id: "57cbca4c-8c94-446c-b8ca-7d8dc54f4285",
    hint: "__Validate Button Validation Rules",
    placement: "shared",
    kind: "multiline",
  },
  validatorBarValidationRules: {
    id: "b7e5b151-b145-4ced-85c5-fbdb566dfa4d",
    hint: "__Validator Bar Validation Rules",
    placement: "shared",
    kind: "multiline",
  },
  workflowValidationRules: {
    id: "86b52eef-078e-4d9e-80bf-888287070e6c",
    hint: "__Workflow Validation Rules",
    placement: "shared",
    kind: "multiline",
  },

  // Workflow (definition only — not lock/state)
  defaultWorkflow: {
    id: "ca9b9f52-4fb0-4f87-a79f-24dea62cda65",
    hint: "__Default workflow",
    placement: "shared",
    kind: "text",
  },
  workflow: {
    id: "a4f985d9-98b3-4b52-aaaf-4344f6e747c6",
    hint: "__Workflow",
    placement: "shared",
    kind: "text",
  },
} as const satisfies Record<string, StandardFieldDef>;

export type StandardFieldKey = keyof typeof STANDARD_FIELDS;

/** Optional standard `__*` fields settable on enumeration list / value definitions. */
export type StandardItemFields = {
  [K in StandardFieldKey]?: string | number | boolean;
};

export type CollectedStandardFields = {
  shared: ScsField[];
  language: ScsField[];
  version: ScsField[];
};

function toFieldValue(
  def: StandardFieldDef,
  value: string | number | boolean,
): { value: string | number; multiline?: boolean } {
  if (def.kind === "checkbox") {
    return { value: value === true || value === 1 || value === "1" ? "1" : "" };
  }
  if (def.kind === "multiline") {
    const text = String(value);
    if (text.includes("\n")) {
      return { value: text, multiline: true };
    }
    return { value: text };
  }
  if (def.kind === "number") {
    return { value: typeof value === "number" ? value : Number(value) };
  }
  return { value: String(value) };
}

/**
 * Map definition standard-field props into SCS shared / language / version fields.
 * Only keys present (and not `undefined`) are emitted.
 */
export function collectStandardFields(
  fields: StandardItemFields | undefined | null,
): CollectedStandardFields {
  const shared: ScsField[] = [];
  const language: ScsField[] = [];
  const version: ScsField[] = [];

  if (!fields) return { shared, language, version };

  for (const key of Object.keys(STANDARD_FIELDS) as StandardFieldKey[]) {
    const raw = fields[key];
    if (raw === undefined || raw === null) continue;
    const def = STANDARD_FIELDS[key];
    const formatted = toFieldValue(def, raw);
    const field: ScsField = {
      id: def.id,
      hint: def.hint,
      value: formatted.value,
      ...(formatted.multiline ? { multiline: true } : {}),
    };
    if (def.placement === "shared") shared.push(field);
    else if (def.placement === "unversioned") language.push(field);
    else version.push(field);
  }

  return { shared, language, version };
}

/** Pick only known standard-field keys from a larger definition object. */
export function pickStandardFields(
  source: Record<string, unknown>,
): StandardItemFields {
  const out: StandardItemFields = {};
  for (const key of Object.keys(STANDARD_FIELDS) as StandardFieldKey[]) {
    if (key in source && source[key] !== undefined) {
      out[key] = source[key] as string | number | boolean;
    }
  }
  return out;
}

/**
 * Map definition description props to Standard template language fields.
 * - `description` → `__Long description`
 * - `shortDescription` → `__Short description`
 * Both may be set together.
 */
export function collectDescriptionLanguageFields(
  description?: string,
  shortDescription?: string,
): ScsField[] {
  return collectStandardFields({
    ...(description?.trim() ? { longDescription: description } : {}),
    ...(shortDescription?.trim() ? { shortDescription } : {}),
  }).language;
}
