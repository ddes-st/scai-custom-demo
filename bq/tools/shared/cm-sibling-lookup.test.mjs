/**
 * Run: node --import tsx --test tools/shared/cm-sibling-lookup.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isRetryableCmLookupFailure,
  isSoftBqScaffoldSitecorePath,
  parseNonUniquePathsFromSerError,
  withCmLookupRetries,
} from './cm-sibling-lookup.ts';
import { stableGuid } from './ids.ts';

describe('parseNonUniquePathsFromSerError', () => {
  it('parses path and truncated IDs', () => {
    const hits = parseNonUniquePathsFromSerError(
      'Non-unique path /sitecore/media library/Project/crelan/shared (IDs 75282ebc-… vs 5f3b2556-…)',
    );
    assert.equal(hits.length, 1);
    assert.equal(
      hits[0].path,
      '/sitecore/media library/Project/crelan/shared',
    );
    assert.ok(hits[0].ids.some((id) => id.startsWith('75282ebc')));
    assert.ok(hits[0].ids.some((id) => id.startsWith('5f3b2556')));
  });
});

describe('isSoftBqScaffoldSitecorePath', () => {
  it('matches media shared and Project media roots', () => {
    assert.equal(
      isSoftBqScaffoldSitecorePath(
        '/sitecore/media library/Project/crelan/shared',
      ),
      true,
    );
    assert.equal(
      isSoftBqScaffoldSitecorePath('/sitecore/media library/Project/crelan'),
      true,
    );
  });

  it('rejects arbitrary content paths', () => {
    assert.equal(
      isSoftBqScaffoldSitecorePath(
        '/sitecore/content/crelan/crelan-be/Home/About',
      ),
      false,
    );
  });
});

describe('isRetryableCmLookupFailure', () => {
  it('matches auth and network blips', () => {
    assert.equal(
      isRetryableCmLookupFailure(
        new Error('Error discovering identity provider'),
      ),
      true,
    );
    assert.equal(
      isRetryableCmLookupFailure(new Error('No access token for Authoring')),
      true,
    );
    assert.equal(
      isRetryableCmLookupFailure(new Error('invalid_client permanent')),
      false,
    );
  });
});

describe('withCmLookupRetries', () => {
  it('retries then succeeds', async () => {
    let calls = 0;
    const sleeps = [];
    const result = await withCmLookupRetries(
      async () => {
        calls += 1;
        if (calls === 1) throw new Error('discovering identity provider');
        return 'ok';
      },
      {
        delayMs: 5,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
    assert.deepEqual(sleeps, [5]);
  });

  it('does not retry non-retryable errors', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withCmLookupRetries(
          async () => {
            calls += 1;
            throw new Error('schema validation failed permanently');
          },
          { delayMs: 5, sleep: async () => {} },
        ),
      /schema validation/,
    );
    assert.equal(calls, 1);
  });
});

describe('crelan shared scaffold GUID', () => {
  it('matches historical local mint for media shared.yml (canonical)', () => {
    assert.equal(
      stableGuid(
        'bq-collection-scaffold:crelan',
        'f7f7de5e-6bb6-486d-a303-7eba43bba208',
      ),
      '5f3b25568574529e8340f999bd1106c3',
    );
  });
});
