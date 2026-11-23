/**
 * URL → language/culture + locale path stripping.
 * Run: node --test tools/shared/cultures.url.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cultureFromLanguageAndRegion,
  extractContentLanguageFromDesignMd,
  inferPageLanguageFromUrl,
  inferSitecoreCultureFromUrl,
  isContentLanguageSegment,
  isMarketOrCountrySegment,
  normalizeLanguageHint,
  parseHtmlLangAttribute,
  parseLocaleFromPathname,
  resolveCaptureSourceCulture,
  stripLocalePathSegments,
  stripLocalePrefixFromPathname,
  tldFromHostOrUrl,
} from './cultures.mjs';

describe('tldFromHostOrUrl', () => {
  it('reads ccTLD and ignores gTLDs', () => {
    assert.equal(tldFromHostOrUrl('https://www.axa.be/nl/x'), 'be');
    assert.equal(tldFromHostOrUrl('https://www.something.fr/fr/x'), 'fr');
    assert.equal(tldFromHostOrUrl('https://www.dom-security.com/be/en/x'), '');
  });
});

describe('parseLocaleFromPathname / inferPageLanguageFromUrl', () => {
  it('treats first language folder as language', () => {
    assert.deepEqual(parseLocaleFromPathname('/nl/particulieren'), {
      language: 'nl',
      region: null,
      stripCount: 1,
    });
    assert.equal(inferPageLanguageFromUrl('https://www.axa.be/nl/particulieren'), 'nl');
    assert.equal(inferPageLanguageFromUrl('https://www.axa.be/fr/particuliers'), 'fr');
  });

  it('defaults to en for ambiguous TLD without language folder', () => {
    assert.equal(inferPageLanguageFromUrl('https://www.axa.be/particulieren'), 'en');
    assert.equal(
      inferPageLanguageFromUrl(
        'https://www.dom-security.com/products/half-cylinder',
      ),
      'en',
    );
  });

  it('uses monolingual ccTLD default when no language folder', () => {
    assert.equal(inferPageLanguageFromUrl('https://www.menzis.nl/'), 'nl');
    assert.equal(
      inferPageLanguageFromUrl('https://www.menzis.nl/zorgverzekering'),
      'nl',
    );
  });

  it('handles market/language (/be/en/…) without treating be as Belarusian', () => {
    assert.equal(isContentLanguageSegment('be'), false);
    assert.equal(isMarketOrCountrySegment('be'), true);
    assert.deepEqual(parseLocaleFromPathname('/be/en/products/els'), {
      language: 'en',
      region: 'BE',
      stripCount: 2,
    });
    assert.equal(
      inferPageLanguageFromUrl(
        'https://www.dom-security.com/be/en/products/els',
      ),
      'en',
    );
  });
});

describe('inferSitecoreCultureFromUrl', () => {
  it('combines language folder with host ccTLD', () => {
    assert.equal(
      inferSitecoreCultureFromUrl('https://www.axa.be/nl/particulieren'),
      'nl-BE',
    );
    assert.equal(
      inferSitecoreCultureFromUrl('https://www.axa.be/fr/particuliers'),
      'fr-BE',
    );
    assert.equal(
      inferSitecoreCultureFromUrl('https://www.example.fr/fr/accueil'),
      'fr-FR',
    );
  });

  it('returns en without a language folder on ambiguous TLD', () => {
    assert.equal(
      inferSitecoreCultureFromUrl('https://www.axa.be/particulieren'),
      'en',
    );
    assert.equal(
      inferSitecoreCultureFromUrl(
        'https://www.dom-security.com/be/en/products/els',
      ),
      'en',
    );
  });

  it('uses monolingual ccTLD for locale-less .nl', () => {
    assert.equal(inferSitecoreCultureFromUrl('https://www.menzis.nl/'), 'nl-NL');
    assert.equal(
      inferSitecoreCultureFromUrl('https://www.menzis.nl/zorgverzekering'),
      'nl-NL',
    );
  });

  it('prefers cultures list when provided', () => {
    assert.equal(
      inferSitecoreCultureFromUrl('https://www.axa.be/nl/x', ['nl-BE', 'fr-BE']),
      'nl-BE',
    );
  });
});

describe('resolveCaptureSourceCulture', () => {
  it('prefers path language over html lang', () => {
    assert.deepEqual(
      resolveCaptureSourceCulture({
        url: 'https://www.axa.be/nl/particulieren',
        htmlLang: 'fr',
      }),
      { culture: 'nl-BE', pageLanguage: 'nl' },
    );
  });

  it('uses html lang × TLD when path has no language folder', () => {
    assert.deepEqual(
      resolveCaptureSourceCulture({
        url: 'https://www.menzis.nl/zorgverzekering',
        htmlLang: 'nl',
      }),
      { culture: 'nl-NL', pageLanguage: 'nl' },
    );
    assert.deepEqual(
      resolveCaptureSourceCulture({
        url: 'https://www.axa.be/particulieren',
        htmlLang: 'nl',
      }),
      { culture: 'nl-BE', pageLanguage: 'nl' },
    );
  });

  it('uses AI language when html lang missing', () => {
    assert.deepEqual(
      resolveCaptureSourceCulture({
        url: 'https://www.menzis.nl/',
        aiLanguage: 'nl-NL',
      }),
      { culture: 'nl-NL', pageLanguage: 'nl' },
    );
  });

  it('falls back to monolingual TLD then en', () => {
    assert.deepEqual(
      resolveCaptureSourceCulture({ url: 'https://www.menzis.nl/' }),
      { culture: 'nl-NL', pageLanguage: 'nl' },
    );
    assert.deepEqual(
      resolveCaptureSourceCulture({ url: 'https://www.axa.be/particulieren' }),
      { culture: 'en', pageLanguage: 'en' },
    );
  });

  it('keeps explicit /en/ path as English', () => {
    assert.deepEqual(
      resolveCaptureSourceCulture({
        url: 'https://www.dom-security.com/be/en/products/els',
        htmlLang: 'nl',
      }),
      { culture: 'en', pageLanguage: 'en' },
    );
  });
});

describe('parseHtmlLangAttribute / design md contentLanguage', () => {
  it('reads html lang', () => {
    assert.equal(
      parseHtmlLangAttribute('<!DOCTYPE html><html lang="nl" class="js">'),
      'nl',
    );
    assert.equal(
      parseHtmlLangAttribute('<html lang=\'fr-BE\'>'),
      'fr-BE',
    );
    assert.equal(parseHtmlLangAttribute('<html class="x">'), null);
  });

  it('normalizes language hints', () => {
    assert.deepEqual(normalizeLanguageHint('nl-NL'), {
      language: 'nl',
      region: 'NL',
    });
    assert.deepEqual(normalizeLanguageHint('fr'), {
      language: 'fr',
      region: null,
    });
    assert.equal(normalizeLanguageHint(''), null);
  });

  it('extracts contentLanguage from DESIGN.md front matter', () => {
    const md = `---
name: Menzis
contentLanguage: nl
colors:
  primary: "#043572"
---
# Overview
`;
    assert.equal(extractContentLanguageFromDesignMd(md), 'nl');
    assert.equal(extractContentLanguageFromDesignMd('# no front matter'), null);
  });
});

describe('cultureFromLanguageAndRegion', () => {
  it('builds Sitecore cultures', () => {
    assert.equal(cultureFromLanguageAndRegion('nl', 'be'), 'nl-BE');
    assert.equal(cultureFromLanguageAndRegion('fr', 'fr'), 'fr-FR');
    assert.equal(cultureFromLanguageAndRegion('en', 'be'), 'en');
    assert.equal(cultureFromLanguageAndRegion('nl', 'nl'), 'nl-NL');
  });
});

describe('stripLocalePrefixFromPathname', () => {
  it('strips language and market/language prefixes for Sitecore items', () => {
    assert.equal(
      stripLocalePrefixFromPathname('/nl/particulieren/pensioen'),
      '/particulieren/pensioen',
    );
    assert.equal(
      stripLocalePrefixFromPathname('/be/en/products/els-pro'),
      '/products/els-pro',
    );
    assert.deepEqual(
      stripLocalePathSegments(['be', 'nl', 'products'], []),
      ['products'],
    );
  });
});
