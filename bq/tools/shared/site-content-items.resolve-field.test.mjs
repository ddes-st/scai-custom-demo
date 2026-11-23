/**
 * Run: node --import tsx --test tools/shared/site-content-items.resolve-field.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMaterializeImageOptions,
  resolveSiteContentFieldValue,
} from './site-content-items.ts';

const media = {
  handle: 'test',
  folder: ['Test'],
  collectionSystem: 'crelan',
  label: 'component-content "test"',
};

describe('resolveSiteContentFieldValue text-field arrays', () => {
  it('joins primitive arrays on Multi-Line Text (Styles tokens)', async () => {
    const result = await resolveSiteContentFieldValue(
      {
        name: 'Styles',
        type: 'Multi-Line Text',
        id: '{00000000-0000-0000-0000-000000000001}',
        sectionName: 'Navigation',
      },
      /** @type {any} */ (['level1', 'card']),
      media,
      'First Salary Job Guide',
    );
    assert.equal(result.value, 'level1 card');
  });

  it('joins primitive arrays on Single-Line Text', async () => {
    const result = await resolveSiteContentFieldValue(
      {
        name: 'Label',
        type: 'Single-Line Text',
        id: '{00000000-0000-0000-0000-000000000002}',
        sectionName: 'Data',
      },
      /** @type {any} */ (['a', 'b']),
      media,
      'Item',
    );
    assert.equal(result.value, 'a b');
  });

  it('throws on non-coercible object without claiming Multi-Line Text is invalid', async () => {
    await assert.rejects(
      () =>
        resolveSiteContentFieldValue(
          {
            name: 'Styles',
            type: 'Multi-Line Text',
            id: '{00000000-0000-0000-0000-000000000003}',
            sectionName: 'Navigation',
          },
          /** @type {any} */ ({ unexpected: true }),
          media,
          'Item',
        ),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(
          err.message,
          /received an object value that is not a usable Link\/Image payload \(field type "Multi-Line Text"\)/,
        );
        assert.doesNotMatch(err.message, /Invalid Sitecore field type "Multi-Line Text"/);
        return true;
      },
    );
  });

  it('still hints childItemTemplate when field type looks invented', async () => {
    await assert.rejects(
      () =>
        resolveSiteContentFieldValue(
          {
            name: 'Rows',
            type: 'Array',
            id: '{00000000-0000-0000-0000-000000000004}',
            sectionName: 'Data',
          },
          /** @type {any} */ ({ foo: 1 }),
          media,
          'Item',
        ),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Invalid Sitecore field type "Array"/);
        assert.match(err.message, /childItemTemplate/);
        return true;
      },
    );
  });
});

describe('buildMaterializeImageOptions', () => {
  it('maps siteSystem → siteName and sourceLanguage for media ensure', () => {
    const opts = buildMaterializeImageOptions(
      {
        ...media,
        siteSystem: 'menzis-nl',
        siteOrigin: 'https://www.menzis.nl',
        sourceLanguage: 'nl-NL',
      },
      'Header',
      'Logo',
    );
    assert.equal(opts.siteName, 'menzis-nl');
    assert.equal(opts.siteOrigin, 'https://www.menzis.nl');
    assert.equal(opts.sourceLanguage, 'nl-NL');
    assert.equal(opts.collectionSystem, 'crelan');
    assert.equal(opts.itemName, 'Header-Logo');
  });
});
