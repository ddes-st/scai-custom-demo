/**
 * Run: node --import tsx --test tools/restore-collection.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runRestoreCollection } from './restore-collection.mjs';

describe('runRestoreCollection ser session order', () => {
  it('restore disk → expand → ser push → reset', async () => {
    const calls = [];
    const result = await runRestoreCollection({
      archivePath: 'unused.tar.gz',
      dryRun: false,
      restoreCollectionPackage: async () => {
        calls.push('restore');
        return {
          dryRun: false,
          archivePath: 'unused.tar.gz',
          manifest: {
            version: 1,
            mode: 'collection',
            collectionSystem: 'lifecycle-coll',
            siteSystems: ['lifecycle-coll-com'],
            localOnly: false,
          },
          restoredFiles: ['a'],
          restoredSnapshots: ['b'],
          clearedDisabled: [],
          remoteWasDeleted: true,
          remote: { status: 'deleted' },
        };
      },
      expandModuleForSerSession: ({ collectionSystem, siteSystem }) => {
        calls.push(`expand:${collectionSystem}/${siteSystem}`);
        return {
          path: 'module.json',
          collectionSystem,
          siteSystem,
          reset: { changed: true },
        };
      },
      pushSerializationNow: async ({ reason }) => {
        calls.push(`push:${reason}`);
      },
      resetModuleJsonToMinimal: () => {
        calls.push('reset');
        return { path: 'module.json', from: 'minimal', changed: true };
      },
    });

    assert.deepEqual(calls, [
      'restore',
      'expand:lifecycle-coll/lifecycle-coll-com',
      'push:restore:collection lifecycle-coll',
      'reset',
    ]);
    assert.equal(result.push?.ok, true);
    assert.equal(result.moduleReset?.changed, true);
  });

  it('skip-push restores disk and still resets module', async () => {
    const calls = [];
    await runRestoreCollection({
      archivePath: 'unused.tar.gz',
      skipPush: true,
      restoreCollectionPackage: async () => {
        calls.push('restore');
        return {
          dryRun: false,
          archivePath: 'unused.tar.gz',
          manifest: {
            version: 1,
            mode: 'collection',
            collectionSystem: 'lifecycle-coll',
            siteSystems: [],
            localOnly: false,
          },
          restoredFiles: [],
          restoredSnapshots: [],
          clearedDisabled: [],
          remoteWasDeleted: true,
          remote: null,
        };
      },
      expandModuleForSerSession: () => {
        calls.push('expand');
        return { path: 'x', collectionSystem: 'x', reset: {} };
      },
      pushSerializationNow: async () => {
        calls.push('push');
      },
      resetModuleJsonToMinimal: () => {
        calls.push('reset');
        return { path: 'module.json', from: 'minimal', changed: false };
      },
    });

    assert.deepEqual(calls, ['restore', 'reset']);
  });
});
