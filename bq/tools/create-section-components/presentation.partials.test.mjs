/**
 * Partial chrome ownership: once-per-run host nesting + invariant gate.
 * Run: node --test tools/create-section-components/presentation.partials.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  absorbSiblingChildrenIntoHost,
  assertPartialDesignsCorrect,
  collectNestedDefinitionKeys,
  dedupePartialChildrenBySeed,
  ensureHostPartialChildrenFromCandidates,
  enforceNestedPlaceholders,
  enforcePresentationNestedPlaceholders,
  forceChildPlaceholderAgainstHost,
  inferPlaceholderFromDefinitionKey,
  mergeFooterPartialEntries,
  mergeHeaderPartialEntries,
  mergePartials,
  normalizePartialThumbnailForDisk,
  omitPartialPlaceholderKeys,
  resolveSectionDesktopThumbnailRel,
  thumbnailFromCaptureRel,
} from './presentation.mjs';
import { buildAllowedControlsByPlaceholder } from './sync-definition-from-tsx.mjs';

describe('thumbnailFromCaptureRel / normalizePartialThumbnailForDisk', () => {
  it('stamps { path } from capture rel', () => {
    assert.deepEqual(
      thumbnailFromCaptureRel('sections/section-02/section-02-desktop.png'),
      { path: 'sections/section-02/section-02-desktop.png' },
    );
  });

  it('migrates deprecated thumbnailCaptureRel on disk normalize', () => {
    const out = normalizePartialThumbnailForDisk({
      signature: 'header',
      definitionKey: 'menzis-global-header',
      thumbnailCaptureRel: 'sections/section-02/section-02-desktop.png',
    });
    assert.deepEqual(out.thumbnail, {
      path: 'sections/section-02/section-02-desktop.png',
    });
    assert.equal('thumbnailCaptureRel' in out, false);
  });
});

describe('assertPartialDesignsCorrect', () => {
  it('passes flat GlobalHeader host (no placeholders) even when nav candidates exist', () => {
    const gate = assertPartialDesignsCorrect(
      [
        {
          signature: 'header',
          definitionKey: 'menzis-global-header',
          canHostChildren: false,
          children: [],
        },
      ],
      { candidateKeys: ['menzis-header-navigation'] },
    );
    assert.equal(gate.ok, true);
  });

  it('allows empty host children when no nestable packages matched host slots', () => {
    const gate = assertPartialDesignsCorrect(
      [
        {
          signature: 'footer',
          definitionKey: 'site-footer-support',
          canHostChildren: true,
          placeholderKeys: ['footer-quick-links', 'footer-account-links'],
          children: [],
        },
      ],
      { candidateKeys: ['site-header-navigation', 'site-footer-info'] },
    );
    assert.equal(gate.ok, true, gate.errors.join('\n'));
  });

  it('fails when host child is missing placeholder', () => {
    const gate = assertPartialDesignsCorrect(
      [
        {
          signature: 'footer',
          definitionKey: 'site-footer-support',
          canHostChildren: true,
          placeholderKeys: ['footer-quick-links'],
          children: [
            {
              definitionKey: 'site-header-navigation',
              datasourceItem: 'Main Nav',
            },
          ],
        },
      ],
      { candidateKeys: ['site-header-navigation'] },
    );
    assert.equal(gate.ok, false);
    assert.ok(gate.errors.some((e) => /missing placeholder/.test(e)));
  });

  it('passes when host has children on host placeholder keys', () => {
    const gate = assertPartialDesignsCorrect(
      [
        {
          signature: 'header',
          definitionKey: 'crelan-main-menu',
          canHostChildren: true,
          placeholderKeys: ['primary-navigation', 'header-navigation'],
          children: [
            {
              definitionKey: 'crelan-header-navigation',
              placeholder: 'header-navigation',
              datasourceItem: 'Betalen',
            },
          ],
        },
        {
          signature: 'cookie',
          definitionKey: 'crelan-consent',
          canHostChildren: false,
        },
      ],
      { candidateKeys: ['crelan-header-navigation'] },
    );
    assert.equal(gate.ok, true);
  });

  it('flags duplicate column seeds', () => {
    const gate = assertPartialDesignsCorrect(
      [
        {
          signature: 'footer',
          definitionKey: 'crelan-footer-columns',
          canHostChildren: true,
          placeholderKeys: ['footer-navigation'],
          children: [
            {
              definitionKey: 'crelan-footer-link-column',
              placeholder: 'footer-navigation',
              datasourceItem: 'Our Offer',
            },
            {
              definitionKey: 'crelan-footer-link-column',
              placeholder: 'footer-navigation',
              datasourceItem: 'Our Offer',
            },
          ],
        },
      ],
      { candidateKeys: ['crelan-footer-link-column'] },
    );
    assert.equal(gate.ok, false);
    assert.ok(gate.errors.some((e) => /duplicate child seed/.test(e)));
  });
});

describe('ensureHostPartialChildrenFromCandidates', () => {
  it('wires header-navigation package into host slot', () => {
    const out = ensureHostPartialChildrenFromCandidates(
      {
        signature: 'header',
        definitionKey: 'crelan-main-menu',
        canHostChildren: true,
        placeholderKeys: ['primary-navigation', 'header-navigation'],
        children: [],
      },
      {
        hostPlaceholderKeys: ['primary-navigation', 'header-navigation'],
        candidates: [
          {
            definitionKey: 'crelan-header-navigation',
            role: 'child',
            datasourceItem: 'Betalen',
          },
          {
            definitionKey: 'crelan-navigation',
            role: 'child',
            datasourceItem: 'Main Nav',
          },
        ],
      },
    );
    assert.ok((out.children || []).length >= 1);
    assert.ok(
      out.children.some(
        (c) =>
          c.definitionKey === 'crelan-header-navigation' &&
          c.placeholder === 'header-navigation',
      ),
    );
    assert.ok(!('placeholderKeys' in out));
  });

  it('does not dump Navigation pool into empty footer host with known slots', () => {
    const out = ensureHostPartialChildrenFromCandidates(
      {
        signature: 'footer',
        definitionKey: 'site-footer-support',
        canHostChildren: true,
        placeholderKeys: ['footer-quick-links', 'footer-account-links'],
        children: [],
      },
      {
        hostPlaceholderKeys: ['footer-quick-links', 'footer-account-links'],
        candidates: [
          {
            definitionKey: 'site-header-navigation',
            role: 'child',
            datasourceItem: 'Main Nav',
          },
          {
            definitionKey: 'site-header-context-link-list',
            role: 'child',
            datasourceItem: 'Context Links',
          },
          {
            definitionKey: 'site-footer-info-link-list',
            role: 'child',
            datasourceItem: 'Info Links',
          },
          {
            definitionKey: 'site-footer-info-links',
            role: 'child',
            datasourceItem: 'Footer Info',
          },
        ],
      },
    );
    assert.equal((out.children || []).length, 0);
    assert.ok(
      !(out.children || []).some((c) =>
        /header-navigation|header-context/.test(String(c.definitionKey || '')),
      ),
    );
  });

  it('dump-all only when host keys are unknown', () => {
    const out = ensureHostPartialChildrenFromCandidates(
      {
        signature: 'footer',
        definitionKey: 'site-footer',
        canHostChildren: true,
        children: [],
      },
      {
        hostPlaceholderKeys: [],
        candidates: [
          {
            definitionKey: 'site-footer-column',
            role: 'child',
            datasourceItem: 'Column A',
          },
        ],
      },
    );
    assert.ok((out.children || []).length >= 1);
    assert.equal(out.children[0].definitionKey, 'site-footer-column');
  });
});

describe('enforceNestedPlaceholders', () => {
  it('keeps deep page tree placeholders on grandchildren', () => {
    const { nodes, dropped } = enforceNestedPlaceholders(
      [
        {
          definitionKey: 'site-support-card',
          placeholder: 'support-health-content',
          children: [
            {
              definitionKey: 'site-support-link-list',
              placeholder: 'support-card-links',
              datasourceItem: 'Support Links',
            },
          ],
        },
        {
          definitionKey: 'site-promo-band',
          placeholder: 'support-health-content',
        },
      ],
      { parentPlaceholderKeys: ['support-health-content'] },
    );
    assert.equal(dropped.length, 0);
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0].children[0].placeholder, 'support-card-links');
  });

  it('drops nested nodes still missing placeholder', () => {
    const { nodes, dropped } = enforceNestedPlaceholders(
      [
        {
          definitionKey: 'site-header-navigation',
          datasourceItem: 'Main Nav',
        },
      ],
      { parentPlaceholderKeys: ['footer-quick-links'] },
    );
    assert.equal(nodes.length, 0);
    assert.deepEqual(dropped, ['site-header-navigation']);
  });

  it('enforces placeholders on page + partial + sibling trees', async () => {
    const { renderings, partials } = await enforcePresentationNestedPlaceholders({
      renderings: [
        {
          definitionKey: 'site-support-section',
          placeholder: 'headless-main',
          children: [
            {
              definitionKey: 'site-support-card',
              placeholder: 'support-health-content',
              children: [
                {
                  definitionKey: 'site-support-link-list',
                  placeholder: 'support-card-links',
                },
              ],
            },
          ],
        },
      ],
      partials: [
        {
          signature: 'footer',
          definitionKey: 'site-footer-support',
          children: [],
          siblingsBefore: [
            {
              definitionKey: 'site-footer-info-links',
              children: [
                {
                  definitionKey: 'site-footer-info-link-list',
                  placeholder: 'info-links',
                  datasourceItem: 'Info',
                },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(
      renderings[0].children[0].children[0].placeholder,
      'support-card-links',
    );
    assert.equal(
      partials[0].siblingsBefore[0].children[0].placeholder,
      'info-links',
    );
  });

  it('forces stale sibling-child PH onto sibling host current keys', async () => {
    const { partials } = await enforcePresentationNestedPlaceholders({
      renderings: [],
      partials: [
        {
          signature: 'footer',
          definitionKey: 'menzis-footer-info-links',
          children: [],
          siblingsBefore: [
            {
              definitionKey: 'menzis-footer-support-navigation',
              placeholderKeys: [
                'footer-account-links',
                'footer-help-links',
                'footer-quick-links',
              ],
              children: [
                {
                  definitionKey: 'menzis-footer-quick-links',
                  placeholder: 'footer-support-links',
                },
                {
                  definitionKey: 'menzis-footer-account-links',
                  placeholder: 'footer-support-links',
                },
              ],
            },
          ],
        },
      ],
    });
    const kids = partials[0].siblingsBefore[0].children;
    assert.equal(kids.length, 2);
    assert.equal(kids[0].placeholder, 'footer-quick-links');
    assert.equal(kids[1].placeholder, 'footer-account-links');
  });

  it('drops foreign sibling-child PH when definitionKey cannot map to host keys', async () => {
    const { partials } = await enforcePresentationNestedPlaceholders({
      renderings: [],
      partials: [
        {
          signature: 'footer',
          definitionKey: 'site-footer',
          siblingsBefore: [
            {
              definitionKey: 'site-footer-nav',
              placeholderKeys: ['footer-account-links', 'footer-help-links'],
              children: [
                {
                  definitionKey: 'totally-unrelated-widget',
                  placeholder: 'footer-support-links',
                },
              ],
            },
          ],
        },
      ],
    });
    // Foreign kids dropped; empty children omitted (headerSiblingRef shape).
    assert.ok(!partials[0].siblingsBefore[0].children?.length);
    assert.ok(!('children' in partials[0].siblingsBefore[0]));
  });
});

describe('nestable siblingsBefore candidate refill', () => {
  it('fills empty sibling host without stealing root-claimed children', () => {
    const rootKids = [
      {
        definitionKey: 'menzis-footer-legal-link-list',
        datasourceItem: 'Footer Legal Links',
        placeholder: 'footer-legal-links',
      },
    ];
    const rootClaimed = new Set(
      rootKids.map((c) => c.definitionKey),
    );
    const candidates = [
      {
        definitionKey: 'menzis-footer-legal-link-list',
        role: 'child',
        placeholder: 'footer-legal-links',
        contentItemNames: ['Footer Legal Links'],
      },
      {
        definitionKey: 'menzis-footer-help-band',
        role: 'child',
        placeholder: 'footer-help-and-links-content',
        contentItemNames: ['Help Band'],
      },
      {
        definitionKey: 'menzis-footer-help-link-list',
        role: 'child',
        placeholder: 'footer-help-and-links-content',
        contentItemNames: ['Snel naar', 'Mijn Menzis'],
      },
    ].filter((c) => !rootClaimed.has(c.definitionKey));

    const filled = ensureHostPartialChildrenFromCandidates(
      {
        definitionKey: 'menzis-footer-support-navigation',
        canHostChildren: true,
        children: [],
      },
      {
        hostPlaceholderKeys: ['footer-help-and-links-content'],
        candidates,
      },
    );
    // ensureHost fills one candidate package per host PH (first match).
    // Multi-package same-PH trees (Help Band + Link Lists) come from section
    // wiring + mergeSiblingsBeforeList upgrade — not candidate dump.
    assert.ok((filled.children || []).length >= 1);
    assert.ok(
      filled.children.some((c) => c.definitionKey === 'menzis-footer-help-band'),
    );
    assert.ok(
      !filled.children.some(
        (c) => c.definitionKey === 'menzis-footer-legal-link-list',
      ),
      'sibling must not steal root legal links',
    );
  });

  it('no-ops when sibling host already covers its placeholders', () => {
    const existing = [
      {
        definitionKey: 'menzis-footer-help-band',
        datasourceItem: 'Help Band',
        placeholder: 'footer-help-and-links-content',
      },
    ];
    const filled = ensureHostPartialChildrenFromCandidates(
      {
        definitionKey: 'menzis-footer-support-navigation',
        canHostChildren: true,
        children: existing,
      },
      {
        hostPlaceholderKeys: ['footer-help-and-links-content'],
        candidates: [
          {
            definitionKey: 'menzis-footer-help-link-list',
            role: 'child',
            contentItemNames: ['Snel naar'],
          },
        ],
      },
    );
    assert.equal(filled.children?.length, 1);
    assert.equal(filled.children[0].definitionKey, 'menzis-footer-help-band');
  });
});

describe('forceChildPlaceholderAgainstHost', () => {
  it('remaps stale PH via definitionKey onto host keys', () => {
    assert.equal(
      inferPlaceholderFromDefinitionKey('menzis-footer-account-links'),
      'footer-account-links',
    );
    assert.equal(
      forceChildPlaceholderAgainstHost({
        placeholder: 'footer-support-links',
        definitionKey: 'menzis-footer-account-links',
        hostKeys: [
          'footer-account-links',
          'footer-help-links',
          'footer-quick-links',
        ],
      }),
      'footer-account-links',
    );
  });
});

describe('absorbSiblingChildrenIntoHost with host keys', () => {
  it('keeps foreign-PH sibling kids on the sibling (multi-band footer)', () => {
    const out = absorbSiblingChildrenIntoHost(
      {
        signature: 'footer',
        definitionKey: 'site-footer-support',
        canHostChildren: true,
        placeholderKeys: ['footer-quick-links', 'footer-account-links'],
        children: [],
        siblingsBefore: [
          {
            definitionKey: 'site-footer-info-links',
            canHostChildren: true,
            children: [
              {
                definitionKey: 'site-footer-info-link-list',
                placeholder: 'info-links',
                datasourceItem: 'Info',
              },
            ],
          },
        ],
      },
      {
        hostPlaceholderKeys: ['footer-quick-links', 'footer-account-links'],
      },
    );
    assert.equal((out.children || []).length, 0);
    assert.equal(out.siblingsBefore?.length, 1);
    assert.equal(
      out.siblingsBefore[0].children[0].placeholder,
      'info-links',
    );
  });
});

describe('collectNestedDefinitionKeys', () => {
  it('collects nested keys under children and siblings', () => {
    const keys = collectNestedDefinitionKeys({
      children: [{ definitionKey: 'site-header-navigation' }],
      siblingsBefore: [
        {
          definitionKey: 'site-footer-info-links',
          children: [{ definitionKey: 'site-footer-info-link-list' }],
        },
      ],
    });
    assert.ok(keys.has('site-header-navigation'));
    assert.ok(keys.has('site-footer-info-links'));
    assert.ok(keys.has('site-footer-info-link-list'));
  });
});

describe('omitPartialPlaceholderKeys', () => {
  it('strips placeholderKeys for SitePresentationDefinition disk shape', () => {
    const out = omitPartialPlaceholderKeys({
      signature: 'footer',
      definitionKey: 'crelan-site-footer',
      canHostChildren: true,
      placeholderKeys: ['footer-signposts'],
      children: [
        {
          definitionKey: 'crelan-footer-column',
          placeholder: 'footer-signposts',
        },
      ],
    });
    assert.ok(!('placeholderKeys' in out));
    assert.equal(out.canHostChildren, true);
    assert.equal(out.children[0].placeholder, 'footer-signposts');
  });
});

describe('absorbSiblingChildrenIntoHost', () => {
  it('promotes sibling nestables onto empty host', () => {
    const out = absorbSiblingChildrenIntoHost({
      signature: 'header',
      definitionKey: 'crelan-main-menu',
      canHostChildren: true,
      // Legacy in-memory stamp (read for absorb); must not appear on output.
      placeholderKeys: ['primary-navigation', 'header-navigation'],
      children: [],
      siblingsBefore: [
        {
          definitionKey: 'crelan-header',
          children: [
            {
              definitionKey: 'crelan-header-navigation',
              placeholder: 'header-navigation',
              datasourceItem: 'Betalen',
            },
          ],
        },
      ],
    });
    assert.ok(
      (out.children || []).some(
        (c) => c.definitionKey === 'crelan-header-navigation',
      ),
    );
    assert.ok(!('placeholderKeys' in out));
  });
});

describe('dedupePartialChildrenBySeed', () => {
  it('collapses Our Offer spam', () => {
    const out = dedupePartialChildrenBySeed([
      {
        definitionKey: 'crelan-footer-link-column',
        placeholder: 'footer-navigation',
        datasourceItem: 'Our Offer',
      },
      {
        definitionKey: 'crelan-footer-link-column',
        placeholder: 'footer-navigation',
        datasourceItem: 'Our Offer',
      },
      {
        definitionKey: 'crelan-footer-link-column',
        placeholder: 'footer-navigation',
        datasourceItem: 'Themes',
      },
    ]);
    assert.equal(out.length, 2);
  });

  it('collapses same seed when placeholder differs or is omitted', () => {
    const out = dedupePartialChildrenBySeed([
      {
        definitionKey: 'crelan-footer-column',
        datasourceItem: "Thema's",
      },
      {
        definitionKey: 'crelan-footer-column',
        placeholder: 'footer-columns',
        datasourceItem: "Thema's",
      },
      {
        definitionKey: 'crelan-footer-column',
        datasourceItem: 'Ons aanbod',
      },
    ]);
    assert.equal(out.length, 2);
    assert.deepEqual(
      out.map((c) => c.datasourceItem),
      ["Thema's", 'Ons aanbod'],
    );
  });
});

describe('mergePartials secondary pages', () => {
  it('does not empty chrome partials when replaceChrome=false', () => {
    const existing = [
      {
        signature: 'header',
        definitionKey: 'crelan-main-menu',
        canHostChildren: true,
        children: [
          {
            definitionKey: 'crelan-header-navigation',
            placeholder: 'header-navigation',
            datasourceItem: 'Betalen',
          },
        ],
      },
      {
        signature: 'footer',
        definitionKey: 'crelan-footer-columns',
        canHostChildren: true,
        children: [
          {
            definitionKey: 'crelan-footer-link-column',
            placeholder: 'footer-navigation',
            datasourceItem: 'Themes',
          },
        ],
      },
    ];
    const incoming = [
      {
        signature: 'header',
        definitionKey: 'crelan-main-menu',
        canHostChildren: true,
        children: [],
      },
    ];
    const canHostMap = {
      'crelan-main-menu': true,
      'crelan-footer-columns': true,
    };
    const merged = mergePartials(existing, incoming, {
      replaceChrome: false,
      canHostMap,
    });
    const header = merged.find((p) => p.signature === 'header');
    assert.ok((header?.children || []).length >= 1);
    const footer = merged.find((p) => p.signature === 'footer');
    assert.ok((footer?.children || []).length >= 1);
  });
});

describe('buildAllowedControlsByPlaceholder no ghost item', () => {
  it('does not emit allowedControls item for empty bands when kids exist', () => {
    const byPh = buildAllowedControlsByPlaceholder(
      {
        children: [
          {
            definitionKey: 'crelan-footer-link-column',
            componentName: 'CrelanFooterLinkColumn',
            placeholder: 'footer-navigation',
          },
        ],
      },
      [
        'footer-signposts',
        'footer-navigation',
        'footer-social',
        'footer-legal',
      ],
    );
    assert.deepEqual(byPh['footer-navigation'], ['crelan-footer-link-column']);
    assert.ok(!byPh['footer-signposts'].includes('item'));
    assert.ok(!byPh['footer-social'].includes('item'));
    assert.ok(!byPh['footer-legal'].includes('item'));
  });
});

describe('mergeHeaderPartialEntries stamped canHost', () => {
  it('uses stamped canHostChildren without disk map', () => {
    const leaf = {
      signature: 'header',
      definitionKey: 'crelan-header',
      sectionIndex: 2,
      canHostChildren: false,
      children: [
        {
          definitionKey: 'crelan-navigation',
          placeholder: 'primary-navigation',
          datasourceItem: 'Nav',
        },
      ],
    };
    const host = {
      signature: 'header',
      definitionKey: 'crelan-main-menu',
      sectionIndex: 3,
      canHostChildren: true,
      placeholderKeys: ['primary-navigation', 'header-navigation'],
      children: [],
    };
    const merged = mergeHeaderPartialEntries(leaf, host);
    assert.equal(merged.definitionKey, 'crelan-main-menu');
    assert.ok(
      (merged.children || []).some((c) => c.definitionKey === 'crelan-navigation'),
    );
    assert.ok(!('placeholderKeys' in merged));
  });
});

describe('resolveSectionDesktopThumbnailRel', () => {
  it('prefers section-information outputs.desktop.path', () => {
    const rel = resolveSectionDesktopThumbnailRel(
      {
        folderName: 'section-01',
        outputs: {
          desktop: { path: 'sections/section-01/section-01-desktop.png' },
        },
      },
      'section-99',
    );
    assert.equal(rel, 'sections/section-01/section-01-desktop.png');
  });

  it('falls back to sections/{folder}/{folder}-desktop.png', () => {
    const rel = resolveSectionDesktopThumbnailRel(
      { folderName: 'section-06' },
      undefined,
    );
    assert.equal(rel, 'sections/section-06/section-06-desktop.png');
  });

  it('does not invent a path from section index alone', () => {
    const rel = resolveSectionDesktopThumbnailRel({ index: 0 }, undefined);
    assert.equal(rel, undefined);
  });
});

describe('partial thumbnail merge', () => {
  it('keeps winner thumbnail; siblingsBefore loser does not steal it', () => {
    const announcement = {
      signature: 'header',
      definitionKey: 'energyprice-announcement',
      sectionIndex: 0,
      canHostChildren: false,
      thumbnail: { path: 'sections/section-00/section-00-desktop.png' },
    };
    const mainNav = {
      signature: 'header',
      definitionKey: 'energyprice-multi-brand-header',
      sectionIndex: 1,
      canHostChildren: true,
      placeholderKeys: ['primary-navigation'],
      thumbnail: { path: 'sections/section-01/section-01-desktop.png' },
      children: [],
    };
    const merged = mergeHeaderPartialEntries(announcement, mainNav);
    assert.equal(merged.definitionKey, 'energyprice-multi-brand-header');
    assert.deepEqual(merged.thumbnail, {
      path: 'sections/section-01/section-01-desktop.png',
    });
    assert.ok(
      (merged.siblingsBefore || []).some(
        (s) => s.definitionKey === 'energyprice-announcement',
      ),
    );
    assert.ok(!(merged.siblingsBefore || []).some((s) => s.thumbnail));
  });

  it('refreshes thumbnail when a later host becomes the main root', () => {
    const early = {
      signature: 'header',
      definitionKey: 'energyprice-old-header',
      sectionIndex: 1,
      canHostChildren: true,
      placeholderKeys: ['primary-navigation'],
      thumbnail: { path: 'sections/section-01/section-01-desktop.png' },
      children: [],
    };
    const later = {
      signature: 'header',
      definitionKey: 'energyprice-multi-brand-header',
      sectionIndex: 2,
      canHostChildren: true,
      placeholderKeys: ['primary-navigation'],
      thumbnail: { path: 'sections/section-02/section-02-desktop.png' },
      children: [],
    };
    const merged = mergeHeaderPartialEntries(early, later);
    assert.equal(merged.definitionKey, 'energyprice-multi-brand-header');
    assert.deepEqual(merged.thumbnail, {
      path: 'sections/section-02/section-02-desktop.png',
    });
  });

  it('preserves footer winner thumbnail (not min/max section index scan)', () => {
    const earlyFooter = {
      signature: 'footer',
      definitionKey: 'energyprice-promo-band',
      sectionIndex: 5,
      canHostChildren: false,
      thumbnail: { path: 'sections/section-05/section-05-desktop.png' },
    };
    const siteFooter = {
      signature: 'footer',
      definitionKey: 'energyprice-site-footer',
      sectionIndex: 6,
      canHostChildren: true,
      placeholderKeys: ['footer-columns'],
      thumbnail: { path: 'sections/section-06/section-06-desktop.png' },
      children: [],
    };
    const merged = mergeFooterPartialEntries(earlyFooter, siteFooter);
    assert.equal(merged.definitionKey, 'energyprice-site-footer');
    assert.deepEqual(merged.thumbnail, {
      path: 'sections/section-06/section-06-desktop.png',
    });
  });
});
