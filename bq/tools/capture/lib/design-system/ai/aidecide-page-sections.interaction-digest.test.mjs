/**
 * Unit tests for interactionStates digest used by AI enrich.
 * Run: node --test tools/capture/lib/design-system/ai/aidecide-page-sections.interaction-digest.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatInteractionStatesDigestForEnrich } from './aidecide-page-sections.mjs';

describe('formatInteractionStatesDigestForEnrich', () => {
  it('returns null for empty / missing states', () => {
    assert.equal(formatInteractionStatesDigestForEnrich(null), null);
    assert.equal(formatInteractionStatesDigestForEnrich(undefined), null);
    assert.equal(formatInteractionStatesDigestForEnrich([]), null);
    assert.equal(formatInteractionStatesDigestForEnrich('nope'), null);
  });

  it('compacts menu + tab fields without bulky outputs/mutation/html', () => {
    const digest = formatInteractionStatesDigestForEnrich([
      {
        kind: 'tab',
        slug: 'tab-a',
        label: 'A',
        depth: 0,
        trigger: { selector: '#tab-a', method: 'click' },
        panel: {
          selector: '#panel-a',
          htmlPath: 'sections/section-01/states/tab-a/section.html',
        },
        outputs: {
          desktop: {
            path: 'sections/section-01/states/tab-a/x-desktop.png',
            method: 'section-html',
          },
          mobile: { path: null },
        },
        mutation: { detection: 'heuristic', huge: 'blob' },
        sectionHtml: 'sections/section-01/states/tab-a/section.html',
      },
      {
        kind: 'menu',
        slug: 'menu-products',
        label: 'Products',
        depth: 2,
        narrowOnly: false,
        trigger: { selector: 'nav a.products', method: 'hover' },
        panel: { selector: '.mega-products' },
        outputs: {
          desktop: { path: 'sections/section-02/states/menu-products/d.png' },
          tablet: { path: 'sections/section-02/states/menu-products/t.png' },
        },
      },
    ]);

    assert.ok(Array.isArray(digest));
    assert.equal(digest.length, 2);
    // Menus ranked before tabs; deeper menu first among menus
    assert.equal(digest[0].kind, 'menu');
    assert.equal(digest[0].slug, 'menu-products');
    assert.equal(digest[0].trigger.method, 'hover');
    assert.equal(digest[0].trigger.selector, 'nav a.products');
    assert.equal(digest[0].panel.selector, '.mega-products');
    assert.deepEqual(digest[0].shots, ['tablet', 'desktop']);
    assert.equal(digest[0].narrowOnly, false);
    assert.equal(digest[0].mutation, undefined);
    assert.equal(digest[0].outputs, undefined);
    assert.equal(digest[0].sectionHtml, undefined);
    assert.equal(digest[0].panel.htmlPath, undefined);

    assert.equal(digest[1].kind, 'tab');
    assert.equal(digest[1].trigger.method, 'click');
    assert.deepEqual(digest[1].shots, ['desktop']);
  });

  it('caps at max and prefers deeper menus', () => {
    const states = [
      {
        kind: 'menu',
        slug: 'l1',
        depth: 1,
        trigger: { method: 'click' },
        panel: {},
        outputs: {},
      },
      {
        kind: 'menu',
        slug: 'l3',
        depth: 3,
        trigger: { method: 'hover' },
        panel: {},
        outputs: { desktop: { path: 'a.png' } },
      },
      {
        kind: 'accordion',
        slug: 'faq-1',
        depth: 0,
        narrowOnly: true,
        trigger: { selector: '#faq-1', method: 'click' },
        panel: { selector: '#faq-1-panel' },
        outputs: { mobile: { path: 'm.png' } },
      },
      {
        kind: 'tab',
        slug: 'tab-z',
        depth: 0,
        trigger: { method: 'click' },
        panel: {},
        outputs: {},
      },
    ];
    const digest = formatInteractionStatesDigestForEnrich(states, { max: 2 });
    assert.equal(digest.length, 2);
    assert.equal(digest[0].slug, 'l3');
    assert.equal(digest[1].slug, 'l1');
    assert.ok(!digest.some((d) => d.slug === 'faq-1' || d.slug === 'tab-z'));
  });

  it('preserves narrowOnly on hamburger-style menus', () => {
    const digest = formatInteractionStatesDigestForEnrich([
      {
        kind: 'menu',
        slug: 'menu-open',
        depth: 0,
        narrowOnly: true,
        trigger: { selector: '#mobile-menu-anchor', method: 'click' },
        panel: { selector: '#mobile-menu' },
        outputs: {
          mobile: { path: 'm.png' },
          tablet: { path: 't.png' },
          desktop: { path: null },
        },
      },
    ]);
    assert.equal(digest[0].narrowOnly, true);
    assert.deepEqual(digest[0].shots, ['mobile', 'tablet']);
  });
});
