/**
 * Capture rendered TSX preview screenshots (Playwright) without AI scoring.
 * Used when BQ_VISUAL_FIDELITY is off but shots are still wanted.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { logVerbose } from '../create-log.mjs';
import { loadComponentPackages } from './compose-tree.mjs';
import { captureAndCompare } from './capture-and-compare.mjs';
import {
  buildPreviewBundle,
  cleanupWorkDir,
  startPreviewServer,
} from './preview-server.mjs';

/**
 * Compose + preview + Playwright shots for a section/parent package.
 * Does not call scoreRenderedAgainstRefs.
 *
 * @param {{
 *   pageDir: string,
 *   sectionFolder: string,
 *   info: object,
 *   hostSlug: string,
 *   componentName: string,
 *   childComponentNames?: string[],
 *   instancePlan?: Array<{ componentName: string, datasourceItem?: string, placeholder?: string }>|null,
 *   layoutSketch?: object|null,
 *   placeholderKey?: string|null,
 *   plan?: object|null,
 *   attempt?: number,
 *   outSubdir?: string|null,
 * }} opts
 * @returns {Promise<{
 *   ok: boolean,
 *   outDir: string,
 *   captureResults: Record<string, object>,
 *   notes: string,
 * }>}
 */
export async function captureRenderedPreview(opts) {
  const {
    pageDir,
    sectionFolder,
    info,
    hostSlug,
    componentName,
    plan = null,
  } = opts;
  if (!pageDir || !sectionFolder || !componentName || !hostSlug) {
    return {
      ok: false,
      outDir: '',
      captureResults: {},
      notes: 'capture requires pageDir, sectionFolder, componentName, hostSlug',
    };
  }

  const attempt = Math.max(1, Math.trunc(Number(opts.attempt) || 1));
  // One VF tree per section — do not nest under component Pascal name.
  const outRoot = path.join(
    pageDir,
    'sections',
    sectionFolder,
    'visual-fidelity',
  );
  // outSubdir (e.g. sitecoreize-proof) avoids colliding with pre-sitecoreize attempt-*.
  const rawSubdir = opts.outSubdir != null ? String(opts.outSubdir).trim() : '';
  const leafDir = rawSubdir
    ? path.join(outRoot, rawSubdir)
    : path.join(outRoot, `attempt-${attempt}`);
  const shotsDir = path.join(leafDir, 'shots');
  await mkdir(shotsDir, { recursive: true });

  let tree;
  try {
    tree = await loadComponentPackages({
      hostSlug,
      parentComponentName: componentName,
      childComponentNames: opts.childComponentNames || [],
      instancePlan: opts.instancePlan || null,
      layoutSketch: opts.layoutSketch || null,
      placeholderKey:
        opts.placeholderKey || plan?.section?.placeholderKey || null,
    });
  } catch (err) {
    const notes = `compose failed: ${err?.message || err}`;
    console.warn(`  ⚠ Visual capture: ${notes} (${componentName})`);
    return { ok: false, outDir: shotsDir, captureResults: {}, notes };
  }

  const workDir = path.join(leafDir, 'preview');
  let server;
  /** @type {Record<string, object>} */
  let captureResults = {};
  try {
    logVerbose(`  · Visual capture ${componentName}: building preview…`);
    await buildPreviewBundle({ workDir, tree });
    server = await startPreviewServer(workDir);
    logVerbose(
      `  · Visual capture ${componentName}: preview ready at ${server.baseUrl} — capturing…`,
    );
    captureResults = await captureAndCompare({
      baseUrl: server.baseUrl,
      pageDir,
      sectionFolder,
      info,
      outDir: shotsDir,
    });
  } catch (err) {
    const notes = `render failed: ${err?.message || err}`;
    console.warn(`  ⚠ Visual capture: ${notes} (${componentName})`);
    if (server) await server.close().catch(() => {});
    await cleanupWorkDir(workDir);
    return { ok: false, outDir: shotsDir, captureResults: {}, notes };
  } finally {
    if (server) await server.close().catch(() => {});
    await cleanupWorkDir(workDir);
  }

  const shotCount = Object.keys(captureResults || {}).length;
  const notes =
    shotCount > 0
      ? `captured ${shotCount} viewport(s) → ${shotsDir}`
      : `no shots written → ${shotsDir}`;
  return {
    ok: shotCount > 0,
    outDir: shotsDir,
    captureResults: captureResults || {},
    notes,
  };
}
