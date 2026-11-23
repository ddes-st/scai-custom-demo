import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computedValueContainsUrl,
  extractCssUrls,
  extractPaintUrlsFromStyleCssText,
  normalizeCssUrlToken,
  shouldKeepPaintUrlRule,
} from './authored-css-url-gate.mjs';

describe('normalizeCssUrlToken', () => {
  it('strips url() wrap and quotes', () => {
    assert.equal(
      normalizeCssUrlToken('url("https://cdn.example/a.webp")'),
      'https://cdn.example/a.webp',
    );
    assert.equal(
      normalizeCssUrlToken("url('https://cdn.example/a.webp')"),
      'https://cdn.example/a.webp',
    );
  });

  it('drops hash fragments for stable compare', () => {
    assert.equal(
      normalizeCssUrlToken('https://cdn.example/a.webp#frag'),
      'https://cdn.example/a.webp',
    );
  });
});

describe('extractCssUrls', () => {
  it('extracts multiple urls from a background-image list', () => {
    const urls = extractCssUrls(
      'url("https://a/x.png"), linear-gradient(red, blue), url(https://b/y.webp)',
    );
    assert.deepEqual(urls, ['https://a/x.png', 'https://b/y.webp']);
  });
});

describe('extractPaintUrlsFromStyleCssText', () => {
  it('pulls background-image urls and ignores color-only decls', () => {
    const urls = extractPaintUrlsFromStyleCssText(
      'color: red; background-image: url("https://myprivacy-static.example/consent/bg.webp"); width: 100%;',
    );
    assert.deepEqual(urls, ['https://myprivacy-static.example/consent/bg.webp']);
  });

  it('handles @media-inner style cssText with background shorthand', () => {
    const urls = extractPaintUrlsFromStyleCssText(
      'background: url(https://cdn.example/hero.jpg) center / cover no-repeat;',
    );
    assert.ok(urls.includes('https://cdn.example/hero.jpg'));
  });
});

describe('shouldKeepPaintUrlRule / computed evidence', () => {
  it('keeps rules with no paint urls (typography/color)', () => {
    assert.equal(shouldKeepPaintUrlRule([], new Set()), true);
    assert.equal(
      shouldKeepPaintUrlRule([], new Set(['https://cdn.example/x.webp'])),
      true,
    );
  });

  it('drops selector-matched paint url not in computed evidence (CMP-style leak)', () => {
    const ruleUrls = extractPaintUrlsFromStyleCssText(
      'background-image: url("https://myprivacy-static.dpgmedia.net/consent/resources/backgrounds/energyprice.webp"); width: 100vw;',
    );
    const evidenced = new Set([
      // Section only has a solid / none background in computed style
    ]);
    assert.equal(shouldKeepPaintUrlRule(ruleUrls, evidenced), false);
  });

  it('keeps paint url when computed style evidences the same URL (any host)', () => {
    const url =
      'https://myprivacy-static.dpgmedia.net/consent/resources/backgrounds/energyprice.webp';
    const ruleUrls = extractPaintUrlsFromStyleCssText(
      `background-image: url("${url}");`,
    );
    const evidenced = new Set([normalizeCssUrlToken(url)]);
    assert.equal(shouldKeepPaintUrlRule(ruleUrls, evidenced), true);
  });

  it('keeps same-origin next/image backgrounds when evidenced', () => {
    const url =
      'https://www.energyprice.be/_next/image?url=%2Fhero.jpg&w=1200&q=75';
    const ruleUrls = [normalizeCssUrlToken(url)];
    const evidenced = new Set([normalizeCssUrlToken(`url("${url}")`)]);
    assert.equal(shouldKeepPaintUrlRule(ruleUrls, evidenced), true);
  });

  it('computedValueContainsUrl matches quoted computed forms', () => {
    assert.equal(
      computedValueContainsUrl(
        'url("https://cdn.example/a.webp")',
        'https://cdn.example/a.webp',
      ),
      true,
    );
    assert.equal(
      computedValueContainsUrl('none', 'https://cdn.example/a.webp'),
      false,
    );
  });
});
