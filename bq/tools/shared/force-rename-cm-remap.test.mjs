/**
 * Run: node --import tsx --test tools/shared/force-rename-cm-remap.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  deleteApplyInventory,
  saveApplyInventory,
} from './apply-inventory.ts';
import {
  executeForceRenameCmRemap,
  isProtectedSitecoreRoot,
  orderActionsForExecution,
  planForceRenameCmRemap,
  substituteComponentPathSegments,
} from './force-rename-cm-remap.ts';

describe('substituteComponentPathSegments', () => {
  it('replaces spaced name and kebab key', () => {
    const out = substituteComponentPathSegments(
      '/sitecore/content/menzis/menzis-nl/Data/Menzis Navigation Header/Seed',
      {
        oldSpaced: 'Menzis Navigation Header',
        newSpaced: 'Menzis Global Navigation Header',
        oldKebab: 'menzis-navigation-header',
        newKebab: 'menzis-global-navigation-header',
      },
    );
    assert.equal(
      out,
      '/sitecore/content/menzis/menzis-nl/Data/Menzis Global Navigation Header/Seed',
    );
  });
});

describe('orderActionsForExecution', () => {
  it('deletes leftover templates deepest-path-first (parent last)', () => {
    const ordered = orderActionsForExecution([
      {
        type: 'leftover-delete',
        entry: {
          id: '1',
          path: '/sitecore/templates/Project/demo/Global Context Link List',
          kind: 'template',
        },
        reason: 'leftover',
      },
      {
        type: 'leftover-delete',
        entry: {
          id: '2',
          path: '/sitecore/templates/Project/demo/Global Context Link List/Link',
          kind: 'template',
        },
        reason: 'leftover',
      },
      {
        type: 'leftover-delete',
        entry: {
          id: '3',
          path: '/sitecore/templates/Project/demo/Global Context Link List/Link/Content',
          kind: 'template',
        },
        reason: 'leftover',
      },
      {
        type: 'keep',
        entry: {
          id: '9',
          path: '/sitecore/content/demo/Data/Link Lists/X',
          kind: 'content',
        },
        reason: 'shared',
      },
    ]);
    assert.equal(ordered[0].type, 'keep');
    assert.deepEqual(
      ordered.slice(1).map((a) =>
        a.type === 'leftover-delete' ? a.entry.id : '',
      ),
      ['3', '2', '1'],
    );
  });
});

describe('isProtectedSitecoreRoot', () => {
  it('protects project and data roots + link list folders', () => {
    assert.equal(
      isProtectedSitecoreRoot(
        '/sitecore/layout/Renderings/Project/menzis',
      ),
      true,
    );
    assert.equal(
      isProtectedSitecoreRoot('/sitecore/content/menzis/menzis-nl/Data'),
      true,
    );
    assert.equal(
      isProtectedSitecoreRoot(
        '/sitecore/content/menzis/menzis-nl/Data/Link Lists',
      ),
      true,
    );
    assert.equal(
      isProtectedSitecoreRoot(
        '/sitecore/layout/Renderings/Project/menzis/Menzis Navigation Header',
      ),
      false,
    );
  });
});

describe('planForceRenameCmRemap', () => {
  it('keeps shared Link Lists content when path unchanged; deletes other leftovers', () => {
    const plan = planForceRenameCmRemap({
      oldDefinitionKey: 'old-comp',
      newDefinitionKey: 'new-comp',
      oldComponentName: 'OldComp',
      newComponentName: 'NewComp',
      inventory: {
        definitionKey: 'old-comp',
        sourceContentHash: null,
        updatedAt: '',
        entries: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            path: '/sitecore/content/demo/demo-site/Data/Link Lists/Header Context Links',
            kind: 'content',
            leafName: 'Header Context Links',
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            path: '/sitecore/layout/Placeholder Settings/Project/demo/orphan-ph',
            kind: 'placeholder-setting',
            leafName: 'orphan-ph',
          },
        ],
      },
    });
    const byId = Object.fromEntries(
      plan.actions.map((a) => [a.entry.id.slice(0, 8), a.type]),
    );
    assert.equal(byId['11111111'], 'keep');
    assert.equal(byId['22222222'], 'leftover-delete');
  });

  it('plans rename when parent unchanged and move when parent changes', () => {
    const plan = planForceRenameCmRemap({
      oldDefinitionKey: 'old-comp',
      newDefinitionKey: 'new-comp',
      oldComponentName: 'OldComp',
      newComponentName: 'NewComp',
      inventory: {
        definitionKey: 'old-comp',
        sourceContentHash: null,
        updatedAt: '',
        entries: [
          {
            id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            path: '/sitecore/layout/Renderings/Project/demo/Old Comp',
            kind: 'rendering',
            leafName: 'Old Comp',
          },
          {
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            path: '/sitecore/content/demo/demo-site/Data/Old Comp/Seed',
            kind: 'content',
            leafName: 'Seed',
          },
          {
            id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            path: '/sitecore/content/demo/demo-site/Data',
            kind: 'folder',
            leafName: 'Data',
          },
          {
            id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
            path: '/sitecore/layout/Placeholder Settings/Project/demo/orphan-ph',
            kind: 'placeholder-setting',
            leafName: 'orphan-ph',
          },
        ],
      },
    });

    const types = Object.fromEntries(
      plan.actions.map((a) => [a.entry.id.slice(0, 8), a.type]),
    );
    assert.equal(types.aaaaaaaa, 'rename');
    assert.equal(types.bbbbbbbb, 'move');
    assert.equal(types.cccccccc, 'skip-protected');
    assert.equal(types.dddddddd, 'leftover-delete'); // path unchanged — not remappable

    const render = plan.actions.find((a) => a.type === 'rename');
    assert.equal(render?.newLeaf, 'New Comp');
    const content = plan.actions.find((a) => a.type === 'move');
    assert.match(content?.newPath || '', /\/Data\/New Comp\/Seed$/);
  });
});

describe('executeForceRenameCmRemap', () => {
  const oldKey = `test-force-remap-old-${Date.now()}`;
  const newKey = `test-force-remap-new-${Date.now()}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-force-remap-'));

  before(() => {
    saveApplyInventory({
      definitionKey: oldKey,
      sourceContentHash: 'hash-old',
      updatedAt: new Date().toISOString(),
      entries: [
        {
          id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          path: '/sitecore/layout/Renderings/Project/demo/Old Comp',
          kind: 'rendering',
          leafName: 'Old Comp',
        },
        {
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          path: '/sitecore/content/demo/demo-site/Data/Old Comp/Dropped',
          kind: 'content',
          leafName: 'Dropped',
        },
      ],
    });
  });

  after(() => {
    deleteApplyInventory(oldKey);
    deleteApplyInventory(newKey);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('renames via mock fetch, deletes leftover when remap fails, migrates inventory', async () => {
    /** @type {string[]} */
    const ops = [];
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const q = String(body.query || '');
      if (/renameItem/.test(q)) {
        ops.push(`rename:${body.variables.input.newName}`);
        return {
          ok: true,
          async json() {
            return {
              data: {
                renameItem: {
                  item: {
                    itemId: body.variables.input.itemId,
                    name: body.variables.input.newName,
                    path: `/sitecore/layout/Renderings/Project/demo/${body.variables.input.newName}`,
                  },
                },
              },
            };
          },
        };
      }
      if (/moveItem/.test(q)) {
        ops.push('move');
        return {
          ok: true,
          async json() {
            return {
              data: {
                moveItem: {
                  item: {
                    itemId: body.variables.input.itemId,
                    path: '/sitecore/content/demo/demo-site/Data/New Comp/Dropped',
                  },
                },
              },
            };
          },
        };
      }
      if (/deleteItem/.test(q)) {
        ops.push('delete');
        return {
          ok: true,
          async json() {
            return { data: { deleteItem: { successful: true } } };
          },
        };
      }
      return {
        ok: true,
        async json() {
          return { data: {} };
        },
      };
    };

    // Force leftover-delete on second entry by crafting a plan manually.
    const plan = planForceRenameCmRemap({
      oldDefinitionKey: oldKey,
      newDefinitionKey: newKey,
      oldComponentName: 'OldComp',
      newComponentName: 'NewComp',
      inventory: {
        definitionKey: oldKey,
        sourceContentHash: 'hash-old',
        updatedAt: '',
        entries: [
          {
            id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            path: '/sitecore/layout/Renderings/Project/demo/Old Comp',
            kind: 'rendering',
            leafName: 'Old Comp',
          },
          {
            id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            path: '/sitecore/content/demo/demo-site/Data/Old Comp/Orphan Extra',
            kind: 'content',
            leafName: 'Orphan Extra',
          },
        ],
      },
    });
    // Simulate structure-dropped leftover
    plan.actions.push({
      type: 'leftover-delete',
      entry: {
        id: '99999999-9999-9999-9999-999999999999',
        path: '/sitecore/content/demo/demo-site/Data/Old Comp/Gone',
        kind: 'content',
        leafName: 'Gone',
      },
      reason: 'structure dropped',
    });

    const result = await executeForceRenameCmRemap({
      plan,
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl,
      resolveParentId: async () => '11111111-2222-3333-4444-555555555555',
      log: () => {},
    });

    assert.ok(result.renamed >= 1);
    assert.ok(result.moved >= 1);
    assert.ok(result.deleted >= 1);
    assert.ok(ops.some((o) => o.startsWith('rename:')));
    assert.ok(ops.includes('move'));
    assert.ok(ops.includes('delete'));
    assert.ok(result.migrated);
    assert.equal(result.migrated.definitionKey, newKey);
    assert.ok(
      result.migrated.entries.some((e) =>
        /New Comp/i.test(e.path),
      ),
    );
  });

  it('treats not-found leftover delete as success; verbose-only detail', async () => {
    const prev = process.env.BQ_CREATE_LOG;
    delete process.env.BQ_CREATE_LOG;

    /** @type {string[]} */
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => {
      warns.push(args.map(String).join(' '));
    };

    try {
      const plan = {
        oldDefinitionKey: oldKey,
        newDefinitionKey: newKey,
        oldSpaced: 'Old Comp',
        newSpaced: 'New Comp',
        actions: [
          {
            type: 'leftover-delete',
            entry: {
              id: 'abcdabcd-abcd-abcd-abcd-abcdabcdabcd',
              path: '/sitecore/content/demo/demo-site/Data/Old Comp/Missing',
              kind: 'content',
              leafName: 'Missing',
            },
            reason: 'path unchanged after name substitute — not remappable; delete leftover',
          },
        ],
      };

      const result = await executeForceRenameCmRemap({
        plan,
        auth: { host: 'https://cm.example', token: 'tok' },
        fetchImpl: async () => ({
          ok: true,
          async json() {
            return {
              errors: [
                {
                  message:
                    "The item '{ABCDABCD-ABCD-ABCD-ABCD-ABCDABCDABCD}' was not found. It may have been deleted.",
                },
              ],
            };
          },
        }),
        log: () => {},
      });

      assert.equal(result.deleted, 1);
      assert.equal(result.failed, 0);
      assert.ok(
        !warns.some((w) => /delete failed/i.test(w)),
        'default warn must not include delete failed for not-found',
      );

      process.env.BQ_CREATE_LOG = 'verbose';
      warns.length = 0;
      const resultVerbose = await executeForceRenameCmRemap({
        plan,
        auth: { host: 'https://cm.example', token: 'tok' },
        fetchImpl: async () => ({
          ok: true,
          async json() {
            return {
              errors: [
                {
                  message:
                    "The item '{ABCDABCD-ABCD-ABCD-ABCD-ABCDABCDABCD}' was not found. It may have been deleted.",
                },
              ],
            };
          },
        }),
        log: () => {},
      });
      assert.equal(resultVerbose.deleted, 1);
      assert.ok(
        warns.some((w) => /already gone/i.test(w)),
        'verbose mode should log already-gone detail',
      );
    } finally {
      console.warn = origWarn;
      if (prev === undefined) delete process.env.BQ_CREATE_LOG;
      else process.env.BQ_CREATE_LOG = prev;
    }
  });
});
