/**
 * Run: node --import tsx --test tools/shared/link-list-reuse.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  clearLinkListReuseIndexes,
  getLinkListReuseIndex,
} from './link-list-reuse.ts';

const FOLDER = '/sitecore/content/axa/axa-be/Data/Link Lists';

describe('LinkListReuseIndex.resolveGroup', () => {
  beforeEach(() => {
    clearLinkListReuseIndexes();
  });
  afterEach(() => {
    clearLinkListReuseIndexes();
  });

  it('prefers name/path over shared Title (no collapse across groups)', async () => {
    const idx = getLinkListReuseIndex(FOLDER, 'Link Lists');
    await idx.registerEmitted({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      yamlPath: `${FOLDER}/Mobility`,
      sitecorePath: `${FOLDER}/Mobility`,
      parentId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      isGroup: true,
      titles: ['Alle verzekeringen', 'All insurance', 'Mobility'],
    });
    await idx.registerEmitted({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      yamlPath: `${FOLDER}/Home`,
      sitecorePath: `${FOLDER}/Home`,
      parentId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      isGroup: true,
      titles: ['Alle verzekeringen', 'Home'],
    });

    const home = await idx.resolveGroup({
      name: 'Home',
      title: 'Alle verzekeringen',
      parentSitecorePath: FOLDER,
    });
    assert.ok(home);
    assert.equal(home.reason, 'path');
    assert.match(home.sitecorePath, /\/Home$/);

    const mobility = await idx.resolveGroup({
      name: 'Mobility',
      title: 'Alle verzekeringen',
      parentSitecorePath: FOLDER,
    });
    assert.ok(mobility);
    assert.match(mobility.sitecorePath, /\/Mobility$/);
    assert.notEqual(home.id, mobility.id);
  });

  it('does not reuse a different group via Title alone', async () => {
    const idx = getLinkListReuseIndex(FOLDER, 'Link Lists');
    await idx.registerEmitted({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      yamlPath: `${FOLDER}/Mobility`,
      sitecorePath: `${FOLDER}/Mobility`,
      parentId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      isGroup: true,
      titles: ['Alle verzekeringen'],
    });

    const miss = await idx.resolveGroup({
      name: 'Pension',
      title: 'Alle verzekeringen',
      parentSitecorePath: FOLDER,
    });
    assert.equal(miss, undefined);
  });
});

describe('LinkListReuseIndex.pruneOrphanChildren', () => {
  it('is a no-op without local YAML prune', () => {
    clearLinkListReuseIndexes();
    const idx = getLinkListReuseIndex(FOLDER, 'Link Lists');
    assert.equal(
      idx.pruneOrphanChildren({
        childDir: '/tmp/unused',
        keepYamlPaths: [],
        label: 'test',
      }),
      0,
    );
  });
});

describe('LinkListReuseIndex.resolveChild parent-scoped URL', () => {
  beforeEach(() => {
    clearLinkListReuseIndexes();
  });
  afterEach(() => {
    clearLinkListReuseIndexes();
  });

  it('does not return a URL hit from a different parent group', async () => {
    const idx = getLinkListReuseIndex(FOLDER, 'Link Lists');
    const supportParent = `${FOLDER}/Can you use some help`;
    const footerParent = `${FOLDER}/Footer Legal`;
    const sharedUrl = 'https://www.menzis.nl/klantenservice';

    await idx.registerEmitted({
      id: '11111111-1111-1111-1111-111111111111',
      yamlPath: `${supportParent}/Service and contact`,
      sitecorePath: `${supportParent}/Service and contact`,
      parentId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      isGroup: false,
      linkUrls: [sharedUrl],
    });

    const miss = await idx.resolveChild({
      name: 'Service and contact',
      linkUrl: sharedUrl,
      parentSitecorePath: footerParent,
    });
    assert.equal(miss, undefined);

    const hit = await idx.resolveChild({
      name: 'Service and contact',
      linkUrl: sharedUrl,
      parentSitecorePath: supportParent,
    });
    assert.ok(hit);
    // Path match is preferred when the leaf exists under this parent.
    assert.ok(hit.reason === 'path' || hit.reason === 'link-url');
    assert.equal(hit.sitecorePath, `${supportParent}/Service and contact`);
    assert.equal(hit.parentId, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  it('URL fingerprint alone does not cross parent groups (different leaf names)', async () => {
    const idx = getLinkListReuseIndex(FOLDER, 'Link Lists');
    const supportParent = `${FOLDER}/Can you use some help`;
    const footerParent = `${FOLDER}/Footer Legal`;
    const sharedUrl = 'https://www.menzis.nl/klantenservice';

    await idx.registerEmitted({
      id: '33333333-3333-3333-3333-333333333333',
      yamlPath: `${supportParent}/Service and contact`,
      sitecorePath: `${supportParent}/Service and contact`,
      parentId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      isGroup: false,
      linkUrls: [sharedUrl],
    });

    // Same URL, different leaf name under another group — must not reuse.
    const miss = await idx.resolveChild({
      name: 'Customer service',
      linkUrl: sharedUrl,
      parentSitecorePath: footerParent,
    });
    assert.equal(miss, undefined);
  });

  it('path match still wins under the same parent', async () => {
    const idx = getLinkListReuseIndex(FOLDER, 'Link Lists');
    const parent = `${FOLDER}/My Menzis`;
    await idx.registerEmitted({
      id: '22222222-2222-2222-2222-222222222222',
      yamlPath: `${parent}/Log in`,
      sitecorePath: `${parent}/Log in`,
      parentId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      isGroup: false,
      linkUrls: ['https://www.menzis.nl/login'],
    });

    const hit = await idx.resolveChild({
      name: 'Log in',
      linkUrl: 'https://www.menzis.nl/other',
      parentSitecorePath: parent,
    });
    assert.ok(hit);
    assert.equal(hit.reason, 'path');
    assert.equal(hit.sitecorePath, `${parent}/Log in`);
  });
});
