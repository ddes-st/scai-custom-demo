/**
 * Run: node --test tools/capture/lib/unique-css-path.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canUseBareId } from './unique-css-path.mjs';

describe('canUseBareId', () => {
  it('allows unique stable ids', () => {
    assert.equal(canUseBareId('main-nav', 1), true);
    assert.equal(canUseBareId('_R_tab-5', 1), true);
  });

  it('rejects duplicate ids (MediaSlider-style)', () => {
    assert.equal(canUseBareId('_R_7tanpfl5uivb_-tab-5', 3), false);
    assert.equal(canUseBareId('dup', 2), false);
  });

  it('rejects ids with 4+ consecutive digits (unstable react-ish)', () => {
    assert.equal(canUseBareId('item-1234', 1), false);
  });

  it('rejects empty', () => {
    assert.equal(canUseBareId('', 1), false);
    assert.equal(canUseBareId(null, 1), false);
  });
});
