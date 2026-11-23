/**
 * Persist BQ-managed brand kit id + draft under `.bq/captures/{host}/brandkit/`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const BRANDKIT_DIR_NAME = 'brandkit';
export const BRANDKIT_STATE_FILE = 'state.json';
export const BRANDKIT_DRAFT_FILE = 'draft.json';

/**
 * @param {string} hostProjectRoot
 */
export function brandkitDir(hostProjectRoot) {
  return path.join(hostProjectRoot, BRANDKIT_DIR_NAME);
}

/**
 * @param {string} hostProjectRoot
 */
export function brandkitStatePath(hostProjectRoot) {
  return path.join(brandkitDir(hostProjectRoot), BRANDKIT_STATE_FILE);
}

/**
 * @param {string} hostProjectRoot
 */
export function brandkitDraftPath(hostProjectRoot) {
  return path.join(brandkitDir(hostProjectRoot), BRANDKIT_DRAFT_FILE);
}

/**
 * @param {string} hostProjectRoot
 * @returns {Promise<object|null>}
 */
export async function readBrandkitState(hostProjectRoot) {
  try {
    return JSON.parse(await readFile(brandkitStatePath(hostProjectRoot), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} hostProjectRoot
 * @param {object} state
 */
export async function writeBrandkitState(hostProjectRoot, state) {
  const dir = brandkitDir(hostProjectRoot);
  await mkdir(dir, { recursive: true });
  const payload = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(
    brandkitStatePath(hostProjectRoot),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );
  return payload;
}

/**
 * @param {string} hostProjectRoot
 * @returns {Promise<object|null>}
 */
export async function readBrandkitDraft(hostProjectRoot) {
  try {
    return JSON.parse(await readFile(brandkitDraftPath(hostProjectRoot), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} hostProjectRoot
 * @param {object} draft
 */
export async function writeBrandkitDraft(hostProjectRoot, draft) {
  const dir = brandkitDir(hostProjectRoot);
  await mkdir(dir, { recursive: true });
  const payload = {
    ...draft,
    generatedAt: draft.generatedAt || new Date().toISOString(),
  };
  await writeFile(
    brandkitDraftPath(hostProjectRoot),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );
  return payload;
}

/**
 * Deterministic Stream brand kit display name.
 * @param {string} siteDisplayName
 */
export function brandKitNameForSite(siteDisplayName) {
  const base = String(siteDisplayName || '').trim() || 'Site';
  return `${base} Brand Kit`;
}
