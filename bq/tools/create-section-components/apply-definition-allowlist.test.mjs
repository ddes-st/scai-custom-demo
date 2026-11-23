import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDefinitionKeysCliArg } from './apply-definition-allowlist.mjs';

describe('formatDefinitionKeysCliArg', () => {
  it('returns null when keys is null (no allowlist mode)', () => {
    assert.equal(formatDefinitionKeysCliArg(null), null);
  });

  it('formats empty allowlist as empty --definitionKeys=', () => {
    assert.equal(formatDefinitionKeysCliArg([]), '--definitionKeys=');
  });

  it('joins keys', () => {
    assert.equal(
      formatDefinitionKeysCliArg(['b', 'a']),
      '--definitionKeys=b,a',
    );
  });
});
