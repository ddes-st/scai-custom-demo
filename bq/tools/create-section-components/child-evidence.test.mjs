/**
 * Child HTML slice helper.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveChildCropRect,
  sliceChildHtmlFromSection,
} from './child-evidence.mjs';

describe('sliceChildHtmlFromSection', () => {
  it('extracts article by index', () => {
    const html = `
      <section>
        <article class="card">One</article>
        <article class="card">Two</article>
      </section>`;
    const slice = sliceChildHtmlFromSection(html, { index: 1 });
    assert.match(slice, /Two/);
    assert.doesNotMatch(slice, /One/);
  });

  it('returns full html when nothing matches', () => {
    const html = '<div>plain</div>';
    assert.equal(sliceChildHtmlFromSection(html, {}), html);
  });
});

describe('resolveChildCropRect', () => {
  it('uses explicit child rect when smaller than full image', () => {
    const rect = resolveChildCropRect({
      child: { rect: { x0: 0, y0: 10, x1: 100, y1: 40 } },
      imageWidth: 100,
      imageHeight: 100,
    });
    assert.deepEqual(rect, { left: 0, top: 10, width: 100, height: 30 });
  });

  it('bands by sibling index on y axis', () => {
    const rect = resolveChildCropRect({
      childIndex: 1,
      siblingCount: 2,
      imageWidth: 200,
      imageHeight: 100,
    });
    assert.equal(rect.top, 50);
    assert.equal(rect.height, 50);
  });
});
