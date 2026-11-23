/**
 * Content-hash datasource upsert.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  datasourceItemNameForInstance,
  hashContentSeed,
  upsertContentItemByHash,
} from './content-hash-merge.mjs';

describe('hashContentSeed', () => {
  it('is stable for same payload', () => {
    assert.equal(hashContentSeed({ a: 1 }), hashContentSeed({ a: 1 }));
  });
});

describe('upsertContentItemByHash', () => {
  it('reuses item when bqContentHash marker matches', () => {
    const def = `
export const x = {
  content: {
    items: [
      { name: 'Hero A' /* bqContentHash:deadbeefcafebabe */, fields: {} },
    ],
  },
};
`;
    const r = upsertContentItemByHash(def, {
      preferredName: 'Hero B',
      contentHash: 'deadbeefcafebabe',
    });
    assert.equal(r.reused, true);
    assert.equal(r.itemName, 'Hero A');
  });

  it('inserts marked item when missing', () => {
    const def = `
export const x = {
  content: {
    items: [
    ],
  },
};
`;
    const r = upsertContentItemByHash(def, {
      preferredName: 'Offer',
      contentHash: 'abc123',
      itemSnippet: `{ name: 'Offer', fields: {} }`,
    });
    assert.equal(r.reused, false);
    assert.match(r.definitionTs, /bqContentHash:abc123/);
    assert.match(r.definitionTs, /name: 'Offer'/);
  });
});

describe('datasourceItemNameForInstance', () => {
  it('includes hash suffix', () => {
    assert.match(
      datasourceItemNameForInstance({
        contentHash: 'abcdefghijklmnop',
        fallbackName: 'Welcome Hero',
      }),
      /Welcome Hero abcdefgh/,
    );
  });
});
