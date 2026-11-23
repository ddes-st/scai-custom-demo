/**
 * Run: node --import tsx --test tools/create-section-components/unwrap-json-stringify-path-names.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { unwrapJsonStringifyOnPathNames } from './ai-source-fixup.mjs';
import { tryParseDefinitionTs } from './definition-seed-sanitize.mjs';

describe('unwrapJsonStringifyOnPathNames', () => {
  it('unwraps Path names and field/link string seeds to plain literals', () => {
    const src = `export const X = {
  displayName: JSON.stringify('Cookie Consent Overlay'),
  model: {
    folderTemplate: { name: JSON.stringify('Cookie Consent Overlay Folder') },
    itemTemplate: {
      name: JSON.stringify('Cookie Consent Overlay'),
      sections: [
        {
          name: JSON.stringify('Content'),
          fields: [
            { name: JSON.stringify('Heading'), type: 'Single-Line Text' },
          ],
        },
      ],
    },
  },
  datasourceLocation: { scope: 'site', root: 'data', folder: [JSON.stringify('Cookie Consent Overlays')] },
  content: {
    location: { root: 'data', folder: [JSON.stringify('Cookie Consent Overlays')] },
    items: [
      {
        name: JSON.stringify('Cookie Consent Overlay'),
        fields: {
          Heading: JSON.stringify('Cookie instellingen'),
          Link: { text: JSON.stringify('welkom'), url: JSON.stringify('https://example.com/x') },
        },
      },
    ],
  },
};`;
    const out = unwrapJsonStringifyOnPathNames(src);
    assert.match(out, /displayName:\s*"Cookie Consent Overlay"/);
    assert.match(
      out,
      /folderTemplate:\s*\{\s*name:\s*"Cookie Consent Overlay Folder"/,
    );
    assert.match(
      out,
      /itemTemplate:\s*\{[\s\S]*?name:\s*"Cookie Consent Overlay"/,
    );
    assert.match(out, /\{\s*name:\s*"Content",\s*fields:/);
    assert.match(out, /\{\s*name:\s*"Heading",\s*type:/);
    assert.match(out, /folder:\s*\[\s*"Cookie Consent Overlays"\s*\]/);
    assert.match(
      out,
      /\{\s*name:\s*"Cookie Consent Overlay",\s*fields:/,
    );
    // Field / link seeds become plain literals (no JSON.stringify)
    assert.match(out, /Heading:\s*"Cookie instellingen"/);
    assert.match(out, /text:\s*"welkom"/);
    assert.match(out, /url:\s*"https:\/\/example.com\/x"/);
    assert.doesNotMatch(out, /JSON\.stringify\s*\(\s*['"]/);
  });

  it('leaves JSON.stringify([…]) array bags untouched', () => {
    const src = `fields: { Links: JSON.stringify([{ text: 'a', url: '/a' }]) }`;
    const out = unwrapJsonStringifyOnPathNames(src);
    assert.match(out, /Links:\s*JSON\.stringify\(\[\{/);
  });

  it('is a no-op when Path names are already plain literals', () => {
    const src = `export const X = {
  displayName: "Cookie Consent Overlay",
  model: {
    folderTemplate: { name: 'Cookie Consent Overlay Folder' },
    itemTemplate: { name: 'Cookie Consent Overlay', sections: [] },
  },
  content: {
    items: [{ name: 'Cookie Consent Overlay', fields: { Heading: "Hi" } }],
  },
};`;
    assert.equal(unwrapJsonStringifyOnPathNames(src), src);
  });

  it("recovers Navigation Data JSON.stringify('…Extra's…') to a parseable literal", () => {
    // Unescaped apostrophe inside single-quoted stringify arg (Menzis mega-menu).
    const broken = `export const X = {
  content: {
    items: [{
      name: 'Nav',
      fields: {
        'Navigation Data': JSON.stringify('[{"title":"Extra's voor Menzis leden"}]'),
      },
    }],
  },
};`;
    assert.equal(tryParseDefinitionTs(broken).ok, false);

    const out = unwrapJsonStringifyOnPathNames(broken);
    assert.doesNotMatch(out, /JSON\.stringify\s*\(\s*['"]/);
    assert.match(
      out,
      /'Navigation Data':\s*"\[\{\\"title\\":\\"Extra's voor Menzis leden\\"\}\]"/,
    );
    assert.equal(tryParseDefinitionTs(out).ok, true);
  });
});
