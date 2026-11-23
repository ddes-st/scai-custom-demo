/**
 * Run: node --test tools/shared/apply-source-cache.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  canSkipApplyFromSourceCache,
  computeApplySourceHash,
  applySourceScopeKey,
  APPLY_SOURCE_PIPELINE_VERSION,
  getLastSuccessfulFromEntry,
  isDefinitionApplyDirty,
  recordComponentsSuccessAt,
  recordApplySourceCache,
  readScopeLastSuccessful,
} from './apply-source-cache.mjs';

const TEST_SCOPE = {
  collectionSystem: '__bq_emit_source_test_coll',
  siteSystem: '__bq_emit_source_test_site',
};

describe('applySourceScopeKey', () => {
  it('normalizes collection::site', () => {
    assert.equal(
      applySourceScopeKey({
        collectionSystem: 'Sitecore',
        siteSystem: 'Sitecore-Com',
      }),
      'sitecore::sitecore-com',
    );
  });
});

describe('computeApplySourceHash', () => {
  it('is stable for the same scope', async () => {
    const a = await computeApplySourceHash(TEST_SCOPE);
    const b = await computeApplySourceHash(TEST_SCOPE);
    assert.equal(typeof a, 'string');
    assert.equal(a.length, 64);
    assert.equal(a, b);
  });

  it('differs when scope key differs', async () => {
    const a = await computeApplySourceHash(TEST_SCOPE);
    const b = await computeApplySourceHash({
      ...TEST_SCOPE,
      siteSystem: '__bq_emit_source_test_site_other',
    });
    assert.notEqual(a, b);
  });
});

describe('canSkipApplyFromSourceCache', () => {
  it('does not skip when force apply', async () => {
    const hash = await computeApplySourceHash(TEST_SCOPE);
    await recordApplySourceCache({ ...TEST_SCOPE, hash });
    const result = await canSkipApplyFromSourceCache({
      ...TEST_SCOPE,
      forceKinds: new Set(['apply']),
      hash,
    });
    assert.equal(result.skip, false);
    assert.match(result.reason, /force apply/);
  });

  it('does not skip when force translations', async () => {
    const hash = await computeApplySourceHash(TEST_SCOPE);
    const result = await canSkipApplyFromSourceCache({
      ...TEST_SCOPE,
      forceKinds: new Set(['translations']),
      hash,
    });
    assert.equal(result.skip, false);
  });

  it('skips when hash matches prior record and no force', async () => {
    const hash = await computeApplySourceHash(TEST_SCOPE);
    await recordApplySourceCache({ ...TEST_SCOPE, hash });
    const result = await canSkipApplyFromSourceCache({
      ...TEST_SCOPE,
      forceKinds: new Set(),
      hash,
    });
    assert.equal(result.skip, true);
    assert.match(result.reason, /unchanged/);
    assert.equal(result.hash, hash);
    assert.ok(result.yamlsAt);
  });

  it('does not skip when scope inactive', async () => {
    const result = await canSkipApplyFromSourceCache({
      collectionSystem: null,
      siteSystem: null,
      forceKinds: new Set(),
    });
    assert.equal(result.skip, false);
    assert.match(result.reason, /inactive/);
  });
});

describe('lastSuccessful watermarks', () => {
  it('recordApplySourceCache stamps yamlsAt and preserves componentsAt', async () => {
    const hash = await computeApplySourceHash(TEST_SCOPE);
    await recordComponentsSuccessAt({
      ...TEST_SCOPE,
      componentsAt: '2020-01-01T00:00:00.000Z',
    });
    await recordApplySourceCache({
      ...TEST_SCOPE,
      hash,
      yamlsAt: '2021-06-01T00:00:00.000Z',
    });
    const ls = await readScopeLastSuccessful(TEST_SCOPE);
    assert.equal(ls.yamlsAt, '2021-06-01T00:00:00.000Z');
    assert.equal(ls.componentsAt, '2020-01-01T00:00:00.000Z');
  });

  it('recordComponentsSuccessAt stamps componentsAt and preserves yamlsAt', async () => {
    const hash = await computeApplySourceHash(TEST_SCOPE);
    await recordApplySourceCache({
      ...TEST_SCOPE,
      hash,
      yamlsAt: '2022-01-01T00:00:00.000Z',
    });
    await recordComponentsSuccessAt({
      ...TEST_SCOPE,
      componentsAt: '2023-01-01T00:00:00.000Z',
    });
    const ls = await readScopeLastSuccessful(TEST_SCOPE);
    assert.equal(ls.yamlsAt, '2022-01-01T00:00:00.000Z');
    assert.equal(ls.componentsAt, '2023-01-01T00:00:00.000Z');
  });

  it('getLastSuccessfulFromEntry reads nested and legacy shapes', () => {
    assert.deepEqual(
      getLastSuccessfulFromEntry({
        lastSuccessful: { yamlsAt: 'a', componentsAt: 'b' },
      }),
      { yamlsAt: 'a', componentsAt: 'b' },
    );
    assert.deepEqual(
      getLastSuccessfulFromEntry({ lastSuccessfulApplyAt: 'legacy' }),
      { yamlsAt: 'legacy', componentsAt: null },
    );
  });
});

describe('isDefinitionApplyDirty', () => {
  it('is dirty when yamlsAt missing or force', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bq-yamls-'));
    const def = path.join(dir, 'foo.definition.ts');
    await writeFile(def, 'export const x = 1;\n', 'utf8');
    const missing = await isDefinitionApplyDirty({
      definitionFile: def,
      yamlsAt: null,
      forceKinds: new Set(),
      scopeActive: true,
    });
    assert.equal(missing.dirty, true);
    const forced = await isDefinitionApplyDirty({
      definitionFile: def,
      yamlsAt: '2099-01-01T00:00:00.000Z',
      forceKinds: new Set(['apply']),
      scopeActive: true,
    });
    assert.equal(forced.dirty, true);
  });

  it('is clean when mtime is older than yamlsAt', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bq-yamls-'));
    const def = path.join(dir, 'bar.definition.ts');
    await writeFile(def, 'export const y = 2;\n', 'utf8');
    const past = new Date('2020-01-01T00:00:00.000Z');
    await utimes(def, past, past);
    const clean = await isDefinitionApplyDirty({
      definitionFile: def,
      yamlsAt: '2021-01-01T00:00:00.000Z',
      forceKinds: new Set(),
      scopeActive: true,
    });
    assert.equal(clean.dirty, false);
  });

  it('is dirty when mtime is newer than yamlsAt', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bq-yamls-'));
    const def = path.join(dir, 'baz.definition.ts');
    await writeFile(def, 'export const z = 3;\n', 'utf8');
    const future = new Date('2030-01-01T00:00:00.000Z');
    await utimes(def, future, future);
    const dirty = await isDefinitionApplyDirty({
      definitionFile: def,
      yamlsAt: '2021-01-01T00:00:00.000Z',
      forceKinds: new Set(),
      scopeActive: true,
    });
    assert.equal(dirty.dirty, true);
    assert.match(dirty.reason, /newer than yamlsAt/);
  });
});

describe('APPLY_SOURCE_PIPELINE_VERSION', () => {
  it('is v2', () => {
    assert.equal(APPLY_SOURCE_PIPELINE_VERSION, 'apply-source/v2');
  });
});
