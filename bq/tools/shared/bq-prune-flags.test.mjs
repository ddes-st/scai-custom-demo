/**
 * Run: node --import tsx --test tools/shared/bq-prune-flags.test.mjs
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isBqPruneSkipped } from './bq-prune-flags.ts';

const ENV = 'BQ_SKIP_PRUNE';
let prev;

afterEach(() => {
  if (prev === undefined) delete process.env[ENV];
  else process.env[ENV] = prev;
  prev = undefined;
});

function setEnv(value) {
  prev = process.env[ENV];
  if (value === undefined) delete process.env[ENV];
  else process.env[ENV] = value;
}

describe('isBqPruneSkipped', () => {
  it('is false when unset', () => {
    setEnv(undefined);
    assert.equal(isBqPruneSkipped(), false);
  });

  it('is true for 1 and true (case-insensitive)', () => {
    setEnv('1');
    assert.equal(isBqPruneSkipped(), true);
    setEnv('true');
    assert.equal(isBqPruneSkipped(), true);
    setEnv('TRUE');
    assert.equal(isBqPruneSkipped(), true);
  });

  it('is false for other values', () => {
    setEnv('0');
    assert.equal(isBqPruneSkipped(), false);
    setEnv('false');
    assert.equal(isBqPruneSkipped(), false);
    setEnv('yes');
    assert.equal(isBqPruneSkipped(), false);
  });
});
