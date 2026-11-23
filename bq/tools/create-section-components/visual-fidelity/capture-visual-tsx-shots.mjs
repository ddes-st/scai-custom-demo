/**
 * Playwright-capture visual-only TSX (pre-Sitecoreize). Shots only — no score gate.
 * Writes under sections/<section>/visual-fidelity/attempt-1/shots/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { logVerbose } from '../create-log.mjs';
import { captureAndCompare } from './capture-and-compare.mjs';
import {
  buildStandaloneTsxPreview,
  cleanupWorkDir,
  startPreviewServer,
} from './preview-server.mjs';

/**
 * @param {{
 *   pageDir: string,
 *   sectionFolder: string,
 *   visualTsx: string,
 *   componentName: string,
 *   info?: object|null,
 *   aiDebugRoot?: string|null,
 * }} opts
 * @returns {Promise<{ ok: boolean, outDir: string, notes: string }>}
 */
export async function captureVisualTsxShots(opts) {
  const {
    pageDir,
    sectionFolder,
    visualTsx,
    componentName,
    info = null,
  } = opts || {};

  if (!pageDir || !sectionFolder || !String(visualTsx || '').trim()) {
    return {
      ok: false,
      outDir: '',
      notes:
        'captureVisualTsxShots requires pageDir, sectionFolder, and visualTsx',
    };
  }

  const name = String(componentName || 'Visual')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 80);
  const attemptDir = path.join(
    pageDir,
    'sections',
    sectionFolder,
    'visual-fidelity',
    'attempt-1',
  );
  const shotsDir = path.join(attemptDir, 'shots');
  const workDir = path.join(attemptDir, 'preview');
  await mkdir(shotsDir, { recursive: true });
  await mkdir(workDir, { recursive: true });

  const tsxPath = path.join(workDir, `${name}.tsx`);
  await writeFile(
    tsxPath,
    visualTsx.endsWith('\n') ? visualTsx : `${visualTsx}\n`,
    'utf8',
  );

  let server;
  /** @type {Record<string, object>} */
  let captureResults = {};
  try {
    logVerbose(`  · visual TSX shots: bundling ${name}…`);
    await buildStandaloneTsxPreview({ workDir, tsxPath });
    server = await startPreviewServer(workDir);
    logVerbose(`  · visual TSX shots: preview at ${server.baseUrl}`);
    captureResults = await captureAndCompare({
      baseUrl: server.baseUrl,
      pageDir,
      sectionFolder,
      info: info || {},
      outDir: shotsDir,
    });
  } catch (err) {
    const notes = `visual TSX shots failed: ${err?.message || err}`;
    console.warn(`  ⚠ ${notes}`);
    if (server) await server.close().catch(() => {});
    await cleanupWorkDir(workDir);
    return { ok: false, outDir: shotsDir, notes };
  } finally {
    if (server) await server.close().catch(() => {});
    await cleanupWorkDir(workDir);
  }

  const shotCount = Object.keys(captureResults || {}).length;
  const notes =
    shotCount > 0
      ? `visual TSX shots: ${shotCount} viewport(s) → ${shotsDir}`
      : `visual TSX shots: no files written → ${shotsDir}`;
  console.log(`  · ${notes}`);
  return { ok: shotCount > 0, outDir: shotsDir, notes };
}
