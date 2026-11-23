/**
 * Chrome band helpers.
 * Run: node --test tools/create-section-components/chrome-bands.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeChromeCatalogue,
  positionBand,
  computeChromeBandCuts,
  resolveBandRole,
  catalogueToProvisionalRole,
  buildChromeEvidence,
  mapChromeBandRoles,
} from './chrome-bands.mjs';

describe('normalizeChromeCatalogue', () => {
  it('maps known catalogues', () => {
    assert.equal(normalizeChromeCatalogue('header'), 'header');
    assert.equal(normalizeChromeCatalogue('partial-header'), 'header');
    assert.equal(normalizeChromeCatalogue('footer'), 'footer');
    assert.equal(normalizeChromeCatalogue('partial-footer'), 'footer');
    assert.equal(normalizeChromeCatalogue('breadcrumb'), 'breadcrumb');
  });

  it('maps cookie/partial-cookie/normal/page/empty to other', () => {
    assert.equal(normalizeChromeCatalogue('cookie'), 'other');
    assert.equal(normalizeChromeCatalogue('partial-cookie'), 'other');
    assert.equal(normalizeChromeCatalogue('normal'), 'other');
    assert.equal(normalizeChromeCatalogue('page'), 'other');
    assert.equal(normalizeChromeCatalogue('empty'), 'other');
    assert.equal(normalizeChromeCatalogue(''), 'other');
    assert.equal(normalizeChromeCatalogue(null), 'other');
  });
});

describe('positionBand', () => {
  it('marks first 2 early (1-based)', () => {
    assert.equal(positionBand(1, 5), 'early');
    assert.equal(positionBand(2, 5), 'early');
  });

  it('marks first 2 early (0-based)', () => {
    assert.equal(positionBand(0, 5), 'early');
    assert.equal(positionBand(1, 5), 'early');
  });

  it('marks last 2 late when count >= 3', () => {
    assert.equal(positionBand(4, 5), 'late');
    assert.equal(positionBand(5, 5), 'late');
    assert.equal(positionBand(3, 5), 'mid');
  });

  it('uses mid when not early/late', () => {
    assert.equal(positionBand(3, 6), 'mid');
  });

  it('does not mark late when count < 3', () => {
    assert.equal(positionBand(1, 2), 'early');
    assert.equal(positionBand(2, 2), 'early');
  });
});

describe('buildChromeEvidence', () => {
  it('includes positionBand', () => {
    const ev = buildChromeEvidence({
      sharedAcrossPages: true,
      pageCount: 3,
      instancePages: ['a', 'b'],
      sectionIndex: 1,
      sectionCount: 5,
    });
    assert.equal(ev.positionBand, 'early');
    assert.equal(ev.sharedAcrossPages, true);
    assert.equal(ev.pageCount, 3);
    assert.deepEqual(ev.instancePages, ['a', 'b']);
    assert.equal(ev.sectionIndex, 1);
    assert.equal(ev.sectionCount, 5);
  });
});

describe('computeChromeBandCuts', () => {
  it('sets H from header+breadcrumb max, F from footer min', () => {
    const cuts = computeChromeBandCuts([
      { index: 1, chromeCatalogue: 'header' },
      { index: 2, chromeCatalogue: 'breadcrumb' },
      { index: 3, chromeCatalogue: 'other' },
      { index: 8, chromeCatalogue: 'footer' },
      { index: 9, chromeCatalogue: 'footer' },
    ]);
    assert.deepEqual(cuts, { headerCut: 2, footerCut: 8 });
  });

  it('sets footerCut alone', () => {
    const cuts = computeChromeBandCuts([
      { index: 5, chromeCatalogue: 'other' },
      { index: 7, chromeCatalogue: 'footer' },
    ]);
    assert.deepEqual(cuts, { headerCut: null, footerCut: 7 });
  });

  it('resolves conflict when H >= F', () => {
    const cuts = computeChromeBandCuts([
      { index: 5, chromeCatalogue: 'header' },
      { index: 4, chromeCatalogue: 'footer' },
    ]);
    assert.deepEqual(cuts, { headerCut: 3, footerCut: 4 });
  });

  it('nulls headerCut when conflict drives H < 0', () => {
    const cuts = computeChromeBandCuts([
      { index: 0, chromeCatalogue: 'header' },
      { index: 0, chromeCatalogue: 'footer' },
    ]);
    assert.deepEqual(cuts, { headerCut: null, footerCut: 0 });
  });
});

describe('resolveBandRole', () => {
  it('resolves by cuts', () => {
    const cuts = { headerCut: 2, footerCut: 8 };
    assert.equal(resolveBandRole(1, cuts), 'partial-header');
    assert.equal(resolveBandRole(2, cuts), 'partial-header');
    assert.equal(resolveBandRole(3, cuts), 'page');
    assert.equal(resolveBandRole(8, cuts), 'partial-footer');
    assert.equal(resolveBandRole(9, cuts), 'partial-footer');
  });
});

describe('catalogueToProvisionalRole', () => {
  it('maps catalogues to provisional roles', () => {
    assert.equal(catalogueToProvisionalRole('header'), 'partial-header');
    assert.equal(catalogueToProvisionalRole('breadcrumb'), 'partial-header');
    assert.equal(catalogueToProvisionalRole('footer'), 'partial-footer');
    assert.equal(catalogueToProvisionalRole('other'), 'page');
    assert.equal(catalogueToProvisionalRole('cookie'), 'page');
  });
});

describe('mapChromeBandRoles', () => {
  it('absorbs pre-header other (cookie) into partial-header via cut', () => {
    const { cuts, byDefinitionKey } = mapChromeBandRoles([
      {
        index: 1,
        chromeCatalogue: 'other',
        definitionKey: 'sitecore-cookie-consent-banner',
      },
      {
        index: 2,
        chromeCatalogue: 'header',
        definitionKey: 'sitecore-announcement-marquee',
      },
      {
        index: 3,
        chromeCatalogue: 'header',
        definitionKey: 'sitecore-main-navigation',
      },
      {
        index: 13,
        chromeCatalogue: 'footer',
        definitionKey: 'sitecore-global-footer',
      },
    ]);
    assert.deepEqual(cuts, { headerCut: 3, footerCut: 13 });
    assert.equal(
      byDefinitionKey.get('sitecore-cookie-consent-banner'),
      'partial-header',
    );
    assert.equal(
      byDefinitionKey.get('sitecore-announcement-marquee'),
      'partial-header',
    );
    assert.equal(
      byDefinitionKey.get('sitecore-main-navigation'),
      'partial-header',
    );
    assert.equal(byDefinitionKey.get('sitecore-global-footer'), 'partial-footer');
  });
});
