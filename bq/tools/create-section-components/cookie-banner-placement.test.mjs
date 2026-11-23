/**
 * Cookie banner placement resolve + skip helpers.
 * Run: node --import tsx --test tools/create-section-components/cookie-banner-placement.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { parseArgs } from './cli.mjs';
import {
  BQ_COOKIEBANNER_PLACEMENT,
  isCookieBannerSection,
  normalizeCookieBannerPlacement,
  resolveCookieBannerPlacement,
  shouldSkipCookieBannerLayoutPlacement,
} from './cookie-banner-placement.mjs';
import { assertPresentationCoverage } from './presentation-coverage.mjs';

describe('resolveCookieBannerPlacement', () => {
  const prev = process.env[BQ_COOKIEBANNER_PLACEMENT];

  afterEach(() => {
    if (prev === undefined) delete process.env[BQ_COOKIEBANNER_PLACEMENT];
    else process.env[BQ_COOKIEBANNER_PLACEMENT] = prev;
  });

  it('defaults to none when neither CLI nor env', () => {
    delete process.env[BQ_COOKIEBANNER_PLACEMENT];
    assert.equal(resolveCookieBannerPlacement(null), 'none');
    assert.equal(resolveCookieBannerPlacement(undefined, {}), 'none');
  });

  it('uses env when CLI omitted', () => {
    assert.equal(
      resolveCookieBannerPlacement(null, {
        [BQ_COOKIEBANNER_PLACEMENT]: 'none',
      }),
      'none',
    );
  });

  it('CLI overrides env', () => {
    assert.equal(
      resolveCookieBannerPlacement('place', {
        [BQ_COOKIEBANNER_PLACEMENT]: 'none',
      }),
      'place',
    );
    assert.equal(
      resolveCookieBannerPlacement('none', {
        [BQ_COOKIEBANNER_PLACEMENT]: 'place',
      }),
      'none',
    );
  });

  it('normalize rejects unknown values', () => {
    assert.equal(normalizeCookieBannerPlacement('skip'), null);
    assert.equal(normalizeCookieBannerPlacement('PLACE'), 'place');
  });
});

describe('parseArgs --cookiebanner-placement', () => {
  it('parses equals and space forms', () => {
    assert.equal(
      parseArgs([
        '--url',
        'https://example.com/',
        '--cookiebanner-placement=none',
      ]).cookieBannerPlacement,
      'none',
    );
    assert.equal(
      parseArgs([
        '--url',
        'https://example.com/',
        '--cookiebanner-placement',
        'place',
      ]).cookieBannerPlacement,
      'place',
    );
  });
});

describe('shouldSkipCookieBannerLayoutPlacement', () => {
  it('skips cookie keys only when placement is none', () => {
    assert.equal(
      shouldSkipCookieBannerLayoutPlacement(
        'none',
        { cmsName: 'CookieBanner', type: 'cookie-banner' },
        'sitecore-cookie-consent-banner',
      ),
      true,
    );
    assert.equal(
      shouldSkipCookieBannerLayoutPlacement(
        'place',
        { cmsName: 'CookieBanner', type: 'cookie-banner' },
        'sitecore-cookie-consent-banner',
      ),
      false,
    );
    assert.equal(
      shouldSkipCookieBannerLayoutPlacement(
        'none',
        { cmsName: 'Hero' },
        'sitecore-hero-banner',
      ),
      false,
    );
  });

  it('detects cookie by definitionKey alone', () => {
    assert.equal(
      isCookieBannerSection(null, 'sitecore-privacy-consent-panel'),
      true,
    );
  });

  it('does not treat footer utility/legal bands as CMP when purpose cites cookies', () => {
    assert.equal(
      isCookieBannerSection(
        {
          cmsName: 'UtilityFooter',
          purpose:
            'Provides brand identification and utility links for cookies, disclaimer, privacy, and accessibility.',
          folderName: 'section-06',
          pageWiring: { role: 'partial', placeholder: 'headless-footer' },
        },
        'menzis-footer-info-links',
      ),
      false,
    );
    assert.equal(
      shouldSkipCookieBannerLayoutPlacement(
        'none',
        {
          cmsName: 'UtilityFooter',
          purpose:
            'Provides brand identification and utility links for cookies, disclaimer, privacy, and accessibility.',
        },
        'menzis-footer-info-links',
      ),
      false,
    );
  });
});

describe('assertPresentationCoverage cookieBannerPlacement=none', () => {
  it('exempts cookie sections from must-appear-on-layout errors', async () => {
    const result = await assertPresentationCoverage({
      detected: {
        sections: [
          {
            folderName: 'section-01',
            cmsName: 'CookieBanner',
            index: 1,
          },
          {
            folderName: 'section-02',
            cmsName: 'Hero',
            index: 2,
          },
        ],
      },
      sectionsDir: '/unused',
      homeRenderings: [{ definitionKey: 'sitecore-hero' }],
      partials: [],
      cookieBannerPlacement: 'none',
      readConversion: async (abs) => {
        if (String(abs).includes('section-01')) {
          return {
            chromeCatalogue: 'other',
            role: 'page',
            components: [
              {
                role: 'section',
                definitionKey: 'sitecore-cookie-consent-banner',
              },
            ],
          };
        }
        return {
          chromeCatalogue: 'other',
          role: 'page',
          components: [{ role: 'section', definitionKey: 'sitecore-hero' }],
        };
      },
      readSectionInfo: async (abs) => {
        if (String(abs).includes('section-01')) {
          return { cmsName: 'CookieBanner', type: 'cookie-banner' };
        }
        return { cmsName: 'Hero' };
      },
    });
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(result.errors.length, 0);
  });

  it('still requires cookie on layout when place', async () => {
    const result = await assertPresentationCoverage({
      detected: {
        sections: [
          {
            folderName: 'section-01',
            cmsName: 'CookieBanner',
            index: 1,
          },
        ],
      },
      sectionsDir: '/unused',
      homeRenderings: [],
      partials: [],
      cookieBannerPlacement: 'place',
      readConversion: async () => ({
        chromeCatalogue: 'other',
        role: 'page',
        components: [
          {
            role: 'section',
            definitionKey: 'sitecore-cookie-consent-banner',
          },
        ],
      }),
      readSectionInfo: async () => ({
        cmsName: 'CookieBanner',
        type: 'cookie-banner',
      }),
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => /sitecore-cookie-consent-banner/.test(e)),
      result.errors.join('\n'),
    );
  });
});
