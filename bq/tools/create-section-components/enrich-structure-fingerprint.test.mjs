import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeEnrichStructureFingerprint,
  enrichStructureFingerprintsMatch,
  inferEnrichPageRole,
  isStickyTopChrome,
  layoutRolesCompatible,
  normalizeConsentModalPatternFamily,
  collapsePlanChildrenToCanonical,
  compositeChildrenFromEnrichRepeats,
  stackedFooterChildrenFromEnrich,
} from './enrich-structure-fingerprint.mjs';

describe('isStickyTopChrome', () => {
  it('returns false for measured bottom pin even with stickyTopPx', () => {
    assert.equal(
      isStickyTopChrome({
        scrollBehavior: {
          desktop: {
            cssPosition: 'fixed',
            sticky: true,
            pinnedEdge: 'bottom',
            stickyTopPx: 596,
          },
        },
      }),
      false,
    );
  });

  it('returns true for top-pinned sticky chrome', () => {
    assert.equal(
      isStickyTopChrome({
        scrollBehavior: {
          desktop: {
            cssPosition: 'fixed',
            sticky: true,
            pinnedEdge: 'top',
            visibleAtTop: true,
          },
        },
      }),
      true,
    );
  });
});

describe('inferEnrichPageRole position signals', () => {
  it('maps overlay consent to page (cookie partial retired)', () => {
    assert.equal(
      inferEnrichPageRole({
        cmsName: 'OsanoDialog',
        track: 'overlay',
        chromeKind: 'float-overlay',
        isOverlay: true,
        purpose: 'cookie consent CMP',
        reasons: ['CMP/consent evidence'],
        scrollBehavior: {
          desktop: { cssPosition: 'fixed', sticky: true, pinnedEdge: 'top' },
        },
      }),
      'page',
    );
  });

  it('maps stacked-footer pattern to partial-footer', () => {
    assert.equal(
      inferEnrichPageRole({
        cmsName: 'SiteChromeBottom',
        layout: { pattern: 'stacked-footer' },
        purpose: 'signposts and legal',
      }),
      'partial-footer',
    );
  });

  it('maps stacked-footer-with-* pattern to partial-footer', () => {
    assert.equal(
      inferEnrichPageRole({
        cmsName: 'FooterSignpostAndNavigation',
        layout: { pattern: 'stacked-footer-with-signposts-and-columns' },
        purpose: 'signposts and legal',
      }),
      'partial-footer',
    );
  });

  it('keeps mid-page Footer-named CTA as page', () => {
    assert.equal(
      inferEnrichPageRole({
        cmsName: 'Footer',
        index: 7,
        layout: { pattern: 'title-description-cta' },
        purpose: 'title description cta',
        track: 'content',
      }),
      'page',
    );
  });

  it('maps track:header stack to partial-header', () => {
    assert.equal(
      inferEnrichPageRole({
        cmsName: 'BandA',
        index: 2,
        track: 'header',
        chromeKind: 'header-stack',
        isOverlay: false,
        purpose: 'top utility strip',
        scrollBehavior: {
          desktop: {
            cssPosition: 'fixed',
            sticky: true,
            pinnedEdge: 'top',
            stickyTopPx: 0,
            visibleAtTop: true,
          },
        },
      }),
      'partial-header',
    );
  });

  it('keeps float overlay consent as page not header (cookie partial retired)', () => {
    assert.equal(
      inferEnrichPageRole({
        cmsName: 'ConsentUi',
        index: 1,
        track: 'overlay',
        chromeKind: 'float-overlay',
        isOverlay: true,
        purpose: 'cookie consent dialog',
        reasons: ['CMP/consent evidence'],
        scrollBehavior: {
          desktop: {
            cssPosition: 'fixed',
            sticky: true,
            pinnedEdge: 'bottom',
          },
        },
      }),
      'page',
    );
  });

  it('maps sticky early nav band to partial-header', () => {
    assert.equal(
      inferEnrichPageRole({
        cmsName: 'PrimaryChrome',
        index: 2,
        track: 'content',
        purpose: 'site navigation links',
        scrollBehavior: {
          desktop: {
            cssPosition: 'sticky',
            sticky: true,
            pinnedEdge: 'top',
            visibleAtTop: true,
          },
        },
      }),
      'partial-header',
    );
  });
});

describe('enrich-structure-fingerprint', () => {
  const stacked = {
    cmsName: 'FooterNavigationAndSignposts',
    purpose: 'signposts, navigation columns, social, legal',
    layout: { pattern: 'stacked-footer', structureNotes: 'bands' },
    outputs: { desktop: { path: 'sections/section-13/section-13-desktop.png' } },
    repeats: [
      { name: 'SignpostLinks', count: 4 },
      { name: 'NavigationGroups', count: 5 },
      { name: 'SocialLinks', count: 6 },
      { name: 'LegalLinks', count: 5 },
    ],
  };

  const ctaFooter = {
    cmsName: 'Footer',
    purpose: 'title description cta',
    layout: { pattern: 'title-description-cta' },
    outputs: { desktop: { path: 'sections/section-07/section-07-desktop.png' } },
    repeats: [],
  };

  it('computes stable fingerprints for stacked footer', () => {
    const a = computeEnrichStructureFingerprint(stacked);
    const b = computeEnrichStructureFingerprint(stacked);
    assert.equal(a.fingerprint, b.fingerprint);
    assert.equal(a.payload.layoutPattern, 'stacked-footer');
    assert.equal(a.payload.pageRole, 'partial-footer');
    // Partial-footer fingerprints use role names only (no counts) and drop shell CTAs
    assert.ok(a.payload.repeatRoles.includes('NavigationGroups'));
    assert.ok(!a.payload.repeatRoles.some((r) => /PrimaryActions/i.test(r)));
  });

  it('refuses skip when registry fingerprint missing', () => {
    const r = enrichStructureFingerprintsMatch(stacked, null);
    assert.equal(r.match, false);
    assert.match(r.reason, /no registry enrich fingerprint/);
  });

  it('matches when stored fingerprint equals live', () => {
    const live = computeEnrichStructureFingerprint(stacked);
    const r = enrichStructureFingerprintsMatch(stacked, {
      enrichStructureFingerprint: live.fingerprint,
      enrichStructurePayload: live.payload,
    });
    assert.equal(r.match, true);
  });

  it('mismatches stacked vs CTA footer payloads', () => {
    const stored = computeEnrichStructureFingerprint(ctaFooter);
    const r = enrichStructureFingerprintsMatch(stacked, {
      enrichStructureFingerprint: stored.fingerprint,
      enrichStructurePayload: stored.payload,
    });
    assert.equal(r.match, false);
  });

  it('layoutRolesCompatible blocks stacked-footer vs other pattern', () => {
    const r = layoutRolesCompatible(stacked, ctaFooter);
    assert.equal(r.ok, false);
  });

  it('layoutRolesCompatible blocks mega-menu header vs mid-page nav grid', () => {
    const r = layoutRolesCompatible(
      {
        layout: { pattern: 'responsive-header-with-mega-menu' },
        purpose: 'site header',
      },
      {
        layout: { pattern: 'navigation-grid-plus-split-content-plus-usp-grid' },
        purpose: 'product cards values',
      },
    );
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /layout\.pattern mismatch/);
  });

  it('layoutRolesCompatible allows partial-header vs page when patterns match', () => {
    const r = layoutRolesCompatible(
      {
        layout: { pattern: 'responsive-header-with-mega-menu' },
        pageWiring: { role: 'partial-header' },
      },
      {
        layoutPattern: 'responsive-header',
        pageRole: 'page',
        repeatRoles: [],
      },
    );
    // stems: responsive-header-with-mega-menu → responsive-header after -with- strip
    assert.equal(r.ok, true, r.reason);
  });

  it('matches stacked-footer vs stacked-footer-with-* when band roles align', () => {
    const home = {
      layout: { pattern: 'stacked-footer' },
      purpose: 'signposts navigation social legal',
      repeats: [
        { name: 'Signposts', count: 4 },
        { name: 'NavigationGroups', count: 5 },
        { name: 'SocialLinks', count: 6 },
        { name: 'PrimaryActions', count: 2 },
        { name: 'LegalLinks', count: 4 },
      ],
    };
    const platform = {
      layout: { pattern: 'stacked-footer-with-signposts-and-columns' },
      purpose: 'signposts navigation social legal',
      repeats: [
        { name: 'Signposts', count: 4 },
        { name: 'NavigationGroups', count: 5 },
        { name: 'SocialLinks', count: 6 },
        { name: 'LegalLinks', count: 4 },
      ],
    };
    const stored = computeEnrichStructureFingerprint(home);
    const r = enrichStructureFingerprintsMatch(platform, {
      enrichStructureFingerprint: stored.fingerprint,
      enrichStructurePayload: stored.payload,
    });
    assert.equal(r.match, true, r.reason);
    assert.equal(
      layoutRolesCompatible(home, platform).ok,
      true,
    );
  });

  it('stackedFooterChildrenFromEnrich maps all repeat roles', () => {
    const kids = stackedFooterChildrenFromEnrich(stacked);
    const names = kids.map((k) => k.componentName).sort();
    assert.deepEqual(names, [
      'FooterBrandingSocial',
      'FooterLegal',
      'FooterNavigationGroup',
      'FooterSignpost',
    ]);
  });

  it('compositeChildrenFromEnrichRepeats is the generic entry and attaches placeholders', () => {
    const kids = compositeChildrenFromEnrichRepeats(stacked);
    assert.equal(kids.length, 4);
    const signpost = kids.find((k) => k.componentName === 'FooterSignpost');
    assert.equal(signpost?.placeholder, 'footer-signpost');
    const nav = kids.find((k) => k.componentName === 'FooterNavigationGroup');
    assert.equal(nav?.placeholder, 'footer-navigation-group');
  });

  it('collapsePlanChildrenToCanonical merges SignpostLink into FooterSignpost', () => {
    const out = collapsePlanChildrenToCanonical([
      { componentName: 'SitecoreFooterSignpostLink', repeatHint: 4 },
      { componentName: 'FooterSignpost', repeatHint: 3 },
      { componentName: 'FooterNavigationGroup', repeatHint: 5 },
    ]);
    assert.equal(out.length, 2);
    const signpost = out.find((c) => /Signpost/i.test(c.componentName));
    assert.ok(signpost);
    assert.equal(signpost.componentName, 'FooterSignpost');
    assert.equal(signpost.repeatHint, 4);
    assert.ok(!out.some((c) => /SignpostLink/i.test(c.componentName)));
  });
});

describe('responsive-header enrich composite', () => {
  it('does not force HeaderNavigation when repeats are empty (AI decides)', () => {
    const kids = compositeChildrenFromEnrichRepeats({
      layout: { pattern: 'responsive-header-with-mega-menu' },
      chromeKind: 'header-stack',
      track: 'header',
      purpose: 'product navigation mega-menu',
      repeats: [],
    });
    assert.equal(kids.length, 0);
  });

  it('does not force HeaderNavigation via enrich roles (AI decides)', () => {
    const kids = compositeChildrenFromEnrichRepeats({
      layout: { pattern: 'responsive-header-with-mega-menu' },
      chromeKind: 'header-stack',
      track: 'header',
      purpose: 'product navigation mega-menu',
      repeats: [
        {
          name: 'audienceLinks',
          itemName: 'audienceLink',
          count: 3,
        },
      ],
    });
    assert.equal(kids.length, 0);
  });

  it('partial-header pattern synonyms are layout-compatible', () => {
    const a = {
      layoutPattern: 'brand-row',
      pageRole: 'partial-header',
      repeatRoles: [],
      motionKind: 'none',
      inventoryRepeatMax: 0,
      screenshotIdentity: '',
    };
    const b = {
      layoutPattern: 'horizontal-brand-navigation',
      pageRole: 'partial-header',
      repeatRoles: [],
      motionKind: 'none',
      inventoryRepeatMax: 0,
      screenshotIdentity: '',
    };
    assert.equal(layoutRolesCompatible(a, b).ok, true);
  });

  it('does not merge header with mid-page nav grid', () => {
    const a = {
      layoutPattern: 'responsive-header',
      pageRole: 'partial-header',
      repeatRoles: [],
      motionKind: 'none',
      inventoryRepeatMax: 0,
      screenshotIdentity: '',
    };
    const b = {
      layoutPattern: 'navigation-grid-plus-split-content-plus-usp-grid',
      pageRole: 'page',
      repeatRoles: ['navigationCards:8'],
      motionKind: 'none',
      inventoryRepeatMax: 8,
      screenshotIdentity: '',
    };
    assert.equal(layoutRolesCompatible(a, b).ok, false);
  });

  it('treats modal-overlay and modal-dialog as the same consent-modal family', () => {
    assert.equal(
      normalizeConsentModalPatternFamily('modal-overlay'),
      'consent-modal',
    );
    assert.equal(
      normalizeConsentModalPatternFamily('modal-dialog'),
      'consent-modal',
    );
    const r = layoutRolesCompatible(
      {
        layoutPattern: 'modal-overlay',
        pageRole: 'page',
        repeatRoles: [],
        motionKind: 'none',
        inventoryRepeatMax: 0,
        screenshotIdentity: '',
      },
      {
        layoutPattern: 'modal-dialog',
        pageRole: 'page',
        repeatRoles: [],
        motionKind: 'none',
        inventoryRepeatMax: 0,
        screenshotIdentity: '',
      },
    );
    assert.equal(r.ok, true, r.reason);
  });
});

