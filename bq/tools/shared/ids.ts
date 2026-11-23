import { createHash } from "node:crypto";

/**
 * Canonical item ID: 32-char lowercase hex, no dashes, no braces.
 * Use for maps, caches, preferId, and in-memory compares.
 * Convert at boundaries: {@link toScsYamlGuid} / {@link toAuthoringGuid}.
 */
export function canonicalItemId(id: string): string {
  const hex = String(id || "")
    .replace(/[{}-]/g, "")
    .trim()
    .toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return "";
  return hex;
}

/**
 * SCS YAML GUID form: lowercase dashed `8-4-4-4-12`.
 * Always use when writing `ID:` / `Parent:` / `Template:` (and GUID field IDs).
 */
export function toScsYamlGuid(id: string): string {
  const hex = canonicalItemId(id);
  if (!hex) {
    // Preserve non-GUID strings (should not appear as item ids).
    return String(id || "")
      .replace(/[{}]/g, "")
      .trim()
      .toLowerCase();
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Authoring GraphQL mutate form: braced uppercase dashed GUID.
 */
export function toAuthoringGuid(id: string): string {
  const dashed = toScsYamlGuid(id);
  const hex = canonicalItemId(dashed);
  if (!hex) {
    throw new Error(`[ids] invalid item id for authoring: ${id}`);
  }
  return `{${dashed.toUpperCase()}}`;
}

/**
 * Deterministic GUID (canonical 32-hex) from namespace + key.
 * Same inputs always produce the same ID — required for definition→YAML stability.
 * Callers serializing SCS YAML must pass through {@link toScsYamlGuid}.
 */
export function stableGuid(namespace: string, name: string): string {
  const hash = createHash("sha1")
    .update(`bq:${namespace}:${name}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return bytes.toString("hex");
}

/** @deprecated Prefer {@link toAuthoringGuid} — braced uppercase dashed GUID. */
export function braceGuid(id: string): string {
  return toAuthoringGuid(id);
}
