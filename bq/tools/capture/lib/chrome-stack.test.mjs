/**
 * Run: node --test tools/capture/lib/chrome-stack.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveChromeStackForSlot,
  enrichSectionInfosWithChromeStack,
  formatScrollBehaviorSummary,
} from './section-scroll-behavior.mjs';

describe('deriveChromeStackForSlot', () => {
  const announcement = {
    slot: 'section-02',
    index: 2,
    y0: 0,
    scrollBehavior: {
      cssPosition: 'fixed',
      sticky: true,
      stickyTopPx: 0,
      pinnedEdge: 'top',
      hidesOnScrollDown: true,
      showsOnScrollUp: true,
      hideAfterScrollYPx: 2475,
    },
  };
  const nav = {
    slot: 'section-03',
    index: 3,
    y0: 34,
    scrollBehavior: {
      cssPosition: 'fixed',
      sticky: true,
      stickyTopPx: 34,
      pinnedEdge: 'top',
      hidesOnScrollDown: false,
    },
  };

  it('marks nav as following a collapsible announcement', () => {
    const stack = deriveChromeStackForSlot([announcement, nav], 'section-03');
    assert.ok(stack);
    assert.equal(stack.edge, 'top');
    assert.equal(stack.restingInsetPx, 34);
    assert.equal(stack.precedingMayCollapse, true);
    assert.deepEqual(stack.precedingSlots, ['section-02']);
    assert.equal(stack.stackIndex, 1);
    assert.equal(stack.stackSize, 2);
  });

  it('marks announcement as stack root', () => {
    const stack = deriveChromeStackForSlot([announcement, nav], 'section-02');
    assert.ok(stack);
    assert.equal(stack.restingInsetPx, 0);
    assert.equal(stack.precedingMayCollapse, false);
    assert.deepEqual(stack.precedingSlots, []);
    assert.equal(stack.stackIndex, 0);
  });

  it('returns null for non-sticky body bands', () => {
    const body = {
      slot: 'section-04',
      index: 4,
      y0: 200,
      scrollBehavior: {
        cssPosition: 'static',
        sticky: false,
        stickyTopPx: null,
        hidesOnScrollDown: false,
      },
    };
    assert.equal(deriveChromeStackForSlot([announcement, nav, body], 'section-04'), null);
  });
});

describe('enrichSectionInfosWithChromeStack', () => {
  it('writes per-device chromeStack onto infos', () => {
    const infos = [
      {
        folderName: 'section-02',
        index: 2,
        rect: { y0: 0 },
        scrollBehavior: {
          desktop: {
            cssPosition: 'fixed',
            sticky: true,
            stickyTopPx: 0,
            pinnedEdge: 'top',
            hidesOnScrollDown: true,
          },
        },
      },
      {
        folderName: 'section-03',
        index: 3,
        rect: { y0: 34 },
        scrollBehavior: {
          desktop: {
            cssPosition: 'fixed',
            sticky: true,
            stickyTopPx: 34,
            pinnedEdge: 'top',
            hidesOnScrollDown: false,
          },
        },
      },
    ];
    enrichSectionInfosWithChromeStack(infos);
    assert.equal(infos[1].chromeStack.desktop.precedingMayCollapse, true);
    assert.equal(infos[1].chromeStack.desktop.restingInsetPx, 34);
    assert.equal(infos[0].chromeStack.desktop.stackIndex, 0);
  });
});

describe('formatScrollBehaviorSummary stickyTopPx', () => {
  it('includes stickyTopPx when present', () => {
    assert.match(
      formatScrollBehaviorSummary({
        cssPosition: 'fixed',
        sticky: true,
        stickyTopPx: 34,
        hidesOnScrollDown: false,
        pinnedEdge: 'top',
      }),
      /stickyTopPx=34/,
    );
  });
});
