/**
 * Run: node --test tools/shared/authoring-force-kinds.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AUTHORING_FORCE_KINDS,
  BARE_FORCE_KINDS,
  consumeForceArg,
  formatForceArg,
  formatForceArgForGenerate,
  parseAuthoringForce,
  parseForceKindsValue,
  shouldForce,
  shouldForceApply,
  shouldForceConversion,
  shouldForceYamlEmit,
} from './authoring-force-kinds.mjs';

describe('parseForceKindsValue', () => {
  it('bare / empty → components + definition + apply (not translations)', () => {
    const a = parseForceKindsValue('');
    const b = parseForceKindsValue(null);
    for (const k of BARE_FORCE_KINDS) {
      assert.equal(a.has(k), true);
      assert.equal(b.has(k), true);
    }
    assert.equal(a.has('translations'), false);
  });

  it('--force:translations alone → all kinds including translations', () => {
    const set = parseForceKindsValue('translations');
    for (const k of AUTHORING_FORCE_KINDS) {
      assert.equal(set.has(k), true, k);
    }
  });

  it('--force:all → all kinds', () => {
    const set = parseForceKindsValue('all');
    for (const k of AUTHORING_FORCE_KINDS) {
      assert.equal(set.has(k), true, k);
    }
  });

  it('explicit list is exact (translations + apply does not expand)', () => {
    const set = parseForceKindsValue('translations,apply');
    assert.deepEqual([...set].sort(), ['apply', 'translations']);
  });

  it('yaml is deprecated alias for apply', () => {
    const set = parseForceKindsValue('translations,yaml');
    assert.deepEqual([...set].sort(), ['apply', 'translations']);
  });

  it('ai alias → components + definition', () => {
    const set = parseForceKindsValue('ai');
    assert.deepEqual([...set].sort(), ['components', 'definition']);
  });

  it('definitions alias → definition', () => {
    const set = parseForceKindsValue('definitions');
    assert.deepEqual([...set], ['definition']);
  });

  it('rejects unknown kinds', () => {
    assert.throws(() => parseForceKindsValue('nope'), /Unknown --force kind/);
  });
});

describe('consumeForceArg', () => {
  it('bare --force does not consume following token', () => {
    const consumed = consumeForceArg(['--force', 'section-04'], 0);
    assert.ok(consumed);
    assert.equal(consumed.nextIndex, 1);
    assert.equal(consumed.force.has('apply'), true);
    assert.equal(consumed.force.has('translations'), false);
  });

  it('supports --force:all and --force=all', () => {
    const a = consumeForceArg(['--force:all'], 0);
    const b = consumeForceArg(['--force=all'], 0);
    assert.equal(a.force.has('translations'), true);
    assert.equal(b.force.has('translations'), true);
  });

  it('supports --force:apply', () => {
    const consumed = consumeForceArg(['--force:apply'], 0);
    assert.deepEqual([...consumed.force], ['apply']);
  });

  it('supports --force:yaml as apply alias', () => {
    const consumed = consumeForceArg(['--force:yaml'], 0);
    assert.deepEqual([...consumed.force], ['apply']);
  });
});

describe('shouldForce helpers', () => {
  it('shouldForceConversion for components or definition', () => {
    assert.equal(shouldForceConversion(new Set(['components'])), true);
    assert.equal(shouldForceConversion(new Set(['definition'])), true);
    assert.equal(shouldForceConversion(new Set(['apply'])), false);
  });

  it('shouldForceApply for apply or translations', () => {
    assert.equal(shouldForceApply(new Set(['apply'])), true);
    assert.equal(shouldForceApply(new Set(['translations'])), true);
    assert.equal(shouldForceApply(new Set(['components'])), false);
  });

  it('shouldForceYamlEmit delegates to shouldForceApply', () => {
    assert.equal(shouldForceYamlEmit(new Set(['apply'])), true);
    assert.equal(shouldForceYamlEmit(new Set(['yaml'])), false);
  });
});

describe('formatForceArg / formatForceArgForGenerate', () => {
  it('formats bare-equivalent as --force', () => {
    assert.equal(formatForceArg(new Set(BARE_FORCE_KINDS)), '--force');
  });

  it('formats all as --force:all', () => {
    assert.equal(formatForceArg(new Set(AUTHORING_FORCE_KINDS)), '--force:all');
  });

  it('forwards only apply/translations to generate', () => {
    assert.equal(
      formatForceArgForGenerate(new Set(BARE_FORCE_KINDS)),
      '--force:apply',
    );
    assert.equal(
      formatForceArgForGenerate(new Set(AUTHORING_FORCE_KINDS)),
      '--force:translations,apply',
    );
    assert.equal(formatForceArgForGenerate(new Set(['components'])), null);
  });
});

describe('parseAuthoringForce', () => {
  it('last force wins', () => {
    const force = parseAuthoringForce(['--force', '--force:apply']);
    assert.equal(shouldForce(force, 'apply'), true);
    assert.equal(shouldForce(force, 'components'), false);
  });
});
