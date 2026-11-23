/**
 * Run: node --test tools/capture/lib/export-detected-sections.chrome-clamp.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applySectionNeighborClamp,
  clampChromeRectToBodyNeighbor,
  clampRectToNeighbors,
  isBodyNeighborSection,
  resolveBodyNeighborSelectors,
  shouldNeighborClampSection,
  SHORT_FULL_BLEED_MAX_PX,
  TIGHTEN_CHROME_FALLBACK_MAX_PX,
  tightenClosedChromeY,
} from './export-detected-sections.mjs';

describe('resolveBodyNeighborSelectors', () => {
  const cmp = {
    selector: '#onetrust-pc-sdk',
    track: 'overlay',
    isOverlay: true,
    chromeKind: 'float-overlay',
  };
  const header = {
    selector: 'header.header',
    track: 'header',
    isOverlay: false,
    chromeKind: 'header-stack',
  };
  const hero = {
    selector: '#main > div:nth-of-type(1)',
    track: 'both',
    isOverlay: false,
  };
  const ordered = [cmp, header, hero];

  it('skips float-overlay/CMP when resolving neighbors for header-stack', () => {
    const { prevSelector, nextSelector } = resolveBodyNeighborSelectors(ordered, 1);
    assert.equal(prevSelector, null);
    assert.equal(nextSelector, hero.selector);
  });

  it('uses header-stack as prev for the following body band', () => {
    const { prevSelector, nextSelector } = resolveBodyNeighborSelectors(ordered, 2);
    assert.equal(prevSelector, header.selector);
    assert.equal(nextSelector, null);
  });

  it('classifies float-overlay as non-neighbor and header-stack as neighbor', () => {
    assert.equal(isBodyNeighborSection(cmp), false);
    assert.equal(isBodyNeighborSection(header), true);
    assert.equal(isBodyNeighborSection(hero), true);
    assert.equal(shouldNeighborClampSection(cmp), false);
    assert.equal(shouldNeighborClampSection(header), true);
  });
});

describe('clampRectToNeighbors', () => {
  it('cuts an inflated header rect to the next body top', () => {
    const rect = { x0: 0, y0: 0, x1: 370, y1: 245, width: 370, height: 245 };
    const clamped = clampRectToNeighbors(rect, { prevBottom: null, nextTop: 128 });
    assert.equal(clamped.y0, 0);
    assert.equal(clamped.y1, 127);
    assert.equal(clamped.height, 127);
  });

  it('keeps an authentic ~170px header when bottom equals next body top', () => {
    const rect = { x0: 0, y0: 0, x1: 1024, y1: 170, width: 1024, height: 170 };
    const clamped = clampRectToNeighbors(rect, { prevBottom: null, nextTop: 170 });
    assert.equal(clamped.y0, 0);
    assert.equal(clamped.y1, 169);
    assert.ok(clamped.height >= 168);
    assert.ok(clamped.height <= 170);
  });

  it('does not collapse to empty when nextTop overlaps the rect', () => {
    const rect = { x0: 0, y0: 0, x1: 370, y1: 80, width: 370, height: 80 };
    const clamped = clampRectToNeighbors(rect, { prevBottom: null, nextTop: 0 });
    assert.deepEqual(clamped, rect);
  });
});

describe('tightenClosedChromeY', () => {
  it('keeps short full-bleed authentic headers (incl. ~170px)', () => {
    const r = tightenClosedChromeY({
      rootTop: 0,
      rootBottom: 170,
      rootHeight: 170,
      rootWidth: 1024,
      vw: 1024,
      vh: 900,
      controlTops: [8, 40],
      controlBottoms: [48, 400],
    });
    assert.equal(r.path, 'short-full-bleed');
    assert.equal(r.y0, 0);
    assert.equal(r.y1, 170);
    assert.ok(170 <= SHORT_FULL_BLEED_MAX_PX);
  });

  it('does not re-expand control-union toward inflated root.bottom', () => {
    const r = tightenClosedChromeY({
      rootTop: 0,
      rootBottom: 455,
      rootHeight: 455,
      rootWidth: 370,
      vw: 370,
      vh: 800,
      controlTops: [4, 40],
      controlBottoms: [36, 120],
    });
    assert.equal(r.path, 'control-union');
    assert.ok(r.y1 - r.y0 <= 220);
    assert.ok(r.y1 < 400, 'must not grow back toward inflated menu root');
  });
});

describe('clampChromeRectToBodyNeighbor', () => {
  it('cuts inflated header when nextTop is real clearance', () => {
    const rect = { x0: 0, y0: 0, x1: 370, y1: 245, width: 370, height: 245 };
    const clamped = clampChromeRectToBodyNeighbor(rect, { nextTop: 126 });
    assert.equal(clamped.y1, 125);
    assert.equal(clamped.height, 125);
  });

  it('keeps tightened height when nextTop underlays the bar', () => {
    const rect = { x0: 0, y0: 0, x1: 370, y1: 126, width: 370, height: 126 };
    const clamped = clampChromeRectToBodyNeighbor(rect, { nextTop: 0 });
    assert.equal(clamped.y1, 126);
    assert.equal(clamped.height, 126);
  });

  it('keeps authentic ~170px when nextTop equals bottom', () => {
    const rect = { x0: 0, y0: 0, x1: 1024, y1: 170, width: 1024, height: 170 };
    const clamped = clampChromeRectToBodyNeighbor(rect, { nextTop: 170 });
    assert.equal(clamped.y1, 169);
    assert.ok(clamped.height >= 168);
  });
});

describe('applySectionNeighborClamp', () => {
  const header = { track: 'header', chromeKind: 'header-stack', isOverlay: false };
  const body = { track: 'both', isOverlay: false };

  it('soft-caps residual inflated header-stack height', () => {
    const rect = { x0: 0, y0: 0, x1: 370, y1: 400, width: 370, height: 400 };
    const clamped = applySectionNeighborClamp(header, rect, { nextTop: null });
    assert.ok(clamped.y1 - clamped.y0 <= TIGHTEN_CHROME_FALLBACK_MAX_PX);
  });

  it('still clamps body bands with underlay nextTop via collapse-guard', () => {
    const rect = { x0: 0, y0: 100, x1: 370, y1: 400, width: 370, height: 300 };
    const clamped = applySectionNeighborClamp(body, rect, { nextTop: 0 });
    assert.deepEqual(clamped, rect);
  });
});
