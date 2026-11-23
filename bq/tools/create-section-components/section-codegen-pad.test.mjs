import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertContentItemsMatchPeerCount,
  ensureDefinitionContentItemCount,
  sanitizeDefinitionTsImport,
  warnIfContentItemCountBelowHint,
} from './section-codegen.mjs';
import { countContentItemsInDefinitionTs } from './ai-source-fixup.mjs';

describe('sanitizeDefinitionTsImport', () => {
  it('rewrites ellipsis / lib import paths', () => {
    const src = `import type { ComponentTemplateDefinition } from '…/tools/definitions/types';\nexport const X = { definitionKey: 'crelan/foo' } satisfies ComponentTemplateDefinition;\n`;
    const out = sanitizeDefinitionTsImport(src);
    assert.match(out, /\.\.\/\.\.\/\.\.\/\.\.\/tools\/definitions\/types/);
    assert.match(out, /definitionKey: 'crelan-foo'/);
    assert.doesNotMatch(out, /…/);
  });
});

describe('warnIfContentItemCountBelowHint', () => {
  it('does not pad or clone when under-seeded', () => {
    const sample = `export const x = {
  kind: "component",
  definitionKey: "crelan-navigation-card",
  content: { location: { root: "data", folder: ["X"] }, culture: "nl-BE", items: [
    { name: 'Zichtrekeningen', fields: { Title: 'Zichtrekeningen' } },
  ] },
} satisfies ComponentTemplateDefinition;`;
    const result = warnIfContentItemCountBelowHint(
      sample,
      8,
      'NavigationCard',
    );
    assert.equal(result.ok, false);
    assert.equal(result.actual, 1);
    assert.equal(result.expected, 8);
    assert.equal(countContentItemsInDefinitionTs(result.definitionTs), 1);
    assert.equal(result.definitionTs, sample);
    assert.doesNotMatch(result.definitionTs, /NavigationCard 2/);
  });

  it('reports ok when count meets hint', () => {
    const sample = `export const x = {
  content: { items: [
    { name: 'A', fields: {} },
    { name: 'B', fields: {} },
    { name: 'C', fields: {} },
  ] },
} satisfies ComponentTemplateDefinition;`;
    const result = warnIfContentItemCountBelowHint(sample, 3, 'Card');
    assert.equal(result.ok, true);
    assert.equal(result.actual, 3);
    assert.equal(result.definitionTs, sample);
  });

  it('ensureDefinitionContentItemCount is a non-mutating passthrough', () => {
    const sample = `export const x = {
  content: { items: [{ name: 'Only', fields: { Title: 'Only' } }] },
} satisfies ComponentTemplateDefinition;`;
    const out = ensureDefinitionContentItemCount(sample, 4, 'UspItem');
    assert.equal(out, sample);
    assert.equal(countContentItemsInDefinitionTs(out), 1);
    assert.doesNotMatch(out, /UspItem 2/);
  });
});

describe('assertContentItemsMatchPeerCount', () => {
  it('hard-fails when items < peer count (≥2)', () => {
    const sample = `export const x = {
  content: { items: [{ name: 'Only', fields: {} }] },
};`;
    assert.throws(
      () => assertContentItemsMatchPeerCount(sample, 6, 'SplitContentBand'),
      /CONTRACT: content\.items under-seeded/,
    );
  });

  it('passes when items meet peer count', () => {
    const sample = `export const x = {
  content: { items: [
    { name: 'A', fields: {} },
    { name: 'B', fields: {} },
  ] },
};`;
    assert.equal(assertContentItemsMatchPeerCount(sample, 2, 'Band'), sample);
  });

  it('no-ops for peer count < 2', () => {
    const sample = `export const x = { content: { items: [] } };`;
    assert.equal(assertContentItemsMatchPeerCount(sample, 1, 'Band'), sample);
  });
});
