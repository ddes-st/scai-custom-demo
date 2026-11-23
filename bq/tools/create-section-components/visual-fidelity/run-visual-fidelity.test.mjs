import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  shouldRepairAfterVisualScore,
  visualFidelityMaxScoreRounds,
} from './run-visual-fidelity.mjs';

describe('visualFidelityMaxScoreRounds', () => {
  it('is repair budget + 1 (initial score + one re-score per repair)', () => {
    assert.equal(visualFidelityMaxScoreRounds(0), 0);
    assert.equal(visualFidelityMaxScoreRounds(1), 2);
    assert.equal(visualFidelityMaxScoreRounds(2), 3);
    assert.equal(visualFidelityMaxScoreRounds(3), 4);
  });
});

describe('shouldRepairAfterVisualScore', () => {
  it('maxIters=1: repair after failing before score, not after after-1', () => {
    assert.equal(
      shouldRepairAfterVisualScore({
        scoreRound: 1,
        maxIters: 1,
        passed: false,
      }),
      true,
      'failing before → one repair',
    );
    assert.equal(
      shouldRepairAfterVisualScore({
        scoreRound: 2,
        maxIters: 1,
        passed: false,
      }),
      false,
      'after one repair re-score → stop',
    );
  });

  it('maxIters=2: up to two repairs', () => {
    assert.equal(
      shouldRepairAfterVisualScore({ scoreRound: 1, maxIters: 2, passed: false }),
      true,
    );
    assert.equal(
      shouldRepairAfterVisualScore({ scoreRound: 2, maxIters: 2, passed: false }),
      true,
    );
    assert.equal(
      shouldRepairAfterVisualScore({ scoreRound: 3, maxIters: 2, passed: false }),
      false,
    );
  });

  it('does not repair when passed, dryRun, or maxIters=0', () => {
    assert.equal(
      shouldRepairAfterVisualScore({ scoreRound: 1, maxIters: 1, passed: true }),
      false,
    );
    assert.equal(
      shouldRepairAfterVisualScore({
        scoreRound: 1,
        maxIters: 1,
        passed: false,
        dryRun: true,
      }),
      false,
    );
    assert.equal(
      shouldRepairAfterVisualScore({ scoreRound: 1, maxIters: 0, passed: false }),
      false,
    );
  });
});
