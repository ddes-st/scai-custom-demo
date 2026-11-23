import { applyAuthoringItem } from "./authoring-apply-bridge";
import path from "node:path";
import { ensureSystemLanguages } from "./ensure-languages";
import { braceGuid } from "./ids";
import { REPO_ROOT } from "./paths";
import type { ScsField } from "./provenance";
import {
  emptyWriteStats,
  formatMultilistItems,
  mergeWriteStats,
  recordWrite,
  type ScsLanguageBlock,
  type ScsWriteStats
} from "./authoring-item-model";
import { BASE_FOLDER_TEMPLATE } from "./system-ids";
import { translateText } from "./translate";
import {
  normalizeCultureKey,
  resolveContentLanguages,
} from "./resolve-content-languages";
import { proposeValidItemName } from "./naming";
import {
  definitionKeyFromRef,
  fieldRuleFromRef,
  isDefinitionKeyRef,
  isFieldRuleRef,
  isSitecoreGuidRef,
  isSitecorePathRef,
  sitecoreGuidFromRef,
  sitecorePathFromRef,
  type DefinitionKeyRef,
  type FieldRuleRef,
  type SitecoreGuidRef,
  type SitecorePathRef,
} from "./definition-ref";
import { resolveItemIdByPath } from "./resolve-item-id-by-path";

/**
 * Synthetic disk-style root for Field Rules (module include `validationRules`).
 * Used only by prune-roots / log labels — Authoring apply never reads or writes it.
 */
export const FIELD_RULES_DISK_ROOT = path.join(
  REPO_ROOT,
  "authoring",
  "items",
  "bq-demo",
  "sai",
  "validationRules",
  "Validation Rules",
  "Field Rules",
);

export const FIELD_RULES_SITECORE_ROOT =
  "/sitecore/system/Settings/Validation Rules/Field Rules";

/** Field Rules folder item (parent of Required, Common, Sample, BQ, …). */
export const FIELD_RULES_FOLDER_ID = "207b1f0d-fcf2-4f86-b270-a20fd012ceb8";

/** Validation Rule template. */
export const FIELD_RULE_VALIDATOR_TEMPLATE =
  "8f8e2549-c77f-4860-b83b-54fa31e2befa";

/** Default folder for BQ-authored custom rules. */
export const DEFAULT_VALIDATOR_FOLDER = "BQ";

const VALIDATOR_FIELD_IDS = {
  Type: "43a829d1-43da-465c-b772-ebaa0d515e3e",
  Parameters: "8f9d8603-2e34-4c5f-b0bb-f0d91eb956ca",
  Description: "58014183-26fe-4568-b19f-c26745824c32",
  Title: "da43c533-cbae-43d0-9019-65b1e346f984",
} as const;

const KERNEL = {
  required:
    "Sitecore.Data.Validators.FieldValidators.RequiredFieldValidator,Sitecore.Kernel",
  minLength:
    "Sitecore.Data.Validators.FieldValidators.MinLengthFieldValidator,Sitecore.Kernel",
  maxLength:
    "Sitecore.Data.Validators.FieldValidators.MaxLengthFieldValidator,Sitecore.Kernel",
  integerRange:
    "Sitecore.Data.Validators.FieldValidators.IntegerRangeValidator,Sitecore.Kernel",
  regex:
    "Sitecore.Data.Validators.FieldValidators.RegexValidator,Sitecore.Kernel",
} as const;

/**
 * Validation Rules multilists always written on template fields.
 * (Validate Button, Quick Action Bar, Validator Bar — not Workflow.)
 */
const FIELD_VALIDATOR_SLOTS = [
  {
    id: "21828437-ea4b-40a1-8c61-4ce60ea41db6",
    hint: "Validate Button",
  },
  {
    id: "337e20e1-999a-4eea-85ad-b58a03ae75cc",
    hint: "Quick Action Bar",
  },
  {
    id: "9c903e29-650d-4af2-b9bd-526d5c14a1a5",
    hint: "Validator Bar",
  },
] as const;

/**
 * Validator refs on data/component fields (tagged objects):
 * - `{ rule: "Required" }` / `{ rule: "Common/Is Email" }` — Field Rules–relative
 * - `{ definitionKey: "at-least-two-words" }` — BQ `kind: "field-validator"`
 * - `{ path: "/sitecore/system/Settings/Validation Rules/Field Rules/…" }` — full tree path
 * - `{ guid: "{…}" }` — Field Rules item id
 *
 * Bare strings are treated as `{ rule }` (used by constraint auto-create).
 * Emit always writes GUIDs on template multilists.
 */
export type DataFieldValidatorRef =
  | FieldRuleRef
  | DefinitionKeyRef
  | SitecorePathRef
  | SitecoreGuidRef
  | string;
export type DataFieldValidators = DataFieldValidatorRef[];

/** Declarative constraints; missing BQ rules are created on emit. */
export type DataFieldConstraints = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  /** Integer range lower bound (use with `max`). */
  min?: number;
  /** Integer range upper bound (use with `min`). */
  max?: number;
  /** Regex pattern (RegexValidator). */
  pattern?: string;
  /** RegexValidator `Text=` message (may include `{0}` for field name). */
  patternMessage?: string;
  /** Item name under BQ when creating from `pattern` (default: derived). */
  patternName?: string;
};

export type FieldValidatorRuleKind =
  | { type: "required" }
  | { type: "minLength"; minLength: number }
  | { type: "maxLength"; maxLength: number }
  | { type: "integerRange"; min: number; max: number }
  | { type: "regex"; pattern: string; text?: string }
  | { type: "custom"; typeName: string; parameters?: string };

/**
 * Flat v1 rule fields at definition root (mutually exclusive with `versions` at runtime).
 * All rule keys are optional here so `satisfies FieldValidatorDefinition` works with
 * discriminated rule shapes; emit validates required fields per `type`.
 */
export type FieldValidatorRuleShorthand = {
  title?: string;
  description?: string;
  type?: FieldValidatorRuleKind["type"];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  text?: string;
  typeName?: string;
  parameters?: string;
};

/**
 * One Sitecore numbered version of a Field Rules validator (English source).
 * Title / Description are versioned; Type / Parameters are shared.
 */
export type FieldValidatorVersionDef = {
  version: number;
  title?: string;
  description?: string;
} & FieldValidatorRuleKind;

/**
 * Constraint auto-create payload (emitted as a single Version 1 item).
 * Prefer `FieldValidatorVersionDef` in `kind: "field-validator"` definitions.
 */
export type FieldValidatorRuleSpec = {
  name: string;
  title?: string;
  description?: string;
} & FieldValidatorRuleKind;

type MaterializedRule = {
  typeAssembly: string;
  parameters: string;
  title: string;
  description: string;
};

/**
 * `definitionKey` (lowercase) → Field Rules relative paths emitted for that definition.
 * Populated when emitting `kind: "field-validator"` definitions.
 */
let definitionKeyRegistry: Map<string, string[]> | undefined;

/** Clear definitionKey → path mappings (call at the start of each generate run). */
export function clearValidatorSaiHandleRegistry(): void {
  definitionKeyRegistry = undefined;
}

/**
 * Record that a field-validator `definitionKey` maps to one or more Field Rules paths.
 * Called when emitting `kind: "field-validator"` definitions.
 */
export function registerValidatorDefinitionKey(
  definitionKey: string,
  relPaths: string[],
): void {
  const key = definitionKey.trim().toLowerCase();
  if (!key) {
    throw new Error("Validator definitionKey must be non-empty");
  }
  if (!definitionKeyRegistry) definitionKeyRegistry = new Map();
  definitionKeyRegistry.set(
    key,
    relPaths.map((p) => normalizeRuleKey(p)).filter(Boolean),
  );
}

/** @deprecated Use {@link registerValidatorDefinitionKey}. */
export function registerValidatorSaiHandle(
  handleOrKey: string,
  relPaths: string[],
): void {
  // Accept legacy `key@N` by registering under the key prefix as well.
  const trimmed = handleOrKey.trim();
  const at = trimmed.lastIndexOf("@");
  const definitionKey =
    at > 0 ? trimmed.slice(0, at) : trimmed;
  registerValidatorDefinitionKey(definitionKey, relPaths);
}

/**
 * Resolve a validator ref to one or more Field Rules GUIDs.
 */
export async function resolveValidatorRefs(
  ref: DataFieldValidatorRef,
): Promise<string[]> {
  if (isDefinitionKeyRef(ref)) {
    const key = definitionKeyFromRef(ref);
    const paths = definitionKeyRegistry?.get(key.toLowerCase());
    if (!paths?.length) {
      throw new Error(
        `Unknown field-validator definitionKey "${key}". Ensure a kind: "field-validator" definition with that key is emitted before this field.`,
      );
    }
    const ids: string[] = [];
    for (const p of paths) ids.push(await resolveFieldRuleId(p));
    return ids;
  }

  if (isFieldRuleRef(ref)) {
    return [await resolveFieldRuleId(fieldRuleFromRef(ref))];
  }

  if (isSitecoreGuidRef(ref)) {
    return [sitecoreGuidFromRef(ref)];
  }

  if (isSitecorePathRef(ref)) {
    const sitecorePath = sitecorePathFromRef(ref);
    const asRule = normalizeRuleKey(sitecorePath);
    // Full tree paths under Field Rules → same index as `{ rule }`
    if (
      /\/Validation Rules\/Field Rules\//i.test(sitecorePath) ||
      asRule.toLowerCase() !== sitecorePath.replace(/^\/+/, "").toLowerCase()
    ) {
      return [await resolveFieldRuleId(asRule)];
    }
    const resolved = await resolveItemIdByPath({
      sitecorePath,
      logPrefix: "[bq:apply:field-validators]",
    });
    if (!resolved.found) {
      throw new Error(
        `Unknown field validator path "${sitecorePath}" (not found on CM).`,
      );
    }
    return [resolved.id];
  }

  if (typeof ref === "string") {
    const trimmed = ref.trim();
    if (!trimmed) {
      throw new Error("Field validator ref must be non-empty");
    }
    // Bare string = Field Rules–relative rule name (constraint helpers, legacy).
    return [await resolveFieldRuleId(trimmed)];
  }

  throw new Error(
    `Invalid field validator ref (expected { rule } | { definitionKey } | { path } | { guid })`,
  );
}

function normalizeRuleKey(rule: string): string {
  return rule
    .trim()
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(
      /^sitecore\/system\/Settings\/Validation Rules\/Field Rules\//i,
      "",
    )
    .replace(/^Field Rules\//i, "");
}

function isGuid(value: string): boolean {
  return /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(
    value.trim(),
  );
}

/**
 * Resolve a Field Rules path or GUID to an item GUID via CM path lookup
 * (in-run path cache first). Paths are relative to {@link FIELD_RULES_SITECORE_ROOT}.
 * For BQ-owned validators use `{ definitionKey }` with {@link resolveValidatorRefs}.
 */
export async function resolveFieldRuleId(rule: string): Promise<string> {
  const trimmed = rule.trim();
  if (!trimmed) {
    throw new Error("Field validator rule path must be non-empty");
  }
  if (isGuid(trimmed)) {
    return trimmed.replace(/[{}]/g, "").toLowerCase();
  }

  const key = normalizeRuleKey(trimmed);
  const sitecorePath = `${FIELD_RULES_SITECORE_ROOT}/${key}`;
  const resolved = await resolveItemIdByPath({
    sitecorePath,
    logPrefix: "[bq:apply:field-validators]",
  });
  if (!resolved.found) {
    throw new Error(
      `Unknown field validator "${rule}". Expected a Field Rules path under ${FIELD_RULES_SITECORE_ROOT} (looked up ${sitecorePath} on CM). For BQ-owned rules use { definitionKey: "…" } instead of a display path.`,
    );
  }
  return resolved.id;
}

async function tryResolveFieldRuleId(rule: string): Promise<string | undefined> {
  try {
    return await resolveFieldRuleId(rule);
  } catch {
    return undefined;
  }
}
function encodeRegexParameters(pattern: string, text?: string): string {
  const message =
    text?.trim() || 'Field "{0}" does not match the required format.';
  // Sitecore stores Pattern=…&Text=… (ampersand-separated).
  return `Pattern=${pattern}&Text=${message}`;
}

function materializeRuleSpec(
  spec: FieldValidatorVersionDef | FieldValidatorRuleSpec,
): MaterializedRule {
  switch (spec.type) {
    case "required":
      return {
        typeAssembly: KERNEL.required,
        parameters: "",
        title: spec.title ?? "Is required",
        description: spec.description ?? "This field is required.",
      };
    case "minLength":
      return {
        typeAssembly: KERNEL.minLength,
        parameters: `minlength=${spec.minLength}`,
        title: spec.title ?? `Has minimum length of ${spec.minLength}`,
        description:
          spec.description ??
          `The field must have a minimum length of ${spec.minLength} characters.`,
      };
    case "maxLength":
      return {
        typeAssembly: KERNEL.maxLength,
        parameters: `MaxLength=${spec.maxLength}`,
        title: spec.title ?? `Has maximum length of ${spec.maxLength}`,
        description:
          spec.description ??
          `Field must contain maximum ${spec.maxLength} characters.`,
      };
    case "integerRange":
      return {
        typeAssembly: KERNEL.integerRange,
        parameters: `Min=${spec.min}&Max=${spec.max}`,
        title: spec.title ?? `Has value between ${spec.min} and ${spec.max}`,
        description:
          spec.description ??
          `The field must have a value between ${spec.min} and ${spec.max}.`,
      };
    case "regex":
      return {
        typeAssembly: KERNEL.regex,
        parameters: encodeRegexParameters(spec.pattern, spec.text),
        title: spec.title ?? "Matches pattern",
        description:
          spec.description ?? "Field must match the configured pattern.",
      };
    case "custom":
      return {
        typeAssembly: spec.typeName,
        parameters: spec.parameters ?? "",
        title: spec.title ?? "Custom validator",
        description: spec.description ?? "",
      };
    default: {
      const _exhaustive: never = spec;
      throw new Error(`Unsupported validator type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function ruleSitecorePath(folder: string, name: string): string {
  return `${FIELD_RULES_SITECORE_ROOT}/${folder}/${name}`;
}

function ruleRelPath(folder: string, name: string): string {
  return `${folder}/${name}`;
}

/**
 * Ensure a folder under Field Rules (e.g. BQ) exists as an SCS folder item.
 */
export async function ensureValidatorFolder(
  folder: string,
  handle: string,
): Promise<{ id: string; stats: ScsWriteStats }> {
  const name = folder.trim() || DEFAULT_VALIDATOR_FOLDER;
  void handle;

  const stats = emptyWriteStats();
  const applied = await applyAuthoringItem({
    parent: FIELD_RULES_FOLDER_ID,
    template: BASE_FOLDER_TEMPLATE,
    path: `${FIELD_RULES_SITECORE_ROOT}/${name}`,
  });
  recordWrite(stats, applied);
  return { id: applied.itemId, stats };
}

/**
 * Write (or update) a Field Rules validator item under `folder`.
 * One Sitecore item; Type/Parameters are shared; Title/Description are versioned
 * (and translated when `cultures` is set).
 * Returns relative path for use in `validators: ["BQ/…"]`.
 */
export async function ensureFieldRule(options: {
  folder: string;
  name: string;
  handle: string;
  cultures?: string[];
  culture?: string;
  versions: FieldValidatorVersionDef[];
}): Promise<{ relPath: string; id: string; stats: ScsWriteStats }> {
  const folderName = proposeValidItemName(
    options.folder.trim() || DEFAULT_VALIDATOR_FOLDER,
    DEFAULT_VALIDATOR_FOLDER,
  );
  const rawName = options.name.trim();
  if (!rawName) {
    throw new Error("Field Rules validator name must be non-empty");
  }
  const itemName = proposeValidItemName(rawName);
  if (!options.versions?.length) {
    throw new Error(
      `Field Rules validator "${itemName}" must declare versions: [{ version, … }]`,
    );
  }

  const seen = new Set<number>();
  for (const ver of options.versions) {
    if (!Number.isInteger(ver.version) || ver.version < 1) {
      throw new Error(
        `Field Rules validator "${itemName}" has invalid version ${ver.version}`,
      );
    }
    if (seen.has(ver.version)) {
      throw new Error(
        `Field Rules validator "${itemName}" repeats version ${ver.version}`,
      );
    }
    seen.add(ver.version);
  }

  let stats = emptyWriteStats();
  const { sourceCulture: src, emitCultures } = resolveContentLanguages({
    culture: options.culture || "en",
    cultures: options.cultures ?? [],
  });
  if (emitCultures.length > 1 || !normalizeCultureKey(src).toLowerCase().startsWith("en")) {
    stats = mergeWriteStats(stats, await ensureSystemLanguages(emitCultures));
  }

  const folderResult = await ensureValidatorFolder(folderName, options.handle);
  stats = mergeWriteStats(stats, folderResult.stats);

  // Shared Type / Parameters — last version wins
  let typeAssembly = "";
  let parameters = "";
  const sourceVersions: Array<{
    version: number;
    title: string;
    description: string;
  }> = [];

  for (const ver of options.versions) {
    const materialized = materializeRuleSpec(ver);
    typeAssembly = materialized.typeAssembly;
    parameters = materialized.parameters;
    sourceVersions.push({
      version: ver.version,
      title: materialized.title,
      description: materialized.description,
    });
  }

  const sharedFields: ScsField[] = [
    {
      id: VALIDATOR_FIELD_IDS.Type,
      hint: "Type",
      value: typeAssembly,
    },
  ];
  if (parameters) {
    sharedFields.push({
      id: VALIDATOR_FIELD_IDS.Parameters,
      hint: "Parameters",
      value: parameters,
      multiline: parameters.includes("\n") || parameters.length > 80,
    });
  }

  function versionFieldsFor(title: string, description: string): ScsField[] {
    const fields: ScsField[] = [
      {
        id: VALIDATOR_FIELD_IDS.Title,
        hint: "Title",
        value: title,
      },
    ];
    if (description) {
      fields.push({
        id: VALIDATOR_FIELD_IDS.Description,
        hint: "Description",
        value: description,
      });
    }
    return fields;
  }

  const srcKey = normalizeCultureKey(src).toLowerCase();
  const languages: ScsLanguageBlock[] = [];
  for (const lang of emitCultures) {
    const isSource = normalizeCultureKey(lang).toLowerCase() === srcKey;
    const cultureVersions: NonNullable<ScsLanguageBlock["versions"]> = [];
    for (const srcVer of sourceVersions) {
      const title = isSource
        ? srcVer.title
        : await translateText(srcVer.title, lang, src);
      const description = !srcVer.description
        ? ""
        : isSource
          ? srcVer.description
          : await translateText(srcVer.description, lang, src);
      cultureVersions.push({
        version: srcVer.version,
        versionFields: versionFieldsFor(title, description),
      });
    }
    languages.push({ language: lang, versions: cultureVersions });
  }

  const writeStats = emptyWriteStats();
  const ruleApplied = await applyAuthoringItem({
    parent: folderResult.id,
    template: FIELD_RULE_VALIDATOR_TEMPLATE,
    path: ruleSitecorePath(folderName, itemName),
    sharedFields,
    languages,
  });
  recordWrite(writeStats, ruleApplied);

  return {
    relPath: ruleRelPath(folderName, itemName),
    id: ruleApplied.itemId,
    stats: mergeWriteStats(stats, writeStats),
  };
}

function shortPatternSlug(pattern: string): string {
  // Stable short token for unnamed regex rules
  let hash = 0;
  for (let i = 0; i < pattern.length; i++) {
    hash = (hash * 31 + pattern.charCodeAt(i)) | 0;
  }
  return `Pattern ${Math.abs(hash).toString(16).slice(0, 8)}`;
}

/**
 * Expand data-field constraints into Field Rules paths, creating BQ items when needed.
 * Stock `Required` is referenced, never recreated.
 */
export async function ensureConstraintValidators(
  constraints: DataFieldConstraints,
  handle: string,
): Promise<{ refs: string[]; stats: ScsWriteStats }> {
  let stats = emptyWriteStats();
  const refs: string[] = [];

  if (constraints.required) {
    refs.push("Required");
  }

  if (constraints.minLength != null) {
    const name = `Minimum Length ${constraints.minLength}`;
    const existing = await tryResolveFieldRuleId(`BQ/${name}`);
    if (existing) {
      refs.push(`BQ/${name}`);
    } else {
      const created = await ensureFieldRule({
        folder: DEFAULT_VALIDATOR_FOLDER,
        name,
        handle,
        versions: [
          {
            version: 1,
            type: "minLength",
            minLength: constraints.minLength,
          },
        ],
      });
      refs.push(created.relPath);
      stats = mergeWriteStats(stats, created.stats);
    }
  }

  if (constraints.maxLength != null) {
    const name = `Max Length ${constraints.maxLength}`;
    const existing = await tryResolveFieldRuleId(`BQ/${name}`);
    if (existing) {
      refs.push(`BQ/${name}`);
    } else {
      const created = await ensureFieldRule({
        folder: DEFAULT_VALIDATOR_FOLDER,
        name,
        handle,
        versions: [
          {
            version: 1,
            type: "maxLength",
            maxLength: constraints.maxLength,
          },
        ],
      });
      refs.push(created.relPath);
      stats = mergeWriteStats(stats, created.stats);
    }
  }

  if (constraints.min != null && constraints.max != null) {
    const name = `Integer Range ${constraints.min} to ${constraints.max}`;
    const existing = await tryResolveFieldRuleId(`BQ/${name}`);
    if (existing) {
      refs.push(`BQ/${name}`);
    } else {
      const created = await ensureFieldRule({
        folder: DEFAULT_VALIDATOR_FOLDER,
        name,
        handle,
        versions: [
          {
            version: 1,
            type: "integerRange",
            min: constraints.min,
            max: constraints.max,
          },
        ],
      });
      refs.push(created.relPath);
      stats = mergeWriteStats(stats, created.stats);
    }
  } else if (constraints.min != null || constraints.max != null) {
    throw new Error(
      "Data field constraints.min and constraints.max must both be set for an integer range validator.",
    );
  }

  if (constraints.pattern) {
    const name =
      constraints.patternName?.trim() || shortPatternSlug(constraints.pattern);
    const existing = await tryResolveFieldRuleId(`BQ/${name}`);
    if (existing) {
      refs.push(`BQ/${name}`);
    } else {
      const created = await ensureFieldRule({
        folder: DEFAULT_VALIDATOR_FOLDER,
        name,
        handle,
        versions: [
          {
            version: 1,
            type: "regex",
            pattern: constraints.pattern,
            text: constraints.patternMessage,
            title: constraints.patternName
              ? `Matches ${constraints.patternName}`
              : undefined,
            description: constraints.patternMessage,
          },
        ],
      });
      refs.push(created.relPath);
      stats = mergeWriteStats(stats, created.stats);
    }
  }

  return { refs, stats };
}

/**
 * Merge explicit `validators` + `constraints` into unique Field Rules paths,
 * creating any missing constraint-backed BQ rules.
 */
export async function resolveDataFieldValidators(
  field: {
    validators?: DataFieldValidators;
    constraints?: DataFieldConstraints;
  },
  handle: string,
): Promise<{ refs: DataFieldValidators; stats: ScsWriteStats }> {
  let stats = emptyWriteStats();
  const refs: DataFieldValidatorRef[] = [];

  if (field.constraints) {
    const ensured = await ensureConstraintValidators(field.constraints, handle);
    refs.push(...ensured.refs);
    stats = mergeWriteStats(stats, ensured.stats);
  }
  if (field.validators?.length) {
    refs.push(...field.validators);
  }

  const seen = new Set<string>();
  const unique: DataFieldValidatorRef[] = [];
  for (const ref of refs) {
    // Expand definitionKey / paths now so missing refs fail during data emit
    const ids = await resolveValidatorRefs(ref);
    const already = ids.every((id) => seen.has(id));
    for (const id of ids) seen.add(id);
    if (!already) unique.push(ref);
  }
  return { refs: unique, stats };
}

/**
 * Emit Validation Rules multilist SharedFields for a template field definition.
 * Always writes Validate Button, Quick Action Bar, and Validator Bar.
 * Multiple rules → `|`-separated multilist on all three validator slots.
 * Refs may be stock paths or `{ definitionKey }` for field-validator definitions.
 */
export async function collectFieldValidatorSharedFields(
  validators: DataFieldValidators | undefined,
): Promise<ScsField[]> {
  if (!validators?.length) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const ref of validators) {
    for (const id of await resolveValidatorRefs(ref)) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }

  const formatted = formatMultilistItems(ids.map((id) => braceGuid(id)));

  return FIELD_VALIDATOR_SLOTS.map((slot) => ({
    id: slot.id,
    hint: slot.hint,
    value: formatted.value,
    ...(formatted.multiline ? { multiline: true } : {}),
  }));
}
