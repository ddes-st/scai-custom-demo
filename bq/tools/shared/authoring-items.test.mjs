/**
 * Run: node --import tsx --test tools/shared/authoring-items.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  createItem,
  createItemTemplate,
  ensureItemByPath,
  ensureItemTemplate,
  updateItem,
  updateItemTemplate,
  __test,
} from './authoring-items.ts';
import { clearAuthoringPathCache } from './authoring-path-cache.ts';
import { BASE_STANDARD_TEMPLATE } from './system-ids.ts';

/** @type {string | undefined} */
let prevCreateLog;

const AUTH = { host: 'https://cm.example', token: 'tok' };

function gqlResponse(data) {
  return {
    ok: true,
    async json() {
      return { data };
    },
  };
}

describe('authoring-items helpers', () => {
  beforeEach(() => {
    clearAuthoringPathCache();
    prevCreateLog = process.env.BQ_CREATE_LOG;
    delete process.env.BQ_CREATE_LOG;
  });

  afterEach(() => {
    if (prevCreateLog === undefined) delete process.env.BQ_CREATE_LOG;
    else process.env.BQ_CREATE_LOG = prevCreateLog;
  });

  it('leafNameFromPath uses last segment', () => {
    assert.equal(
      __test.leafNameFromPath('/sitecore/content/Demo/Home'),
      'Home',
    );
  });

  it('isNameExistsError detects race messages', () => {
    assert.equal(__test.isNameExistsError(new Error('already exists')), true);
    assert.equal(__test.isNameExistsError(new Error('boom')), false);
  });

  it('isNameExistsError matches Sitecore already-defined-on-this-level', () => {
    assert.equal(
      __test.isNameExistsError(
        new Error('The item name "Log in" is already defined on this level.'),
      ),
      true,
    );
    assert.equal(
      __test.isNameExistsError(
        new Error(
          'The item name "Service andcontact" is already defined on this level',
        ),
      ),
      true,
    );
  });

  it('isMissingLanguageVersionError detects Authoring version messages', () => {
    assert.equal(
      __test.isMissingLanguageVersionError(
        new Error(
          "The item 'ff06dc83-a29d-4a7a-9738-6d8034d5fc64' does not contain version # in 'nl-NL' language",
        ),
      ),
      true,
    );
    assert.equal(
      __test.isMissingLanguageVersionError(new Error('Cannot find a field')),
      false,
    );
  });

  it('createItem returns itemId and caches path', async () => {
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      assert.equal(body.variables.input.name, 'Hero');
      return gqlResponse({
        createItem: {
          item: {
            itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
            name: 'Hero',
            path: '/sitecore/content/Demo/Hero',
          },
        },
      });
    };

    const result = await createItem({
      name: 'Hero',
      parentId: '11111111111111111111111111111111',
      templateId: '22222222222222222222222222222222',
      auth: AUTH,
      fetchImpl,
    });
    assert.equal(result.itemId, 'aaaaaaaabbbbccccddddeeeeeeeeeeee');
    assert.equal(result.path, '/sitecore/content/Demo/Hero');
  });

  it('ensureItemByPath updates when find hits', async () => {
    let step = 0;
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      step += 1;
      if (body.query.includes('item(where: { path:')) {
        return gqlResponse({
          item: {
            itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
            name: 'Hero',
            path: '/sitecore/content/Demo/Hero',
          },
        });
      }
      if (body.query.includes('updateItem')) {
        assert.equal(body.variables.input.fields[0].value, 'Hi');
        return gqlResponse({
          updateItem: {
            item: {
              itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
              name: 'Hero',
              path: '/sitecore/content/Demo/Hero',
            },
          },
        });
      }
      throw new Error(`unexpected query step=${step}`);
    };

    const result = await ensureItemByPath({
      path: '/sitecore/content/Demo/Hero',
      parentId: '11111111111111111111111111111111',
      templateId: '22222222222222222222222222222222',
      fields: [{ name: 'Title', value: 'Hi' }],
      auth: AUTH,
      fetchImpl,
    });
    assert.equal(result.created, false);
    assert.equal(result.itemId, 'aaaaaaaabbbbccccddddeeeeeeeeeeee');
  });

  it('ensureItemByPath creates when missing', async () => {
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.query.includes('item(where: { path:')) {
        return gqlResponse({ item: null });
      }
      if (body.query.includes('createItem')) {
        return gqlResponse({
          createItem: {
            item: {
              itemId: '{BBBBBBBB-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
              name: 'Hero',
              path: '/sitecore/content/Demo/Hero',
            },
          },
        });
      }
      if (body.query.includes('updateItem')) {
        return gqlResponse({
          updateItem: {
            item: {
              itemId: '{BBBBBBBB-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
              name: 'Hero',
              path: '/sitecore/content/Demo/Hero',
            },
          },
        });
      }
      throw new Error('unexpected query');
    };

    const result = await ensureItemByPath({
      path: '/sitecore/content/Demo/Hero',
      parentId: '11111111111111111111111111111111',
      templateId: '22222222222222222222222222222222',
      fields: [{ name: 'Title', value: 'New' }],
      auth: AUTH,
      fetchImpl,
    });
    assert.equal(result.created, true);
    assert.equal(result.itemId, 'bbbbbbbbbbbbccccddddeeeeeeeeeeee');
  });

  it('ensureItemByPath recovers from create race via re-lookup + update', async () => {
    let pathLookups = 0;
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.query.includes('item(where: { path:')) {
        pathLookups += 1;
        if (pathLookups === 1) return gqlResponse({ item: null });
        return gqlResponse({
          item: {
            itemId: '{CCCCCCCC-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
            name: 'Hero',
            path: '/sitecore/content/Demo/Hero',
          },
        });
      }
      if (body.query.includes('createItem')) {
        return {
          ok: false,
          status: 400,
          async json() {
            return {
              errors: [{ message: 'An item with the same name already exists' }],
            };
          },
        };
      }
      if (body.query.includes('updateItem')) {
        return gqlResponse({
          updateItem: {
            item: {
              itemId: '{CCCCCCCC-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
              name: 'Hero',
              path: '/sitecore/content/Demo/Hero',
            },
          },
        });
      }
      throw new Error('unexpected query');
    };

    const result = await ensureItemByPath({
      path: '/sitecore/content/Demo/Hero',
      parentId: '11111111111111111111111111111111',
      templateId: '22222222222222222222222222222222',
      fields: [{ name: 'Title', value: 'Race' }],
      auth: AUTH,
      fetchImpl,
    });
    assert.equal(result.created, false);
    assert.equal(result.itemId, 'ccccccccbbbbccccddddeeeeeeeeeeee');
    assert.equal(pathLookups, 2);
  });

  it('updateItem requires itemId or path', async () => {
    await assert.rejects(
      () =>
        updateItem({
          fields: [{ name: 'Title', value: 'x' }],
          auth: AUTH,
          fetchImpl: async () => gqlResponse({}),
        }),
      /requires itemId or path/,
    );
  });

  it('formatBaseTemplateIds braces Authoring IDs', () => {
    assert.deepEqual(__test.formatBaseTemplateIds([BASE_STANDARD_TEMPLATE]), [
      '{1930BBEB-7805-471A-A3BE-4858AC7CF696}',
    ]);
    assert.deepEqual(
      __test.formatBaseTemplateIds(['a87a00b1-e6db-45ab-8b54-636fec3b5523']),
      ['{A87A00B1-E6DB-45AB-8B54-636FEC3B5523}'],
    );
    assert.equal(__test.formatBaseTemplateIds([]), undefined);
    assert.equal(__test.formatBaseTemplateIds(undefined), undefined);
  });

  it('ensureItemTemplate create path also forwards baseTemplates', async () => {
    let seen;
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.query.includes('item(where: { path:')) {
        // first lookup miss, then post-create hit
        if (!seen) return gqlResponse({ item: null });
        return gqlResponse({
          item: {
            itemId: '{EEEEEEEE-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
            name: 'Health Card',
            path: '/sitecore/templates/Project/menzis/Health Card',
          },
        });
      }
      if (body.query.includes('createItemTemplate')) {
        seen = body.variables.input;
        return gqlResponse({
          createItemTemplate: { itemTemplate: { name: 'Health Card' } },
        });
      }
      throw new Error(`unexpected: ${body.query?.slice?.(0, 60)}`);
    };

    const result = await ensureItemTemplate({
      path: '/sitecore/templates/Project/menzis/Health Card',
      parentId: '11111111111111111111111111111111',
      name: 'Health Card',
      baseTemplates: [BASE_STANDARD_TEMPLATE],
      auth: AUTH,
      fetchImpl,
    });
    assert.equal(result.created, true);
    assert.deepEqual(seen.baseTemplates, [
      '{1930BBEB-7805-471A-A3BE-4858AC7CF696}',
    ]);
  });

  it('createItemTemplate sends baseTemplates to Authoring', async () => {
    let seen;
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.query.includes('createItemTemplate')) {
        seen = body.variables.input;
        return gqlResponse({
          createItemTemplate: { itemTemplate: { name: 'Health Card' } },
        });
      }
      if (body.query.includes('item(where: { path:')) {
        return gqlResponse({
          item: {
            itemId: '{DDDDDDDD-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
            name: 'Health Card',
            path: '/sitecore/templates/Project/menzis/Health Card',
          },
        });
      }
      throw new Error(`unexpected: ${body.query?.slice?.(0, 60)}`);
    };

    const result = await createItemTemplate({
      name: 'Health Card',
      parentId: '11111111111111111111111111111111',
      path: '/sitecore/templates/Project/menzis/Health Card',
      baseTemplates: [BASE_STANDARD_TEMPLATE],
      auth: AUTH,
      fetchImpl,
    });
    assert.equal(result.itemId, 'ddddddddbbbbccccddddeeeeeeeeeeee');
    assert.deepEqual(seen.baseTemplates, [
      '{1930BBEB-7805-471A-A3BE-4858AC7CF696}',
    ]);
  });

  it('updateItemTemplate sends baseTemplates to Authoring', async () => {
    let seen;
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      assert.match(body.query, /updateItemTemplate/);
      seen = body.variables.input;
      return gqlResponse({
        updateItemTemplate: { itemTemplate: { name: 'Health Card' } },
      });
    };

    await updateItemTemplate({
      templateId: 'ddddddddbbbbccccddddeeeeeeeeeeee',
      name: 'Health Card',
      baseTemplates: [BASE_STANDARD_TEMPLATE],
      auth: AUTH,
      fetchImpl,
    });
    assert.deepEqual(seen.baseTemplates, [
      '{1930BBEB-7805-471A-A3BE-4858AC7CF696}',
    ]);
  });

  it('ensureItemTemplate forwards baseTemplates on update path', async () => {
    let seen;
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.query.includes('item(where: { path:')) {
        return gqlResponse({
          item: {
            itemId: '{DDDDDDDD-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
            name: 'Health Card',
            path: '/sitecore/templates/Project/menzis/Health Card',
          },
        });
      }
      if (body.query.includes('updateItemTemplate')) {
        seen = body.variables.input;
        return gqlResponse({
          updateItemTemplate: { itemTemplate: { name: 'Health Card' } },
        });
      }
      throw new Error(`unexpected: ${body.query?.slice?.(0, 60)}`);
    };

    const result = await ensureItemTemplate({
      path: '/sitecore/templates/Project/menzis/Health Card',
      parentId: '11111111111111111111111111111111',
      name: 'Health Card',
      baseTemplates: [BASE_STANDARD_TEMPLATE],
      auth: AUTH,
      fetchImpl,
    });
    assert.equal(result.created, false);
    assert.deepEqual(seen.baseTemplates, [
      '{1930BBEB-7805-471A-A3BE-4858AC7CF696}',
    ]);
  });

  it('ensureItemByPath creates missing language version then retries update', async () => {
    const calls = [];
    let updateAttempts = 0;
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const q = String(body.query || '');
      if (q.includes('item(where: { path:')) {
        calls.push('find');
        return gqlResponse({
          item: {
            itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
            name: 'Menzis Header Navigation',
            path: '/sitecore/content/Demo/Menzis Header Navigation',
          },
        });
      }
      if (q.includes('updateItem')) {
        updateAttempts += 1;
        calls.push(`update:${body.variables.input.language}`);
        if (updateAttempts === 1) {
          return {
            ok: false,
            status: 400,
            async json() {
              return {
                errors: [
                  {
                    message:
                      "The item 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' does not contain version # in 'nl-NL' language",
                  },
                ],
              };
            },
          };
        }
        assert.equal(body.variables.input.fields[0].value, 'Zoeken');
        return gqlResponse({
          updateItem: {
            item: {
              itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
              name: 'Menzis Header Navigation',
              path: '/sitecore/content/Demo/Menzis Header Navigation',
            },
          },
        });
      }
      if (q.includes('addItemVersion')) {
        calls.push(`addVersion:${body.variables.input.language}`);
        assert.equal(body.variables.input.language, 'nl-NL');
        assert.match(body.variables.input.itemId, /AAAAAAAA/i);
        return gqlResponse({
          addItemVersion: {
            item: {
              itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
              name: 'Menzis Header Navigation',
              path: '/sitecore/content/Demo/Menzis Header Navigation',
            },
          },
        });
      }
      throw new Error(`unexpected query: ${q.slice(0, 80)}`);
    };

    const result = await ensureItemByPath({
      path: '/sitecore/content/Demo/Menzis Header Navigation',
      parentId: '11111111111111111111111111111111',
      templateId: '22222222222222222222222222222222',
      language: 'nl-NL',
      fields: [{ name: 'Search Label', value: 'Zoeken' }],
      auth: AUTH,
      fetchImpl,
    });
    assert.equal(result.created, false);
    assert.equal(result.itemId, 'aaaaaaaabbbbccccddddeeeeeeeeeeee');
    assert.deepEqual(calls, [
      'find',
      'update:nl-NL',
      'addVersion:nl-NL',
      'update:nl-NL',
    ]);
  });

  function missingVersionFetchImpl() {
    let updateAttempts = 0;
    return async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const q = String(body.query || '');
      if (q.includes('item(where: { path:')) {
        return gqlResponse({
          item: {
            itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
            name: 'Demo',
            path: '/sitecore/content/Demo/Item',
          },
        });
      }
      if (q.includes('updateItem')) {
        updateAttempts += 1;
        if (updateAttempts === 1) {
          return {
            ok: false,
            status: 400,
            async json() {
              return {
                errors: [
                  {
                    message:
                      "The item 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' does not contain version # in 'nl-NL' language",
                  },
                ],
              };
            },
          };
        }
        return gqlResponse({
          updateItem: {
            item: {
              itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
              name: 'Demo',
              path: '/sitecore/content/Demo/Item',
            },
          },
        });
      }
      if (q.includes('addItemVersion')) {
        return gqlResponse({
          addItemVersion: {
            item: {
              itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
              name: 'Demo',
              path: '/sitecore/content/Demo/Item',
            },
          },
        });
      }
      throw new Error(`unexpected query: ${q.slice(0, 80)}`);
    };
  }

  it('missing-version soft retry is silent without BQ_CREATE_LOG=verbose', async () => {
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => {
      warns.push(args.map(String).join(' '));
    };
    try {
      await ensureItemByPath({
        path: '/sitecore/content/Demo/Item',
        parentId: '11111111111111111111111111111111',
        templateId: '22222222222222222222222222222222',
        language: 'nl-NL',
        fields: [{ name: 'Title', value: 'x' }],
        auth: AUTH,
        fetchImpl: missingVersionFetchImpl(),
      });
    } finally {
      console.warn = origWarn;
    }
    assert.equal(
      warns.some((w) => /missing nl-NL version|addItemVersion then retry/i.test(w)),
      false,
    );
  });

  it('missing-version soft retry logs [bq:apipush:authoring] when verbose', async () => {
    process.env.BQ_CREATE_LOG = 'verbose';
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => {
      warns.push(args.map(String).join(' '));
    };
    try {
      await ensureItemByPath({
        path: '/sitecore/content/Demo/Item',
        parentId: '11111111111111111111111111111111',
        templateId: '22222222222222222222222222222222',
        language: 'nl-NL',
        fields: [{ name: 'Title', value: 'x' }],
        auth: AUTH,
        fetchImpl: missingVersionFetchImpl(),
      });
    } finally {
      console.warn = origWarn;
    }
    const hit = warns.find((w) => /addItemVersion then retry/i.test(w));
    assert.ok(hit, `expected soft-retry warn, got: ${JSON.stringify(warns)}`);
    assert.match(hit, /\[bq:apipush:authoring\]/);
    assert.match(hit, /missing nl-NL version/);
  });
});
