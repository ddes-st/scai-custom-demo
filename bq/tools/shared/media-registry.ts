import type { MediaDefinition } from "../definitions/types";

let registry: Map<string, MediaDefinition> | undefined;

export function clearMediaDefinitionRegistry(): void {
  registry = undefined;
}

export function setMediaDefinitionRegistry(
  definitions: Iterable<MediaDefinition>,
): void {
  registry = new Map();
  for (const def of definitions) {
    registry.set(def.definitionKey, def);
  }
}

export function getMediaDefinition(
  definitionKey: string,
): MediaDefinition | undefined {
  return registry?.get(definitionKey);
}

export function requireMediaDefinition(
  definitionKey: string,
  label: string,
): MediaDefinition {
  const def = getMediaDefinition(definitionKey);
  if (!def) {
    throw new Error(
      `${label}: unknown media definitionKey "${definitionKey}" (no kind: "media" definition loaded)`,
    );
  }
  return def;
}
