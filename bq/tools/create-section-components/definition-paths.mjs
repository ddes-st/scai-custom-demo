/**
 * Paths for collection / site / site-presentation *.definition.ts files.
 *
 * Canonical location: `src/components/{hostSlug}/` (same folder as FE components).
 * Legacy locations (`components/collections/`, `components/sites/`) are still
 * resolved when reading; writers prefer the host folder and may unlink legacy.
 */
import { access } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot } from '../capture/paths.mjs';
import { hostToHostSlugFolder } from './naming.mjs';

const COMPONENTS_ROOT = path.join(bqRoot, 'src', 'components');
const LEGACY_COLLECTIONS_DIR = path.join(COMPONENTS_ROOT, 'collections');
const LEGACY_SITES_DIR = path.join(COMPONENTS_ROOT, 'sites');

/**
 * @param {string} hostSlug
 * @returns {string}
 */
export function hostComponentsDir(hostSlug) {
  const folder = hostToHostSlugFolder(hostSlug);
  return path.join(COMPONENTS_ROOT, folder);
}

/**
 * @param {string} hostSlug
 * @param {string} collectionSystem
 * @returns {string}
 */
export function collectionDefinitionPath(hostSlug, collectionSystem) {
  const key = String(collectionSystem || '')
    .trim()
    .toLowerCase();
  return path.join(
    hostComponentsDir(hostSlug),
    `${key}-collection.definition.ts`,
  );
}

/**
 * @param {string} hostSlug
 * @param {string} siteSystem
 * @returns {string}
 */
export function siteDefinitionPath(hostSlug, siteSystem) {
  const key = String(siteSystem || '')
    .trim()
    .toLowerCase();
  return path.join(hostComponentsDir(hostSlug), `${key}-site.definition.ts`);
}

/**
 * @param {string} hostSlug
 * @param {string} siteSystem
 * @returns {string}
 */
export function presentationDefinitionPath(hostSlug, siteSystem) {
  const key = String(siteSystem || '')
    .trim()
    .toLowerCase();
  return path.join(
    hostComponentsDir(hostSlug),
    `${key}-presentation.definition.ts`,
  );
}

/**
 * @param {string} collectionSystem
 * @returns {string}
 */
export function legacyCollectionDefinitionPath(collectionSystem) {
  const key = String(collectionSystem || '')
    .trim()
    .toLowerCase();
  return path.join(LEGACY_COLLECTIONS_DIR, `${key}-collection.definition.ts`);
}

/**
 * @param {string} siteSystem
 * @returns {string}
 */
export function legacySiteDefinitionPath(siteSystem) {
  const key = String(siteSystem || '')
    .trim()
    .toLowerCase();
  return path.join(LEGACY_SITES_DIR, `${key}-site.definition.ts`);
}

/**
 * @param {string} siteSystem
 * @returns {string}
 */
export function legacyPresentationDefinitionPath(siteSystem) {
  const key = String(siteSystem || '')
    .trim()
    .toLowerCase();
  return path.join(LEGACY_SITES_DIR, `${key}-presentation.definition.ts`);
}

export { COMPONENTS_ROOT, LEGACY_COLLECTIONS_DIR, LEGACY_SITES_DIR };

/**
 * @param {string} p
 * @returns {Promise<boolean>}
 */
async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefer host-folder path; fall back to legacy `collections/` path.
 * @param {string} hostSlug
 * @param {string} collectionSystem
 * @returns {Promise<{ path: string, legacy: boolean }>}
 */
export async function resolveCollectionDefinitionPath(
  hostSlug,
  collectionSystem,
) {
  const preferred = collectionDefinitionPath(hostSlug, collectionSystem);
  if (await pathExists(preferred)) return { path: preferred, legacy: false };
  const legacy = legacyCollectionDefinitionPath(collectionSystem);
  if (await pathExists(legacy)) return { path: legacy, legacy: true };
  return { path: preferred, legacy: false };
}

/**
 * Prefer host-folder path; fall back to legacy `sites/` path.
 * @param {string} hostSlug
 * @param {string} siteSystem
 * @returns {Promise<{ path: string, legacy: boolean }>}
 */
export async function resolveSiteDefinitionPath(hostSlug, siteSystem) {
  const preferred = siteDefinitionPath(hostSlug, siteSystem);
  if (await pathExists(preferred)) return { path: preferred, legacy: false };
  const legacy = legacySiteDefinitionPath(siteSystem);
  if (await pathExists(legacy)) return { path: legacy, legacy: true };
  return { path: preferred, legacy: false };
}

/**
 * Prefer host-folder path; fall back to legacy `sites/` path.
 * @param {string} hostSlug
 * @param {string} siteSystem
 * @returns {Promise<{ path: string, legacy: boolean }>}
 */
export async function resolvePresentationDefinitionPath(hostSlug, siteSystem) {
  const preferred = presentationDefinitionPath(hostSlug, siteSystem);
  if (await pathExists(preferred)) return { path: preferred, legacy: false };
  const legacy = legacyPresentationDefinitionPath(siteSystem);
  if (await pathExists(legacy)) return { path: legacy, legacy: true };
  return { path: preferred, legacy: false };
}
