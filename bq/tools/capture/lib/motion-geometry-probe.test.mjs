/**
 * Run: node --test tools/capture/lib/motion-geometry-probe.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyMotionGeometry,
  mergeMotionGeometryByDevice,
} from './motion-geometry-probe.mjs';

describe('motion-geometry-probe', () => {
  it('classifies short full-bleed band + text overflow as band-ticker', () => {
    const r = classifyMotionGeometry({
      rootWidth: 1440,
      rootHeight: 34,
      viewportWidth: 1440,
      overflowRatio: 1.4,
      hasHorizontalOverflow: true,
      bgOnRoot: true,
      nowrapText: true,
      textLen: 80,
      imgCount: 0,
      hasInfiniteAnimation: true,
    });
    assert.equal(r.surface, 'band-ticker');
    assert.equal(r.kind, 'continuous-marquee');
    assert.equal(r.scrollingSubtree, 'text-track');
    assert.equal(r.clonesAreNotContent, true);
    assert.ok(r.evidence.includes('surface:band-ticker'));
  });

  it('classifies multi-image overflowing row as item-rail', () => {
    const r = classifyMotionGeometry({
      rootWidth: 1200,
      rootHeight: 80,
      viewportWidth: 1200,
      overflowRatio: 2.2,
      hasHorizontalOverflow: true,
      bgOnRoot: false,
      imgCount: 8,
      textLen: 10,
      hasInfiniteAnimation: false,
      transformDeltaTx: 12,
    });
    assert.equal(r.surface, 'item-rail');
    assert.equal(r.scrollingSubtree, 'item-track');
    assert.equal(r.kind, 'continuous-marquee');
  });

  it('mergeMotionGeometryByDevice prefers band-ticker', () => {
    const merged = mergeMotionGeometryByDevice({
      mobile: classifyMotionGeometry({
        rootWidth: 390,
        rootHeight: 34,
        viewportWidth: 390,
        hasHorizontalOverflow: true,
        overflowRatio: 2,
        bgOnRoot: true,
        nowrapText: true,
        textLen: 60,
        imgCount: 0,
      }),
      desktop: classifyMotionGeometry({
        rootWidth: 1440,
        rootHeight: 100,
        viewportWidth: 1440,
        hasHorizontalOverflow: true,
        imgCount: 6,
        textLen: 5,
      }),
    });
    assert.equal(merged?.surface, 'band-ticker');
    assert.equal(merged?.kind, 'continuous-marquee');
  });

  it('merge returns null when nothing continuous', () => {
    assert.equal(
      mergeMotionGeometryByDevice({
        desktop: classifyMotionGeometry({
          rootWidth: 800,
          rootHeight: 400,
          viewportWidth: 800,
          imgCount: 1,
          textLen: 20,
        }),
      }),
      null,
    );
  });
});
