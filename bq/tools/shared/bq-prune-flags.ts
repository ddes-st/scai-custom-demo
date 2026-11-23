/**
 * Kill-switch for definitions:generate pruning (orphan YAML, empty dirs,
 * unresolvable-template BQ YAML, Sites API orphans, partial-design Data orphans).
 *
 * Set BQ_SKIP_PRUNE=1 or true to skip all of those. Unset = normal prune behavior.
 */
export function isBqPruneSkipped(): boolean {
  const v = String(process.env.BQ_SKIP_PRUNE || "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true";
}
