import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fidelityHistoryLabel,
  formatFidelityHistoryTrail,
  formatFidelityPercent,
  normalizeFidelityScore,
  pushFidelityHistory,
} from './fidelity-history.mjs';

describe('fidelity-history', () => {
  it('formats percentages with %', () => {
    assert.equal(formatFidelityPercent(72), '72%');
    assert.equal(formatFidelityPercent(95.4), '95%');
    assert.equal(formatFidelityPercent(null), 'n/a');
    assert.equal(normalizeFidelityScore(101), 100);
    assert.equal(normalizeFidelityScore(-3), 0);
  });

  it('labels before → after-N and builds a trail', () => {
    assert.equal(fidelityHistoryLabel(0), 'before');
    assert.equal(fidelityHistoryLabel(1), 'after-1');
    assert.equal(fidelityHistoryLabel(2), 'after-2');

    const history = [];
    pushFidelityHistory(history, { score: 72, pass: false });
    pushFidelityHistory(history, { score: 88, pass: false });
    pushFidelityHistory(history, { score: 96, pass: true });

    assert.equal(history[0].label, 'before');
    assert.equal(history[0].percent, '72%');
    assert.equal(history[1].label, 'after-1');
    assert.equal(history[2].label, 'after-2');
    assert.equal(
      formatFidelityHistoryTrail(history),
      'before=72% → after-1=88% → after-2=96%',
    );
  });
});
