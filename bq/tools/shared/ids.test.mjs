/**
 * Run: node --import tsx --test tools/shared/ids.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  braceGuid,
  canonicalItemId,
  stableGuid,
  toAuthoringGuid,
  toScsYamlGuid,
} from './ids.ts';

describe('canonicalItemId', () => {
  it('strips braces and dashes to 32 hex', () => {
    assert.equal(
      canonicalItemId('{8EE87FDF-A73E-4E89-817B-B12EB245389A}'),
      '8ee87fdfa73e4e89817bb12eb245389a',
    );
    assert.equal(
      canonicalItemId('8ee87fdf-a73e-4e89-817b-b12eb245389a'),
      '8ee87fdfa73e4e89817bb12eb245389a',
    );
    assert.equal(
      canonicalItemId('8ee87fdfa73e4e89817bb12eb245389a'),
      '8ee87fdfa73e4e89817bb12eb245389a',
    );
  });

  it('returns empty for invalid', () => {
    assert.equal(canonicalItemId('not-a-guid'), '');
    assert.equal(canonicalItemId(''), '');
  });
});

describe('toScsYamlGuid / toAuthoringGuid', () => {
  it('emits dashed YAML form from compact', () => {
    assert.equal(
      toScsYamlGuid('8ee87fdfa73e4e89817bb12eb245389a'),
      '8ee87fdf-a73e-4e89-817b-b12eb245389a',
    );
  });

  it('emits braced uppercase for authoring', () => {
    assert.equal(
      toAuthoringGuid('8ee87fdfa73e4e89817bb12eb245389a'),
      '{8EE87FDF-A73E-4E89-817B-B12EB245389A}',
    );
    assert.equal(
      braceGuid('8ee87fdf-a73e-4e89-817b-b12eb245389a'),
      '{8EE87FDF-A73E-4E89-817B-B12EB245389A}',
    );
  });
});

describe('stableGuid', () => {
  it('returns canonical 32-hex (no dashes)', () => {
    const id = stableGuid('test-ns', 'item-a');
    assert.equal(id.length, 32);
    assert.equal(id.includes('-'), false);
    assert.equal(canonicalItemId(id), id);
    assert.equal(stableGuid('test-ns', 'item-a'), id);
  });
});
