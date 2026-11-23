import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeSectionHtmlForHash,
  sectionContentHash,
} from './export-detected-sections.mjs';

describe('normalizeSectionHtmlForHash strips data-* attrs', () => {
  it('removes data-modalloaded / data-osbloaded so CMP twins hash equal', () => {
    const home = `<div class="cookie" data-modalloaded="qwqzqxbeu1b05w1xpbe693g" data-osbloaded="hq5fn4j3zngo67yofeq8xs"><h1>Menzis maakt gebruikt van cookies</h1></div>`;
    const zorg = `<div class="cookie" data-modalloaded="jfwuohg203ahsqn41woo" data-osbloaded="59lbj9blco8d3zqwg1xsq"><h1>Menzis maakt gebruikt van cookies</h1></div>`;
    assert.equal(
      normalizeSectionHtmlForHash(home),
      normalizeSectionHtmlForHash(zorg),
    );
    assert.equal(sectionContentHash(home), sectionContentHash(zorg));
  });

  it('strips single-quoted and unquoted data-* attrs', () => {
    const a = `<section data-foo='abc' data-bar=baz class="x">Hi</section>`;
    const b = `<section class="x">Hi</section>`;
    assert.equal(normalizeSectionHtmlForHash(a), normalizeSectionHtmlForHash(b));
  });

  it('still distinguishes real content differences', () => {
    const a = `<div data-id="1"><p>Hello</p></div>`;
    const b = `<div data-id="2"><p>Goodbye</p></div>`;
    assert.notEqual(sectionContentHash(a), sectionContentHash(b));
  });
});
