/**
 * Unescaped HTML quotes in definition field seeds.
 * Run: node --test tools/create-section-components/ai-source-fixup.definition-quotes.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  stringifyBrokenDefinitionFieldStrings,
  normalizeDefinitionTs,
} from './ai-source-fixup.mjs';

function assertParseableTsObject(source) {
  const js = String(source)
    .replace(/^\s*import[\s\S]*?;\s*/m, '')
    .replace(/\bexport\s+const\b/g, 'const')
    .replace(/\s+satisfies\s+\w+/g, '');
  new Function(js);
}

describe('stringifyBrokenDefinitionFieldStrings', () => {
  it('JSON.stringify-escapes HTML href quotes inside double-quoted Body seeds', () => {
    const src = `
export const fooDefinition = {
  kind: "component",
  content: {
    items: [{
      name: "One",
      fields: {
        Body: "<a href="https://example.com">x</a>",
      },
    }],
  },
};
`;
    const out = stringifyBrokenDefinitionFieldStrings(src);
    assert.match(out, /Body:\s*"<a href=\\"https:\/\/example.com\\">x<\/a>"/);
    assertParseableTsObject(out);
  });

  it('leaves already-escaped and single-quoted HTML unchanged', () => {
    const escaped = `fields: { Body: "<a href=\\"https://example.com\\">x</a>" }`;
    assert.equal(stringifyBrokenDefinitionFieldStrings(escaped), escaped);
    const single = `fields: { Body: '<a href="https://example.com">x</a>' }`;
    assert.equal(stringifyBrokenDefinitionFieldStrings(single), single);
  });
});

describe('normalizeDefinitionTs sanitizes broken HTML field quotes', () => {
  it('makes a href-in-Body definition parseable', () => {
    const src = `
export const fooDefinition = {
  kind: "component",
  definitionKey: "foo",
  name: "foo",
  displayName: "Foo",
  componentName: "Foo",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Foos"] },
  model: {
    folderTemplate: { name: "Foo Folder" },
    itemTemplate: {
      name: "Foo",
      sections: [{ name: "Data", fields: [{ name: "Body", type: "Rich Text" }] }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Foos"] },
    culture: "en",
    items: [{ name: "One", fields: { Body: "<p>See <a href="https://example.com/path">here</a>.</p>" } }],
  },
};
`;
    const out = normalizeDefinitionTs(src, { definitionKey: 'foo' });
    assertParseableTsObject(out);
    assert.match(out, /href=\\"https:\/\/example.com\/path\\"/);
  });
});
