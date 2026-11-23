/**
 * Run: node --test tools/brandkit/upsert-resolve.test.mjs
 */
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeBrandkitState } from './state.mjs';
import {
  createBrandKitOrReuse,
  ensureDosDontRemoteSubsections,
  resolveExistingBrandkitId,
} from './upsert.mjs';
import { isDuplicateBrandKitNameError } from './client.mjs';
import {
  DOS_DONT_EXTENSIONS_FIELD,
  DOS_DONT_RESTRICTIONS_FIELD,
} from './generate-content.mjs';

const CTX = {
  organizationId: 'org_1',
  baseUrl: 'https://edge.example/ai/ai-brands-api',
  token: 'tok',
};

/**
 * @param {(url: string, init?: RequestInit) => Promise<Response>|Response} handler
 */
function mockFetch(handler) {
  return mock.method(globalThis, 'fetch', async (url, init) => {
    return handler(String(url), init);
  });
}

describe('isDuplicateBrandKitNameError', () => {
  it('detects 400 duplicate', () => {
    const err = new Error('Duplicate brand kit name');
    err.status = 400;
    err.body = { message: 'Duplicate brand kit name' };
    assert.equal(isDuplicateBrandKitNameError(err), true);
  });

  it('ignores unrelated 500', () => {
    const err = new Error('boom');
    err.status = 500;
    err.body = { message: 'internal' };
    assert.equal(isDuplicateBrandKitNameError(err), false);
  });
});

describe('resolveExistingBrandkitId', () => {
  /** @type {string} */
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'bq-bk-resolve-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    mock.restoreAll();
  });

  it('reuses id from state when GET succeeds', async () => {
    await writeBrandkitState(dir, {
      brandkitId: 'state-kit-1',
      createdBy: 'bq',
    });

    mockFetch((url) => {
      assert.match(url, /brandkits\/state-kit-1$/);
      return new Response(
        JSON.stringify({ id: 'state-kit-1', name: 'Demo Brand Kit' }),
        { status: 200 },
      );
    });

    const result = await resolveExistingBrandkitId(CTX, {
      hostProjectRoot: dir,
      kitName: 'Demo Brand Kit',
    });
    assert.equal(result.brandkitId, 'state-kit-1');
    assert.equal(result.source, 'state');
  });

  it('falls back to list-name when state missing', async () => {
    mockFetch((url) => {
      assert.match(url, /brandkits\?/);
      return new Response(
        JSON.stringify([
          { id: 'listed-9', name: 'Demo Brand Kit' },
          { id: 'other', name: 'Other Kit' },
        ]),
        { status: 200 },
      );
    });

    const result = await resolveExistingBrandkitId(CTX, {
      hostProjectRoot: dir,
      kitName: 'Demo Brand Kit',
    });
    assert.equal(result.brandkitId, 'listed-9');
    assert.equal(result.source, 'list-name');
  });
});

describe('createBrandKitOrReuse', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('returns created on success', async () => {
    mockFetch((url, init) => {
      assert.equal(init?.method, 'POST');
      assert.match(url, /brandkits$/);
      return new Response(JSON.stringify({ id: 'new-1' }), { status: 200 });
    });
    const result = await createBrandKitOrReuse(CTX, {
      name: 'Demo Brand Kit',
    });
    assert.equal(result.brandkitId, 'new-1');
    assert.equal(result.source, 'created');
  });

  it('reuses on duplicate-name error', async () => {
    let step = 0;
    mockFetch((url, init) => {
      step += 1;
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({ message: 'Duplicate brand kit name' }),
          { status: 400 },
        );
      }
      assert.match(url, /brandkits\?/);
      return new Response(
        JSON.stringify([{ id: 'existing-dup', name: 'Demo Brand Kit' }]),
        { status: 200 },
      );
    });
    const result = await createBrandKitOrReuse(CTX, {
      name: 'Demo Brand Kit',
    });
    assert.equal(result.brandkitId, 'existing-dup');
    assert.equal(result.source, 'duplicate-name');
    assert.ok(step >= 2);
  });
});

describe('ensureDosDontRemoteSubsections', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('POSTs create for missing Extensions and Restrictions', async () => {
    /** @type {string[]} */
    const createdNames = [];
    mockFetch((url, init) => {
      assert.equal(init?.method, 'POST');
      assert.match(url, /\/sections\/sec-dd\/fields$/);
      const body = JSON.parse(String(init?.body || '{}'));
      createdNames.push(body.name);
      return new Response(
        JSON.stringify({
          id: `field-${body.name}`,
          name: body.name,
          value: body.value,
        }),
        { status: 200 },
      );
    });

    const fields = await ensureDosDontRemoteSubsections(
      CTX,
      'kit-1',
      'sec-dd',
      [{ id: 'f-existing', name: "Dos and dont's", value: 'Do be clear.' }],
    );

    assert.deepEqual(createdNames.sort(), [
      DOS_DONT_EXTENSIONS_FIELD,
      DOS_DONT_RESTRICTIONS_FIELD,
    ].sort());
    assert.equal(fields.length, 3);
    assert.ok(fields.some((f) => f.name === DOS_DONT_EXTENSIONS_FIELD));
    assert.ok(fields.some((f) => f.name === DOS_DONT_RESTRICTIONS_FIELD));
  });

  it('skips create when both already exist', async () => {
    let posts = 0;
    mockFetch(() => {
      posts += 1;
      return new Response('{}', { status: 200 });
    });

    const fields = await ensureDosDontRemoteSubsections(
      CTX,
      'kit-1',
      'sec-dd',
      [
        { id: '1', name: DOS_DONT_EXTENSIONS_FIELD, value: 'x' },
        { id: '2', name: DOS_DONT_RESTRICTIONS_FIELD, value: 'y' },
      ],
    );
    assert.equal(posts, 0);
    assert.equal(fields.length, 2);
  });
});
