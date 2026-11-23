/**
 * Apply/rendering routing: composite flag skips platform link-list paths.
 * Run: node --import tsx --test tools/shared/bq-env-apply-routing.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { BQ_LINK_LIST_AS_COMPOSITE } from './bq-env.mjs';
import { shouldApplyPlatformLinkList } from './platform-link-list.ts';
import { shouldPreferCompositeLinkList } from './bq-env.mjs';

describe('apply routing with BQ_LINK_LIST_AS_COMPOSITE', () => {
  let prev;

  before(() => {
    prev = process.env[BQ_LINK_LIST_AS_COMPOSITE];
  });

  after(() => {
    if (prev === undefined) delete process.env[BQ_LINK_LIST_AS_COMPOSITE];
    else process.env[BQ_LINK_LIST_AS_COMPOSITE] = prev;
  });

  it('flag off: Link Lists folder still selects platform apply', () => {
    delete process.env[BQ_LINK_LIST_AS_COMPOSITE];
    const content = { location: { folder: ['Link Lists'] } };
    const def = {
      placeholders: [{ allowedControls: ['crelan-link-item'] }],
      content,
    };
    assert.equal(shouldApplyPlatformLinkList(content), true);
    assert.equal(shouldPreferCompositeLinkList(def), false);
    // items.ts gate: platform only when !preferComposite && shouldEmit
    assert.equal(
      !shouldPreferCompositeLinkList(def) && shouldApplyPlatformLinkList(content),
      true,
    );
  });

  it('flag on + placeholders: skip platform apply even if folder is Link Lists', () => {
    process.env[BQ_LINK_LIST_AS_COMPOSITE] = '1';
    const content = { location: { folder: ['Link Lists'] } };
    const def = {
      placeholders: [{ allowedControls: ['crelan-link-item'] }],
      content,
    };
    assert.equal(shouldApplyPlatformLinkList(content), true);
    assert.equal(shouldPreferCompositeLinkList(def), true);
    assert.equal(
      !shouldPreferCompositeLinkList(def) && shouldApplyPlatformLinkList(content),
      false,
    );
  });

  it('flag on without placeholders: keep platform apply for Link Lists folder', () => {
    process.env[BQ_LINK_LIST_AS_COMPOSITE] = '1';
    const content = { location: { folder: ['Link Lists'] } };
    const def = { placeholders: [], content };
    assert.equal(shouldPreferCompositeLinkList(def), false);
    assert.equal(
      !shouldPreferCompositeLinkList(def) && shouldApplyPlatformLinkList(content),
      true,
    );
  });
});
