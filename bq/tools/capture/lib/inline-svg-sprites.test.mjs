/**
 * Run: node --test tools/capture/lib/inline-svg-sprites.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  clearSvgSpriteSheetCache,
  extractSvgSymbolFromSheet,
  findExternalSvgSpriteUses,
  inlineSvgSpritesInHtml,
  parseExternalSvgUseHref,
  sanitizeStandaloneSvg,
} from './inline-svg-sprites.mjs';

const ENERGYPRICE_LIKE_SHEET = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><defs>
<svg fill="none" viewBox="0 0 52 52" id="CE__gas" xmlns="http://www.w3.org/2000/svg">
  <path stroke="var(--wk-theme-icon-base)" d="M10 10h20"/>
</svg>
<svg fill="none" viewBox="0 0 52 52" id="CE__electricity" xmlns="http://www.w3.org/2000/svg">
  <circle stroke="var(--wk-theme-icon-highlight)" cx="26" cy="26" r="10"/>
</svg>
</defs></svg>`;

const SYMBOL_SHEET = `<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="foo" viewBox="0 0 24 24"><path d="M1 1h10" fill="var(--icon)"/></symbol>
</svg>`;

describe('parseExternalSvgUseHref', () => {
  it('resolves relative sprite path against page origin', () => {
    const hit = parseExternalSvgUseHref(
      '/sprite/sprite.svg#CE__gas',
      'https://www.energyprice.be/',
    );
    assert.deepEqual(hit, {
      sheetUrl: 'https://www.energyprice.be/sprite/sprite.svg',
      symbolId: 'CE__gas',
    });
  });

  it('accepts absolute CDN icons.svg#id', () => {
    const hit = parseExternalSvgUseHref(
      'https://cdn.example.com/assets/icons.svg#logo',
      'https://www.example.com/',
    );
    assert.equal(hit?.sheetUrl, 'https://cdn.example.com/assets/icons.svg');
    assert.equal(hit?.symbolId, 'logo');
  });

  it('skips same-document #id and non-svg paths', () => {
    assert.equal(parseExternalSvgUseHref('#local', 'https://a.com/'), null);
    assert.equal(
      parseExternalSvgUseHref('/img/photo.png#x', 'https://a.com/'),
      null,
    );
  });
});

describe('extractSvgSymbolFromSheet', () => {
  it('extracts nested defs svg (energyprice-like)', () => {
    const svg = extractSvgSymbolFromSheet(ENERGYPRICE_LIKE_SHEET, 'CE__gas');
    assert.ok(svg);
    assert.match(svg, /viewBox="0 0 52 52"/);
    assert.match(svg, /M10 10h20/);
    assert.match(svg, /currentColor/);
    assert.ok(!/var\(--/.test(svg));
  });

  it('extracts symbol id', () => {
    const svg = extractSvgSymbolFromSheet(SYMBOL_SHEET, 'foo');
    assert.ok(svg);
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.match(svg, /M1 1h10/);
    assert.match(svg, /currentColor/);
  });
});

describe('inlineSvgSpritesInHtml', () => {
  beforeEach(() => clearSvgSpriteSheetCache());

  it('inlines energyprice-like use inside wrapping svg', async () => {
    const html = `
      <a class="card">
        <span class="icon">
          <svg style="height:70px" class="icon spot-icon CE__gas">
            <use xlink:href="/sprite/sprite.svg#CE__gas"></use>
          </svg>
        </span>
      </a>`;
    const { html: out, inlined, failed } = await inlineSvgSpritesInHtml(html, {
      pageUrl: 'https://www.energyprice.be/',
      warn: false,
      fetchText: async () => ENERGYPRICE_LIKE_SHEET,
    });
    assert.equal(failed, 0);
    assert.equal(inlined, 1);
    assert.ok(!/xlink:href=/.test(out));
    assert.ok(!/<use\b/i.test(out));
    assert.match(out, /M10 10h20/);
    assert.match(out, /class="icon spot-icon CE__gas"/);
  });

  it('inlines non-/sprite/ path (host-agnostic)', async () => {
    const html = `<svg><use href="/assets/icons.svg#foo"></use></svg>`;
    const { html: out, inlined } = await inlineSvgSpritesInHtml(html, {
      pageUrl: 'https://shop.example.com/page',
      warn: false,
      fetchText: async (url) => {
        assert.equal(url, 'https://shop.example.com/assets/icons.svg');
        return SYMBOL_SHEET;
      },
    });
    assert.equal(inlined, 1);
    assert.match(out, /M1 1h10/);
    assert.ok(!/<use\b/i.test(out));
  });

  it('leaves use unchanged when sheet missing', async () => {
    const html = `<svg><use href="/sprite/sprite.svg#CE__gas"></use></svg>`;
    const { html: out, inlined, failed } = await inlineSvgSpritesInHtml(html, {
      pageUrl: 'https://www.energyprice.be/',
      warn: false,
      fetchText: async () => null,
    });
    assert.equal(inlined, 0);
    assert.equal(failed, 1);
    assert.match(out, /<use\b/i);
  });

  it('findExternalSvgSpriteUses finds xlink and href', () => {
    const html = `
      <use xlink:href="/sprite/sprite.svg#A"></use>
      <use href="https://cdn.example.com/i.svg#B" />`;
    const hits = findExternalSvgSpriteUses(html, 'https://www.energyprice.be/');
    assert.equal(hits.length, 2);
    assert.equal(hits[0].symbolId, 'A');
    assert.equal(hits[1].symbolId, 'B');
  });
});

describe('sanitizeStandaloneSvg', () => {
  it('adds xmlns and strips outer id', () => {
    const out = sanitizeStandaloneSvg(
      '<svg id="CE__gas" viewBox="0 0 1 1"><path fill="var(--x)" d="M0 0"/></svg>',
    );
    assert.match(out, /xmlns=/);
    assert.ok(!/\sid="CE__gas"/.test(out));
    assert.match(out, /fill="currentColor"/);
  });
});
