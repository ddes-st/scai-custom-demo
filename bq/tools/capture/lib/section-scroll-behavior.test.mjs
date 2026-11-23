/**
 * Run: node --test tools/capture/lib/section-scroll-behavior.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  analyzeScrollSamples,
  formatScrollBehaviorSummary,
  pickDesktopScrollBehavior,
  scrollYToViewports,
} from './section-scroll-behavior.mjs';

describe('scrollYToViewports', () => {
  it('rounds to 2 decimals', () => {
    assert.equal(scrollYToViewports(420, 900), 0.47);
    assert.equal(scrollYToViewports(null, 900), null);
  });
});

describe('analyzeScrollSamples', () => {
  it('records hide threshold on incremental hide', () => {
    const vh = 900;
    const out = analyzeScrollSamples({
      cssPosition: 'fixed',
      stickyTopPx: 0,
      vh,
      deep: true,
      samples: [
        { scrollY: 0, visible: true, top: 0, bottom: 34, height: 34 },
        { scrollY: 225, visible: true, top: 0, bottom: 34, height: 34 },
        { scrollY: 450, visible: false, top: -40, bottom: -6, height: 34 },
        { scrollY: 675, visible: false, top: -40, bottom: -6, height: 34 },
        { scrollY: 158, visible: true, top: 0, bottom: 34, height: 34 },
        { scrollY: 0, visible: true, top: 0, bottom: 34, height: 34 },
      ],
    });
    assert.equal(out.hidesOnScrollDown, true);
    assert.equal(out.hideAfterScrollYPx, 450);
    assert.equal(out.hideAfterViewports, 0.5);
    assert.equal(out.visiblePastOneViewport, false);
    assert.equal(out.showsOnScrollUp, true);
    assert.equal(out.showAfterScrollYPx, 158);
    assert.match(out.evidence.join(' '), /hidden @ scrollY~450/);
  });

  it('keeps permanent sticky when still visible past one viewport', () => {
    const vh = 900;
    const out = analyzeScrollSamples({
      cssPosition: 'fixed',
      stickyTopPx: 0,
      vh,
      deep: true,
      samples: [
        { scrollY: 0, visible: true, top: 0, bottom: 34, height: 34 },
        { scrollY: 225, visible: true, top: 0, bottom: 34, height: 34 },
        { scrollY: 945, visible: true, top: 0, bottom: 34, height: 34 },
        { scrollY: 0, visible: true, top: 0, bottom: 34, height: 34 },
      ],
    });
    assert.equal(out.hidesOnScrollDown, false);
    assert.equal(out.hideAfterScrollYPx, null);
    assert.equal(out.sticky, true);
    assert.equal(out.visiblePastOneViewport, true);
    assert.equal(out.pinnedEdge, 'top');
  });

  it('detects bottom-fixed cookie bar even when CSS already marks fixed', () => {
    const vh = 900;
    const out = analyzeScrollSamples({
      cssPosition: 'fixed',
      stickyTopPx: 596,
      vh,
      deep: true,
      samples: [
        { scrollY: 0, visible: true, top: 596, bottom: 900, height: 304 },
        { scrollY: 945, visible: true, top: 596, bottom: 900, height: 304 },
      ],
    });
    assert.equal(out.sticky, true);
    assert.equal(out.pinnedEdge, 'bottom');
    assert.ok(out.evidence.includes('geom-bottom-pin'));
    assert.equal(
      formatScrollBehaviorSummary(out),
      'bottom-fixed; remains while scrolling; stickyTopPx=596',
    );
  });
});

describe('formatScrollBehaviorSummary', () => {
  it('describes hide threshold', () => {
    assert.match(
      formatScrollBehaviorSummary({
        cssPosition: 'fixed',
        sticky: true,
        hidesOnScrollDown: true,
        showsOnScrollUp: true,
        hideAfterScrollYPx: 420,
        hideAfterViewports: 0.47,
        pinnedEdge: 'top',
      }),
      /hides on scroll down after ~420px \(~0\.47vh\).*shows on scroll up/,
    );
  });

  it('describes permanent pin', () => {
    assert.equal(
      formatScrollBehaviorSummary({
        cssPosition: 'fixed',
        sticky: true,
        hidesOnScrollDown: false,
        pinnedEdge: 'top',
      }),
      'top-fixed; remains while scrolling',
    );
  });

  it('includes stickyTopPx when set', () => {
    assert.equal(
      formatScrollBehaviorSummary({
        cssPosition: 'fixed',
        sticky: true,
        stickyTopPx: 34,
        hidesOnScrollDown: false,
        pinnedEdge: 'top',
      }),
      'top-fixed; remains while scrolling; stickyTopPx=34',
    );
  });
});

describe('pickDesktopScrollBehavior', () => {
  it('prefers desktop device block', () => {
    const sb = pickDesktopScrollBehavior({
      scrollBehavior: {
        mobile: { hidesOnScrollDown: false },
        desktop: { hidesOnScrollDown: true, hideAfterScrollYPx: 100 },
      },
    });
    assert.equal(sb.hidesOnScrollDown, true);
    assert.equal(sb.hideAfterScrollYPx, 100);
  });
});
