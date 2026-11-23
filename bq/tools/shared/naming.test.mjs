/**
 * Run: node --import tsx --test tools/shared/naming.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  encodeGeneralLink,
  isUnderSiteHome,
  proposeValidItemName,
  sanitizeSingleLineText,
  toPlainDisplayName,
  unwrapStringValue,
} from './naming.ts';

describe('sanitizeSingleLineText', () => {
  it('collapses LF mid-name (menzis CORRUPT FILE shape)', () => {
    assert.equal(
      sanitizeSingleLineText('Men\nzis Netherlands'),
      'Men zis Netherlands',
    );
  });

  it('collapses CR/LF and Unicode separators; trims', () => {
    assert.equal(
      sanitizeSingleLineText('  Menzis\r\nNetherlands\u2028Extra  '),
      'Menzis Netherlands Extra',
    );
  });

  it('leaves normal single-line names unchanged', () => {
    assert.equal(
      sanitizeSingleLineText('Menzis Netherlands'),
      'Menzis Netherlands',
    );
  });

  it('handles null/undefined', () => {
    assert.equal(sanitizeSingleLineText(null), '');
    assert.equal(sanitizeSingleLineText(undefined), '');
  });
});


describe('encodeGeneralLink internal id casing (ser pull format)', () => {
  // Observed after `dotnet sitecore ser pull -n bqAuthoring -i BQ` on
  // Primary Navigation Search Link / Logo Link / Request Demo.
  const PULL_SEARCH_ID = '{B396099F-E5FD-526B-9010-59F2C1DBA7B8}';
  const LOWER = 'b396099f-e5fd-526b-9010-59f2c1dba7b8';
  const MIXED = 'B396099f-E5Fd-526b-9010-59f2c1dba7b8';
  const BRACED_LOWER = '{b396099f-e5fd-526b-9010-59f2c1dba7b8}';

  it('emits uppercase braced id matching ser pull', () => {
    const xml = encodeGeneralLink({
      text: 'Open Search',
      url: '/search',
      linktype: 'internal',
      id: LOWER,
    });
    assert.equal(
      xml,
      `<link text="Open Search" linktype="internal" url="/search" anchor="" target="" id="${PULL_SEARCH_ID}" />`,
    );
  });

  it('normalizes mixed-case and braced-lowercase inputs to pull format', () => {
    for (const id of [LOWER, MIXED, BRACED_LOWER, PULL_SEARCH_ID]) {
      const xml = encodeGeneralLink({
        text: 'Open Search',
        url: '/search',
        linktype: 'internal',
        id,
      });
      assert.match(xml, /id="\{B396099F-E5FD-526B-9010-59F2C1DBA7B8\}"/);
    }
  });
});

describe('proposeValidItemName (ItemNameValidation)', () => {
  it('strips trailing period and apostrophe (menzis-content-band)', () => {
    assert.equal(
      proposeValidItemName("Then there's Menzis."),
      'Then theres Menzis',
    );
  });

  it('strips straight apostrophes in mid-name headlines', () => {
    assert.equal(
      proposeValidItemName("Medicine shortages here's what's going on"),
      'Medicine shortages heres whats going on',
    );
  });

  it('strips curly apostrophes', () => {
    assert.equal(
      proposeValidItemName('Medicine shortages here\u2019s what\u2019s going on'),
      'Medicine shortages heres whats going on',
    );
  });

  it('strips commas and bangs; keeps spaced Title Case', () => {
    assert.equal(
      proposeValidItemName('Hello, world!'),
      'Hello world',
    );
  });

  it('leaves already-valid display names alone', () => {
    assert.equal(
      proposeValidItemName('Then theres Menzis'),
      'Then theres Menzis',
    );
  });

  it('strips literal quotes from JSON.stringify-evaluated Path names', () => {
    assert.equal(
      proposeValidItemName('"Cookie Consent Overlay"'),
      'Cookie Consent Overlay',
    );
    assert.equal(
      proposeValidItemName("'Cookie Consent Overlay'"),
      'Cookie Consent Overlay',
    );
  });
});

describe('unwrapStringValue', () => {
  it('peels JSON.stringify-evaluated wrapping quotes', () => {
    assert.equal(unwrapStringValue('"welkom"'), 'welkom');
    assert.equal(unwrapStringValue("'onze zorgadviseurs'"), 'onze zorgadviseurs');
  });

  it('peels &quot; wrappers from link XML extracts', () => {
    assert.equal(unwrapStringValue('&quot;welkom&quot;'), 'welkom');
    assert.equal(unwrapStringValue('&#34;welkom&#34;'), 'welkom');
  });

  it('leaves bare text and mid-string quotes alone', () => {
    assert.equal(unwrapStringValue('welkom'), 'welkom');
    assert.equal(unwrapStringValue('Say "hi"'), 'Say "hi"');
  });
});

describe('toPlainDisplayName', () => {
  it('strips Rich Text-ish tags (Reason Cards Shorter Waiting)', () => {
    assert.equal(
      toPlainDisplayName('<p>Wacht 18 weken korter</p>'),
      'Wacht 18 weken korter',
    );
  });

  it('leaves plain text alone; peels wrapping quotes', () => {
    assert.equal(toPlainDisplayName('Wacht 18 weken korter'), 'Wacht 18 weken korter');
    assert.equal(toPlainDisplayName('"Wacht 18 weken korter"'), 'Wacht 18 weken korter');
  });

  it('decodes common entities and keeps mid-sentence punctuation', () => {
    assert.equal(
      toPlainDisplayName('<p>Service &amp; contact — it&apos;s here!</p>'),
      "Service & contact — it's here!",
    );
  });
});

describe('encodeGeneralLink unwrap', () => {
  it('does not manufacture &quot; from wrapping quotes on text', () => {
    const xml = encodeGeneralLink({
      text: '"welkom"',
      url: 'https://example.com/x',
    });
    assert.match(xml, /text="welkom"/);
    assert.doesNotMatch(xml, /&quot;welkom&quot;/);
  });
});

describe('isUnderSiteHome', () => {
  it('true for site page descendants under content/collection/site/Home', () => {
    assert.equal(
      isUnderSiteHome('/sitecore/content/axa/axa-be/Home/About'),
      true,
    );
    assert.equal(
      isUnderSiteHome('/sitecore/content/axa/axa-be/Home/individuals/pension'),
      true,
    );
  });

  it('false for Home itself', () => {
    assert.equal(isUnderSiteHome('/sitecore/content/axa/axa-be/Home'), false);
  });

  it('false for Data under site Home', () => {
    assert.equal(
      isUnderSiteHome('/sitecore/content/axa/axa-be/Home/Data/Link Lists/X'),
      false,
    );
  });

  it('false for Link Lists group named Home (not a site URL)', () => {
    assert.equal(
      isUnderSiteHome(
        '/sitecore/content/axa/axa-be/Data/Link Lists/Home/Outstanding Balance Insurance',
      ),
      false,
    );
    assert.equal(
      isUnderSiteHome('/sitecore/content/axa/axa-be/Data/Link Lists/Home'),
      false,
    );
  });

  it('false for other Data trees', () => {
    assert.equal(
      isUnderSiteHome('/sitecore/content/axa/axa-be/Data/Link Lists/Mobility/Car'),
      false,
    );
  });
});
