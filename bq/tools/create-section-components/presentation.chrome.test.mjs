/**
 * Chrome / page-rendering filter + footer placeholder helpers.
 * Run: node --test tools/create-section-components/presentation.chrome.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  alignChildPlaceholderToParent,
  alignFooterChildPlaceholder,
  ensureCompositePresentationChildren,
  extractPlaceholderKeysFromDefinition,
  filterPageRenderings,
  inferFooterChildPlaceholder,
  cookieChromeScore,
  headerSiblingRef,
  isHeaderSiblingChromeKey,
  isPartialChromeRole,
  isSiteChromeDefinitionKey,
  mergeFooterPartialEntries,
  mergeHeaderPartialEntries,
  mergeSiblingsBeforeList,
  isPrimaryHeaderNavChromeKey,
  resolveChromePartialRootFromSketch,
  entryCanHostChildren,
  ensureHostPartialChildrenFromCandidates,
  sanitizeNestedPrimaryHeaderChrome,
  collectPartialDesignDefinitionKeys,
  pruneAvailableRenderingsMissingDefinitions,
  restampPartialHostFlags,
  sanitizePartialNesting,
  pageRenderingFingerprint,
  parseSectionIndex,
  preferSingleChildFamily,
  preferSingleFooterColumnFamily,
} from './presentation.mjs';
import {
  ensureDarkSurfaceIconContrast,
  normalizeCaptureGroupHeading,
  rewriteLiteralTitleSeedsFromItemName,
  rewriteSeedTitlesMatchingParentHeading,
} from './ai-source-fixup.mjs';

/** Mirrors src/lib/consent-editing.ts — keep in sync. */
function shouldShowConsentOverlay(page) {
  if (!page?.mode?.isEditing) return true;
  return page.layout?.sitecore?.route?.templateName === 'Partial Design';
}

describe('isSiteChromeDefinitionKey', () => {
  it('detects header/footer chrome parents (cookie/CMP is page, not chrome)', () => {
    assert.equal(isSiteChromeDefinitionKey('sitecore-site-header'), true);
    assert.equal(isSiteChromeDefinitionKey('sitecore-site-navigation'), true);
    assert.equal(isSiteChromeDefinitionKey('sitecore-main-navigation'), true);
    assert.equal(isSiteChromeDefinitionKey('sitecore-footer'), true);
    assert.equal(isSiteChromeDefinitionKey('sitecore-global-footer'), true);
    assert.equal(
      isSiteChromeDefinitionKey('sitecore-footer-navigation-and-signposts'),
      true,
    );
    assert.equal(isSiteChromeDefinitionKey('sitecore-consent-banner'), false);
    assert.equal(isSiteChromeDefinitionKey('sitecore-privacy-consent-panel'), false);
    assert.equal(isSiteChromeDefinitionKey('sitecore-cookie-consent'), false);
    assert.equal(isSiteChromeDefinitionKey('sitecore-notification-bar'), true);
    assert.equal(
      isSiteChromeDefinitionKey('sitecore-announcement-marquee-track'),
      true,
    );
  });

  it('does not treat body or footer children as chrome parents', () => {
    assert.equal(isSiteChromeDefinitionKey('sitecore-technology-hero'), false);
    assert.equal(
      isSiteChromeDefinitionKey('sitecore-footer-navigation-group'),
      false,
    );
    assert.equal(isSiteChromeDefinitionKey('sitecore-global-footer-legal'), false);
    assert.equal(isSiteChromeDefinitionKey('sitecore-navigation-item'), false);
  });
});

describe('cookieChromeScore', () => {
  it('prefers privacy-consent-panel over cookie-consent', () => {
    assert.ok(
      cookieChromeScore('sitecore-privacy-consent-panel') >
        cookieChromeScore('sitecore-cookie-consent'),
    );
    assert.ok(
      cookieChromeScore('sitecore-consent-panel') >
        cookieChromeScore('sitecore-cookie-consent'),
    );
  });
});

describe('isHeaderSiblingChromeKey', () => {
  it('detects notification / announcement bars (score hint only)', () => {
    assert.equal(isHeaderSiblingChromeKey('sitecore-notification-bar'), true);
    assert.equal(
      isHeaderSiblingChromeKey('sitecore-announcement-marquee-track'),
      true,
    );
    assert.equal(isHeaderSiblingChromeKey('sitecore-main-navigation'), false);
    // Bare announcement stays sibling chrome so merge keeps it above primary nav.
    assert.equal(isHeaderSiblingChromeKey('sitecore-announcement'), true);
  });
});

describe('isPrimaryHeaderNavChromeKey link-list exclusion', () => {
  it('does not treat context-link-list as primary chrome', () => {
    assert.equal(
      isPrimaryHeaderNavChromeKey('menzis-global-navigation-context-link-list'),
      false,
    );
    assert.equal(isPrimaryHeaderNavChromeKey('menzis-footer-help-link-list'), false);
  });

  it('still treats real header shells as primary', () => {
    assert.equal(isPrimaryHeaderNavChromeKey('menzis-global-header'), true);
    assert.equal(isPrimaryHeaderNavChromeKey('menzis-header-navigation'), true);
  });
});

describe('resolveChromePartialRootFromSketch', () => {
  it('maps sketch root onto section package definitionKey', () => {
    const root = resolveChromePartialRootFromSketch({
      layoutSketch: {
        target: 'partial-header',
        renderings: [
          {
            componentName: 'MenzisGlobalHeaderNavigation',
            datasourceName: 'Global Header Navigation',
            placeholders: {},
          },
        ],
      },
      componentResults: [
        {
          role: 'section',
          componentName: 'MenzisGlobalHeader',
          definitionKey: 'menzis-global-header',
        },
      ],
    });
    assert.equal(root?.definitionKey, 'menzis-global-header');
    assert.equal(root?.datasourceItem, 'Global Header Navigation');
    assert.equal(root?.fromSketch, true);
  });

  it('falls back to section definitionKey when sketch is missing', () => {
    const root = resolveChromePartialRootFromSketch({
      layoutSketch: null,
      componentResults: [
        {
          role: 'section',
          componentName: 'MenzisGlobalHeader',
          definitionKey: 'menzis-global-header',
        },
      ],
    });
    assert.equal(root?.definitionKey, 'menzis-global-header');
    assert.equal(root?.fromSketch, false);
  });
});

describe('parseSectionIndex / headerSiblingRef', () => {
  it('parses positive finite indexes only', () => {
    assert.equal(parseSectionIndex(2), 2);
    assert.equal(parseSectionIndex('3'), 3);
    assert.equal(parseSectionIndex(0), undefined);
    assert.equal(parseSectionIndex(undefined), undefined);
  });

  it('preserves sectionIndex on sibling refs', () => {
    assert.deepEqual(
      headerSiblingRef({
        definitionKey: 'sitecore-announcement',
        sectionIndex: 2,
        renderingIdentifier: 'ann-1',
      }),
      {
        definitionKey: 'sitecore-announcement',
        renderingIdentifier: 'ann-1',
        sectionIndex: 2,
      },
    );
  });

  it('omits empty children on sibling refs', () => {
    const ref = headerSiblingRef({
      definitionKey: 'menzis-footer-support-navigation',
      sectionIndex: 5,
      children: [],
    });
    assert.equal(ref.children, undefined);
    assert.ok(!('children' in ref));
  });
});

describe('mergeSiblingsBeforeList', () => {
  it('upgrades empty sibling to non-empty on duplicate definitionKey', () => {
    const merged = mergeSiblingsBeforeList(
      [
        {
          definitionKey: 'menzis-footer-support-navigation',
          sectionIndex: 5,
          children: [],
        },
      ],
      [
        {
          definitionKey: 'menzis-footer-support-navigation',
          datasourceItem: 'Footer Help And Links',
          children: [
            {
              definitionKey: 'menzis-footer-help-band',
              datasourceItem: 'Help Band',
              placeholder: 'footer-help-and-links-content',
            },
          ],
        },
      ],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].datasourceItem, 'Footer Help And Links');
    assert.equal(merged[0].children?.length, 1);
    assert.equal(merged[0].children[0].definitionKey, 'menzis-footer-help-band');
  });

  it('unions children when both sides are non-empty', () => {
    const merged = mergeSiblingsBeforeList(
      [
        {
          definitionKey: 'menzis-footer-support-navigation',
          children: [
            {
              definitionKey: 'menzis-footer-help-band',
              datasourceItem: 'Help Band',
              placeholder: 'footer-help-and-links-content',
            },
          ],
        },
      ],
      [
        {
          definitionKey: 'menzis-footer-support-navigation',
          children: [
            {
              definitionKey: 'menzis-footer-help-link-list',
              datasourceItem: 'Snel naar',
              placeholder: 'footer-help-and-links-content',
            },
            {
              definitionKey: 'menzis-footer-help-link-list',
              datasourceItem: 'Mijn Menzis',
              placeholder: 'footer-help-and-links-content',
            },
          ],
        },
      ],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].children?.length, 3);
    assert.ok(
      merged[0].children.some((c) => c.definitionKey === 'menzis-footer-help-band'),
    );
    assert.ok(
      merged[0].children.some(
        (c) =>
          c.definitionKey === 'menzis-footer-help-link-list' &&
          c.datasourceItem === 'Snel naar',
      ),
    );
    assert.ok(
      merged[0].children.some(
        (c) =>
          c.definitionKey === 'menzis-footer-help-link-list' &&
          c.datasourceItem === 'Mijn Menzis',
      ),
    );
  });

  it('omits children when both sides are empty', () => {
    const merged = mergeSiblingsBeforeList(
      [{ definitionKey: 'menzis-footer-support-navigation', children: [] }],
      [{ definitionKey: 'menzis-footer-support-navigation', children: [] }],
    );
    assert.equal(merged.length, 1);
    assert.ok(!('children' in merged[0]));
  });
});

describe('mergeFooterPartialEntries', () => {
  it('unions children from two site-footer hosts without self-nested siblingsBefore', () => {
    const canHostMap = {
      'host-site-footer': true,
    };
    const pageA = {
      signature: 'footer',
      placeholder: 'headless-footer',
      definitionKey: 'host-site-footer',
      canHostChildren: true,
      children: [
        {
          definitionKey: 'host-footer-signpost',
          datasourceItem: 'Explore',
          placeholder: 'footer-signposts',
        },
        {
          definitionKey: 'host-footer-legal',
          datasourceItem: 'Legal',
          placeholder: 'footer-legal',
        },
      ],
    };
    const pageB = {
      signature: 'footer',
      placeholder: 'headless-footer',
      definitionKey: 'host-site-footer',
      canHostChildren: true,
      children: [
        {
          definitionKey: 'host-footer-signpost',
          datasourceItem: 'Learn',
          placeholder: 'footer-signposts',
        },
        {
          definitionKey: 'host-footer-social',
          datasourceItem: 'Social',
          placeholder: 'footer-social',
        },
      ],
    };
    const merged = mergeFooterPartialEntries(pageA, pageB, { canHostMap });
    assert.equal(merged.definitionKey, 'host-site-footer');
    assert.equal(merged.children?.length, 4);
    assert.ok(
      !(merged.siblingsBefore || []).some(
        (s) => s.definitionKey === 'host-site-footer',
      ),
      'must not put a second site-footer under siblingsBefore',
    );
  });

  it('prefers site-footer host over bare footer and unions children', () => {
    const canHostMap = {
      'host-site-footer': true,
      'host-footer': true,
    };
    const bare = {
      signature: 'footer',
      placeholder: 'headless-footer',
      definitionKey: 'host-footer',
      canHostChildren: true,
      children: [
        {
          definitionKey: 'host-footer-nav',
          datasourceItem: 'Platform',
          placeholder: 'footer-navigation',
        },
      ],
    };
    const preferred = {
      signature: 'footer',
      placeholder: 'headless-footer',
      definitionKey: 'host-site-footer',
      canHostChildren: true,
      children: [
        {
          definitionKey: 'host-footer-legal',
          datasourceItem: 'Legal',
          placeholder: 'footer-legal',
        },
      ],
    };
    const merged = mergeFooterPartialEntries(bare, preferred, { canHostMap });
    assert.equal(merged.definitionKey, 'host-site-footer');
    assert.equal(merged.children?.length, 2);
    assert.ok(
      !(merged.siblingsBefore || []).some((s) =>
        /footer/.test(String(s.definitionKey || '')),
      ),
      'must not keep a second footer shell as sibling',
    );
  });

  it('prefers next host when prev stamp says host but disk map says deleted', () => {
    const canHostMap = {
      'old-footer-navigation': false,
      'new-footer-columns': true,
    };
    const prev = {
      signature: 'footer',
      placeholder: 'headless-footer',
      definitionKey: 'old-footer-navigation',
      canHostChildren: true,
      children: [
        {
          definitionKey: 'old-footer-column',
          datasourceItem: 'Offer',
        },
      ],
    };
    const next = {
      signature: 'footer',
      placeholder: 'headless-footer',
      definitionKey: 'new-footer-columns',
      canHostChildren: true,
      children: [
        {
          definitionKey: 'new-footer-link-column',
          datasourceItem: 'Offer',
          placeholder: 'footer-navigation',
        },
      ],
    };
    const merged = mergeFooterPartialEntries(prev, next, { canHostMap });
    assert.equal(merged.definitionKey, 'new-footer-columns');
    assert.equal(merged.canHostChildren, true);
  });

  it('keeps distinct peer footer hosts as siblingsBefore with own children', () => {
    const canHostMap = {
      'menzis-footer-support-navigation': true,
      'menzis-footer-info-links': true,
    };
    const support = {
      signature: 'footer',
      placeholder: 'headless-footer',
      definitionKey: 'menzis-footer-support-navigation',
      sectionIndex: 5,
      canHostChildren: true,
      children: [
        {
          definitionKey: 'menzis-footer-quick-links',
          datasourceItem: 'Footer Quick Links',
          placeholder: 'footer-support-links',
        },
      ],
    };
    const info = {
      signature: 'footer',
      placeholder: 'headless-footer',
      definitionKey: 'menzis-footer-info-links',
      sectionIndex: 6,
      canHostChildren: true,
      children: [
        {
          definitionKey: 'menzis-footer-legal-link-list',
          datasourceItem: 'Footer Legal Links',
          placeholder: 'footer-legal-links',
        },
      ],
    };
    const merged = mergeFooterPartialEntries(support, info, { canHostMap });
    assert.equal(merged.definitionKey, 'menzis-footer-info-links');
    assert.equal(merged.sectionIndex, 6);
    assert.equal(merged.children?.length, 1);
    assert.equal(merged.children[0].definitionKey, 'menzis-footer-legal-link-list');
    const sib = (merged.siblingsBefore || []).find(
      (s) => s.definitionKey === 'menzis-footer-support-navigation',
    );
    assert.ok(sib, 'earlier support-nav must be siblingsBefore');
    assert.equal(sib.sectionIndex, 5);
    assert.equal(sib.children?.length, 1);
    assert.equal(sib.children[0].definitionKey, 'menzis-footer-quick-links');
  });

  it('upgrades empty demoted support-nav when merged again with children', () => {
    const canHostMap = {
      'menzis-footer-support-navigation': true,
      'menzis-footer-info-links': true,
    };
    const hollow = mergeFooterPartialEntries(
      {
        signature: 'footer',
        placeholder: 'headless-footer',
        definitionKey: 'menzis-footer-support-navigation',
        sectionIndex: 5,
        canHostChildren: true,
        children: [],
      },
      {
        signature: 'footer',
        placeholder: 'headless-footer',
        definitionKey: 'menzis-footer-info-links',
        sectionIndex: 6,
        canHostChildren: true,
        children: [
          {
            definitionKey: 'menzis-footer-legal-link-list',
            datasourceItem: 'Footer Legal Links',
            placeholder: 'footer-legal-links',
          },
        ],
      },
      { canHostMap },
    );
    assert.equal(hollow.definitionKey, 'menzis-footer-info-links');
    const emptySib = (hollow.siblingsBefore || []).find(
      (s) => s.definitionKey === 'menzis-footer-support-navigation',
    );
    assert.ok(emptySib);
    assert.ok(!emptySib.children?.length);

    const refilled = mergeSiblingsBeforeList(hollow.siblingsBefore, [
      {
        definitionKey: 'menzis-footer-support-navigation',
        sectionIndex: 5,
        children: [
          {
            definitionKey: 'menzis-footer-help-band',
            datasourceItem: 'Help Band',
            placeholder: 'footer-help-and-links-content',
          },
        ],
      },
    ]);
    const sib = refilled.find(
      (s) => s.definitionKey === 'menzis-footer-support-navigation',
    );
    assert.equal(sib?.children?.length, 1);
    assert.equal(sib.children[0].definitionKey, 'menzis-footer-help-band');
    // Root kids unchanged by sibling list merge
    assert.equal(hollow.children?.[0]?.definitionKey, 'menzis-footer-legal-link-list');
  });
});

describe('mergeHeaderPartialEntries', () => {
  it('sketchRoot challenger replaces stuck context-link-list at same sectionIndex', () => {
    const stuck = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'menzis-global-navigation-context-link-list',
      sectionIndex: 2,
      canHostChildren: false,
      children: [],
      datasourceItem: 'Global Navigation Context Links',
    };
    const sketchAligned = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'menzis-global-header',
      sectionIndex: 2,
      sketchRoot: true,
      canHostChildren: false,
      children: [],
      datasourceItem: 'Global Header Navigation',
    };
    const merged = mergeHeaderPartialEntries(stuck, sketchAligned);
    assert.equal(merged.definitionKey, 'menzis-global-header');
    assert.equal(merged.datasourceItem, 'Global Header Navigation');
  });

  it('does not promote nested context-link-list leaf over header host', () => {
    const out = sanitizeNestedPrimaryHeaderChrome(
      {
        signature: 'header',
        definitionKey: 'menzis-header-navigation',
        canHostChildren: true,
        placeholderKeys: ['header-navigation'],
        children: [
          {
            definitionKey: 'menzis-global-navigation-context-link-list',
            datasourceItem: 'Global Navigation Context Links',
          },
        ],
      },
      {
        'menzis-header-navigation': true,
        'menzis-global-navigation-context-link-list': false,
      },
    );
    assert.equal(out.definitionKey, 'menzis-header-navigation');
    assert.equal(
      out.children?.[0]?.definitionKey,
      'menzis-global-navigation-context-link-list',
    );
  });

  it('puts earlier bare sitecore-announcement into siblingsBefore of main-header', () => {
    const canHostMap = {
      'sitecore-announcement': false,
      'sitecore-main-header': true,
    };
    const announcement = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'sitecore-announcement',
      sectionIndex: 2,
    };
    const mainHeader = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'sitecore-main-header',
      sectionIndex: 3,
      children: [{ definitionKey: 'sitecore-nav-item' }],
    };

    const announcementFirst = mergeHeaderPartialEntries(announcement, mainHeader, {
      canHostMap,
    });
    assert.equal(announcementFirst.definitionKey, 'sitecore-main-header');
    assert.equal(announcementFirst.sectionIndex, 3);
    assert.ok(
      (announcementFirst.siblingsBefore || []).some(
        (s) => s.definitionKey === 'sitecore-announcement' && s.sectionIndex === 2,
      ),
    );
    assert.equal(announcementFirst.children?.length, 1);

    const headerFirst = mergeHeaderPartialEntries(mainHeader, announcement, {
      canHostMap,
    });
    assert.equal(headerFirst.definitionKey, 'sitecore-main-header');
    assert.ok(
      (headerFirst.siblingsBefore || []).some(
        (s) => s.definitionKey === 'sitecore-announcement',
      ),
    );
  });

  it('keeps non-primary challenger (promo strip) in siblingsBefore', () => {
    const canHostMap = {
      'sitecore-site-navigation': true,
      'sitecore-promo-strip': false,
    };
    const nav = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'sitecore-site-navigation',
      sectionIndex: 4,
      children: [{ definitionKey: 'sitecore-link' }],
    };
    const promoStrip = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'sitecore-promo-strip',
      sectionIndex: 2,
    };
    const merged = mergeHeaderPartialEntries(nav, promoStrip, { canHostMap });
    assert.equal(merged.definitionKey, 'sitecore-site-navigation');
    assert.ok(
      (merged.siblingsBefore || []).some(
        (s) => s.definitionKey === 'sitecore-promo-strip',
      ),
    );
  });

  it('prefers host-capable composite over leaf header regardless of name', () => {
    const canHostMap = {
      'sitecore-main-header': false,
      'sitecore-main-nav': true,
    };
    const mainHeader = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'sitecore-main-header',
      sectionIndex: 3,
      children: [{ definitionKey: 'sitecore-main-navigation' }],
    };
    const mainNav = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'sitecore-main-nav',
      sectionIndex: 3,
      children: [{ definitionKey: 'sitecore-main-navigation' }],
    };
    const merged = mergeHeaderPartialEntries(mainHeader, mainNav, { canHostMap });
    assert.equal(merged.definitionKey, 'sitecore-main-nav');
    assert.equal(merged.children?.length, 1);
    assert.equal(
      (merged.siblingsBefore || []).some((s) =>
        /main-nav|main-header/.test(String(s.definitionKey)),
      ),
      false,
      'does not stack second primary nav in siblingsBefore',
    );
  });

  it('never absorbs children onto a leaf parent', () => {
    const canHostMap = {
      'leaf-chrome': false,
      'host-chrome': true,
    };
    const leaf = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'leaf-chrome',
      sectionIndex: 2,
    };
    const host = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'host-chrome',
      sectionIndex: 3,
      children: [{ definitionKey: 'card' }],
    };
    const merged = mergeHeaderPartialEntries(leaf, host, { canHostMap });
    assert.equal(merged.definitionKey, 'host-chrome');
    assert.equal(merged.children?.length, 1);
  });

  it('keeps two host-capable composites as sibling roots with own children', () => {
    const canHostMap = {
      'sitecore-announcement': true,
      'sitecore-main-nav': true,
    };
    const announcement = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'sitecore-announcement',
      sectionIndex: 2,
      children: [{ definitionKey: 'sitecore-announcement-message' }],
    };
    const mainNav = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'sitecore-main-nav',
      sectionIndex: 3,
      children: [{ definitionKey: 'sitecore-main-navigation' }],
    };
    const merged = mergeHeaderPartialEntries(announcement, mainNav, { canHostMap });
    assert.equal(merged.definitionKey, 'sitecore-main-nav');
    assert.deepEqual(
      (merged.children || []).map((c) => c.definitionKey),
      ['sitecore-main-navigation'],
    );
    const sib = (merged.siblingsBefore || []).find(
      (s) => s.definitionKey === 'sitecore-announcement',
    );
    assert.ok(sib);
    assert.deepEqual(
      (sib.children || []).map((c) => c.definitionKey),
      ['sitecore-announcement-message'],
    );
  });

  it('absorbs loser children into empty host winner (never leave children:[])', () => {
    const canHostMap = {
      'crelan-header': true,
      'crelan-main-menu': true,
    };
    const header = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'crelan-header',
      sectionIndex: 2,
      canHostChildren: true,
      placeholderKeys: ['navigation-groups', 'header-navigation'],
      children: [
        {
          definitionKey: 'crelan-header-navigation',
          datasourceItem: 'Betalen',
          placeholder: 'header-navigation',
        },
      ],
    };
    const mainMenu = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'crelan-main-menu',
      sectionIndex: 3,
      canHostChildren: true,
      placeholderKeys: ['primary-navigation', 'header-navigation'],
      children: [],
    };
    const merged = mergeHeaderPartialEntries(header, mainMenu, { canHostMap });
    assert.equal(merged.definitionKey, 'crelan-main-menu');
    assert.ok(
      (merged.children || []).some(
        (c) => c.definitionKey === 'crelan-header-navigation',
      ),
      'empty host must absorb nestable children from loser',
    );
    assert.ok(
      !('placeholderKeys' in merged),
      'merged partial must not stamp placeholderKeys (SitePresentationDefinition)',
    );
  });

  it('prefers host-capable early nav over later leaf header', () => {
    const canHostMap = {
      'site-navigation': true,
      'main-header': false,
    };
    const early = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'site-navigation',
      sectionIndex: 2,
      children: [{ definitionKey: 'nav-link' }],
    };
    const late = {
      signature: 'header',
      placeholder: 'headless-header',
      definitionKey: 'main-header',
      sectionIndex: 3,
      children: [{ definitionKey: 'nav-item' }],
    };
    const merged = mergeHeaderPartialEntries(early, late, { canHostMap });
    assert.equal(merged.definitionKey, 'site-navigation');
    assert.equal(
      (merged.siblingsBefore || []).some(
        (s) => s.definitionKey === 'main-header',
      ),
      false,
    );
  });
});

describe('sanitizeNestedPrimaryHeaderChrome', () => {
  it('promotes nested primary Header Navigation over Global Header host', () => {
    const out = sanitizeNestedPrimaryHeaderChrome(
      {
        signature: 'header',
        placeholder: 'headless-header',
        definitionKey: 'menzis-global-header',
        canHostChildren: true,
        datasourceItem: 'Menzis Global Header',
        children: [
          {
            definitionKey: 'menzis-header-navigation',
            datasourceItem: 'Header Navigation',
            placeholder: 'header-navigation',
            children: [],
          },
        ],
      },
      { 'menzis-global-header': true, 'menzis-header-navigation': true },
    );
    assert.equal(out.definitionKey, 'menzis-header-navigation');
    assert.equal(out.datasourceItem, 'Header Navigation');
    assert.equal(
      (out.children || []).some((c) => c.definitionKey === 'menzis-header-navigation'),
      false,
    );
  });

  it('skips leaf hosts so sibling promotion can run', () => {
    const out = sanitizeNestedPrimaryHeaderChrome(
      {
        signature: 'header',
        definitionKey: 'sitecore-main-header',
        children: [{ definitionKey: 'sitecore-main-navigation' }],
      },
      { 'sitecore-main-header': false },
    );
    assert.equal(out.definitionKey, 'sitecore-main-header');
  });
});

describe('ensureHostPartialChildrenFromCandidates primary nest ban', () => {
  it('does not fill primary header-navigation under primary global-header', () => {
    const out = ensureHostPartialChildrenFromCandidates(
      {
        signature: 'header',
        definitionKey: 'menzis-global-header',
        canHostChildren: true,
        placeholderKeys: ['header-context-links', 'header-navigation'],
        children: [],
      },
      {
        hostPlaceholderKeys: ['header-context-links', 'header-navigation'],
        candidates: [
          {
            definitionKey: 'menzis-header-navigation',
            role: 'child',
            datasourceItem: 'Header Navigation',
          },
        ],
      },
    );
    assert.equal(
      (out.children || []).some(
        (c) => c.definitionKey === 'menzis-header-navigation',
      ),
      false,
    );
  });
});

describe('sanitizePartialNesting', () => {
  it('promotes host-capable sibling over leaf parent with nested children', () => {
    const canHostMap = {
      'sitecore-main-header': false,
      'sitecore-main-nav': true,
    };
    const out = sanitizePartialNesting(
      [
        {
          signature: 'header',
          placeholder: 'headless-header',
          definitionKey: 'sitecore-main-header',
          children: [{ definitionKey: 'sitecore-main-navigation' }],
          siblingsBefore: [
            {
              definitionKey: 'sitecore-main-nav',
              children: [{ definitionKey: 'sitecore-main-navigation' }],
            },
          ],
        },
      ],
      canHostMap,
    );
    assert.equal(out[0].definitionKey, 'sitecore-main-nav');
    assert.ok(out[0].children?.length >= 1);
    assert.ok(
      (out[0].siblingsBefore || []).some(
        (s) => s.definitionKey === 'sitecore-main-header',
      ),
    );
  });

  it('throws when leaf has children and no host sibling', () => {
    assert.throws(
      () =>
        sanitizePartialNesting(
          [
            {
              signature: 'header',
              definitionKey: 'sitecore-main-header',
              children: [{ definitionKey: 'x' }],
            },
          ],
          { 'sitecore-main-header': false },
        ),
      /placeholders are empty/,
    );
  });
});

describe('entryCanHostChildren', () => {
  it('reads stamped flag and map', () => {
    assert.equal(entryCanHostChildren({ canHostChildren: true }), true);
    assert.equal(
      entryCanHostChildren({ definitionKey: 'a' }, { a: true }),
      true,
    );
    assert.equal(
      entryCanHostChildren({ definitionKey: 'a' }, { a: false }),
      false,
    );
  });

  it('disk map false beats stamped canHostChildren true', () => {
    assert.equal(
      entryCanHostChildren(
        { definitionKey: 'dead-parent', canHostChildren: true },
        { 'dead-parent': false },
      ),
      false,
    );
    assert.equal(
      entryCanHostChildren(
        { definitionKey: 'alive-parent', canHostChildren: false },
        { 'alive-parent': true },
      ),
      true,
    );
  });
});

describe('restampPartialHostFlags', () => {
  it('rewrites canHostChildren from map', () => {
    const out = restampPartialHostFlags(
      [
        {
          signature: 'footer',
          definitionKey: 'dead-parent',
          canHostChildren: true,
        },
        {
          signature: 'header',
          definitionKey: 'alive-parent',
          canHostChildren: false,
        },
      ],
      { 'dead-parent': false, 'alive-parent': true },
    );
    assert.equal(out[0].canHostChildren, false);
    assert.equal(out[1].canHostChildren, true);
  });
});

describe('pruneAvailableRenderingsMissingDefinitions', () => {
  it('drops keys with no on-disk definition for the host', async () => {
    const pruned = await pruneAvailableRenderingsMissingDefinitions(
      {
        Navigation: [
          'definitely-missing-package-zzzz',
          'also-missing-package-yyyy',
        ],
        'Page Content': ['definitely-missing-package-zzzz'],
      },
      'no-such-host-slug-zzzz',
    );
    assert.deepEqual(pruned.Navigation, []);
    assert.deepEqual(pruned['Page Content'], []);
  });
});

describe('isPartialChromeRole', () => {
  it('detects partial-* roles', () => {
    assert.equal(isPartialChromeRole('partial-header'), true);
    assert.equal(isPartialChromeRole('partial-footer'), true);
    assert.equal(isPartialChromeRole('page'), false);
    assert.equal(isPartialChromeRole(undefined), false);
  });
});

describe('filterPageRenderings', () => {
  it('strips header/footer roles; cookie/CMP stays on page (no cookie partial)', () => {
    const out = filterPageRenderings([
      {
        definitionKey: 'sitecore-consent-banner',
        placeholder: 'headless-main',
        role: 'partial-cookie',
      },
      {
        definitionKey: 'sitecore-privacy-consent-panel',
        placeholder: 'headless-main',
        role: 'partial-cookie',
      },
      {
        definitionKey: 'sitecore-notification-bar',
        placeholder: 'headless-main',
        role: 'partial-header',
      },
      {
        definitionKey: 'sitecore-site-header',
        placeholder: 'headless-main',
        role: 'partial-header',
      },
      {
        definitionKey: 'sitecore-technology-hero',
        placeholder: 'headless-main',
        role: 'page',
      },
      {
        definitionKey: 'sitecore-press-release-carousel',
        placeholder: 'headless-main',
        role: 'page',
      },
      {
        definitionKey: 'sitecore-press-release-carousel',
        placeholder: 'headless-main',
        role: 'page',
      },
    ]);
    assert.deepEqual(
      out.map((r) => r.definitionKey),
      [
        'sitecore-consent-banner',
        'sitecore-privacy-consent-panel',
        'sitecore-technology-hero',
        'sitecore-press-release-carousel',
      ],
    );
  });

  it('strips keys already on footer/header partial trees even with role page', () => {
    const partialKeys = collectPartialDesignDefinitionKeys([
      {
        signature: 'footer',
        definitionKey: 'menzis-footer-info-links',
        siblingsBefore: [
          {
            definitionKey: 'menzis-footer-support-navigation',
            children: [
              { definitionKey: 'menzis-footer-quick-links' },
            ],
          },
        ],
        children: [{ definitionKey: 'menzis-footer-legal-link-list' }],
      },
    ]);
    const out = filterPageRenderings(
      [
        {
          definitionKey: 'menzis-footer-support-navigation',
          placeholder: 'headless-main',
          role: 'page',
        },
        {
          definitionKey: 'menzis-introduction-hero',
          placeholder: 'headless-main',
          role: 'page',
        },
      ],
      { partialKeys },
    );
    assert.deepEqual(
      out.map((r) => r.definitionKey),
      ['menzis-introduction-hero'],
    );
  });

  it('keeps explicit role:page even when definitionKey looks like chrome', () => {
    const out = filterPageRenderings([
      {
        definitionKey: 'sitecore-footer-cta-band',
        placeholder: 'headless-main',
        role: 'page',
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].definitionKey, 'sitecore-footer-cta-band');
  });

  it('last-resort strips chrome keys when role metadata is missing', () => {
    const out = filterPageRenderings([
      { definitionKey: 'sitecore-main-navigation', placeholder: 'headless-main' },
      { definitionKey: 'sitecore-technology-hero', placeholder: 'headless-main' },
    ]);
    assert.deepEqual(
      out.map((r) => r.definitionKey),
      ['sitecore-technology-hero'],
    );
  });

  it('fingerprints include children', () => {
    const a = pageRenderingFingerprint({
      definitionKey: 'parent',
      children: [{ definitionKey: 'child', datasourceItem: 'A' }],
    });
    const b = pageRenderingFingerprint({
      definitionKey: 'parent',
      children: [{ definitionKey: 'child', datasourceItem: 'B' }],
    });
    assert.notEqual(a, b);
  });
});

describe('preferSingleFooterColumnFamily', () => {
  it('drops link-group when navigation-group is present', () => {
    const out = preferSingleFooterColumnFamily([
      { definitionKey: 'sitecore-footer-signpost-link', datasourceItem: 'A' },
      { definitionKey: 'sitecore-footer-navigation-group', datasourceItem: 'Platform' },
      { definitionKey: 'sitecore-footer-link-group', datasourceItem: 'Platform' },
    ]);
    assert.equal(out.length, 2);
    assert.ok(out.every((c) => !/footer-link-group/.test(c.definitionKey)));
  });

  it('prefers link-columns over duplicate navigation-group', () => {
    const out = preferSingleFooterColumnFamily([
      { definitionKey: 'sitecore-footer-link-columns', datasourceItem: 'Platform' },
      { definitionKey: 'sitecore-footer-navigation-group', datasourceItem: 'Platform' },
      { definitionKey: 'sitecore-footer-signpost-link', datasourceItem: 'A' },
    ]);
    assert.deepEqual(
      out.map((c) => c.definitionKey),
      ['sitecore-footer-link-columns', 'sitecore-footer-signpost-link'],
    );
  });
});

describe('preferSingleChildFamily', () => {
  it('prefers footer-signpost over signpost-link and branding-social over logo-only', () => {
    const out = preferSingleChildFamily([
      {
        definitionKey: 'sitecore-footer-signpost',
        datasourceItem: 'Explore Use Cases',
        placeholder: 'footer-signposts',
      },
      {
        definitionKey: 'sitecore-footer-signpost-link',
        datasourceItem: 'Explore Use Cases',
        placeholder: 'footer-signposts',
      },
      {
        definitionKey: 'sitecore-footer-branding-social',
        datasourceItem: 'Footer Branding',
        placeholder: 'footer-social',
      },
      {
        definitionKey: 'sitecore-footer-branding',
        datasourceItem: 'Footer Branding',
      },
    ]);
    assert.deepEqual(
      out.map((c) => c.definitionKey),
      ['sitecore-footer-signpost', 'sitecore-footer-branding-social'],
    );
  });

  it('prefers footer-link-column over legacy footer-column (keeps footer-columns parent key)', () => {
    const out = preferSingleChildFamily([
      {
        definitionKey: 'crelan-footer-column',
        datasourceItem: 'Offer',
        placeholder: 'footer-navigation',
      },
      {
        definitionKey: 'crelan-footer-link-column',
        datasourceItem: 'Offer',
        placeholder: 'footer-navigation',
      },
      {
        definitionKey: 'crelan-footer-columns',
        datasourceItem: 'Shell',
      },
    ]);
    assert.deepEqual(
      out.map((c) => c.definitionKey),
      ['crelan-footer-link-column', 'crelan-footer-columns'],
    );
  });
});

describe('inferFooterChildPlaceholder', () => {
  it('returns undefined without explicit placeholder (no four-band invent)', () => {
    assert.equal(
      inferFooterChildPlaceholder('sitecore-footer-signpost-link', 'Explore Use Cases'),
      undefined,
    );
    assert.equal(
      inferFooterChildPlaceholder('sitecore-footer-navigation-group', 'Platform'),
      undefined,
    );
  });
});

describe('ensureCompositePresentationChildren', () => {
  it('rebuilds children from contentItemNames when empty', () => {
    const out = ensureCompositePresentationChildren(
      { definitionKey: 'sitecore-card-grid' },
      [
        { role: 'section', definitionKey: 'sitecore-card-grid' },
        {
          role: 'child',
          definitionKey: 'sitecore-feature-tile',
          contentItemNames: ['Show Up In AI Answers', 'AI With Guardrails Built In'],
        },
      ],
    );
    assert.equal(out.children?.length, 2);
    assert.equal(out.children[0].datasourceItem, 'Show Up In AI Answers');
  });

  it('throws when only self-nested children have content seeds', () => {
    assert.throws(
      () =>
        ensureCompositePresentationChildren(
          { definitionKey: 'sitecore-feature-card-carousel' },
          [
            { role: 'section', definitionKey: 'sitecore-feature-card-carousel' },
            {
              role: 'child',
              definitionKey: 'sitecore-feature-card-carousel',
              contentItemNames: ['Win The AI First Buyer'],
            },
          ],
        ),
      /self-nested child|distinct child package/i,
    );
  });

  it('warns but does not throw when composite label has no child packages', () => {
    const out = ensureCompositePresentationChildren(
      { definitionKey: 'sitecore-media-feature' },
      [
        {
          role: 'section',
          definitionKey: 'sitecore-media-feature',
          planMode: 'composite',
          placeholderKey: 'media-feature-items',
        },
      ],
    );
    assert.equal(out.definitionKey, 'sitecore-media-feature');
    assert.equal(out.children, undefined);
  });

  it('returns unchanged for single-mode section with no child packages', () => {
    const out = ensureCompositePresentationChildren(
      { definitionKey: 'sitecore-hero' },
      [{ role: 'section', definitionKey: 'sitecore-hero', planMode: 'single' }],
    );
    assert.equal(out.definitionKey, 'sitecore-hero');
    assert.equal(out.children, undefined);
  });
});

describe('alignFooterChildPlaceholder', () => {
  it('remaps legacy footer-nav onto footer-navigation when parent declares it', () => {
    assert.equal(
      alignFooterChildPlaceholder('footer-nav', ['footer-signposts', 'footer-navigation']),
      'footer-navigation',
    );
    assert.equal(
      alignFooterChildPlaceholder('footer-signposts', ['footer-signposts', 'footer-navigation']),
      'footer-signposts',
    );
  });
});

describe('alignChildPlaceholderToParent', () => {
  it('is the generic alias and remaps footer-content onto navigation when present', () => {
    assert.equal(
      alignChildPlaceholderToParent('footer-nav', ['footer-signposts', 'footer-navigation']),
      'footer-navigation',
    );
    assert.equal(
      alignChildPlaceholderToParent('footer-content', ['footer-signposts', 'footer-navigation']),
      'footer-navigation',
    );
  });

  it('extractPlaceholderKeysFromDefinition reads placeholders[].key', () => {
    const keys = extractPlaceholderKeysFromDefinition(`
      placeholders: [
        { key: "footer-signposts", allowedControls: ["a"] },
        { key: "footer-navigation", allowedControls: ["b"] },
      ],
    `);
    assert.deepEqual(keys, ['footer-signposts', 'footer-navigation']);
  });
});

describe('rewriteSeedTitlesMatchingParentHeading', () => {
  it('rewrites Title/displayName that match parent Heading to item name', () => {
    const src = `
  content: {
    items: [{
      fields: { Heading: "Own the moments that matter." }
    }]
  }
  items: [
    {
      name: "Platform",
      displayName: "Own the moments that matter.",
      fields: { Title: "Own the moments that matter." },
    },
  ]
`;
    const out = rewriteSeedTitlesMatchingParentHeading(src);
    assert.match(out, /Title:\s*"Platform"/);
    assert.match(out, /displayName:\s*"Platform"/);
  });
});

describe('rewriteLiteralTitleSeedsFromItemName', () => {
  it('rewrites literal Title/Connect to item name', () => {
    const src = `
  items: [
    {
      name: "Platform",
      displayName: "Title",
      fields: { Title: "Title" },
    },
    {
      name: "Solutions",
      displayName: "Connect",
      fields: { Title: "Connect" },
    },
  ]
`;
    const out = rewriteLiteralTitleSeedsFromItemName(src);
    assert.match(out, /name:\s*"Platform"[\s\S]*?Title:\s*"Platform"/);
    assert.match(out, /name:\s*"Solutions"[\s\S]*?Title:\s*"Solutions"/);
  });
});

describe('normalizeCaptureGroupHeading', () => {
  it('derives Platform from URL heading', () => {
    assert.equal(
      normalizeCaptureGroupHeading('https://www.sitecore.com/Platform'),
      'Platform',
    );
  });
});

describe('ensureDarkSurfaceIconContrast', () => {
  it('adds invert / text-white on dark surfaces', () => {
    const src = `
export default function Footer() {
  return (
    <section className="bg-[#0015a0] text-white">
      <Image field={fields.Icon} className="h-5 w-5" />
      <FaIcon name="linkedin" className="h-5 w-5" />
    </section>
  );
}
`;
    const out = ensureDarkSurfaceIconContrast(src);
    assert.match(out, /brightness-0 invert/);
    assert.match(out, /FaIcon[\s\S]*text-white/);
  });

  it('inverts icon Images on text-white social bands without dark bg token', () => {
    const src = `
<div className="flex text-white">
  <Image field={fields["Email Icon"]} className="h-6 w-6 object-contain" />
  <Image field={fields["Logo Image"]} className="h-auto w-[220px] object-contain" />
</div>
`;
    const out = ensureDarkSurfaceIconContrast(src);
    assert.match(out, /Email Icon[\s\S]{0,80}brightness-0 invert/);
    assert.doesNotMatch(out, /Logo Image[\s\S]{0,80}brightness-0/);
  });

  it('no-ops on light surfaces', () => {
    const src = `
<section className="bg-white">
  <Image field={fields.Icon} className="h-5 w-5" />
</section>
`;
    const out = ensureDarkSurfaceIconContrast(src);
    assert.equal(out, src);
  });
});

describe('shouldShowConsentOverlay', () => {
  it('shows when not editing', () => {
    assert.equal(shouldShowConsentOverlay({ mode: { isEditing: false } }), true);
  });
  it('shows when editing a Partial Design', () => {
    assert.equal(
      shouldShowConsentOverlay({
        mode: { isEditing: true },
        layout: { sitecore: { route: { templateName: 'Partial Design' } } },
      }),
      true,
    );
  });
  it('hides when editing a normal page', () => {
    assert.equal(
      shouldShowConsentOverlay({
        mode: { isEditing: true },
        layout: { sitecore: { route: { templateName: 'App Route' } } },
      }),
      false,
    );
  });
});
