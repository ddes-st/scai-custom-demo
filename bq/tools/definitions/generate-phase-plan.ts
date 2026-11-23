/**
 * Authoring generate phase totals (Authoring-first: no ser pull / YAML / ser push theater).
 *
 * Full unscoped: init → discover → Sites API orphan prune → apply sites → apply rest
 * Scoped / BQ_SKIP_PRUNE / --skipSites: omit orphan prune (silent)
 * Bootstrap: init → discover → apply collections/sites
 */

export type GeneratePhasePlan = {
  total: number;
  includeOrphanPrune: boolean;
};

/** Full unscoped generate with Sites API orphan prune. */
export const DEF_PHASE_TOTAL_FULL = 5;
/** Scoped / BQ_SKIP_PRUNE / --skipSites: no orphan-prune phase. */
export const DEF_PHASE_TOTAL_NO_PRUNE = 4;
/** --bootstrapSitesOnly: init → discover → apply collections/sites. */
export const DEF_PHASE_TOTAL_BOOTSTRAP = 3;

export function resolveGeneratePhasePlan(opts: {
  bootstrapSitesOnly: boolean;
  scopeActive: boolean;
  skipSites: boolean;
  pruneSkipped: boolean;
}): GeneratePhasePlan {
  if (opts.bootstrapSitesOnly) {
    return { total: DEF_PHASE_TOTAL_BOOTSTRAP, includeOrphanPrune: false };
  }
  const includeOrphanPrune =
    !opts.pruneSkipped && !opts.scopeActive && !opts.skipSites;
  return {
    total: includeOrphanPrune ? DEF_PHASE_TOTAL_FULL : DEF_PHASE_TOTAL_NO_PRUNE,
    includeOrphanPrune,
  };
}
