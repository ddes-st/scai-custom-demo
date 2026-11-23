import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  VISUAL_FIDELITY_MAX_CHANGES,
  capVisualFidelityChanges,
} from './score-and-directives.mjs';

describe('capVisualFidelityChanges', () => {
  it('caps to top N directives', () => {
    const changes = Array.from({ length: 12 }, (_, i) => `MUST fix ${i}`);
    const capped = capVisualFidelityChanges(changes);
    assert.equal(capped.length, VISUAL_FIDELITY_MAX_CHANGES);
    assert.equal(capped[0], 'MUST fix 0');
    assert.equal(capped[4], 'MUST fix 4');
  });

  it('filters empty entries', () => {
    assert.deepEqual(capVisualFidelityChanges(['a', '', 'b', null, 'c', 'd', 'e', 'f']), [
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });
});
