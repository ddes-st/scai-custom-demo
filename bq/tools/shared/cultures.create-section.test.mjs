/**
 * create:sectioncomponents culture priority + strip empty cultures.
 * Run: node --test tools/shared/cultures.create-section.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureDefinitionCultures,
  isBqCulturesEnvSet,
  resolveCreateSectionCultures,
} from './cultures.mjs';

describe('resolveCreateSectionCultures', () => {
  it('CLI wins over env', () => {
    const out = resolveCreateSectionCultures({
      cliCultures: 'de-DE',
      env: { BQ_CULTURES: 'nl-BE' },
    });
    assert.deepEqual(out, ['de-DE']);
  });

  it('empty BQ_CULTURES means no extras', () => {
    const env = { BQ_CULTURES: '' };
    assert.equal(isBqCulturesEnvSet(env), true);
    const out = resolveCreateSectionCultures({
      cliCultures: null,
      env,
    });
    assert.deepEqual(out, []);
  });

  it('unset env means no extras (page-meta is not a source)', () => {
    const out = resolveCreateSectionCultures({
      cliCultures: null,
      env: {},
    });
    assert.deepEqual(out, []);
  });

  it('non-empty BQ_CULTURES used when set', () => {
    const out = resolveCreateSectionCultures({
      cliCultures: null,
      env: { BQ_CULTURES: 'fr-FR,nl-NL' },
    });
    assert.deepEqual(out, ['fr-FR', 'nl-NL']);
  });
});

describe('ensureDefinitionCultures strip', () => {
  it('removes cultures array when list is empty', () => {
    const src = `
export const x = {
  content: {
    cultures: ["nl-BE", "fr-BE"],
    location: { root: "data" },
    items: [],
  },
};
`;
    const out = ensureDefinitionCultures(src, []);
    assert.doesNotMatch(out, /\bcultures\s*:/);
    assert.match(out, /location:\s*\{\s*root:\s*"data"/);
  });
});
