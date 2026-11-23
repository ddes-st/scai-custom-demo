/**
 * Emit Navigation.reference.tsx beside packages that import it.
 * The primer under prompts/references/ is prompt-only; generated TSX still
 * imports helpers from it at runtime (preview + Next), so write/capture must
 * materialize a copy wherever those imports resolve.
 */
import { access, copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Canonical prompt primer (source of copies). */
export const NAVIGATION_REFERENCE_SOURCE = path.join(
  __dirname,
  'prompts',
  'references',
  'Navigation.reference.tsx',
);

const NAV_REF_IMPORT_RE =
  /from\s+['"]([^'"]*Navigation\.reference(?:\.tsx?)?)['"]/g;

/**
 * @param {string|null|undefined} p
 * @returns {Promise<boolean>}
 */
async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Relative import paths that mention Navigation.reference.
 * @param {string|null|undefined} source
 * @returns {string[]}
 */
export function collectNavigationReferenceImportPaths(source) {
  /** @type {Set<string>} */
  const out = new Set();
  const text = String(source || '');
  for (const m of text.matchAll(NAV_REF_IMPORT_RE)) {
    const rel = String(m[1] || '').trim();
    if (rel) out.add(rel);
  }
  return [...out];
}

/**
 * Resolve import specifier to the .tsx file we will emit (extension preferred).
 * @param {string} packageDir
 * @param {string} importPath
 * @returns {string|null}
 */
export function resolveNavigationReferenceTargetPath(packageDir, importPath) {
  const rel = String(importPath || '').trim();
  if (!rel) return null;
  const withoutExt = rel.replace(/\.tsx?$/i, '');
  return path.resolve(packageDir, `${withoutExt}.tsx`);
}

/**
 * Copy the primer to each Navigation.reference target if missing.
 * Does not overwrite an existing file.
 *
 * @param {string|null|undefined} tsxSource
 * @param {string} packageDir
 * @returns {Promise<string[]>} absolute paths written
 */
export async function ensureNavigationReferenceImports(tsxSource, packageDir) {
  const imports = collectNavigationReferenceImportPaths(tsxSource);
  if (!imports.length) return [];
  if (!(await exists(NAVIGATION_REFERENCE_SOURCE))) {
    throw new Error(
      `Navigation.reference primer missing: ${NAVIGATION_REFERENCE_SOURCE}`,
    );
  }
  /** @type {string[]} */
  const written = [];
  for (const imp of imports) {
    const target = resolveNavigationReferenceTargetPath(packageDir, imp);
    if (!target) continue;
    if (await exists(target)) continue;
    // Import may already resolve to a .ts sibling written earlier.
    const bare = path.resolve(packageDir, String(imp).replace(/\.tsx?$/i, ''));
    if (await exists(`${bare}.ts`) || await exists(`${bare}.tsx`)) continue;
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(NAVIGATION_REFERENCE_SOURCE, target);
    written.push(target);
  }
  return written;
}

/**
 * Read a TSX/client file and ensure its Navigation.reference imports resolve.
 * @param {string} tsxPath
 * @returns {Promise<string[]>}
 */
export async function ensureNavigationReferenceForTsxFile(tsxPath) {
  const abs = path.resolve(String(tsxPath || ''));
  if (!(await exists(abs))) return [];
  const source = await readFile(abs, 'utf8');
  return ensureNavigationReferenceImports(source, path.dirname(abs));
}
