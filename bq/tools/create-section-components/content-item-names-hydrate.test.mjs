/**
 * Run: node --import tsx --test tools/create-section-components/content-item-names-hydrate.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { repoRoot } from '../capture/paths.mjs';
import {
  hydrateSiblingConversionComponents,
  resolveChildContentItemNames,
} from './content-item-names-hydrate.mjs';
import { ensureCompositePresentationChildren } from './presentation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEF_WITH_SEEDS = `
export const foo = {
  content: {
    items: [
      { name: 'Seed One', fields: {} },
      { name: 'Seed Two', fields: {} },
    ],
  },
};
`;

function makeRepoTemp(prefix) {
  const tmp = mkdtempSync(path.join(__dirname, prefix));
  const defRel = path.relative(repoRoot, path.join(tmp, 'live.definition.ts')).replace(/\\/g, '/');
  writeFileSync(path.join(tmp, 'live.definition.ts'), DEF_WITH_SEEDS, 'utf8');
  return { tmp, defRel };
}

describe('resolveChildContentItemNames', () => {
  it('prefers precomputed contentItemNames', () => {
    const out = resolveChildContentItemNames({
      contentItemNames: ['A', 'B'],
      sources: { definition: 'missing/path.definition.ts' },
    });
    assert.deepEqual(out.names, ['A', 'B']);
    assert.equal(out.packageMissing, false);
  });

  it('marks package missing when definition path is absent', () => {
    const out = resolveChildContentItemNames({
      definitionKey: 'ghost-child',
      contentItemNames: [],
    });
    assert.deepEqual(out.names, []);
    assert.equal(out.packageMissing, true);
  });
});

describe('hydrateSiblingConversionComponents', () => {
  it('drops missing packages and rehydrates empty seeds from definition', () => {
    const { tmp, defRel } = makeRepoTemp('.tmp-hydrate-');
    /** @type {string[]} */
    const warns = [];
    try {
      const out = hydrateSiblingConversionComponents(
        [
          { role: 'section', definitionKey: 'host' },
          {
            role: 'child',
            definitionKey: 'ghost-child',
            contentItemNames: [],
          },
          {
            role: 'child',
            definitionKey: 'live-child',
            contentItemNames: [],
            sources: { definition: defRel },
          },
        ],
        { warn: (m) => warns.push(String(m)) },
      );
      assert.equal(out.length, 2);
      assert.equal(out[0].definitionKey, 'host');
      assert.equal(out[1].definitionKey, 'live-child');
      assert.deepEqual(out[1].contentItemNames, ['Seed One', 'Seed Two']);
      assert.ok(warns.some((w) => /stale\/retired child "ghost-child"/i.test(w)));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('ensureCompositePresentationChildren stale vs empty seeds', () => {
  it('warns package missing for ghost children without claiming no contentItemNames', () => {
    /** @type {string[]} */
    const warns = [];
    const original = console.warn;
    console.warn = (...args) => warns.push(args.map(String).join(' '));
    try {
      const out = ensureCompositePresentationChildren(
        { definitionKey: 'menzis-help-and-health-content' },
        [
          { role: 'section', definitionKey: 'menzis-help-and-health-content' },
          {
            role: 'child',
            definitionKey: 'menzis-support-grid',
            contentItemNames: [],
          },
        ],
      );
      assert.equal(out.children, undefined);
      assert.ok(warns.some((w) => /package missing/i.test(w)));
      assert.equal(
        warns.some((w) => /has no contentItemNames/i.test(w)),
        false,
      );
    } finally {
      console.warn = original;
    }
  });

  it('rehydrates seeds from sources.definition when contentItemNames empty', () => {
    const { tmp, defRel } = makeRepoTemp('.tmp-ensure-');
    try {
      const out = ensureCompositePresentationChildren(
        { definitionKey: 'sitecore-card-grid' },
        [
          { role: 'section', definitionKey: 'sitecore-card-grid' },
          {
            role: 'child',
            definitionKey: 'sitecore-feature-tile',
            contentItemNames: [],
            sources: { definition: defRel },
          },
        ],
      );
      assert.equal(out.children?.length, 2);
      assert.equal(out.children[0].datasourceItem, 'Seed One');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
