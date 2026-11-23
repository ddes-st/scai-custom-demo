/**
 * Media force-refresh env flag (ensureMediaFromSource is Authoring-only; no YAML).
 *
 * Run: node --import tsx --test tools/shared/media-skip-rewrite.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMediaForceRefresh } from './media-from-source.ts';

describe('isMediaForceRefresh', () => {
  it('defaults false; accepts 1/true/yes', () => {
    assert.equal(isMediaForceRefresh({}), false);
    assert.equal(isMediaForceRefresh({ BQ_MEDIA_FORCE_REFRESH: '1' }), true);
    assert.equal(isMediaForceRefresh({ BQ_MEDIA_FORCE_REFRESH: 'true' }), true);
    assert.equal(isMediaForceRefresh({ BQ_MEDIA_FORCE_REFRESH: 'yes' }), true);
    assert.equal(isMediaForceRefresh({ BQ_MEDIA_FORCE_REFRESH: '0' }), false);
  });
});
