/**
 * Dual-write: flat JSON link bags → Data/Link Lists mapping.
 * Run: node --import tsx --test tools/shared/link-lists-dual-write.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isFlatLinkBagArray,
  isFlatLinkBagRow,
  parseFlatLinkBagSeed,
  resolveLinkListsForDualWrite,
  synthesizeLinkListsFromItems,
  toPlatformLinkListItems,
} from './link-lists-dual-write.ts';

describe('isFlatLinkBagRow / isFlatLinkBagArray', () => {
  it('accepts { text, url } rows', () => {
    assert.equal(isFlatLinkBagRow({ text: 'Home', url: 'https://example.com' }), true);
    assert.equal(
      isFlatLinkBagArray([
        { text: 'A', url: 'https://a.example' },
        { text: 'B', url: 'https://b.example' },
      ]),
      true,
    );
  });

  it('rejects nested mega-menu rows (items / columns / links)', () => {
    assert.equal(
      isFlatLinkBagRow({
        label: 'Betalen',
        href: 'https://example.com/pay',
        items: [{ label: 'Cards', href: 'https://example.com/cards' }],
      }),
      false,
    );
    assert.equal(
      isFlatLinkBagArray([
        {
          title: 'Column',
          links: [{ text: 'X', url: 'https://x.example' }],
        },
      ]),
      false,
    );
  });
});

describe('parseFlatLinkBagSeed', () => {
  it('parses JSON string bags', () => {
    const rows = parseFlatLinkBagSeed(
      JSON.stringify([
        { text: 'Consumenten', url: 'https://www.menzis.nl/' },
        { text: 'Ondersteuners', url: 'https://www.menzis.nl/support' },
      ]),
    );
    assert.equal(rows?.length, 2);
    assert.equal(rows?.[0]?.text, 'Consumenten');
    assert.equal(rows?.[0]?.url, 'https://www.menzis.nl/');
  });

  it('returns null for nested Categories-style JSON', () => {
    const nested = JSON.stringify([
      {
        label: 'Betalen',
        href: 'https://www.crelan.be/nl/particulieren/betalen',
        items: [
          {
            label: 'Zichtrekeningen',
            href: 'https://www.crelan.be/nl/particulieren/betalen/zichtrekeningen',
          },
        ],
      },
    ]);
    assert.equal(parseFlatLinkBagSeed(nested), null);
  });
});

describe('synthesizeLinkListsFromItems / resolveLinkListsForDualWrite', () => {
  const headerItems = [
    {
      name: 'Site Header',
      fields: {
        'Site Links': JSON.stringify([
          { text: 'Particulieren', url: 'https://www.crelan.be/nl/particulieren' },
          { text: 'Ondernemers', url: 'https://www.crelan.be/nl/ondernemers' },
        ]),
        Categories: JSON.stringify([
          {
            label: 'Betalen',
            href: 'https://www.crelan.be/nl/particulieren/betalen',
            items: [
              {
                label: 'Zichtrekeningen',
                href: 'https://www.crelan.be/nl/particulieren/betalen/zichtrekeningen',
              },
            ],
          },
        ]),
        'Language Links': JSON.stringify([
          { text: 'Nederlands', url: 'https://www.crelan.be/nl/particulieren' },
          { text: 'Français', url: 'https://www.crelan.be/fr/particuliers' },
        ]),
      },
    },
  ];

  it('synthesizes only flat bags (Site Links + Language Links), not Categories', () => {
    const lists = synthesizeLinkListsFromItems(headerItems);
    assert.deepEqual(
      lists.map((l) => l.name).sort(),
      ['Language Links', 'Site Links'],
    );
    const site = lists.find((l) => l.name === 'Site Links');
    assert.equal(site?.links.length, 2);
    assert.equal(site?.links[0]?.link.url, 'https://www.crelan.be/nl/particulieren');
    assert.equal(site?.sourceField, 'Site Links');
  });

  it('maps Context Links-style bag to platform tree shape', () => {
    const lists = resolveLinkListsForDualWrite({
      location: { root: 'data', folder: ['Site Headers'] },
      items: [
        {
          name: 'Header',
          fields: {
            'Context Links': JSON.stringify([
              { text: 'Consumenten', url: 'https://www.menzis.nl/' },
              { text: 'Ondersteuners', url: 'https://www.menzis.nl/support' },
            ]),
          },
        },
      ],
    });
    assert.equal(lists.length, 1);
    assert.equal(lists[0]?.name, 'Context Links');
    const platform = toPlatformLinkListItems(lists);
    assert.equal(platform.length, 1);
    assert.equal(platform[0]?.name, 'Context Links');
    assert.equal(platform[0]?.fields?.Title, 'Context Links');
    assert.equal(platform[0]?.children?.length, 2);
    assert.deepEqual(platform[0]?.children?.[0]?.fields?.Link, {
      text: 'Consumenten',
      url: 'https://www.menzis.nl/',
    });
    assert.equal(platform[0]?.children?.[0]?.name, 'Consumenten');
  });

  it('honors explicit content.linkLists over synthesis', () => {
    const lists = resolveLinkListsForDualWrite({
      location: { root: 'data', folder: ['Site Headers'] },
      linkLists: [
        {
          name: 'Utility Links',
          sourceField: 'Site Links',
          links: [
            { name: 'Contact', link: { text: 'Contact', url: 'https://example.com/contact' } },
          ],
        },
      ],
      items: headerItems,
    });
    assert.equal(lists.length, 1);
    assert.equal(lists[0]?.name, 'Utility Links');
  });

  it('skips dual-write when location.folder is already Link Lists (primary emit)', () => {
    const lists = resolveLinkListsForDualWrite({
      location: { root: 'data', folder: ['Link Lists'] },
      linkLists: [
        {
          name: 'Should Not Apply',
          links: [{ name: 'A', link: { text: 'A', url: 'https://a.example' } }],
        },
      ],
      items: [{ name: 'AXA', fields: { Title: 'AXA' }, children: [] }],
    });
    assert.deepEqual(lists, []);
  });
});
