import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { layoutCritiqueMaxIters, shouldSkipLayoutCritique } from './layout-critique.mjs';

const ENV_KEYS = ['BQ_SOURCE_FIDELITY_MAX_ITERS', 'BQ_SOURCE_FIDELITY'];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('source fidelity MAX_ITERS=0 gate', () => {
  it('force-skips even when source-fidelity enabled', () => {
    process.env.BQ_SOURCE_FIDELITY = '1';
    process.env.BQ_SOURCE_FIDELITY_MAX_ITERS = '0';
    assert.equal(layoutCritiqueMaxIters(), 0);
    assert.equal(shouldSkipLayoutCritique(), true);
  });

  it('runs when enabled and max iters > 0', () => {
    process.env.BQ_SOURCE_FIDELITY = 'true';
    process.env.BQ_SOURCE_FIDELITY_MAX_ITERS = '2';
    assert.equal(layoutCritiqueMaxIters(), 2);
    assert.equal(shouldSkipLayoutCritique(), false);
  });

  it('treats false/0 as off', () => {
    process.env.BQ_SOURCE_FIDELITY = 'false';
    assert.equal(shouldSkipLayoutCritique(), true);
    process.env.BQ_SOURCE_FIDELITY = '0';
    assert.equal(shouldSkipLayoutCritique(), true);
  });
});
