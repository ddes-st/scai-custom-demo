/**
 * Run: node --test tools/capture/lib/section-html-normalize.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLargeMarqueeTranslate,
  normalizeSectionHtmlSnapshot,
  scrubMarqueeTransformFromStyleAttr,
} from './section-html-normalize.mjs';

describe('section-html-normalize', () => {
  it('detects large marquee translates', () => {
    assert.equal(isLargeMarqueeTranslate('translate3d(-4101px, 0px, 0px)'), true);
    assert.equal(isLargeMarqueeTranslate('translate3d(0px, 0px, 0px)'), false);
    assert.equal(isLargeMarqueeTranslate('none'), false);
  });

  it('scrubs large transform from style attr', () => {
    const next = scrubMarqueeTransformFromStyleAttr(
      'transform: translate3d(-4101px, 0px, 0px); gap: 1rem',
    );
    assert.equal(/transform/i.test(next), false);
    assert.match(next, /gap:\s*1rem/);
  });

  it('normalizes snapshot html: marquee + hide stamps', () => {
    const html = `<div style="transform: translate3d(-4101px, 0px, 0px);"><img data-screenshot-hidden="floating-action" style="display: none !important; visibility: hidden !important; opacity: 0 !important; height: 52px;" src="x.png"></div>`;
    const out = normalizeSectionHtmlSnapshot(html);
    assert.equal(/translate3d/i.test(out), false);
    assert.equal(/data-screenshot-hidden/i.test(out), false);
    assert.equal(/display:\s*none/i.test(out), false);
    assert.match(out, /height:\s*52px/);
  });
});
