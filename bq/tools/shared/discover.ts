import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { COMPONENTS_ROOT } from "./paths";

function walk(dir: string, suffix: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, suffix, out);
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      out.push(full);
    }
  }
}

export function discoverFiles(suffix: string): string[] {
  const files: string[] = [];
  walk(COMPONENTS_ROOT, suffix, files);
  return files.sort();
}

export async function importDefaultExport<T>(filePath: string): Promise<T> {
  const mod = await import(pathToFileURL(filePath).href);
  if (mod.default === undefined) {
    throw new Error(`Missing default export: ${filePath}`);
  }
  return mod.default as T;
}

export async function importNamedOrDefault<T>(
  filePath: string,
  namedKeys: string[],
): Promise<T> {
  const mod = await import(pathToFileURL(filePath).href);
  for (const key of namedKeys) {
    if (mod[key] !== undefined) return mod[key] as T;
  }
  if (mod.default !== undefined) return mod.default as T;
  throw new Error(
    `Missing export (${namedKeys.join("|")}|default): ${filePath}`,
  );
}

type DefinitionLike = {
  kind: string;
  definitionKey: string;
};

function isDefinitionLike(value: unknown): value is DefinitionLike {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.kind === "string" &&
    typeof record.definitionKey === "string" &&
    record.kind.length > 0 &&
    record.definitionKey.length > 0
  );
}

/**
 * Load every Definition-shaped export from a `*.definition.ts` file
 * (named + default), deduped by `definitionKey`.
 *
 * Enables the hybrid pattern: co-locate `kind: "component"` with an extracted
 * `kind: "parameters"` (or data) export in the same file when sharing.
 */
export async function importAllDefinitions<T extends DefinitionLike>(
  filePath: string,
): Promise<T[]> {
  const mod = await import(pathToFileURL(filePath).href);
  const byKey = new Map<string, T>();
  for (const value of Object.values(mod)) {
    if (!isDefinitionLike(value)) continue;
    byKey.set(value.definitionKey, value as T);
  }
  if (byKey.size === 0) {
    throw new Error(
      `No Definition exports (kind + definitionKey) found: ${filePath}`,
    );
  }
  return [...byKey.values()];
}
