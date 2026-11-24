import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AFFINITY_MAX_ENTRIES,
  AFFINITY_MAX_SCORE,
  bumpAffinity,
  topAffinity,
} from './affinity';

describe('affinity scores', () => {
  it('adds click and detail weights and caps the score', () => {
    let scores = bumpAffinity({}, 'tapkey', 'DOM Tapkey', 1);
    scores = bumpAffinity(scores, 'tapkey', 'DOM Tapkey', 3);
    assert.equal(scores.tapkey.score, 4);
    scores = bumpAffinity(scores, 'tapkey', 'DOM Tapkey', AFFINITY_MAX_SCORE);
    assert.equal(scores.tapkey.score, AFFINITY_MAX_SCORE);
  });

  it('keeps the highest scores when the map exceeds the entry cap', () => {
    let scores = {};
    for (let index = 0; index < AFFINITY_MAX_ENTRIES + 3; index += 1) {
      scores = bumpAffinity(scores, `item-${index}`, `Item ${index}`, index + 1);
    }
    assert.equal(Object.keys(scores).length, AFFINITY_MAX_ENTRIES);
    assert.equal(topAffinity(scores)?.id, `item-${AFFINITY_MAX_ENTRIES + 2}`);
  });
});
