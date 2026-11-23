/**
 * Mirrors bq/src/components/hooks/sticky-chrome-stack.ts (keep in sync).
 * Run: node --test tools/shared/sticky-chrome-insets.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {{ id: string, height: number, documentOrder: number }[]} layers
 * @returns {Map<string, number>}
 */
function computeStickyChromeInsets(layers) {
  const sorted = [...layers].sort((a, b) => {
    if (a.documentOrder !== b.documentOrder) {
      return a.documentOrder - b.documentOrder;
    }
    return a.id.localeCompare(b.id);
  });

  const insets = new Map();
  let running = 0;
  for (const layer of sorted) {
    insets.set(layer.id, running);
    const h = Number.isFinite(layer.height) && layer.height > 0 ? layer.height : 0;
    running += h;
  }
  return insets;
}

describe('computeStickyChromeInsets', () => {
  it('stacks insets and collapses when preceding height is 0', () => {
    const open = computeStickyChromeInsets([
      { id: 'a', height: 34, documentOrder: 0 },
      { id: 'b', height: 64, documentOrder: 1 },
    ]);
    assert.equal(open.get('a'), 0);
    assert.equal(open.get('b'), 34);

    const hidden = computeStickyChromeInsets([
      { id: 'a', height: 0, documentOrder: 0 },
      { id: 'b', height: 64, documentOrder: 1 },
    ]);
    assert.equal(hidden.get('b'), 0);
  });

  it('stays in sync with src sticky-chrome-stack.ts', async () => {
    const srcPath = path.resolve(
      __dirname,
      '../../src/components/hooks/sticky-chrome-stack.ts',
    );
    const src = await readFile(srcPath, 'utf8');
    assert.match(src, /export function computeStickyChromeInsets/);
    assert.match(src, /running \+= h/);
    assert.match(src, /export function stickyChromeStyle/);
  });
});
