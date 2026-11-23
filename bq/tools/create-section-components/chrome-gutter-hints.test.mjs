/**
 * Run: node --test tools/create-section-components/chrome-gutter-hints.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractChromeGutterHintsFromCapture,
  formatChromeGutterBlockForPrompt,
} from './chrome-gutter-hints.mjs';

describe('chrome-gutter-hints', () => {
  it('detects CMP cookie settings even when display none', () => {
    const html = `
      <a href="#" id="customize-cookies" style="display: none !important;">
        <span>Cookie settings</span>
      </a>
      <a href="/legal">Legal Hub</a>
    `;
    const hints = extractChromeGutterHintsFromCapture(html, '');
    assert.equal(hints.cmpCookieSettings, true);
    assert.ok(hints.legalLinkTexts.some((t) => /Legal Hub/i.test(t)));
  });

  it('parses sc-grid gutter CSS vars', () => {
    const css = `
      .container {
        --sc-grid-margin-x: clamp(2rem, -.8571rem + 4.4643vw, 4.5rem);
        --sc-grid-padding-x: 19px;
      }
    `;
    const hints = extractChromeGutterHintsFromCapture('<div class="sc-grid">', css);
    assert.ok(hints.gutterProfile?.marginX?.includes('clamp'));
    assert.match(hints.gutterProfile?.paddingX || '', /19px/);
  });

  it('formatChromeGutterBlockForPrompt includes liveExpected cookie line', () => {
    const block = formatChromeGutterBlockForPrompt({
      brandLogo: true,
      socialIconCount: 6,
      legalLinkTexts: ['Legal Hub'],
      cmpCookieSettings: true,
      hairlineHints: ['capture-uses-border-edges'],
      gutterProfile: { paddingX: '19px', edgeMode: 'inset-band' },
    });
    assert.match(block, /cmpCookieSettings/);
    assert.match(block, /liveExpected/);
    assert.match(block, /gutterProfile/);
    assert.match(block, /ONE owner per separator/);
  });
});
