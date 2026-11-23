/**
 * Component-type → reference attachment selection.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FIELD_CATALOG_REFERENCE_REL,
  REFERENCE_TYPE_RELS,
  resolveReferenceRelsForCodegen,
  resolveReferenceTypeKeys,
} from './reference-types.mjs';

describe('resolveReferenceTypeKeys', () => {
  it('maps packageKind=navigation to navigation only', () => {
    assert.deepEqual(
      resolveReferenceTypeKeys({ packageKind: 'navigation', cmsName: 'Header' }),
      ['navigation'],
    );
  });

  it('maps responsive header pattern to header (+ nav when menu hints)', () => {
    const keys = resolveReferenceTypeKeys({
      layoutPattern: 'responsive-header-mega-menu',
      cmsName: 'SiteHeader',
    });
    assert.ok(keys.includes('header'));
    assert.ok(keys.includes('navigation'));
  });

  it('maps stacked footer to footer', () => {
    assert.deepEqual(
      resolveReferenceTypeKeys({ layoutPattern: 'stacked-footer' }),
      ['footer'],
    );
  });

  it('maps carousel / accordion / hero keywords', () => {
    assert.ok(
      resolveReferenceTypeKeys({ purpose: 'product carousel rail' }).includes(
        'carousel',
      ),
    );
    assert.ok(
      resolveReferenceTypeKeys({ cmsName: 'FaqAccordion' }).includes('accordion'),
    );
    assert.ok(
      resolveReferenceTypeKeys({ componentName: 'WelcomeHero' }).includes('hero'),
    );
  });

  it('falls back to content-section for generic section role', () => {
    assert.deepEqual(
      resolveReferenceTypeKeys({
        role: 'section',
        purpose: 'article body copy',
      }),
      ['content-section'],
    );
  });
});

describe('resolveReferenceRelsForCodegen', () => {
  it('always includes field catalog first', () => {
    const rels = resolveReferenceRelsForCodegen({
      layoutPattern: 'hero-banner',
      cmsName: 'Hero',
    });
    assert.equal(rels[0], FIELD_CATALOG_REFERENCE_REL);
    assert.ok(rels.includes(REFERENCE_TYPE_RELS.hero));
  });

  it('attaches Navigation.reference for navigation packageKind', () => {
    const rels = resolveReferenceRelsForCodegen({ packageKind: 'navigation' });
    assert.deepEqual(rels, [
      FIELD_CATALOG_REFERENCE_REL,
      REFERENCE_TYPE_RELS.navigation,
    ]);
  });

  it('has a file path for every catalog type key', () => {
    for (const [key, rel] of Object.entries(REFERENCE_TYPE_RELS)) {
      assert.match(rel, /\.reference\.tsx$/);
      assert.equal(typeof key, 'string');
    }
  });
});
