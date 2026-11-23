/**
 * Orphan content seeds + composite childItemTemplate strip.
 * Run: node --test tools/create-section-components/ai-source-fixup.orphan-seeds.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeDefinitionTs,
  stripCompositeChildItemTemplate,
  stripOrphanContentFieldSeeds,
} from './ai-source-fixup.mjs';

const AWARDS_SHAPED = `
export const sitecoreAwardsLogoCarouselDefinition = {
  kind: "component",
  definitionKey: "sitecore-awards-logo-carousel",
  name: "sitecore-awards-logo-carousel",
  displayName: "Awards Logo Carousel",
  componentName: "SitecoreAwardsLogoCarousel",
  datasourceLocation: { scope: "site", root: "data", folder: ["Awards Logo Carousels"] },
  model: {
    folderTemplate: { name: "Awards Logo Carousel Folder" },
    itemTemplate: {
      name: "Awards Logo Carousel",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [],
        },
      ],
    },
    childItemTemplate: {
      name: "Recognition Badge",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Image", type: "Image" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [{ key: "awards-logo-carousel", allowedControls: ["sitecore-recognition-badge"] }],
  content: {
    location: { root: "data", folder: ["Awards Logo Carousels"] },
    culture: "en",
    items: [
      {
        name: "Awards Logo Carousel",
        displayName: "Awards Logo Carousel",
        fields: {
          Title: "Awards Logo Carousel"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
`;

const PARENT_WITH_HEADING = `
export const sitecoreHeroDefinition = {
  kind: "component",
  definitionKey: "sitecore-hero",
  name: "sitecore-hero",
  displayName: "Hero",
  componentName: "SitecoreHero",
  datasourceLocation: { scope: "site", root: "data", folder: ["Heroes"] },
  model: {
    folderTemplate: { name: "Hero Folder" },
    itemTemplate: {
      name: "Hero",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Heroes"] },
    culture: "en",
    items: [
      {
        name: "Hero",
        displayName: "Hero",
        fields: {
          Heading: "Welcome",
          Title: "Should Go",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
`;

const FAQ_SHAPED = `
export const sitecoreFaqDefinition = {
  kind: "component",
  definitionKey: "sitecore-faq",
  name: "sitecore-faq",
  displayName: "FAQ",
  componentName: "SitecoreFaq",
  datasourceLocation: { scope: "site", root: "data", folder: ["FAQs"] },
  model: {
    folderTemplate: { name: "FAQ Folder" },
    itemTemplate: {
      name: "FAQ",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
          ],
        },
      ],
    },
    childItemTemplate: {
      name: "FAQ Item",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Question", type: "Single-Line Text" },
            { name: "Answer", type: "Rich Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["FAQs"] },
    culture: "en",
    items: [
      {
        name: "FAQ",
        displayName: "FAQ",
        fields: {
          Heading: "Common questions",
        },
        children: [
          {
            name: "Item One",
            displayName: "Item One",
            fields: {
              Question: "What is this?",
              Answer: "<p>An answer</p>",
              Title: "Orphan on child",
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
`;

describe('stripCompositeChildItemTemplate', () => {
  it('strips childItemTemplate when placeholders have allowedControls', () => {
    const out = stripCompositeChildItemTemplate(AWARDS_SHAPED);
    assert.doesNotMatch(out, /childItemTemplate/);
    assert.match(out, /allowedControls/);
  });

  it('keeps childItemTemplate when placeholders is empty', () => {
    const out = stripCompositeChildItemTemplate(FAQ_SHAPED);
    assert.match(out, /childItemTemplate/);
    assert.match(out, /FAQ Item/);
  });
});

describe('stripOrphanContentFieldSeeds', () => {
  it('strips parent Title when itemTemplate has no fields', () => {
    // After composite strip, Title is orphan against empty itemTemplate
    let text = stripCompositeChildItemTemplate(AWARDS_SHAPED);
    text = stripOrphanContentFieldSeeds(text);
    assert.doesNotMatch(text, /Title:\s*"Awards Logo Carousel"/);
    assert.match(text, /name:\s*"Awards Logo Carousel"/);
  });

  it('keeps Heading and strips unknown Title on parent', () => {
    const out = stripOrphanContentFieldSeeds(PARENT_WITH_HEADING);
    assert.match(out, /Heading:\s*"Welcome"/);
    assert.doesNotMatch(out, /Title:\s*"Should Go"/);
  });

  it('keeps FAQ childItemTemplate fields; strips nested orphan Title', () => {
    const out = stripOrphanContentFieldSeeds(FAQ_SHAPED);
    assert.match(out, /childItemTemplate/);
    assert.match(out, /Question:\s*"What is this\?"/);
    assert.match(out, /Answer:\s*"<p>An answer<\/p>"/);
    assert.doesNotMatch(out, /Title:\s*"Orphan on child"/);
    assert.match(out, /Heading:\s*"Common questions"/);
  });
});

describe('normalizeDefinitionTs orphan + composite guards', () => {
  it('Awards-shaped: strips Title seed and childItemTemplate', () => {
    const out = normalizeDefinitionTs(AWARDS_SHAPED, {
      definitionKey: 'sitecore-awards-logo-carousel',
      componentName: 'SitecoreAwardsLogoCarousel',
      skipParseAssert: true,
    });
    assert.doesNotMatch(out, /childItemTemplate/);
    assert.doesNotMatch(out, /Title:\s*"Awards Logo Carousel"/);
    assert.match(out, /placeholders:\s*\[\s*\{\s*key:\s*"awards-logo-carousel"/);
  });

  it('FAQ-shaped: keeps childItemTemplate and valid nested seeds', () => {
    const out = normalizeDefinitionTs(FAQ_SHAPED, {
      definitionKey: 'sitecore-faq',
      componentName: 'SitecoreFaq',
      skipParseAssert: true,
    });
    assert.match(out, /childItemTemplate/);
    assert.match(out, /Question:\s*"What is this\?"/);
    assert.doesNotMatch(out, /Title:\s*"Orphan on child"/);
  });
});
