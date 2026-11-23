/**
 * Run: node --test tools/create-section-components/tsx-validate-iters.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  BQ_TSX_VALIDATE_MAX_ITERS,
  resolveTsxValidateMaxIters,
} from './tsx-validate-iters.mjs';

const ENV = BQ_TSX_VALIDATE_MAX_ITERS;
let prev;

describe('resolveTsxValidateMaxIters', () => {
  beforeEach(() => {
    prev = process.env[ENV];
    delete process.env[ENV];
  });
  afterEach(() => {
    if (prev === undefined) delete process.env[ENV];
    else process.env[ENV] = prev;
  });

  it('defaults to 3 when unset', () => {
    assert.equal(resolveTsxValidateMaxIters(), 3);
  });

  it('treats 0 as disabled', () => {
    process.env[ENV] = '0';
    assert.equal(resolveTsxValidateMaxIters(), 0);
  });

  it('accepts 1–3', () => {
    process.env[ENV] = '2';
    assert.equal(resolveTsxValidateMaxIters(), 2);
  });

  it('clamps above 3 to 3', () => {
    process.env[ENV] = '5';
    assert.equal(resolveTsxValidateMaxIters(), 3);
  });

  it('falls back to default on invalid', () => {
    process.env[ENV] = 'nope';
    assert.equal(resolveTsxValidateMaxIters(), 3);
  });
});
