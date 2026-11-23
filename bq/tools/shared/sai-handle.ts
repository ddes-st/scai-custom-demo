/**
 * SAI handle: stable namespace for GUID derivation and cross-definition refs.
 * Composed from author-facing `definitionKey` + a `versions[].version` at emit time.
 *
 * @example toSaiHandle("authors", 1) → `"authors@1"`
 */
export function toSaiHandle(
  definitionKey: string,
  version: string | number,
): string {
  const key = definitionKey.trim();
  const ver = String(version).trim();
  if (!key) {
    throw new Error("definitionKey must be non-empty");
  }
  if (!ver) {
    throw new Error("version must be non-empty");
  }
  return `${key}@${ver}`;
}

export type DefinitionKeyed = {
  definitionKey: string;
};

/** Compose SAI handle from definition key + Sitecore/definition version number. */
export function saiHandleFrom(
  definitionKey: string,
  version: string | number,
): string {
  return toSaiHandle(definitionKey, version);
}

export function minVersionNumber(
  versions: readonly { version: number }[],
): number {
  if (!versions?.length) {
    throw new Error("versions must be a non-empty array");
  }
  let min = versions[0]!.version;
  for (const v of versions) {
    if (!Number.isInteger(v.version) || v.version < 1) {
      throw new Error(`Invalid version number: ${v.version}`);
    }
    if (v.version < min) min = v.version;
  }
  return min;
}

/** SAI handle using the lowest version in the array (stable item GUIDs). */
export function primarySaiHandle(
  definitionKey: string,
  versions: readonly { version: number }[],
): string {
  return toSaiHandle(definitionKey, minVersionNumber(versions));
}
