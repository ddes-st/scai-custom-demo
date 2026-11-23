/**
 * Run: node --test tools/create-section-components/definition-repeat-hint.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertDefinitionTsRepeatHint,
  countContentItemsInDefinitionTs,
} from './ai-source-fixup.mjs';
import { DEFINITION_REPEAT_HINT_FIX_HEADER } from './definition-validate-iters.mjs';
import {
  parsePlaceholderSlotsFromDefinition,
  resolveChildMountPlaceholder,
} from './visual-fidelity/compose-tree.mjs';

const ONE_ITEM = `
export const d = {
  content: {
    items: [
      { name: "Proximity Feature", fields: { Title: "Dichtbij" } },
    ],
  },
};
`;

const TWENTY_ITEMS = `
export const d = {
  content: {
    items: [
      ${Array.from({ length: 20 }, (_, i) => `{ name: "Item ${i}", fields: {} }`).join(',\n      ')}
    ],
  },
};
`;

describe('countContentItemsInDefinitionTs / assertDefinitionTsRepeatHint', () => {
  it('counts top-level items', () => {
    assert.equal(countContentItemsInDefinitionTs(ONE_ITEM), 1);
    assert.equal(countContentItemsInDefinitionTs(TWENTY_ITEMS), 20);
  });

  it('accepts repeatHint 1 with one item', () => {
    assertDefinitionTsRepeatHint(ONE_ITEM, 1);
  });

  it('rejects repeatHint 1 with 20 items', () => {
    assert.throws(
      () => assertDefinitionTsRepeatHint(TWENTY_ITEMS, 1, 'proximity.definition.ts'),
      /DEFINITION REPEAT HINT/,
    );
  });

  it('exposes retry header', () => {
    assert.match(DEFINITION_REPEAT_HINT_FIX_HEADER, /repeatHint/);
  });
});

describe('compose-tree multi-slot mount resolution', () => {
  it('parses multiple placeholder slots and routes children', () => {
    const def = `
export const p = {
  placeholders: [
    { key: "navigation-card-items", allowedControls: ["crelan-navigation-card"] },
    { key: "proximity-feature", allowedControls: ["crelan-proximity-feature"] },
    { key: "value-statement-items", allowedControls: ["crelan-value-statement"] },
  ],
};
`;
    const slots = parsePlaceholderSlotsFromDefinition(def);
    assert.equal(slots.length, 3);
    assert.equal(
      resolveChildMountPlaceholder({
        componentName: 'CrelanProximityFeature',
        definitionKey: 'crelan-proximity-feature',
        slots,
        fallbackKey: 'main',
      }),
      'proximity-feature',
    );
    assert.equal(
      resolveChildMountPlaceholder({
        componentName: 'CrelanNavigationCard',
        definitionKey: 'crelan-navigation-card',
        slots,
        fallbackKey: 'main',
      }),
      'navigation-card-items',
    );
  });
});
