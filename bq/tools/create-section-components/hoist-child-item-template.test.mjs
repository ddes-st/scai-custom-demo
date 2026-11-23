/**
 * Run: node --test tools/create-section-components/hoist-child-item-template.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hoistNestedChildItemTemplate } from './ai-source-fixup.mjs';

describe('hoistNestedChildItemTemplate', () => {
  it('hoists childItemTemplate nested under itemTemplate', () => {
    const src = `
export const def = {
  model: {
    itemTemplate: {
      name: 'Recognition Cards',
      sections: [{ name: 'Data', fields: [{ name: 'Heading' }] }],
      childItemTemplate: {
        name: 'Recognition Badge',
        sections: [{ name: 'Data', fields: [{ name: 'Logo' }] }],
      },
    },
  },
};
`;
    const out = hoistNestedChildItemTemplate(src);
    assert.match(out, /itemTemplate:\s*\{/);
    assert.match(out, /childItemTemplate:\s*\{/);
    // Sibling under model — not nested inside itemTemplate body
    const itemIdx = out.indexOf('itemTemplate:');
    const childIdx = out.indexOf('childItemTemplate:');
    assert.ok(childIdx > itemIdx);
    const between = out.slice(itemIdx, childIdx);
    assert.match(between, /\}/);
    assert.doesNotMatch(between, /childItemTemplate/);
    assert.match(out, /name: 'Recognition Badge'/);
    assert.match(out, /Logo/);
  });
});
