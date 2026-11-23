/**
 * Run: node --import tsx --test tools/shared/resolve-item-id-by-path.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  bracedGuidFieldValue,
  clearItemIdByPathCmCache,
  resolveItemIdByPath,
} from './resolve-item-id-by-path.ts';
import { clearAuthoringPathCache } from './authoring-path-cache.ts';

const CM_ID = 'cb61db85d73b4fcf836675d4349cf868';

describe('resolveItemIdByPath', () => {
  beforeEach(() => {
    clearItemIdByPathCmCache();
    clearAuthoringPathCache();
  });
  afterEach(() => {
    clearItemIdByPathCmCache();
    clearAuthoringPathCache();
  });

  it('CM hit → found with CM id', async () => {
    const result = await resolveItemIdByPath({
      sitecorePath: '/sitecore/layout/Placeholder Settings/Project/demo',
      lookupPath: async () => CM_ID,
    });
    assert.equal(result.found, true);
    assert.equal(result.source, 'cm');
    assert.equal(result.id, CM_ID);
  });

  it('no CM → found false (no mint)', async () => {
    const result = await resolveItemIdByPath({
      sitecorePath: '/sitecore/layout/Placeholder Settings/Project/demo-missing',
      lookupPath: async () => undefined,
    });
    assert.equal(result.found, false);
    assert.equal(result.source, 'missing');
    assert.equal(result.id, undefined);
  });

  it('caches CM lookups by path', async () => {
    let calls = 0;
    const lookupPath = async () => {
      calls += 1;
      return CM_ID;
    };
    await resolveItemIdByPath({
      sitecorePath: '/sitecore/content/demo/cache-me',
      lookupPath,
    });
    await resolveItemIdByPath({
      sitecorePath: '/sitecore/content/demo/cache-me',
      lookupPath,
    });
    assert.equal(calls, 1);
  });

  it('in-run path cache wins before CM', async () => {
    const { cacheAuthoringPathId } = await import('./authoring-path-cache.ts');
    cacheAuthoringPathId('/sitecore/content/demo/cached', CM_ID);
    let calls = 0;
    const result = await resolveItemIdByPath({
      sitecorePath: '/sitecore/content/demo/cached',
      lookupPath: async () => {
        calls += 1;
        return 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      },
    });
    assert.equal(result.found, true);
    assert.equal(result.source, 'cache');
    assert.equal(result.id, CM_ID);
    assert.equal(calls, 0);
  });
});

describe('bracedGuidFieldValue', () => {
  it('returns braced uppercase dashed GUID', () => {
    assert.equal(
      bracedGuidFieldValue(CM_ID),
      '{CB61DB85-D73B-4FCF-8366-75D4349CF868}',
    );
  });
});
