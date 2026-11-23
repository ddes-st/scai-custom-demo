/**
 * Run: node --import tsx --test tools/shared/cm-rename-move-item.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CM_MOVE_VIA_AUTHORING_API,
  CM_RENAME_VIA_AUTHORING_API,
  moveCmItem,
  renameCmItem,
} from './cm-rename-move-item.ts';

describe('renameCmItem / moveCmItem', () => {
  it('renameCmItem posts renameItem mutation', async () => {
    /** @type {object[]} */
    const bodies = [];
    const result = await renameCmItem({
      itemId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      newName: 'New Leaf',
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body || '{}')));
        return {
          ok: true,
          async json() {
            return {
              data: {
                renameItem: {
                  item: {
                    itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
                    name: 'New Leaf',
                    path: '/sitecore/content/x/New Leaf',
                  },
                },
              },
            };
          },
        };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.name, 'New Leaf');
    assert.equal(bodies.length, 1);
    assert.match(bodies[0].query, /renameItem/);
    assert.equal(bodies[0].variables.input.newName, 'New Leaf');
    assert.match(bodies[0].variables.input.itemId, /^\{[0-9A-F-]{36}\}$/);
    assert.equal(typeof CM_RENAME_VIA_AUTHORING_API, 'string');
  });

  it('moveCmItem posts moveItem mutation', async () => {
    /** @type {object[]} */
    const bodies = [];
    const result = await moveCmItem({
      itemId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      targetParentId: '11111111-2222-3333-4444-555555555555',
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body || '{}')));
        return {
          ok: true,
          async json() {
            return {
              data: {
                moveItem: {
                  item: {
                    itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
                    path: '/sitecore/content/x/parent/child',
                  },
                },
              },
            };
          },
        };
      },
    });
    assert.equal(result.ok, true);
    assert.match(bodies[0].query, /moveItem/);
    assert.match(bodies[0].variables.input.targetParentId, /^\{[0-9A-F-]{36}\}$/);
    assert.equal(typeof CM_MOVE_VIA_AUTHORING_API, 'string');
  });

  it('renameCmItem returns ok:false on GraphQL errors', async () => {
    const result = await renameCmItem({
      itemId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      newName: 'X',
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return { errors: [{ message: 'denied' }] };
        },
      }),
    });
    assert.equal(result.ok, false);
    assert.match(result.error || '', /denied/);
  });
});
