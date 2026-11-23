/**
 * Preview TSX under paths outside bq/ (e.g. .bq/captures) must resolve bare
 * packages like lucide-react from bq/node_modules.
 * Run: node --test tools/create-section-components/visual-fidelity/preview-server.bq-resolve.test.mjs
 */
import assert from 'node:assert/strict';
import { access, mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { bqRoot } from '../../capture/paths.mjs';
import {
  buildStandaloneTsxPreview,
  clearPreviewGlobalsCssCache,
  cleanupWorkDir,
} from './preview-server.mjs';

describe('buildStandaloneTsxPreview bq package resolve', () => {
  /** @type {string} */
  let workDir;

  before(async () => {
    // Temp dir outside bq/ — same layout class as .bq/captures/.../preview
    const repoRoot = path.resolve(bqRoot, '..');
    workDir = await mkdtemp(path.join(repoRoot, '.bq', 'tmp-vf-bq-resolve-'));
    const underBq = path
      .resolve(workDir)
      .toLowerCase()
      .startsWith(path.resolve(bqRoot).toLowerCase() + path.sep);
    assert.equal(underBq, false, 'workDir must not live under bq/');
  });

  after(async () => {
    clearPreviewGlobalsCssCache();
    await cleanupWorkDir(workDir).catch(() => {});
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  });

  it('bundles lucide-react from a workDir outside bq/', async () => {
    const tsxPath = path.join(workDir, 'LucideSmoke.tsx');
    await writeFile(
      tsxPath,
      `import { ChevronDown } from 'lucide-react';

export function Default() {
  return (
    <div data-testid="lucide-smoke">
      <ChevronDown aria-hidden />
      smoke
    </div>
  );
}
`,
      'utf8',
    );

    clearPreviewGlobalsCssCache();
    const result = await buildStandaloneTsxPreview({ workDir, tsxPath });
    assert.equal(result.workDir, workDir);
    await access(result.jsPath);
    await access(result.htmlPath);
  });
});
