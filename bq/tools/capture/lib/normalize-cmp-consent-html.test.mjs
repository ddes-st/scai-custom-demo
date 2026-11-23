/**
 * Run: node --test tools/capture/lib/normalize-cmp-consent-html.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeCmpConsentHtml } from './export-detected-sections.mjs';

describe('normalizeCmpConsentHtml', () => {
  it('wraps bare onetrust-pc-sdk in consent-sdk + dark-filter', () => {
    const inHtml =
      '<div id="onetrust-pc-sdk" class="otPcCenter"><h2 id="ot-pc-title">Voorkeurenmenu</h2></div>';
    const out = normalizeCmpConsentHtml(inHtml);
    assert.match(out, /id="onetrust-consent-sdk"/);
    assert.match(out, /onetrust-pc-dark-filter/);
    assert.match(out, /id="onetrust-pc-sdk"/);
    assert.match(out, /Voorkeurenmenu/);
  });

  it('strips closed visibility/display and sets height', () => {
    const inHtml =
      '<div id="onetrust-pc-sdk" style="visibility: hidden; display: none;"><div class="ot-pc-footer" style="visibility: hidden; display: none;">x</div></div>';
    const out = normalizeCmpConsentHtml(inHtml, { heightPx: 678 });
    assert.ok(!/visibility:\s*hidden/i.test(out));
    assert.ok(!/display:\s*none/i.test(out));
    assert.match(out, /height:\s*678px/);
    assert.match(out, /id="onetrust-consent-sdk"/);
  });

  it('does not double-wrap existing consent-sdk', () => {
    const inHtml =
      '<div id="onetrust-consent-sdk"><div id="onetrust-pc-sdk" class="otPcCenter">x</div></div>';
    const out = normalizeCmpConsentHtml(inHtml);
    assert.equal((out.match(/id="onetrust-consent-sdk"/g) || []).length, 1);
  });
});
