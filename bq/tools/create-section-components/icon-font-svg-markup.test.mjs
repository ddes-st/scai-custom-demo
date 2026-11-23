/**
 * Run: node --import tsx --test tools/create-section-components/icon-font-svg-markup.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseCardIconGlyphsFromHtml,
  dualGlyphPathsToSvgMarkup,
  svgMarkupForCardTitle,
} from './icon-font-svg-markup.mjs';

describe('icon-font-svg-markup', () => {
  it('parses feature card icons without matching card-body / external-link', () => {
    const html = `
<div class="card-body"><i class="ic-g-external-link"><span data-bq-glyph="X"></span></i><h3>Nope</h3></div>
<div class="card image--top"><span class="icon"><i class="ic-mnz-people"><span data-bq-glyph="A"></span><span data-bq-glyph="B"></span></i></span><h3>Iedereen is <a>welkom</a></h3></div>
.ic-mnz-people::before { content: "A"; }
.ic-mnz-people::after { content: "B"; }
`;
    const map = parseCardIconGlyphsFromHtml(html);
    assert.equal(map.has('nope'), false);
    const hit = map.get('iedereen is welkom');
    assert.ok(hit);
    assert.equal(hit.className, 'ic-mnz-people');
    assert.equal(hit.before, 'A');
    assert.equal(hit.after, 'B');
  });

  it('builds dual-tone svgMarkup', () => {
    const svg = dualGlyphPathsToSvgMarkup(
      { d: 'M0 0', horizAdvX: 1024 },
      { d: 'M1 1', horizAdvX: 1024 },
    );
    assert.match(svg, /<path fill="#fcb53c"/);
    assert.match(svg, /<path fill="#043572"/);
  });

  it('returns empty markup without font paths', () => {
    const html = `<div class="card"><span class="icon"><i class="ic-mnz-people"><span data-bq-glyph="A"></span></i></span><h3>Hi</h3></div>`;
    assert.equal(
      svgMarkupForCardTitle({ sectionHtml: html, fontSvg: '', title: 'Hi' }),
      '',
    );
  });
});
