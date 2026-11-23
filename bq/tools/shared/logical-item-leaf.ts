/**
 * Canonical Sitecore item leaf names after path-collision orphan renames.
 * CM peers may be named `{name}-orphan-{id8}` so SCS can serialize unique paths.
 */

/** Matches `{name}-orphan-{8hex}` leaf suffix. */
export const ORPHAN_LEAF_SUFFIX_RE = /-orphan-[0-9a-f]{8}$/i;

/**
 * Strip a trailing `-orphan-{8hex}` suffix, if present.
 * `Data-orphan-4234a4d9` → `Data`; `Data` → `Data`.
 */
export function canonicalItemLeafName(name: string): string {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const stripped = raw.replace(ORPHAN_LEAF_SUFFIX_RE, "");
  return stripped || raw;
}

/** True when the leaf has an `-orphan-{8hex}` suffix. */
export function isOrphanLeafName(name: string): boolean {
  return ORPHAN_LEAF_SUFFIX_RE.test(String(name || "").trim());
}

/**
 * Whether `candidateLeaf` is the same logical item name as `desiredName`
 * (case-folded), treating orphan suffixes as the base name.
 */
export function logicalLeafEquals(
  candidateLeaf: string,
  desiredName: string,
): boolean {
  const want = canonicalItemLeafName(desiredName).toLowerCase();
  const got = canonicalItemLeafName(candidateLeaf).toLowerCase();
  return Boolean(want && got && want === got);
}
