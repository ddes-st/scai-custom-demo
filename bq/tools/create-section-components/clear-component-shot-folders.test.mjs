import assert from 'node:assert/strict';
import { mkdir, writeFile, access, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';
import { clearComponentShotFolders } from './clear-component-shot-folders.mjs';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

describe('clearComponentShotFolders', () => {
  /** @type {string} */
  let root;

  before(async () => {
    root = await mkdir(path.join(os.tmpdir(), `bq-clear-shots-${Date.now()}`), {
      recursive: true,
    });
  });

  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('removes flat visual-fidelity contents, leftover nested trees, and legacy visual-shots', async () => {
    const pageDir = path.join(root, 'page');
    const section = 'section-04';
    const vfRoot = path.join(pageDir, 'sections', section, 'visual-fidelity');
    const attemptShots = path.join(vfRoot, 'attempt-1', 'shots');
    const leftoverNested = path.join(vfRoot, 'LocalServicesAndNavigation', 'attempt-1', 'shots');
    const report = path.join(vfRoot, 'report.json');
    const visualShots = path.join(pageDir, 'sections', section, 'ai-debug', 'visual-shots');
    await mkdir(attemptShots, { recursive: true });
    await mkdir(leftoverNested, { recursive: true });
    await mkdir(visualShots, { recursive: true });
    await writeFile(path.join(attemptShots, 'candidate-desktop.png'), 'x');
    await writeFile(path.join(leftoverNested, 'candidate-desktop.png'), 'x');
    await writeFile(report, '{}');
    await writeFile(path.join(visualShots, 'candidate-desktop.png'), 'x');

    const removed = await clearComponentShotFolders({
      pageDir,
      sectionFolder: section,
      componentNames: ['LocalServicesAndNavigation'],
      log: false,
    });

    assert.ok(removed.length >= 3);
    assert.equal(await exists(path.join(vfRoot, 'attempt-1')), false);
    assert.equal(await exists(path.join(vfRoot, 'LocalServicesAndNavigation')), false);
    assert.equal(await exists(report), false);
    assert.equal(await exists(visualShots), false);
  });
});
