/**
 * Run: node --import tsx --test tools/shared/resolve-media-folder-id.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  bracedMediaLibraryFieldValue,
  clearMediaFolderCmIdCache,
  resolveMediaFolderId,
} from './resolve-media-folder-id.ts';
import { clearAuthoringPathCache } from './authoring-path-cache.ts';

const CM_ID = 'cb61db85d73b4fcf836675d4349cf868';

describe('resolveMediaFolderId', () => {
  beforeEach(() => {
    clearMediaFolderCmIdCache();
    clearAuthoringPathCache();
  });
  afterEach(() => {
    clearMediaFolderCmIdCache();
    clearAuthoringPathCache();
  });

  it('CM hit → found', async () => {
    const result = await resolveMediaFolderId({
      sitecorePath: '/sitecore/media library/Project/demo',
      lookupPath: async () => CM_ID,
    });
    assert.equal(result.found, true);
    assert.equal(result.source, 'cm');
    assert.equal(result.id, CM_ID);
  });

  it('no CM → missing (no mint)', async () => {
    const result = await resolveMediaFolderId({
      sitecorePath: '/sitecore/media library/Project/missing',
      lookupPath: async () => undefined,
    });
    assert.equal(result.found, false);
    assert.equal(result.source, 'missing');
  });
});

describe('bracedMediaLibraryFieldValue', () => {
  it('returns braced uppercase dashed GUID', () => {
    assert.equal(
      bracedMediaLibraryFieldValue(CM_ID),
      '{CB61DB85-D73B-4FCF-8366-75D4349CF868}',
    );
  });
});
