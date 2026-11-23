/**
 * Unit tests for ensureCompositeParentContentSeed.
 * Run: node --test tools/create-section-components/ai-source-fixup.composite-parent-seed.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureCompositeParentContentSeed,
  normalizeDefinitionTs,
} from './ai-source-fixup.mjs';

const COMPOSITE_WITH_HEADING = `
export const sitecoreFeatureCardCarouselDefinition = {
  kind: "component",
  definitionKey: "sitecore-feature-card-carousel",
  name: "sitecore-feature-card-carousel",
  displayName: "Feature Card Carousel",
  componentName: "SitecoreFeatureCardCarousel",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Sitecore Feature Card Carousels"],
  },
  model: {
    folderTemplate: { name: "Feature Card Carousel Folder" },
    itemTemplate: {
      name: "Feature Card Carousel",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [{ name: "Heading", type: "Single-Line Text" }],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [{ key: "capability-items", allowedControls: ["sitecore-capability-card"] }],
} satisfies ComponentTemplateDefinition;
`;

describe('ensureCompositeParentContentSeed', () => {
  it('injects content.items when placeholders + Heading field exist', () => {
    const out = ensureCompositeParentContentSeed(COMPOSITE_WITH_HEADING, {
      sectionInfo: { heading: 'Win the AI-first buyer' },
      planMode: 'composite',
    });
    assert.match(out, /content\s*:\s*\{/);
    assert.match(out, /items\s*:\s*\[/);
    assert.match(out, /name:\s*"Feature Card Carousel"/);
    assert.match(out, /Heading:\s*"Win the AI-first buyer"/);
    assert.match(out, /folder:\s*\["Sitecore Feature Card Carousels"\]/);
  });

  it('is a no-op when content.items already present', () => {
    const withContent = COMPOSITE_WITH_HEADING.replace(
      'placeholders:',
      `content: {
    location: { root: "data", folder: ["Sitecore Feature Card Carousels"] },
    culture: "en",
    items: [{ name: "Existing", fields: { Heading: "Keep" } }],
  },
  placeholders:`,
    );
    const out = ensureCompositeParentContentSeed(withContent, {
      sectionInfo: { heading: 'Other' },
    });
    assert.match(out, /Heading:\s*"Keep"/);
    assert.doesNotMatch(out, /Win the AI/);
  });

  it('skips when itemTemplate has no Heading/Title', () => {
    const noHeading = COMPOSITE_WITH_HEADING.replace(
      'fields: [{ name: "Heading", type: "Single-Line Text" }]',
      'fields: []',
    );
    const out = ensureCompositeParentContentSeed(noHeading, {
      planMode: 'composite',
      sectionInfo: { heading: 'Ignored' },
    });
    assert.doesNotMatch(out, /content\s*:\s*\{/);
  });

  it('normalizeDefinitionTs applies the seed for composites', () => {
    const out = normalizeDefinitionTs(COMPOSITE_WITH_HEADING, {
      definitionKey: 'sitecore-feature-card-carousel',
      componentName: 'SitecoreFeatureCardCarousel',
      planMode: 'composite',
      sectionInfo: { heading: 'Capability heading' },
      skipParseAssert: true,
    });
    assert.match(out, /Heading:\s*"Capability heading"/);
    assert.match(out, /content\s*:\s*\{[\s\S]*items\s*:\s*\[/);
  });
});
