/**
 * Shared section-codegen helpers (design prefix + reference examples).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPageSharedDesignPrefixV2,
  CODEGEN_V2_DEFAULT_REFERENCE_REL,
  CODEGEN_V2_NAV_REFERENCE_RELS,
  formatCodegenReferenceExamplesForPrompt,
  resolveCodegenMaxDepth,
  BQ_CODEGEN_MAX_DEPTH,
} from './ai-codegen.mjs';

describe('resolveCodegenMaxDepth', () => {
  it('defaults to 2 and clamps 1-4', () => {
    assert.equal(resolveCodegenMaxDepth({}), 2);
    assert.equal(resolveCodegenMaxDepth({ [BQ_CODEGEN_MAX_DEPTH]: '3' }), 3);
    assert.equal(resolveCodegenMaxDepth({ [BQ_CODEGEN_MAX_DEPTH]: '0' }), 2);
    assert.equal(resolveCodegenMaxDepth({ [BQ_CODEGEN_MAX_DEPTH]: '9' }), 2);
  });
});

describe('buildPageSharedDesignPrefixV2', () => {
  it('omits ai-derived-design and content families', () => {
    const text = buildPageSharedDesignPrefixV2({
      collectionSystem: 'crelan',
      hostSlug: 'crelan-be',
      siteUrl: 'https://www.crelan.be/nl/particulieren',
    });
    assert.match(text, /collectionSystem: crelan/);
    assert.match(text, /hostSlug: crelan-be/);
    assert.doesNotMatch(text, /ai-derived-design/);
    assert.doesNotMatch(text, /content.families/i);
  });
});

describe('formatCodegenReferenceExamplesForPrompt', () => {
  it('embeds field catalog for default', async () => {
    const text = await formatCodegenReferenceExamplesForPrompt('default');
    assert.match(text, /Do NOT copy Tailwind/);
    assert.match(text, /intentionally unstyled/);
    assert.match(
      text,
      new RegExp(CODEGEN_V2_DEFAULT_REFERENCE_REL.replace(/\./g, '\\.')),
    );
    assert.match(text, /FieldCatalog\.reference/);
  });

  it('embeds Navigation.reference for navigation', async () => {
    const text = await formatCodegenReferenceExamplesForPrompt('navigation');
    assert.match(text, /packageKind=navigation/);
    assert.match(text, /FieldCatalog\.reference/);
    for (const rel of CODEGEN_V2_NAV_REFERENCE_RELS) {
      assert.match(text, new RegExp(rel.replace(/\./g, '\\.')));
    }
    assert.doesNotMatch(text, /navHelpers\.tsx/);
  });

  it('attaches type reference when layout hints are provided', async () => {
    const text = await formatCodegenReferenceExamplesForPrompt({
      packageKind: 'default',
      layoutPattern: 'stacked-footer',
      cmsName: 'SiteFooter',
    });
    assert.match(text, /Footer\.reference\.tsx/);
    assert.match(text, /FieldCatalog\.reference/);
  });
});
