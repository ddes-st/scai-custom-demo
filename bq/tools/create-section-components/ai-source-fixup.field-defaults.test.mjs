/**
 * Field defaults for __Standard Values.
 * Run: node --test tools/create-section-components/ai-source-fixup.field-defaults.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureFieldDefaultsFromContentItems,
  resolveFieldDefault,
  pickMostCommon,
  isTitleLikeFieldName,
} from './field-defaults-from-content.mjs';
import { normalizeDefinitionTs } from './ai-source-fixup.mjs';

describe('isTitleLikeFieldName', () => {
  it('matches Title, Card Title, Heading', () => {
    assert.equal(isTitleLikeFieldName('Title'), true);
    assert.equal(isTitleLikeFieldName('Card Title'), true);
    assert.equal(isTitleLikeFieldName('Heading'), true);
    assert.equal(isTitleLikeFieldName('Announcement Text'), false);
  });
});

describe('pickMostCommon / resolveFieldDefault', () => {
  it('picks most common; first on tie', () => {
    assert.equal(pickMostCommon(['a', 'b', 'a']), 'a');
    assert.equal(pickMostCommon(['x', 'y']), 'x');
  });

  it('uses $name for title-like fields', () => {
    assert.equal(
      resolveFieldDefault('Title', 'Single-Line Text', [
        { name: 'A', fields: { Title: 'A' } },
        { name: 'B', fields: { Title: 'B' } },
      ]),
      '$name',
    );
  });

  it('reuses Image seed; invents nothing when missing', () => {
    const img = { url: 'https://cdn.example/a.png', alt: 'A' };
    assert.deepEqual(
      resolveFieldDefault('Image', 'Image', [
        { name: 'One', fields: { Image: img } },
        { name: 'Two', fields: { Image: { url: '', alt: '' } } },
      ]),
      img,
    );
    assert.equal(
      resolveFieldDefault('Image', 'Image', [{ name: 'One', fields: {} }]),
      undefined,
    );
  });

  it('drops nested CTA from Image default copies', () => {
    assert.deepEqual(
      resolveFieldDefault('Icon', 'Image', [
        {
          name: 'One',
          fields: {
            Icon: {
              url: 'https://cdn.example/a.png',
              alt: 'A',
              CTA: { text: 'Lees meer', url: '/' },
            },
          },
        },
      ]),
      { url: 'https://cdn.example/a.png', alt: 'A' },
    );
  });

  it('invents Rich Text with $name when no seeds', () => {
    assert.equal(resolveFieldDefault('Body', 'Rich Text', []), '<p>$name</p>');
  });
});

describe('ensureFieldDefaultsFromContentItems', () => {
  it('injects $name on Title and most-common Body; preserves existing default', () => {
    const src = `
export const fooDefinition = {
  kind: "component",
  definitionKey: "foo",
  name: "foo",
  displayName: "Foo",
  componentName: "Foo",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Foos"] },
  model: {
    folderTemplate: { name: "Foo Folder" },
    itemTemplate: {
      name: "Foo",
      sections: [{
        name: "Data",
        fields: [
          { name: "Title", type: "Single-Line Text" },
          { name: "Body", type: "Rich Text" },
          { name: "Expandable", type: "Checkbox", default: true },
          { name: "Image", type: "Image" },
        ],
      }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Foos"] },
    items: [
      {
        name: "One",
        fields: {
          Title: "One",
          Body: "<p>Alpha</p>",
          Image: { url: "https://cdn.example/a.png", alt: "A" },
        },
      },
      {
        name: "Two",
        fields: {
          Title: "Two",
          Body: "<p>Alpha</p>",
          Image: { url: "https://cdn.example/b.png", alt: "B" },
        },
      },
      {
        name: "Three",
        fields: {
          Title: "Three",
          Body: "<p>Beta</p>",
        },
      },
    ],
  },
};
`;
    const out = ensureFieldDefaultsFromContentItems(src);
    assert.match(out, /name:\s*"Title"[\s\S]*?default:\s*"\$name"/);
    assert.match(out, /name:\s*"Body"[\s\S]*?default:\s*"<p>Alpha<\/p>"/);
    assert.match(
      out,
      /\{\s*name:\s*"Expandable",\s*type:\s*"Checkbox",\s*default:\s*true\s*\}/,
    );
    assert.equal((out.match(/name:\s*"Expandable"/g) || []).length, 1);
    assert.match(
      out,
      /name:\s*"Image"[\s\S]*?default:\s*\{\s*"url":\s*"https:\/\/cdn\.example\/a\.png"/,
    );
  });

  it('skips thin definitions with datasourceTemplate', () => {
    const src = `
export const thinDefinition = {
  kind: "component",
  definitionKey: "thin",
  name: "thin",
  displayName: "Thin",
  componentName: "Thin",
  datasourceTemplate: "/sitecore/templates/…",
  model: {
    folderTemplate: { name: "Thin Folder" },
    itemTemplate: {
      name: "Thin",
      sections: [{ name: "Data", fields: [{ name: "Title", type: "Single-Line Text" }] }],
    },
  },
  content: { location: { root: "data", folder: ["T"] }, items: [] },
};
`;
    const out = ensureFieldDefaultsFromContentItems(src);
    assert.doesNotMatch(out, /default:\s*"\$name"/);
  });

  it('invents defaults when content.items empty', () => {
    const src = `
export const emptyDefinition = {
  kind: "component",
  definitionKey: "empty",
  name: "empty",
  displayName: "Empty",
  componentName: "Empty",
  model: {
    folderTemplate: { name: "Empty Folder" },
    itemTemplate: {
      name: "Empty",
      sections: [{
        name: "Data",
        fields: [
          { name: "Title", type: "Single-Line Text" },
          { name: "Body", type: "Rich Text" },
          { name: "Image", type: "Image" },
        ],
      }],
    },
  },
  content: { location: { root: "data", folder: ["E"] }, items: [] },
};
`;
    const out = ensureFieldDefaultsFromContentItems(src);
    assert.match(out, /name:\s*"Title"[\s\S]*?default:\s*"\$name"/);
    assert.match(out, /name:\s*"Body"[\s\S]*?default:\s*"<p>\$name<\/p>"/);
    assert.doesNotMatch(out, /name:\s*"Image"[\s\S]*?default:/);
  });
});

describe('normalizeDefinitionTs applies field defaults', () => {
  it('runs ensureFieldDefaultsFromContentItems in the pipeline', () => {
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
      sections: [{ name: "Data", fields: [{ name: "Title", type: "Single-Line Text" }] }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Foos"] },
    items: [{ name: "One", fields: { Title: "One" } }],
  },
};
`;
    const out = normalizeDefinitionTs(src, { definitionKey: 'foo' });
    assert.match(out, /default:\s*"\$name"/);
  });
});
