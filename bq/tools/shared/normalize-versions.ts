import type {
  DataItemDef,
  DataItemVersionDef,
  DictionaryDefinition,
  DictionaryDefinitionVersionDef,
  DictionaryEntry,
  DictionaryEntryVersionDef,
  EnumerationConstant,
  EnumerationDefinition,
  EnumerationListVersionDef,
  EnumerationValueVersionDef,
  FieldValidatorDefinition,
  FieldValidatorVersionDef,
} from "../definitions/types";
import type {
  ComponentContentDefinition,
  ComponentContentVersionDef,
} from "../content/types";
import type { FieldValidatorRuleKind } from "./field-validators";

function assertExclusive(
  label: string,
  hasVersions: boolean,
  hasShorthand: boolean,
): void {
  if (hasVersions && hasShorthand) {
    throw new Error(`${label} must not declare both shorthand fields and versions[]`);
  }
}

/** Resolve data item versions — `fields` is shorthand for v1 only. */
export function resolveDataItemVersions(item: DataItemDef): DataItemVersionDef[] {
  const hasVersions = Boolean(item.versions?.length);
  const hasFields = item.fields !== undefined;
  assertExclusive(`data item "${item.name}"`, hasVersions, hasFields);

  if (hasVersions) return item.versions!;
  if (hasFields) return [{ version: 1, fields: item.fields }];
  throw new Error(
    `data item "${item.name}" must declare fields or versions: [{ version, fields }]`,
  );
}

/** Resolve dictionary entry versions — top-level `phrase` is shorthand for v1. */
export function resolveDictionaryEntryVersions(
  entry: DictionaryEntry,
): DictionaryEntryVersionDef[] {
  const label = `dictionary entry "${entry.key}"`;
  const hasVersions = Boolean(entry.versions?.length);
  const hasPhrase = entry.phrase !== undefined;
  assertExclusive(label, hasVersions, hasPhrase);

  if (hasVersions) return entry.versions!;
  if (hasPhrase) {
    return [
      {
        version: 1,
        phrase: entry.phrase!,
        description: entry.description,
        shortDescription: entry.shortDescription,
      },
    ];
  }
  throw new Error(`${label} must declare phrase or versions: [{ version, phrase }]`);
}

/** Resolve enum constant versions — top-level `displayName` is shorthand for v1. */
export function resolveEnumerationConstantVersions(
  constant: EnumerationConstant,
): EnumerationValueVersionDef[] {
  const label = `enumeration constant "${constant.name}"`;
  const hasVersions = Boolean(constant.versions?.length);
  const hasDisplayName = constant.displayName !== undefined;
  assertExclusive(label, hasVersions, hasDisplayName);

  if (hasVersions) return constant.versions!;
  if (hasDisplayName) {
    return [
      {
        version: 1,
        displayName: constant.displayName!,
        description: constant.description,
        shortDescription: constant.shortDescription,
      },
    ];
  }
  throw new Error(
    `${label} must declare displayName or versions: [{ version, displayName }]`,
  );
}

/** Resolve component content versions — top-level `items` is shorthand for v1. */
export function resolveComponentContentVersions(
  content: ComponentContentDefinition,
): ComponentContentVersionDef[] {
  const label = `component-content "${content.definitionKey}"`;
  const hasVersions = Boolean(content.versions?.length);
  const hasItems = content.items !== undefined;
  assertExclusive(label, hasVersions, hasItems);

  if (hasVersions) return content.versions!;
  if (hasItems) return [{ version: 1, items: content.items! }];
  throw new Error(`${label} must declare items or versions: [{ version, items }]`);
}

/** Resolve dictionary definition metadata — top-level `displayName` is shorthand for v1. */
export function resolveDictionaryDefinitionVersions(
  definition: Pick<
    DictionaryDefinition,
    "name" | "versions" | "displayName" | "description" | "shortDescription"
  >,
): DictionaryDefinitionVersionDef[] {
  const label = `dictionary "${definition.name}"`;
  const hasVersions = Boolean(definition.versions?.length);
  const hasDisplayName = definition.displayName !== undefined;
  assertExclusive(label, hasVersions, hasDisplayName);

  if (hasVersions) return definition.versions!;
  if (hasDisplayName) {
    return [
      {
        version: 1,
        displayName: definition.displayName!,
        description: definition.description,
        shortDescription: definition.shortDescription,
      },
    ];
  }
  throw new Error(
    `${label} must declare displayName or versions: [{ version, displayName }]`,
  );
}

/** Resolve enumeration list metadata — top-level `displayName` is shorthand for v1. */
export function resolveEnumerationListVersions(
  definition: Pick<
    EnumerationDefinition,
    | "name"
    | "versions"
    | "displayName"
    | "description"
    | "shortDescription"
    | "default"
  >,
): EnumerationListVersionDef[] {
  const label = `enumeration "${definition.name}"`;
  const hasVersions = Boolean(definition.versions?.length);
  const hasDisplayName = definition.displayName !== undefined;
  assertExclusive(label, hasVersions, hasDisplayName);

  if (hasVersions) return definition.versions!;
  if (hasDisplayName) {
    return [
      {
        version: 1,
        displayName: definition.displayName!,
        description: definition.description,
        shortDescription: definition.shortDescription,
        default: definition.default,
      },
    ];
  }
  throw new Error(
    `${label} must declare displayName or versions: [{ version, displayName }]`,
  );
}

const FIELD_VALIDATOR_VERSION_KEYS = [
  "type",
  "title",
  "description",
  "minLength",
  "maxLength",
  "min",
  "max",
  "pattern",
  "text",
  "typeName",
  "parameters",
] as const;

function hasFieldValidatorRule(
  definition: FieldValidatorDefinition,
): definition is FieldValidatorDefinition & FieldValidatorRuleKind {
  return definition.type !== undefined;
}

function pickFieldValidatorVersionPayload(
  definition: FieldValidatorDefinition & FieldValidatorRuleKind,
): Omit<FieldValidatorVersionDef, "version"> {
  const payload: Record<string, unknown> = {};
  for (const key of FIELD_VALIDATOR_VERSION_KEYS) {
    const value = definition[key as keyof typeof definition];
    if (value !== undefined) payload[key] = value;
  }
  return payload as Omit<FieldValidatorVersionDef, "version">;
}

/** Resolve field-validator versions — top-level rule fields are shorthand for v1. */
export function resolveFieldValidatorVersions(
  definition: FieldValidatorDefinition,
): FieldValidatorVersionDef[] {
  const label = `field-validator "${definition.definitionKey}"`;
  const hasVersions = Boolean(definition.versions?.length);
  const hasRule = hasFieldValidatorRule(definition);
  assertExclusive(label, hasVersions, hasRule);

  if (hasVersions) return definition.versions!;
  if (hasRule) {
    return [
      {
        version: 1,
        ...pickFieldValidatorVersionPayload(definition),
      } as FieldValidatorVersionDef,
    ];
  }
  throw new Error(
    `${label} must declare type (rule) or versions: [{ version, type, … }]`,
  );
}
