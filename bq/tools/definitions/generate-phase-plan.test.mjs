/**
 * Regression: authoring generate must not emit dead ser-pull / YAML / ser-push
 * phase theater; scoped runs omit Sites API orphan prune silently.
 *
 * Run: node --test tools/definitions/generate-phase-plan.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEF_PHASE_TOTAL_BOOTSTRAP,
  DEF_PHASE_TOTAL_FULL,
  DEF_PHASE_TOTAL_NO_PRUNE,
  resolveGeneratePhasePlan,
} from './generate-phase-plan.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoTools = path.resolve(here, '..');

describe('resolveGeneratePhasePlan', () => {
  it('full unscoped includes Sites API orphan prune (5 phases)', () => {
    assert.deepEqual(
      resolveGeneratePhasePlan({
        bootstrapSitesOnly: false,
        scopeActive: false,
        skipSites: false,
        pruneSkipped: false,
      }),
      { total: DEF_PHASE_TOTAL_FULL, includeOrphanPrune: true },
    );
    assert.equal(DEF_PHASE_TOTAL_FULL, 5);
  });

  it('scoped generate omits orphan prune (4 phases, silent skip)', () => {
    assert.deepEqual(
      resolveGeneratePhasePlan({
        bootstrapSitesOnly: false,
        scopeActive: true,
        skipSites: false,
        pruneSkipped: false,
      }),
      { total: DEF_PHASE_TOTAL_NO_PRUNE, includeOrphanPrune: false },
    );
  });

  it('BQ_SKIP_PRUNE and --skipSites omit orphan prune without theater', () => {
    assert.equal(
      resolveGeneratePhasePlan({
        bootstrapSitesOnly: false,
        scopeActive: false,
        skipSites: false,
        pruneSkipped: true,
      }).includeOrphanPrune,
      false,
    );
    assert.equal(
      resolveGeneratePhasePlan({
        bootstrapSitesOnly: false,
        scopeActive: false,
        skipSites: true,
        pruneSkipped: false,
      }).includeOrphanPrune,
      false,
    );
  });

  it('bootstrap is init → discover → apply sites only', () => {
    assert.deepEqual(
      resolveGeneratePhasePlan({
        bootstrapSitesOnly: true,
        scopeActive: true,
        skipSites: false,
        pruneSkipped: false,
      }),
      { total: DEF_PHASE_TOTAL_BOOTSTRAP, includeOrphanPrune: false },
    );
    assert.equal(DEF_PHASE_TOTAL_BOOTSTRAP, 3);
  });
});

describe('generate.ts / create: no dead pull or orphan-skip theater', () => {
  it('generate.ts has no Ser pull / YAML prune / ser validate-push skip phases', async () => {
    const src = await readFile(path.join(here, 'generate.ts'), 'utf8');
    assert.doesNotMatch(src, /Ser pull \(start\)/);
    assert.doesNotMatch(src, /BQ orphan YAML prune/);
    assert.doesNotMatch(src, /Local serialization heal — skipped/);
    assert.doesNotMatch(src, /Ser validate — skipped/);
    assert.doesNotMatch(src, /Ser push — skipped/);
    assert.doesNotMatch(src, /orphan prune — skipped \(scoped/);
    assert.doesNotMatch(src, /logPhaseSkip\(/);
    assert.match(src, /phasePlan\.includeOrphanPrune/);
  });

  it('create run.mjs does not pass --skipPull', async () => {
    const src = await readFile(
      path.join(repoTools, 'create-section-components', 'run.mjs'),
      'utf8',
    );
    assert.doesNotMatch(src, /skipPull/);
    assert.doesNotMatch(src, /--skipPull/);
  });
});
