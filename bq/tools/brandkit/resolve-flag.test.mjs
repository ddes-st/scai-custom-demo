/**
 * Run: node --test tools/brandkit/resolve-flag.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvBool, resolveCreateBrandkit } from './resolve-flag.mjs';

describe('parseEnvBool', () => {
  it('parses truthy/falsey', () => {
    assert.equal(parseEnvBool('true'), true);
    assert.equal(parseEnvBool('1'), true);
    assert.equal(parseEnvBool('yes'), true);
    assert.equal(parseEnvBool('false'), false);
    assert.equal(parseEnvBool('0'), false);
    assert.equal(parseEnvBool(''), null);
    assert.equal(parseEnvBool(undefined), null);
  });
});

describe('resolveCreateBrandkit', () => {
  it('defaults to false', () => {
    assert.equal(resolveCreateBrandkit({}, {}), false);
  });

  it('reads env when CLI unset', () => {
    assert.equal(
      resolveCreateBrandkit({}, { BQ_CREATE_BRANDKIT: 'true' }),
      true,
    );
    assert.equal(
      resolveCreateBrandkit({}, { BQ_CREATE_BRANDKIT: 'false' }),
      false,
    );
  });

  it('CLI wins over env', () => {
    assert.equal(
      resolveCreateBrandkit(
        { brandkit: true },
        { BQ_CREATE_BRANDKIT: 'false' },
      ),
      true,
    );
    assert.equal(
      resolveCreateBrandkit(
        { brandkit: false },
        { BQ_CREATE_BRANDKIT: 'true' },
      ),
      false,
    );
  });
});
