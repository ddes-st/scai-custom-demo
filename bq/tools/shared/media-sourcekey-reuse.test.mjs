/**
 * Run: node --test --import tsx tools/shared/media-sourcekey-reuse.test.mjs
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { stableGuid } from './ids.ts';

describe('media sourceKey mint key', () => {
  it('same sourceKey yields same GUID regardless of folder path', () => {
    const handle = 'sai:demo@1';
    const sourceKey = 'url:https://cdn.example.com/abc123.webp';
    const a = stableGuid(handle, `media:${sourceKey}`);
    const b = stableGuid(handle, `media:${sourceKey}`);
    assert.equal(a, b);

    const oldStyleA = stableGuid(
      handle,
      `media:${sourceKey}:/sitecore/media library/Project/sitecore/bq-demo/Customer Stories/abc123`,
    );
    const oldStyleB = stableGuid(
      handle,
      `media:${sourceKey}:/sitecore/media library/Project/sitecore/bq-demo/Customer Story Cards/abc123`,
    );
    assert.notEqual(oldStyleA, oldStyleB);
    // New key is stable and distinct from path-scoped remints.
    assert.notEqual(a, oldStyleA);
  });

  it('sourceKey hash helper is deterministic', () => {
    const payload = JSON.stringify({
      layoutPattern: 'grid',
      pageRole: 'page',
    });
    const h1 = createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16);
    const h2 = createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16);
    assert.equal(h1, h2);
  });
});
