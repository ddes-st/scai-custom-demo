import type { VariantsDefinition } from "../definitions/types";

let registry: Map<string, VariantsDefinition> | undefined;

export function clearVariantsDefinitionRegistry(): void {
  registry = undefined;
}

export function setVariantsDefinitionRegistry(
  definitions: Iterable<VariantsDefinition>,
): void {
  registry = new Map();
  for (const def of definitions) {
    registry.set(def.definitionKey, def);
  }
}

export function getVariantsDefinition(
  definitionKey: string,
): VariantsDefinition | undefined {
  return registry?.get(definitionKey);
}

export function requireVariantsDefinition(
  definitionKey: string,
  label: string,
): VariantsDefinition {
  const def = getVariantsDefinition(definitionKey);
  if (!def) {
    throw new Error(
      `${label}: unknown variants definitionKey "${definitionKey}" (no kind: "variants" definition loaded)`,
    );
  }
  return def;
}
