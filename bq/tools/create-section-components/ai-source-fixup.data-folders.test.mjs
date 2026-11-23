/**
 * Tests for ensureSpacedDataFolders.
 * Run: node --test tools/create-section-components/ai-source-fixup.data-folders.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ensureSpacedDataFolders, normalizeDefinitionTs } from './ai-source-fixup.mjs';
import { toSpacedDataFolderSegment } from './naming.mjs';

describe('toSpacedDataFolderSegment', () => {
  it('splits PascalCase plurals', () => {
    assert.equal(toSpacedDataFolderSegment('AdvisorSupportSplits'), 'Advisor Support Splits');
    assert.equal(toSpacedDataFolderSegment('AssistanceSplitPanels'), 'Assistance Split Panels');
  });

  it('keeps already-spaced Title Case', () => {
    assert.equal(toSpacedDataFolderSegment('Advisor Support Splits'), 'Advisor Support Splits');
  });

  it('preserves platform folders', () => {
    assert.equal(toSpacedDataFolderSegment('Link Lists'), 'Link Lists');
    assert.equal(toSpacedDataFolderSegment('Icon Link Lists'), 'Icon Link Lists');
    assert.equal(toSpacedDataFolderSegment('Image Link Lists'), 'Image Link Lists');
  });
});

describe('ensureSpacedDataFolders', () => {
  it('rewrites PascalCase folder arrays', () => {
    const src = `
  datasourceLocation: { scope: "site", root: "data", folder: ["AdvisorSupportSplits"] },
  content: {
    location: { root: "data", folder: ['AssistanceSplitPanels'] },
  }
`;
    const out = ensureSpacedDataFolders(src);
    assert.match(out, /folder: \["Advisor Support Splits"\]/);
    assert.match(out, /folder: \['Assistance Split Panels'\]/);
  });

  it('leaves Link Lists alone', () => {
    const src = `folder: ["Link Lists"]`;
    assert.equal(ensureSpacedDataFolders(src), src);
  });
});

describe('normalizeDefinitionTs data folders', () => {
  it('applies spaced folders in full normalize pass', () => {
    const src = `
export const xDefinition = {
  kind: "component",
  definitionKey: "advisor-support-split",
  name: "advisor-support-split",
  displayName: "Advisor Support Split",
  componentName: "AdvisorSupportSplit",
  datasourceLocation: { scope: "site", root: "data", folder: ["AdvisorSupportSplits"] },
  model: {
    folderTemplate: { name: "AdvisorSupportSplit Folder" },
    itemTemplate: { name: "AdvisorSupportSplit", sections: [] },
  },
  content: {
    location: { root: "data", folder: ["AdvisorSupportSplits"] },
    items: [],
  },
};
`;
    const out = normalizeDefinitionTs(src);
    assert.match(out, /folder: \["Advisor Support Splits"\]/);
    assert.doesNotMatch(out, /AdvisorSupportSplits/);
  });
});
