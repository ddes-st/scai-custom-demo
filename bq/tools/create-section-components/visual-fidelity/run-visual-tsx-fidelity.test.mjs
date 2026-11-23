/**
 * Gates for pre-sitecoreize visual TSX fidelity (no Playwright / Azure).
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { runVisualTsxFidelityLoop } from './run-visual-tsx-fidelity.mjs';

const ENV_KEYS = [
  'BQ_VISUAL_FIDELITY',
  'BQ_VISUAL_FIDELITY_MAX_ITERS',
  'BQ_VISUAL_FIDELITY_MIN_SCORE',
];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('runVisualTsxFidelityLoop gates', () => {
  it('returns early when MAX_ITERS=0 without changing TSX', async () => {
    process.env.BQ_VISUAL_FIDELITY = 'true';
    process.env.BQ_VISUAL_FIDELITY_MAX_ITERS = '0';
    const visualTsx = 'export default function X(){return <div/>}\n';
    const result = await runVisualTsxFidelityLoop({
      pageDir: '/tmp/page',
      sectionFolder: 'section-04',
      componentName: 'LocalServicesAndNavigation',
      visualTsx,
    });
    assert.equal(result.applied, false);
    assert.equal(result.iterations, 0);
    assert.equal(result.visualTsx, visualTsx);
    assert.match(result.notes, /MAX_ITERS=0/);
  });

  it('returns early when BQ_VISUAL_FIDELITY is off', async () => {
    process.env.BQ_VISUAL_FIDELITY = 'false';
    process.env.BQ_VISUAL_FIDELITY_MAX_ITERS = '2';
    const visualTsx = 'export default function Y(){return <section/>}\n';
    const result = await runVisualTsxFidelityLoop({
      pageDir: '/tmp/page',
      sectionFolder: 'section-04',
      componentName: 'LocalServicesAndNavigation',
      visualTsx,
    });
    assert.equal(result.applied, false);
    assert.equal(result.pass, false);
    assert.equal(result.visualTsx, visualTsx);
    assert.match(result.notes, /skipped/);
  });
});
