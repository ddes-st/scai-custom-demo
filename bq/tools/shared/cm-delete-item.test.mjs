/**
 * Run: node --import tsx --test tools/shared/cm-delete-item.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CM_DELETE_VIA_AUTHORING_API,
  TEMPLATE_IN_USE_MAX_ROUNDS,
  deleteCmItemById,
  deleteCmItemsByIds,
  formatAuthoringItemId,
} from './cm-delete-item.ts';

const IN_USE_MSG = (id) =>
  `The '${id}' template is used by at least one item. Delete all the items that are based on this template first.`;

function okDelete() {
  return {
    ok: true,
    async json() {
      return { data: { deleteItem: { successful: true } } };
    },
  };
}

function errDelete(message) {
  return {
    ok: true,
    async json() {
      return { errors: [{ message }] };
    },
  };
}

function searchResults(hits) {
  return {
    ok: true,
    async json() {
      return {
        data: {
          search: {
            results: hits.map((h) => ({
              innerItem: {
                itemId: h.itemId,
                name: h.name || 'Item',
                path: h.path || `/sitecore/content/${h.itemId}`,
              },
            })),
          },
        },
      };
    },
  };
}

describe('formatAuthoringItemId', () => {
  it('braces and uppercases GUID', () => {
    assert.equal(
      formatAuthoringItemId('57dc3409-16cd-5b49-aea5-9d3271702d3b'),
      '{57DC3409-16CD-5B49-AEA5-9D3271702D3B}',
    );
  });
});

describe('deleteCmItemsByIds', () => {
  it('deletes each id with permanently:true via Authoring GraphQL', async () => {
    const items = [
      {
        itemId: '57DC3409-16CD-5B49-AEA5-9D3271702D3B',
        path: '[orphan]/cooperative-members',
      },
      {
        itemId: 'FDAE9A16-16A6-5CD1-A492-01D9A49A04C9',
        path: '/sitecore/content/crelan/crelan-be/Home/individuals/saving-and-investing/investing',
      },
    ];

    /** @type {object[]} */
    const bodies = [];
    const logs = [];
    const fetchImpl = async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body || '{}')));
      return {
        ok: true,
        async json() {
          return { data: { deleteItem: { successful: true } } };
        },
      };
    };

    const results = await deleteCmItemsByIds({
      items,
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl,
      log: (m) => logs.push(m),
    });

    assert.equal(results.length, 2);
    assert.ok(results.every((r) => r.ok));
    assert.equal(bodies.length, 2);
    for (const body of bodies) {
      assert.match(body.query, /deleteItem/);
      assert.equal(body.variables.input.permanently, true);
      assert.equal(body.variables.input.database, 'master');
      assert.match(body.variables.input.itemId, /^\{[0-9A-F-]{36}\}$/);
    }
    assert.ok(
      logs.every((l) => l.includes(CM_DELETE_VIA_AUTHORING_API)),
      'logs must name Authoring API delete',
    );
  });
});

describe('deleteCmItemById', () => {
  it('returns ok:false when GraphQL errors', async () => {
    const result = await deleteCmItemById({
      itemId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return { errors: [{ message: 'not found' }] };
        },
      }),
    });
    assert.equal(result.ok, false);
  });

  function childrenResults(hits) {
    return {
      ok: true,
      async json() {
        return {
          data: {
            item: {
              children: {
                nodes: hits.map((h) => ({
                  itemId: h.itemId,
                  name: h.name || 'Child',
                  path: h.path || `/sitecore/templates/${h.itemId}`,
                })),
              },
            },
          },
        };
      },
    };
  }

  it('cascades: find 1 content item → delete it → original succeeds', async () => {
    const templateId = '80ab0c8d-a701-4547-a9a1-5e0aeb8aca69';
    const contentId = '11111111-2222-3333-4444-555555555555';
    /** @type {string[]} */
    const ops = [];
    let templateDeleteAttempts = 0;

    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const q = String(body.query || '');
      if (/\bchildren\b/.test(q) && /\bitem\s*\(/.test(q)) {
        ops.push('list-children');
        return childrenResults([]);
      }
      if (/\bsearch\b/.test(q)) {
        ops.push('search');
        assert.equal(
          body.variables.templateHex,
          '80ab0c8da7014547a9a15e0aeb8aca69',
        );
        return searchResults([
          {
            itemId: contentId,
            name: 'Based Item',
            path: '/sitecore/content/demo/Data/Based Item',
          },
        ]);
      }
      if (/deleteItem/.test(q)) {
        const id = String(body.variables.input.itemId || '').toLowerCase();
        if (id.includes('80ab0c8d')) {
          templateDeleteAttempts += 1;
          ops.push(`delete-template:${templateDeleteAttempts}`);
          if (templateDeleteAttempts === 1) {
            return errDelete(IN_USE_MSG(templateId));
          }
          return okDelete();
        }
        ops.push(`delete-dependent:${id}`);
        return okDelete();
      }
      return {
        ok: true,
        async json() {
          return { data: {} };
        },
      };
    };

    const logs = [];
    const result = await deleteCmItemById({
      itemId: templateId,
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl,
      log: (m) => logs.push(m),
    });

    assert.equal(result.ok, true);
    assert.equal(templateDeleteAttempts, 2);
    const filtered = ops.filter(
      (o) =>
        o === 'search' ||
        o === 'list-children' ||
        o.startsWith('delete-'),
    );
    assert.equal(filtered[0], 'delete-template:1');
    assert.ok(filtered.includes('list-children'));
    assert.ok(filtered.includes('search'));
    assert.ok(
      filtered.includes(
        'delete-dependent:{11111111-2222-3333-4444-555555555555}',
      ),
    );
    assert.equal(filtered.at(-1), 'delete-template:2');
    assert.ok(
      filtered.indexOf('list-children') < filtered.indexOf('search'),
      'subitem list before based-on search',
    );
    assert.ok(logs.some((l) => /template in use/i.test(l)));
    assert.ok(logs.some((l) => /found 1 based-on dependent/i.test(l)));
    assert.ok(logs.some((l) => /cascade delete dependent/i.test(l)));
    assert.ok(logs.some((l) => /retry original/i.test(l)));
  });

  it('wipes subitems before based-on dependents', async () => {
    const templateId = '80ab0c8d-a701-4547-a9a1-5e0aeb8aca69';
    const svId = 'aaaaaaaa-1111-1111-1111-111111111111';
    const fieldId = 'bbbbbbbb-2222-2222-2222-222222222222';
    const contentId = 'cccccccc-3333-3333-3333-333333333333';
    /** @type {string[]} */
    const ops = [];
    let templateDeletes = 0;
    const listed = new Set();

    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const q = String(body.query || '');
      if (/\bchildren\b/.test(q) && /\bitem\s*\(/.test(q)) {
        const id = String(body.variables.id || '').toLowerCase();
        if (id.includes('80ab0c8d') && !listed.has('root')) {
          listed.add('root');
          ops.push('list-root');
          return childrenResults([
            {
              itemId: fieldId,
              name: 'Link',
              path: '/sitecore/templates/Project/demo/T/Content/Link',
            },
            {
              itemId: svId,
              name: '__Standard Values',
              path: '/sitecore/templates/Project/demo/T/__Standard Values',
            },
          ]);
        }
        ops.push('list-other');
        return childrenResults([]);
      }
      if (/\bsearch\b/.test(q)) {
        ops.push('search');
        return searchResults([
          {
            itemId: contentId,
            name: 'Based',
            path: '/sitecore/content/demo/Based',
          },
        ]);
      }
      if (/deleteItem/.test(q)) {
        const id = String(body.variables.input.itemId || '').toLowerCase();
        if (id.includes('80ab0c8d')) {
          templateDeletes += 1;
          ops.push(`delete-template:${templateDeletes}`);
          if (templateDeletes === 1) return errDelete(IN_USE_MSG(templateId));
          return okDelete();
        }
        if (id.includes('bbbbbbbb')) {
          ops.push('delete-field');
          return okDelete();
        }
        if (id.includes('aaaaaaaa')) {
          ops.push('delete-sv');
          return okDelete();
        }
        if (id.includes('cccccccc')) {
          ops.push('delete-based');
          return okDelete();
        }
      }
      return {
        ok: true,
        async json() {
          return { data: {} };
        },
      };
    };

    const result = await deleteCmItemById({
      itemId: templateId,
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl,
      log: () => {},
    });

    assert.equal(result.ok, true);
    assert.ok(ops.indexOf('delete-field') < ops.indexOf('delete-sv'));
    assert.ok(ops.indexOf('delete-sv') < ops.indexOf('search'));
    assert.ok(ops.indexOf('delete-based') < ops.indexOf('delete-template:2'));
  });

  it('nested cascade: dependent template also in use → clears then original succeeds', async () => {
    const rootTpl = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const nestedTpl = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const contentId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    /** @type {string[]} */
    const ops = [];
    const deleteAttempts = { [rootTpl]: 0, [nestedTpl]: 0 };

    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const q = String(body.query || '');
      if (/\bsearch\b/.test(q)) {
        const hex = String(body.variables.templateHex || '');
        if (hex.includes('aaaaaaaa')) {
          ops.push('search-root');
          return searchResults([
            {
              itemId: nestedTpl,
              name: 'Nested Template Item',
              path: '/sitecore/templates/Project/demo/Nested',
            },
          ]);
        }
        if (hex.includes('bbbbbbbb')) {
          ops.push('search-nested');
          return searchResults([
            {
              itemId: contentId,
              name: 'Leaf Content',
              path: '/sitecore/content/demo/Data/Leaf',
            },
          ]);
        }
        ops.push(`search-other:${hex}`);
        return searchResults([]);
      }
      if (/deleteItem/.test(q)) {
        const id = String(body.variables.input.itemId || '').toLowerCase();
        if (id.includes('aaaaaaaa')) {
          deleteAttempts[rootTpl] += 1;
          ops.push(`delete-root:${deleteAttempts[rootTpl]}`);
          if (deleteAttempts[rootTpl] === 1) {
            return errDelete(IN_USE_MSG(rootTpl));
          }
          return okDelete();
        }
        if (id.includes('bbbbbbbb')) {
          deleteAttempts[nestedTpl] += 1;
          ops.push(`delete-nested:${deleteAttempts[nestedTpl]}`);
          if (deleteAttempts[nestedTpl] === 1) {
            return errDelete(IN_USE_MSG(nestedTpl));
          }
          return okDelete();
        }
        if (id.includes('cccccccc')) {
          ops.push('delete-leaf');
          return okDelete();
        }
      }
      return {
        ok: true,
        async json() {
          return { data: {} };
        },
      };
    };

    const logs = [];
    const result = await deleteCmItemById({
      itemId: rootTpl,
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl,
      log: (m) => logs.push(m),
    });

    assert.equal(result.ok, true);
    assert.equal(deleteAttempts[rootTpl], 2);
    assert.equal(deleteAttempts[nestedTpl], 2);
    assert.ok(ops.includes('search-root'));
    assert.ok(ops.includes('search-nested'));
    assert.ok(ops.includes('delete-leaf'));
    assert.ok(
      ops.indexOf('delete-leaf') <
        ops.indexOf('delete-nested:2'),
      'leaf deleted before nested template succeeds',
    );
    assert.ok(
      ops.indexOf('delete-nested:2') < ops.indexOf('delete-root:2'),
      'nested cleared before root succeeds',
    );
    assert.ok(logs.some((l) => /depth 1/.test(l)));
  });

  it('empty-then-hit: first search [], backoff, re-search finds item → original succeeds', async () => {
    const templateId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const contentId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    let searchCount = 0;
    let templateDeletes = 0;
    let sleepCalls = 0;

    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const q = String(body.query || '');
      if (/\bsearch\b/.test(q)) {
        searchCount += 1;
        if (searchCount === 1) return searchResults([]);
        return searchResults([
          {
            itemId: contentId,
            name: 'Lagged Item',
            path: '/sitecore/content/demo/Lagged',
          },
        ]);
      }
      if (/deleteItem/.test(q)) {
        const id = String(body.variables.input.itemId || '').toLowerCase();
        if (id.includes('dddddddd')) {
          templateDeletes += 1;
          if (templateDeletes === 1) {
            return errDelete(IN_USE_MSG(templateId));
          }
          return okDelete();
        }
        return okDelete();
      }
      return {
        ok: true,
        async json() {
          return { data: {} };
        },
      };
    };

    const logs = [];
    const result = await deleteCmItemById({
      itemId: templateId,
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl,
      log: (m) => logs.push(m),
      sleep: async () => {
        sleepCalls += 1;
      },
    });

    assert.equal(result.ok, true);
    assert.equal(searchCount, 2, 'initial empty search + backoff re-search');
    assert.equal(sleepCalls, 1);
    assert.equal(templateDeletes, 2);
    assert.ok(logs.some((l) => /found 0 dependent/i.test(l)));
    assert.ok(logs.some((l) => /backoff \+ re-search/i.test(l)));
    assert.ok(logs.some((l) => /found 1 based-on dependent/i.test(l)));
  });

  it('max rounds exhausted → ok:false with enriched error', async () => {
    const templateId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const stuckId = '99999999-9999-9999-9999-999999999999';
    let templateDeletes = 0;
    let sleepCalls = 0;

    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const q = String(body.query || '');
      if (/\bsearch\b/.test(q)) {
        // Always empty — index never catches up; rounds burn on backoff.
        return searchResults([]);
      }
      if (/deleteItem/.test(q)) {
        const id = String(body.variables.input.itemId || '').toLowerCase();
        if (id.includes('ffffffff')) {
          templateDeletes += 1;
          return errDelete(IN_USE_MSG(templateId));
        }
        if (id.includes('99999999')) {
          return okDelete();
        }
      }
      return {
        ok: true,
        async json() {
          return { data: {} };
        },
      };
    };

    // Alternate scenario: search always returns a dependent that fails to delete
    // while original stays in-use — exhaust rounds with enriched message.
    const stuckFetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const q = String(body.query || '');
      if (/\bsearch\b/.test(q)) {
        return searchResults([
          {
            itemId: stuckId,
            name: 'Stuck Dependent',
            path: '/sitecore/content/demo/Stuck',
          },
        ]);
      }
      if (/deleteItem/.test(q)) {
        const id = String(body.variables.input.itemId || '').toLowerCase();
        if (id.includes('ffffffff')) {
          templateDeletes += 1;
          return errDelete(IN_USE_MSG(templateId));
        }
        // Dependent always fails with a non-not-found error
        return errDelete('permission denied');
      }
      return {
        ok: true,
        async json() {
          return { data: {} };
        },
      };
    };

    const logs = [];
    const result = await deleteCmItemById({
      itemId: templateId,
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl: stuckFetch,
      log: (m) => logs.push(m),
      sleep: async () => {
        sleepCalls += 1;
      },
    });

    assert.equal(result.ok, false);
    assert.equal(templateDeletes, 1 + TEMPLATE_IN_USE_MAX_ROUNDS);
    assert.match(result.error || '', /cascade exhausted after 3 round/i);
    assert.match(result.error || '', /last error:/i);
    assert.match(result.error || '', /failed dependents:/i);
    assert.ok(logs.some((l) => /found 1 based-on dependent/i.test(l)));
    assert.ok(logs.some((l) => /dependent failed/i.test(l)));

    // Empty-search exhaustion path
    templateDeletes = 0;
    sleepCalls = 0;
    const emptyResult = await deleteCmItemById({
      itemId: templateId,
      auth: { host: 'https://cm.example', token: 'tok' },
      fetchImpl,
      log: () => {},
      sleep: async () => {
        sleepCalls += 1;
      },
    });
    assert.equal(emptyResult.ok, false);
    assert.match(emptyResult.error || '', /cascade exhausted after 3 round/i);
    assert.equal(sleepCalls, TEMPLATE_IN_USE_MAX_ROUNDS);
    assert.equal(templateDeletes, 1 + TEMPLATE_IN_USE_MAX_ROUNDS);
  });
});
