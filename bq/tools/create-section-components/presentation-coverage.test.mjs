/**
 * Presentation coverage + detected-order helpers.
 * Run: node --test tools/create-section-components/presentation-coverage.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertHomeConversionLogsComplete,
  assertNonemptyWiredChildren,
  assertPeerCardinality,
  assertPresentationCoverage,
  buildDetectedDefinitionKeyOrder,
  collectPresentationDatasourceMismatches,
  expectedEnrichChildCount,
  isBodyMarketingBandBlob,
  isBodyMarketingDefinitionKey,
  parentDefinitionKeyFromConversion,
  parseContentItemNamesFromDefinitionText,
  sortHomeRenderingsByDetectedOrder,
  throwIfCoverageFailed,
  warnPresentationDatasourceContentMismatches,
} from './presentation-coverage.mjs';
import { inferEnrichPageRole } from './enrich-structure-fingerprint.mjs';

describe('isBodyMarketingDefinitionKey', () => {
  it('treats heroes / media / callouts as body bands', () => {
    assert.equal(isBodyMarketingDefinitionKey('sitecore-platform-hero'), true);
    assert.equal(isBodyMarketingDefinitionKey('sitecore-technology-hero'), true);
    assert.equal(isBodyMarketingDefinitionKey('sitecore-video-feature'), true);
    assert.equal(isBodyMarketingDefinitionKey('sitecore-case-study-carousel'), true);
    assert.equal(isBodyMarketingDefinitionKey('sitecore-demo-callout'), true);
  });

  it('does not treat nav / footer chrome as body marketing', () => {
    assert.equal(isBodyMarketingDefinitionKey('sitecore-main-navigation'), false);
    assert.equal(isBodyMarketingDefinitionKey('sitecore-global-footer'), false);
    assert.equal(isBodyMarketingDefinitionKey('sitecore-privacy-consent-panel'), false);
  });
});

describe('isBodyMarketingBandBlob', () => {
  it('detects hero language', () => {
    assert.equal(isBodyMarketingBandBlob('aiassisted hero banner technology'), true);
  });
});

describe('inferEnrichPageRole body guard', () => {
  it('does not promote sticky early hero to partial-header', () => {
    const role = inferEnrichPageRole({
      index: 4,
      cmsName: 'AIAssistedHeroBanner',
      purpose: 'Centered platform hero with CTAs',
      scrollBehavior: {
        desktop: {
          sticky: true,
          cssPosition: 'sticky',
          pinnedEdge: 'top',
          visibleAtTop: true,
        },
      },
    });
    assert.equal(role, 'page');
  });

  it('still maps sticky nav to partial-header', () => {
    const role = inferEnrichPageRole({
      index: 3,
      cmsName: 'MainNav',
      purpose: 'Main site header navigation',
      scrollBehavior: {
        desktop: {
          sticky: true,
          cssPosition: 'fixed',
          pinnedEdge: 'top',
          visibleAtTop: true,
        },
      },
    });
    assert.equal(role, 'partial-header');
  });

  it('maps capture track:header to partial-header', () => {
    const role = inferEnrichPageRole({
      index: 2,
      cmsName: 'TopStrip',
      track: 'header',
      chromeKind: 'header-stack',
      isOverlay: false,
      purpose: 'collapsible top strip',
      scrollBehavior: {
        desktop: {
          sticky: true,
          cssPosition: 'fixed',
          pinnedEdge: 'top',
          stickyTopPx: 0,
        },
      },
    });
    assert.equal(role, 'partial-header');
  });
});

describe('sortHomeRenderingsByDetectedOrder', () => {
  it('orders by detected definitionKey list', () => {
    const renderings = [
      { definitionKey: 'sitecore-event-carousel' },
      { definitionKey: 'sitecore-platform-hero' },
      { definitionKey: 'sitecore-video-feature' },
    ];
    sortHomeRenderingsByDetectedOrder(renderings, [
      'sitecore-platform-hero',
      'sitecore-video-feature',
      'sitecore-event-carousel',
    ]);
    assert.deepEqual(
      renderings.map((r) => r.definitionKey),
      [
        'sitecore-platform-hero',
        'sitecore-video-feature',
        'sitecore-event-carousel',
      ],
    );
  });
});

describe('assertPeerCardinality', () => {
  it('fails when wired/seeds under-count layoutSketch peers', () => {
    const errors = assertPeerCardinality({
      folderName: 'section-04',
      layoutSketch: {
        placeholders: {
          main: [
            { componentName: 'SplitBand', datasourceName: 'A' },
            { componentName: 'SplitBand', datasourceName: 'B' },
            { componentName: 'SplitBand', datasourceName: 'C' },
          ],
        },
      },
      componentResults: [
        { componentName: 'SplitBand', definitionKey: 'split-band' },
      ],
      wiredChildren: [
        { definitionKey: 'split-band', datasourceItem: 'A' },
      ],
      contentItemNamesByKey: new Map([['split-band', ['A']]]),
    });
    assert.ok(errors.some((e) => /presentation children=1.*peers=3/.test(e)));
    assert.ok(errors.some((e) => /content\.items=1.*peers=3/.test(e)));
  });

  it('passes when peers match', () => {
    const errors = assertPeerCardinality({
      folderName: 'section-04',
      layoutSketch: {
        placeholders: {
          main: [
            { componentName: 'SplitBand', datasourceName: 'A' },
            { componentName: 'SplitBand', datasourceName: 'B' },
          ],
        },
      },
      componentResults: [
        { componentName: 'SplitBand', definitionKey: 'split-band' },
      ],
      wiredChildren: [
        { definitionKey: 'split-band', datasourceItem: 'A' },
        { definitionKey: 'split-band', datasourceItem: 'B' },
      ],
      contentItemNamesByKey: new Map([['split-band', ['A', 'B']]]),
    });
    assert.deepEqual(errors, []);
  });
});

describe('assertNonemptyWiredChildren', () => {
  it('fails when conversion lists distinct PH child packages but wired has none', () => {
    const errors = assertNonemptyWiredChildren({
      folderName: 'section-05',
      cmsName: 'Capability',
      definitionKey: 'sitecore-capability-card-carousel',
      conversion: {
        components: [
          {
            role: 'section',
            definitionKey: 'sitecore-capability-card-carousel',
          },
          { role: 'child', definitionKey: 'sitecore-capability-card' },
          { role: 'child', definitionKey: 'sitecore-capability-card' },
        ],
      },
      info: null,
      wired: {
        definitionKey: 'sitecore-capability-card-carousel',
        children: [],
      },
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /0 presentation children/);
  });

  it('does not fail for childItemTemplate same-key repeats', () => {
    const errors = assertNonemptyWiredChildren({
      folderName: 'section-08',
      cmsName: 'Tiles',
      definitionKey: 'sitecore-feature-tile-grid',
      conversion: {
        components: [
          { role: 'section', definitionKey: 'sitecore-feature-tile-grid' },
        ],
      },
      info: { repeats: [{ count: 3 }] },
      wired: { definitionKey: 'sitecore-feature-tile-grid', children: [] },
    });
    assert.equal(errors.length, 0);
  });

  it('expectedEnrichChildCount ignores enrich repeats without PH children', () => {
    assert.equal(
      expectedEnrichChildCount(
        { repeats: [{ clonesAreNotContent: true }, { count: 3 }] },
        null,
      ),
      0,
    );
  });
});

describe('assertPresentationCoverage', () => {
  it('fails when a page band is missing from homeRenderings', async () => {
    const conversions = {
      'section-04': {
        role: 'page',
        components: [
          { role: 'section', definitionKey: 'sitecore-platform-hero' },
        ],
      },
      'section-05': {
        role: 'page',
        components: [
          { role: 'section', definitionKey: 'sitecore-feature-card-carousel' },
        ],
      },
    };
    const result = await assertPresentationCoverage({
      detected: {
        sections: [
          { folderName: 'section-04', cmsName: 'AIAssistedHeroBanner' },
          { folderName: 'section-05', cmsName: 'CapabilityCardGrid' },
        ],
      },
      sectionsDir: '/virtual',
      homeRenderings: [{ definitionKey: 'sitecore-feature-card-carousel' }],
      partials: [],
      readConversion: async (abs) => {
        const folder = abs.replace(/\\/g, '/').split('/').pop();
        return conversions[folder] || null;
      },
      readSectionInfo: async () => null,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('sitecore-platform-hero')));
  });

  it('passes when pre-header other (cookie) lands on header partial via band cut', async () => {
    const conversions = {
      'section-01': {
        role: 'page',
        chromeCatalogue: 'other',
        components: [
          { role: 'section', definitionKey: 'sitecore-privacy-consent-panel' },
        ],
      },
      'section-02': {
        role: 'partial-header',
        chromeCatalogue: 'header',
        components: [
          { role: 'section', definitionKey: 'sitecore-main-nav' },
        ],
      },
      'section-04': {
        role: 'page',
        chromeCatalogue: 'other',
        components: [
          { role: 'section', definitionKey: 'sitecore-platform-hero' },
        ],
      },
    };
    const result = await assertPresentationCoverage({
      detected: {
        sections: [
          { folderName: 'section-01', cmsName: 'ConsentBanner', index: 1 },
          { folderName: 'section-02', cmsName: 'MainNav', index: 2 },
          { folderName: 'section-04', cmsName: 'AIAssistedHeroBanner', index: 4 },
        ],
      },
      sectionsDir: '/virtual',
      homeRenderings: [{ definitionKey: 'sitecore-platform-hero' }],
      partials: [
        {
          signature: 'header',
          definitionKey: 'sitecore-main-nav',
          siblingsBefore: [
            { definitionKey: 'sitecore-privacy-consent-panel' },
          ],
        },
      ],
      cookieBannerPlacement: 'place',
      readConversion: async (abs) => {
        const folder = abs.replace(/\\/g, '/').split('/').pop();
        return conversions[folder] || null;
      },
      readSectionInfo: async () => null,
    });
    assert.equal(result.ok, true, result.errors?.join('\n'));
  });

  it('fails when pre-header cookie stays on home instead of header partial', async () => {
    const conversions = {
      'section-01': {
        role: 'page',
        chromeCatalogue: 'other',
        components: [
          { role: 'section', definitionKey: 'sitecore-cookie-consent-banner' },
        ],
      },
      'section-02': {
        role: 'partial-header',
        chromeCatalogue: 'header',
        components: [
          { role: 'section', definitionKey: 'sitecore-main-nav' },
        ],
      },
    };
    const result = await assertPresentationCoverage({
      detected: {
        sections: [
          { folderName: 'section-01', cmsName: 'ConsentBanner', index: 1 },
          { folderName: 'section-02', cmsName: 'MainNav', index: 2 },
        ],
      },
      sectionsDir: '/virtual',
      homeRenderings: [{ definitionKey: 'sitecore-cookie-consent-banner' }],
      partials: [
        {
          signature: 'header',
          definitionKey: 'sitecore-main-nav',
        },
      ],
      cookieBannerPlacement: 'place',
      readConversion: async (abs) => {
        const folder = abs.replace(/\\/g, '/').split('/').pop();
        return conversions[folder] || null;
      },
      readSectionInfo: async () => null,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) =>
        e.includes('sitecore-cookie-consent-banner') &&
        e.includes('partial-header'),
      ),
      result.errors?.join('\n'),
    );
  });
});

describe('assertHomeConversionLogsComplete', () => {
  it('fails when a sibling lacks conversion log', async () => {
    const result = await assertHomeConversionLogsComplete({
      allFolders: ['section-04', 'section-05'],
      sectionsDir: '/virtual',
      onlyFolders: ['section-05'],
      readConversion: async (abs) => {
        if (String(abs).includes('section-04')) return null;
        return {
          components: [{ role: 'section', definitionKey: 'x' }],
        };
      },
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.missingFolders, ['section-04']);
  });

  it('skips folders already in onlyFolders', async () => {
    const result = await assertHomeConversionLogsComplete({
      allFolders: ['section-04', 'section-05'],
      sectionsDir: '/virtual',
      onlyFolders: ['section-04', 'section-05'],
      readConversion: async () => null,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.missingFolders, []);
  });
});

describe('buildDetectedDefinitionKeyOrder', () => {
  it('maps folders to parent definitionKeys in capture order', async () => {
    const order = await buildDetectedDefinitionKeyOrder(
      { sectionsDir: '/virtual' },
      {
        sections: [
          { folderName: 'section-04' },
          { folderName: 'section-07' },
        ],
      },
      async (abs) => {
        if (String(abs).includes('section-04')) {
          return {
            components: [
              { role: 'section', definitionKey: 'sitecore-platform-hero' },
            ],
          };
        }
        return {
          components: [
            { role: 'section', definitionKey: 'sitecore-video-feature' },
          ],
        };
      },
    );
    assert.deepEqual(order, [
      'sitecore-platform-hero',
      'sitecore-video-feature',
    ]);
  });
});

describe('throwIfCoverageFailed', () => {
  it('throws with bullet list', () => {
    assert.throws(
      () => throwIfCoverageFailed({ ok: false, errors: ['a', 'b'] }),
      /Presentation coverage failed/,
    );
  });
});

describe('parentDefinitionKeyFromConversion', () => {
  it('prefers role=section', () => {
    assert.equal(
      parentDefinitionKeyFromConversion({
        components: [
          { role: 'child', definitionKey: 'child-key' },
          { role: 'section', definitionKey: 'parent-key' },
        ],
      }),
      'parent-key',
    );
  });
});

describe('presentation datasource ↔ content.items', () => {
  it('parseContentItemNamesFromDefinitionText reads item names', () => {
    const names = parseContentItemNamesFromDefinitionText(`
      content: {
        items: [
          { name: "Enmax", fields: {} },
          { name: "Shriners Children", fields: {} },
        ],
      },
    `);
    assert.deepEqual(names, ['Enmax', 'Shriners Children']);
  });

  it('collectPresentationDatasourceMismatches finds missing seeds', () => {
    const map = new Map([
      [
        'sitecore-customer-story',
        new Set(['Gartner Content Marketing Leader', 'Forrester Digital Experience Platforms']),
      ],
    ]);
    const mismatches = collectPresentationDatasourceMismatches(
      [
        {
          definitionKey: 'sitecore-customer-story-slider',
          children: [
            {
              definitionKey: 'sitecore-customer-story',
              datasourceItem: 'Enmax',
            },
            {
              definitionKey: 'sitecore-customer-story',
              datasourceItem: 'Gartner Content Marketing Leader',
            },
          ],
        },
      ],
      map,
    );
    assert.equal(mismatches.length, 1);
    assert.equal(mismatches[0].datasourceItem, 'Enmax');
  });

  it('warnPresentationDatasourceContentMismatches uses contentItemNames', () => {
    const mismatches = warnPresentationDatasourceContentMismatches(
      [
        {
          definitionKey: 'sitecore-capability-tiles',
          children: [
            {
              definitionKey: 'sitecore-capability-tile',
              datasourceItem: 'Be Unmistakable',
            },
          ],
        },
      ],
      [
        {
          definitionKey: 'sitecore-capability-tile',
          contentItemNames: ['Agentic Studio', 'App Studio'],
        },
      ],
    );
    assert.equal(mismatches.length, 1);
    assert.equal(mismatches[0].datasourceItem, 'Be Unmistakable');
  });
});
