/**
 * Wipe stale visual-fidelity trees for a section before create /
 * fidelity AI so new runs do not mix with old screenshots.
 * One VF tree per section (attempt-*, sitecoreize-proof, report.json) —
 * also removes leftover nested visual-fidelity/<OldName>/ folders.
 * Also removes legacy ai-debug/visual-shots if present.
 */
import { access, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   pageDir: string,
 *   sectionFolder: string,
 *   componentNames?: string[]|null,
 *   log?: boolean,
 * }} opts
 * @returns {Promise<string[]>} absolute paths removed
 */
export async function clearComponentShotFolders(opts) {
  const pageDir = String(opts?.pageDir || '').trim();
  const sectionFolder = String(opts?.sectionFolder || '').trim();
  if (!pageDir || !sectionFolder) return [];

  const sectionAbs = path.join(pageDir, 'sections', sectionFolder);
  /** @type {string[]} */
  const removed = [];

  const v3Shots = path.join(sectionAbs, 'ai-debug', 'visual-shots');
  if (await exists(v3Shots)) {
    await rm(v3Shots, { recursive: true, force: true });
    removed.push(v3Shots);
  }

  const vfRoot = path.join(sectionAbs, 'visual-fidelity');
  if (await exists(vfRoot)) {
    // Flat layout: attempt-*, sitecoreize-proof, report.json at vfRoot.
    // Also wipe leftover nested <Pascal>/ trees from older runs.
    let entries = [];
    try {
      entries = await readdir(vfRoot, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const e of entries) {
      const target = path.join(vfRoot, e.name);
      await rm(target, { recursive: true, force: true });
      removed.push(target);
    }
  }

  if (opts.log !== false && removed.length) {
    const rels = removed.map((p) => {
      try {
        return path.relative(pageDir, p).replace(/\\/g, '/');
      } catch {
        return p;
      }
    });
    console.log(`  · cleared shot folders: ${rels.join(', ')}`);
  }

  return removed;
}
