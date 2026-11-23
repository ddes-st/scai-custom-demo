import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  envFlagOn,
  fidelityMaxItersForMode,
  fidelityMaxItersSkipMessage,
  fidelityMinScoreForMode,
  isFidelityModeEnabled,
  isVisualCaptureOnlyEnvEnabled,
  parseEnvBool,
  resolveFidelityMaxIters,
} from './fidelity-iters.mjs';

const ENV_KEYS = [
  'BQ_SOURCE_FIDELITY_MAX_ITERS',
  'BQ_VISUAL_FIDELITY_MAX_ITERS',
  'BQ_SOURCE_FIDELITY_MIN_SCORE',
  'BQ_VISUAL_FIDELITY_MIN_SCORE',
  'BQ_VISUAL_CAPTURE_ONLY',
];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('resolveFidelityMaxIters', () => {
  it('defaults to 3 when unset', () => {
    assert.equal(resolveFidelityMaxIters('BQ_SOURCE_FIDELITY_MAX_ITERS'), 3);
  });

  it('clamps to 0–3 and treats 0 as force-off', () => {
    process.env.BQ_SOURCE_FIDELITY_MAX_ITERS = '0';
    assert.equal(resolveFidelityMaxIters('BQ_SOURCE_FIDELITY_MAX_ITERS'), 0);
    process.env.BQ_SOURCE_FIDELITY_MAX_ITERS = '9';
    assert.equal(resolveFidelityMaxIters('BQ_SOURCE_FIDELITY_MAX_ITERS'), 3);
    process.env.BQ_SOURCE_FIDELITY_MAX_ITERS = '-2';
    assert.equal(resolveFidelityMaxIters('BQ_SOURCE_FIDELITY_MAX_ITERS'), 0);
  });

  it('falls back to default on non-finite', () => {
    process.env.BQ_VISUAL_FIDELITY_MAX_ITERS = 'nope';
    assert.equal(resolveFidelityMaxIters('BQ_VISUAL_FIDELITY_MAX_ITERS'), 3);
  });
});

describe('parseEnvBool', () => {
  it('accepts true/false, 1/0, yes/no', () => {
    assert.equal(parseEnvBool('true'), true);
    assert.equal(parseEnvBool('TRUE'), true);
    assert.equal(parseEnvBool('1'), true);
    assert.equal(parseEnvBool('yes'), true);
    assert.equal(parseEnvBool('false'), false);
    assert.equal(parseEnvBool('FALSE'), false);
    assert.equal(parseEnvBool('0'), false);
    assert.equal(parseEnvBool('no'), false);
    assert.equal(parseEnvBool(''), null);
    assert.equal(parseEnvBool(undefined), null);
    assert.equal(parseEnvBool('maybe'), null);
    assert.equal(envFlagOn('true'), true);
    assert.equal(envFlagOn('false'), false);
    assert.equal(envFlagOn('0'), false);
  });
});

describe('isFidelityModeEnabled', () => {
  it('MAX_ITERS=0 wins over CLI/enable', () => {
    assert.equal(
      isFidelityModeEnabled({ maxIters: 0, cliOrEnvEnable: true, skip: false }),
      false,
    );
    assert.equal(
      isFidelityModeEnabled({ maxIters: 3, cliOrEnvEnable: true, skip: false }),
      true,
    );
    assert.equal(
      isFidelityModeEnabled({ maxIters: 3, cliOrEnvEnable: true, skip: true }),
      false,
    );
  });
});

describe('fidelityMaxItersForMode', () => {
  it('reads visual and source envs independently', () => {
    process.env.BQ_VISUAL_FIDELITY_MAX_ITERS = '0';
    process.env.BQ_SOURCE_FIDELITY_MAX_ITERS = '2';
    assert.equal(fidelityMaxItersForMode('visual'), 0);
    assert.equal(fidelityMaxItersForMode('source'), 2);
    assert.match(fidelityMaxItersSkipMessage('visual'), /BQ_VISUAL_FIDELITY_MAX_ITERS=0/);
    assert.match(fidelityMaxItersSkipMessage('source'), /BQ_SOURCE_FIDELITY_MAX_ITERS=0/);
  });

  it('defaults source max iters to 3 when unset', () => {
    assert.equal(fidelityMaxItersForMode('source'), 3);
  });
});

describe('fidelityMinScoreForMode', () => {
  it('defaults source 90 / visual 95; CLI override wins', () => {
    assert.equal(fidelityMinScoreForMode('source'), 90);
    assert.equal(fidelityMinScoreForMode('visual'), 95);
    assert.equal(fidelityMinScoreForMode('source', 85), 85);
    process.env.BQ_VISUAL_FIDELITY_MIN_SCORE = '92';
    assert.equal(fidelityMinScoreForMode('visual'), 92);
  });
});

describe('isVisualCaptureOnlyEnvEnabled', () => {
  it('defaults on when unset; false/0/no disables; true enables', () => {
    assert.equal(isVisualCaptureOnlyEnvEnabled({}), true);
    assert.equal(isVisualCaptureOnlyEnvEnabled({ BQ_VISUAL_CAPTURE_ONLY: '' }), true);
    assert.equal(isVisualCaptureOnlyEnvEnabled({ BQ_VISUAL_CAPTURE_ONLY: 'true' }), true);
    assert.equal(isVisualCaptureOnlyEnvEnabled({ BQ_VISUAL_CAPTURE_ONLY: '1' }), true);
    assert.equal(isVisualCaptureOnlyEnvEnabled({ BQ_VISUAL_CAPTURE_ONLY: 'false' }), false);
    assert.equal(isVisualCaptureOnlyEnvEnabled({ BQ_VISUAL_CAPTURE_ONLY: '0' }), false);
    assert.equal(isVisualCaptureOnlyEnvEnabled({ BQ_VISUAL_CAPTURE_ONLY: 'no' }), false);
  });
});
