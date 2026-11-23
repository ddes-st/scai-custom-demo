/**
 * Deterministic family-owner field union tests.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  alignTsxToFieldTypes,
  applyMergeToOwnerDefinition,
  collectFieldSeedsFromInfo,
  inferSitecoreTypeFromValue,
  mergeFamilyOwnerDefinition,
  mergeFamilyOwnerFields,
  mergeFamilyOwnerItems,
  normalizeFieldValue,
  pickCanonicalFieldName,
} from './content-family-merge.mjs';

describe('normalizeFieldValue / inferSitecoreTypeFromValue', () => {
  it('strips HTML for text compare but types RichText when markup present', () => {
    const html = '<p>Hello <strong>World</strong></p>';
    assert.equal(normalizeFieldValue(html), 'hello world');
    assert.equal(inferSitecoreTypeFromValue(html, 'text'), 'RichText');
  });

  it('does not promote plain text to RichText from AI hint', () => {
    assert.equal(
      inferSitecoreTypeFromValue('Anti-microbial Products', 'richText'),
      'Single-Line Text',
    );
  });

  it('detects image and link shapes', () => {
    assert.equal(
      inferSitecoreTypeFromValue({ src: 'https://cdn.example/a.jpg', alt: 'A' }),
      'Image',
    );
    assert.equal(
      inferSitecoreTypeFromValue({ text: 'Read', url: '/news/a' }),
      'General Link',
    );
  });
});

describe('mergeFamilyOwnerFields', () => {
  it('unions matching values across members with deterministic names/types', () => {
    const title = 'DOM Security joins Tapkey as a new shareholder';
    const seeds = [
      ...collectFieldSeedsFromInfo({
        memberFolder: 'news-article-header',
        pageSlug: 'page-a',
        info: {
          suggestedFields: [
            { name: 'title', type: 'text', value: title },
            { name: 'date', type: 'text', value: '1 Nov 2022' },
          ],
        },
      }),
      ...collectFieldSeedsFromInfo({
        memberFolder: 'news-article-body',
        pageSlug: 'page-a',
        info: {
          suggestedFields: [
            { name: 'category', type: 'text', value: 'Group News' },
            {
              name: 'body',
              type: 'richText',
              value: '<p>Paris, September 2020</p><p>More copy</p>',
            },
            {
              name: 'image',
              type: 'image',
              value: { src: 'https://cdn.example/img.jpg', alt: 'x' },
            },
          ],
        },
      }),
      ...collectFieldSeedsFromInfo({
        memberFolder: 'news-teasers',
        pageSlug: 'home',
        info: {
          suggestedFields: [
            { name: 'title', type: 'text', value: 'Latest news' },
            {
              name: 'newsItems',
              type: 'array',
              value: [
                {
                  title,
                  date: '1 Nov 2022',
                  image: { src: 'https://cdn.example/img.jpg', alt: 'x' },
                  link: { text: 'Read', url: '/news/tapkey' },
                },
              ],
            },
          ],
        },
      }),
    ];

    const a = mergeFamilyOwnerFields({ seeds, ownerFolder: 'news-article-body' });
    const b = mergeFamilyOwnerFields({ seeds, ownerFolder: 'news-article-body' });

    assert.deepEqual(a.fields, b.fields);
    const names = a.fields.map((f) => f.name);
    assert.ok(names.includes('Title'), `expected Title in ${names}`);
    assert.ok(names.includes('Body'), `expected Body in ${names}`);
    assert.ok(names.includes('Image'), `expected Image in ${names}`);
    assert.ok(names.includes('Date'), `expected Date in ${names}`);
    assert.ok(names.includes('Category'), `expected Category in ${names}`);
    // Link comes via matched item sibling expansion
    assert.ok(names.includes('Link'), `expected Link in ${names}`);

    const body = a.fields.find((f) => f.name === 'Body');
    assert.equal(body.type, 'RichText');
    const titleField = a.fields.find((f) => f.name === 'Title');
    assert.equal(titleField.type, 'Single-Line Text');

    // Chrome "Latest news" alone must not force a second title onto owner via unique value
    // (Title still present from cross-member match of the article title)
    assert.equal(names.filter((n) => n === 'Title').length, 1);
  });

  it('pickCanonicalFieldName prefers owner then preference list', () => {
    assert.equal(pickCanonicalFieldName(['heading', 'title'], 'Heading'), 'Heading');
    assert.equal(pickCanonicalFieldName(['heading', 'title'], null), 'Title');
  });
});

describe('mergeFamilyOwnerItems', () => {
  it('dedupes by title/url and sorts by name', () => {
    const items = mergeFamilyOwnerItems([
      [
        { name: 'Zeta', fields: { Title: 'Zeta' } },
        { name: 'Alpha', fields: { Title: 'Alpha', Link: { text: 'A', url: '/a' } } },
      ],
      [
        {
          name: 'Alpha Dup',
          fields: { Title: 'Alpha', Body: '<p>x</p>', Link: { text: 'A', url: '/a' } },
        },
      ],
    ]);
    assert.equal(items.length, 2);
    assert.equal(items[0].name, 'Alpha');
    assert.ok(items[0].fields.Body);
    assert.equal(items[1].name, 'Zeta');
  });
});

describe('applyMergeToOwnerDefinition + alignTsxToFieldTypes', () => {
  it('expands thin owner definition and is idempotent', () => {
    const thin = `import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityEditorialArticleBodyDefinition = {
  kind: "component",
  definitionKey: "dom-security-editorial-article-body",
  name: "dom-security-editorial-article-body",
  displayName: "Editorial Article Body",
  componentName: "DomSecurityEditorialArticleBody",
  icon: "Office/32x32/document_empty_landscape.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["News Teasers"],
  },
  datasourceTemplate:
    "/sitecore/templates/Project/domsecurity/DomSecurityNewsTeaser/News Teaser",
  model: {
    folderTemplate: { name: "Editorial Article Body Folder" },
    itemTemplate: {
      name: "Editorial Article Body",
      sections: [],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
} satisfies ComponentTemplateDefinition;
`;

    const fields = [
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Body', type: 'RichText' },
      { name: 'Image', type: 'Image' },
    ];
    const items = [
      {
        name: 'Tapkey',
        displayName: 'Tapkey',
        fields: { Title: 'Tapkey', Body: '<p>Hi</p>' },
      },
    ];

    const once = applyMergeToOwnerDefinition({
      definitionTs: thin,
      fields,
      items,
      datasourceFolder: 'News Articles',
    });
    const twice = applyMergeToOwnerDefinition({
      definitionTs: once,
      fields,
      items,
      datasourceFolder: 'News Articles',
    });

    assert.ok(/name: "Title"/.test(once));
    assert.ok(/type: "RichText"/.test(once));
    assert.ok(/News Articles/.test(once));
    assert.ok(!/datasourceTemplate/.test(once));
    assert.ok(/name: "Tapkey"/.test(once));
    // Second apply should converge (fields/items rewritten deterministically)
    assert.ok(/name: "Title"/.test(twice));
    assert.ok(/name: "Tapkey"/.test(twice));
  });

  it('aligns Text ↔ RichText in TSX from final types', () => {
    const tsx = `import { Text, Image } from "@sitecore-content-sdk/nextjs";
import type { TextField, ImageField } from "@sitecore-content-sdk/nextjs";
interface Fields {
  Title: TextField;
  Body: TextField;
  Image: ImageField;
}
export const Default = (props: { fields: Fields }) => (
  <div>
    <Text field={props.fields.Title} />
    <Text field={props.fields.Body} />
    <Image field={props.fields.Image} />
  </div>
);
`;
    const aligned = alignTsxToFieldTypes(tsx, [
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Body', type: 'RichText' },
      { name: 'Image', type: 'Image' },
    ]);
    assert.ok(/RichText field=\{props\.fields\.Body\}/.test(aligned));
    assert.ok(/Body:\s*RichTextField/.test(aligned));
    assert.ok(/Text field=\{props\.fields\.Title\}/.test(aligned));
    assert.ok(/\bRichText\b/.test(aligned.split('\n')[0]) || /RichText/.test(aligned));
  });
});

describe('mergeFamilyOwnerDefinition end-to-end stability', () => {
  it('two consecutive merges yield identical fields and items', () => {
    const seeds = [
      ...collectFieldSeedsFromInfo({
        memberFolder: 'news-article-body',
        pageSlug: 'p1',
        info: {
          suggestedFields: [
            { name: 'body', type: 'richText', value: '<p>One</p>' },
            { name: 'title', type: 'text', value: 'Story One' },
          ],
        },
      }),
      ...collectFieldSeedsFromInfo({
        memberFolder: 'news-article-header',
        pageSlug: 'p1',
        info: {
          suggestedFields: [{ name: 'title', type: 'text', value: 'Story One' }],
        },
      }),
    ];
    const a = mergeFamilyOwnerDefinition({ seeds, ownerFolder: 'news-article-body' });
    const b = mergeFamilyOwnerDefinition({ seeds, ownerFolder: 'news-article-body' });
    assert.deepEqual(a.fields, b.fields);
    assert.deepEqual(
      a.items.map((i) => i.name),
      b.items.map((i) => i.name),
    );
  });
});
