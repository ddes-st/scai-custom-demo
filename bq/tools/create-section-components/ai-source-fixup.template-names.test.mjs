/**
 * Run: node --test tools/create-section-components/ai-source-fixup.template-names.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureSpacedTemplateNames,
  stripBrandFromSitecoreStructuralNames,
} from './ai-source-fixup.mjs';

describe('ensureSpacedTemplateNames', () => {
  it('ignores Gartner-style displayName and uses unbranded componentName stem', () => {
    const src = `
export const x = {
  displayName: "Sitecore named a Leader in the 2026 Gartner® Magic Quadrant for Content Marketing Platforms™",
  componentName: "SitecoreRecognitionCards",
  model: {
    folderTemplate: { name: "Wrong Folder" },
    itemTemplate: { name: "Wrong" },
  },
};
`;
    const out = ensureSpacedTemplateNames(src, 'Sitecore');
    assert.match(out, /itemTemplate:\s*\{\s*name:\s*"Recognition Cards"/);
    assert.match(out, /folderTemplate:\s*\{\s*name:\s*"Recognition Cards Folder"/);
  });

  it('keeps short displayName stems', () => {
    const src = `
export const x = {
  displayName: "Recognition Cards",
  componentName: "SitecoreRecognitionCards",
  model: {
    folderTemplate: { name: "X Folder" },
    itemTemplate: { name: "X" },
  },
};
`;
    const out = ensureSpacedTemplateNames(src, 'Sitecore');
    assert.match(out, /itemTemplate:\s*\{\s*name:\s*"Recognition Cards"/);
  });

  it('strips Menzis from template stem when codePrefix set', () => {
    const src = `
export const x = {
  displayName: "Introduction Hero",
  componentName: "MenzisIntroductionHero",
  model: {
    folderTemplate: { name: "Menzis Introduction Hero Folder" },
    itemTemplate: { name: "Menzis Introduction Hero" },
  },
};
`;
    const out = ensureSpacedTemplateNames(src, 'Menzis');
    assert.match(out, /itemTemplate:\s*\{\s*name:\s*"Introduction Hero"/);
    assert.match(
      out,
      /folderTemplate:\s*\{\s*name:\s*"Introduction Hero Folder"/,
    );
  });

  it('preserves shared Link List template names on platform Link Lists folder', () => {
    const src = `
export const x = {
  displayName: "Footer Quick Link List",
  componentName: "MenzisFooterQuickLinkList",
  datasourceLocation: { scope: "site", root: "data", folder: ["Link Lists"] },
  model: {
    folderTemplate: { name: "Link List Folder" },
    itemTemplate: { name: "Link List" },
  },
  content: { location: { root: "data", folder: ["Link Lists"] } },
};
`;
    const out = ensureSpacedTemplateNames(src, 'Menzis');
    assert.match(out, /itemTemplate:\s*\{\s*name:\s*"Link List"/);
    assert.match(out, /folderTemplate:\s*\{\s*name:\s*"Link List Folder"/);
    assert.doesNotMatch(out, /itemTemplate:\s*\{\s*name:\s*"Footer Quick Link List"/);
  });
});

describe('stripBrandFromSitecoreStructuralNames', () => {
  it('strips leading brand from templates, folders, items, fields; keeps FE identity', () => {
    const src = `
export const menzisIntroductionHeroDefinition = {
  definitionKey: 'menzis-introduction-hero',
  componentName: 'MenzisIntroductionHero',
  displayName: 'Introduction Hero',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Menzis Section 03'] },
  model: {
    folderTemplate: { name: 'Menzis Introduction Hero Folder' },
    itemTemplate: {
      name: 'Menzis Introduction Hero',
      sections: [
        { name: 'Content', fields: [{ name: 'MenzisHeroImage', type: 'Image' }] },
      ],
    },
  },
  content: {
    location: { root: 'data', folder: ['Menzis Section 03'] },
    items: [
      { name: 'Menzis Introduction Hero', fields: { Heading: 'Hulp bij Menzis' } },
      { name: 'Anderzorg becomes Menzis', fields: { Heading: 'x' } },
    ],
  },
};
`;
    const out = stripBrandFromSitecoreStructuralNames(src, 'Menzis');
    assert.match(out, /componentName:\s*'MenzisIntroductionHero'/);
    assert.match(out, /definitionKey:\s*'menzis-introduction-hero'/);
    assert.match(out, /itemTemplate:\s*\{[\s\S]*?name:\s*'Introduction Hero'/);
    assert.match(
      out,
      /folderTemplate:\s*\{\s*name:\s*'Introduction Hero Folder'/,
    );
    assert.match(out, /folder:\s*\['Section 03'\]/);
    assert.match(out, /\{\s*name:\s*'Introduction Hero',\s*fields:/);
    assert.match(out, /\{\s*name:\s*'Anderzorg Becomes Menzis',\s*fields:/);
    assert.match(out, /name:\s*'Hero Image'\s*,\s*type:\s*'Image'/);
    assert.match(out, /Heading:\s*'Hulp bij Menzis'/);
  });
});
