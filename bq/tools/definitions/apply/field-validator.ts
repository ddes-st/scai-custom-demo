import { resolveFieldValidatorVersions } from "../../shared/normalize-versions";
import { primarySaiHandle } from "../../shared/sai-handle";
import {
  ensureFieldRule,
  DEFAULT_VALIDATOR_FOLDER,
  registerValidatorDefinitionKey,
} from "../../shared/field-validators";
import type { ScsWriteStats } from "../../shared/authoring-item-model";
import type { FieldValidatorDefinition } from "../types";

/**
 * Emit one Field Rules item under `/sitecore/system/Settings/Validation Rules/Field Rules/{folder}/{name}`.
 * Registers `definitionKey` → that path so data fields can use `{ definitionKey: "…" }`.
 */
export async function applyFieldValidatorDefinition(
  definition: FieldValidatorDefinition,
): Promise<ScsWriteStats> {
  const folder = definition.folder?.trim() || DEFAULT_VALIDATOR_FOLDER;
  const name = definition.name.trim();
  if (!name) {
    throw new Error(
      `field-validator definition "${definition.definitionKey}" must declare a non-empty name.`,
    );
  }

  const versions = resolveFieldValidatorVersions(definition);
  const handle = primarySaiHandle(definition.definitionKey, versions);
  const result = await ensureFieldRule({
    folder,
    name,
    handle,
    cultures: definition.cultures,
    culture: definition.culture,
    versions,
  });

  registerValidatorDefinitionKey(definition.definitionKey, [result.relPath]);
  return result.stats;
}
