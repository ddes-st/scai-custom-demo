/**
 * Regression: inject missing chrome content seeds from suggestedFields.
 * Run: node --test tools/create-section-components/ai-source-fixup.content-seeds.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  injectMissingContentSeedsFromSuggestedFields,
  normalizeDefinitionTs,
} from './ai-source-fixup.mjs';

const FOOTER_DEF = `
export const sitecoreGlobalFooterDefinition = {
  kind: "component",
  definitionKey: "sitecore-global-footer",
  name: "sitecore-global-footer",
  displayName: "Global Footer",
  componentName: "SitecoreGlobalFooter",
  datasourceLocation: { scope: "site", root: "data", folder: ["Global Footer"] },
  model: {
    folderTemplate: { name: "Global Footer Folder" },
    itemTemplate: {
      name: "Global Footer",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Description", type: "Rich Text" },
            { name: "Primary CTA", type: "General Link" },
            { name: "Secondary CTA", type: "General Link" },
            { name: "Logo", type: "Image" },
            { name: "Copyright", type: "Single-Line Text" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  content: {
    location: { root: "data", folder: ["Global Footer"] },
    culture: "en",
    items: [
      {
        name: "Global Footer",
        displayName: "Own the moments that matter.",
        fields: {
          Heading: "Own the moments that matter.",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
`;

const FOOTER_INFO = {
  heading: 'Own the moments that matter.',
  suggestedFields: [
    {
      name: 'heading',
      type: 'text',
      value: 'Own the moments that matter.',
    },
    {
      name: 'description',
      type: 'richText',
      value:
        '<p>Now you can close the loop between visibility and action.</p>',
    },
    {
      name: 'logo',
      type: 'image',
      value: {
        src: 'https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/logo.png',
        alt: 'Sitecore Corporate Logo',
      },
    },
    {
      name: 'copyright',
      type: 'text',
      value: '© Copyright 2026, Sitecore A/S',
    },
    {
      name: 'conversionActions',
      type: 'array',
      value: [
        {
          link: {
            text: 'Request a demo',
            url: 'https://www.sitecore.com/request-a-demo',
          },
        },
        {
          link: {
            text: 'Contact us',
            url: 'https://www.sitecore.com/company/contact-us',
          },
        },
      ],
    },
  ],
};

const HERO_DEF = `
export const axaHeroBannerDefinition = {
  kind: "component",
  definitionKey: "axa-hero-banner",
  name: "axa-hero-banner",
  componentName: "AxaHeroBanner",
  model: {
    itemTemplate: {
      name: "Hero Banner",
      sections: [
        {
          name: "Data",
          fields: [
            { name: "Headline", type: "Single-Line Text" },
            { name: "Description", type: "Rich Text" },
            { name: "Primary CTA", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  content: {
    culture: "nl-BE",
    items: [
      {
        name: "Hero Banner",
        fields: {
          Headline: "Verzeker wat telt",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
`;

const HERO_INFO = {
  heading: 'Verzeker wat telt',
  suggestedFields: [
    { name: 'headline', type: 'text', value: 'Verzeker wat telt' },
    {
      name: 'description',
      type: 'richText',
      value: '<p>Persoonlijke verzekeringen voor jou en je gezin.</p>',
    },
    {
      name: 'primaryCta',
      type: 'link',
      value: {
        text: 'Bereken je premie',
        url: 'https://www.axa.be/premie',
      },
    },
  ],
};

describe('injectMissingContentSeedsFromSuggestedFields', () => {
  /** @param {string} source */
  function contentFieldsBlock(source) {
    const m = String(source).match(
      /content\s*:\s*\{[\s\S]*?items\s*:\s*\[[\s\S]*?fields\s*:\s*\{([\s\S]*?)\n\s*\}/,
    );
    assert.ok(m, 'expected content.items[].fields block');
    return m[1];
  }

  it('fills footer chrome fields from suggestedFields + conversionActions', () => {
    const out = injectMissingContentSeedsFromSuggestedFields(
      FOOTER_DEF,
      FOOTER_INFO,
    );
    const fields = contentFieldsBlock(out);
    assert.match(fields, /Description:\s*"<p>Now you can close the loop/);
    assert.match(fields, /"Primary CTA":\s*\{\s*text:\s*"Request a demo"/);
    assert.match(fields, /"Secondary CTA":\s*\{\s*text:\s*"Contact us"/);
    assert.match(fields, /Copyright:\s*"© Copyright 2026/);
    assert.match(fields, /Logo:\s*\{\s*url:\s*"https:\/\/delivery-sitecore/);
  });

  it('fills non-footer hero Description + Primary CTA (generic)', () => {
    const out = injectMissingContentSeedsFromSuggestedFields(HERO_DEF, HERO_INFO);
    const fields = contentFieldsBlock(out);
    assert.match(fields, /Description:\s*"<p>Persoonlijke verzekeringen/);
    assert.match(
      fields,
      /"Primary CTA":\s*\{\s*text:\s*"Bereken je premie".*url:\s*"https:\/\/www\.axa\.be\/premie"/s,
    );
  });

  it('skips pure link-list rows without chrome heading keys', () => {
    const linkList = FOOTER_DEF.replace(
      'fields: {\n          Heading: "Own the moments that matter.",\n        }',
      'fields: {\n          Link: { text: "Platform", url: "https://www.sitecore.com/platform" },\n        }',
    );
    const out = injectMissingContentSeedsFromSuggestedFields(
      linkList,
      FOOTER_INFO,
    );
    const fields = contentFieldsBlock(out);
    assert.doesNotMatch(fields, /Description:/);
    assert.doesNotMatch(fields, /"Primary CTA":/);
    assert.match(fields, /Link:\s*\{/);
  });

  it('never invents placeholder CTAs when capture has no actions', () => {
    const info = {
      suggestedFields: [
        { name: 'heading', type: 'text', value: 'Own the moments that matter.' },
      ],
    };
    const out = injectMissingContentSeedsFromSuggestedFields(FOOTER_DEF, info);
    const fields = contentFieldsBlock(out);
    assert.doesNotMatch(fields, /"Primary CTA":/);
    assert.doesNotMatch(fields, /"Secondary CTA":/);
  });

  it('normalizeDefinitionTs applies inject for footer-shaped seeds when salvage on', () => {
    const out = normalizeDefinitionTs(FOOTER_DEF, {
      definitionKey: 'sitecore-global-footer',
      componentName: 'SitecoreGlobalFooter',
      sectionInfo: FOOTER_INFO,
      allowSeedSalvage: true,
      skipParseAssert: true,
    });
    const fields = contentFieldsBlock(out);
    assert.match(fields, /Description:/);
    assert.match(fields, /"Primary CTA":/);
    assert.match(fields, /"Secondary CTA":/);
    assert.match(fields, /Copyright:/);
  });
});
