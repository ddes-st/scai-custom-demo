/**
 * VF preview CSS must scan ephemeral workDir TSX (not only bq/src).
 * Run: node --test tools/create-section-components/visual-fidelity/preview-server.css-source.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';
import {
  clearPreviewGlobalsCssCache,
  compilePreviewGlobalsCss,
} from './preview-server.mjs';

describe('compilePreviewGlobalsCss extraSourceDirs', () => {
  /** @type {string} */
  let workDir;

  before(async () => {
    workDir = await mkdtemp(path.join(os.tmpdir(), 'bq-vf-css-'));
    // Use breakpoints/URLs unlikely to appear elsewhere in bq/src.
    await writeFile(
      path.join(workDir, 'UniquePreviewOnly.tsx'),
      `export const Default = () => (
  <div className="min-[913px]:w-1/3 after:bg-[url('https://example.com/ornament-unique.png')]">
    preview-only
  </div>
);
`,
      'utf8',
    );
  });

  after(async () => {
    clearPreviewGlobalsCssCache();
    await rm(workDir, { recursive: true, force: true });
  });

  it('emits utilities found only in extraSourceDirs', async () => {
    clearPreviewGlobalsCssCache();
    const withExtra = await compilePreviewGlobalsCss({
      extraSourceDirs: [workDir],
    });
    assert.match(withExtra, /913px/, 'expected min-[913px] utility from preview TSX');
    assert.match(
      withExtra,
      /ornament-unique\.png/,
      'expected ornament-unique.png background utility from preview TSX',
    );
  });

  it('caches by extraSourceDirs and returns the same string for the same key', async () => {
    clearPreviewGlobalsCssCache();
    const a = await compilePreviewGlobalsCss({ extraSourceDirs: [workDir] });
    const a2 = await compilePreviewGlobalsCss({ extraSourceDirs: [workDir] });
    assert.equal(a2, a);
    assert.ok(a.includes('ornament-unique.png'));
  });
});
