/**
 * Resolve `--only` tokens: section-NN, definitionKey, or package folder name.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {string|null|undefined} only
 * @returns {string[]}
 */
export function parseOnlyTokens(only) {
  if (only == null || only === '') return [];
  return String(only)
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * @param {string} token
 * @returns {'section'|'definitionKey'|'package'|'unknown'}
 */
export function classifyOnlyToken(token) {
  const t = String(token || '').trim();
  if (!t) return 'unknown';
  if (/^section-\d+/i.test(t) || /^\d{1,3}$/.test(t)) return 'section';
  // PascalCase package folder (optional nested path leaf)
  const leaf = t.replace(/\\/g, '/').split('/').pop() || t;
  if (/^[A-Z][A-Za-z0-9]*$/.test(leaf)) return 'package';
  // kebab-case definitionKey
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(t) || /^stub-[a-z0-9-]+$/i.test(t)) {
    return 'definitionKey';
  }
  // Ambiguous lowercase single word → try as definitionKey later
  if (/^[a-z][a-z0-9-]*$/.test(t)) return 'definitionKey';
  return 'unknown';
}

/**
 * @param {string} token
 * @returns {string}
 */
export function normalizeSectionFolder(token) {
  const t = String(token || '').trim();
  if (/^section-\d+/i.test(t)) return t.toLowerCase().replace(/^section-/, 'section-');
  if (/^\d+$/.test(t)) {
    const n = String(Number(t)).padStart(2, '0');
    return `section-${n}`;
  }
  return t;
}

/**
 * Extract definitionKey from a *.definition.ts source string.
 * @param {string} source
 * @returns {string|null}
 */
export function extractDefinitionKeyFromSource(source) {
  const m = String(source || '').match(
    /definitionKey\s*:\s*['"`]([^'"`]+)['"`]/,
  );
  return m ? m[1].trim() : null;
}

/**
 * Find package dir + definitionKey under host components root.
 * @param {string} hostComponentsDir
 * @param {string} packageOrKey — folder name or definitionKey
 * @returns {Promise<{ packageDir: string, packageName: string, definitionKey: string|null, definitionFile: string|null }|null>}
 */
export async function resolveHostPackage(hostComponentsDir, packageOrKey) {
  const token = String(packageOrKey || '').trim();
  if (!token || !hostComponentsDir) return null;

  const leaf = token.replace(/\\/g, '/').split('/').pop() || token;
  const asPackage = path.join(hostComponentsDir, leaf);

  /** @type {string|null} */
  let packageDir = null;
  try {
    const st = await stat(asPackage);
    if (st.isDirectory()) packageDir = asPackage;
  } catch {
    /* not a direct package folder */
  }

  if (!packageDir) {
    // Scan for definitionKey match
    let entries = [];
    try {
      entries = await readdir(hostComponentsDir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.')) {
        continue;
      }
      const dir = path.join(hostComponentsDir, e.name);
      const defFile = await findDefinitionFile(dir);
      if (!defFile) continue;
      try {
        const src = await readFile(defFile, 'utf8');
        const key = extractDefinitionKeyFromSource(src);
        if (key && (key === token || key === leaf)) {
          return {
            packageDir: dir,
            packageName: e.name,
            definitionKey: key,
            definitionFile: defFile,
          };
        }
      } catch {
        /* skip */
      }
    }
    return null;
  }

  const definitionFile = await findDefinitionFile(packageDir);
  let definitionKey = null;
  if (definitionFile) {
    try {
      definitionKey = extractDefinitionKeyFromSource(
        await readFile(definitionFile, 'utf8'),
      );
    } catch {
      /* empty stub */
    }
  }
  return {
    packageDir,
    packageName: path.basename(packageDir),
    definitionKey,
    definitionFile,
  };
}

/**
 * @param {string} packageDir
 * @returns {Promise<string|null>}
 */
async function findDefinitionFile(packageDir) {
  let files = [];
  try {
    files = await readdir(packageDir);
  } catch {
    return null;
  }
  const def = files.find((f) => f.endsWith('.definition.ts'));
  return def ? path.join(packageDir, def) : null;
}

/**
 * Find section folders whose conversion log lists any of the keys.
 * @param {string} sectionsDir
 * @param {string[]} definitionKeys
 * @returns {Promise<string[]>}
 */
export async function findSectionsForDefinitionKeys(sectionsDir, definitionKeys) {
  const want = new Set(
    (definitionKeys || []).map((k) => String(k || '').trim()).filter(Boolean),
  );
  if (!want.size) return [];
  let folders = [];
  try {
    const entries = await readdir(sectionsDir, { withFileTypes: true });
    folders = entries
      .filter((e) => e.isDirectory() && /^section-\d+/i.test(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }
  /** @type {string[]} */
  const hit = [];
  for (const folder of folders) {
    const convPath = path.join(sectionsDir, folder, 'section-conversion.json');
    try {
      const conv = JSON.parse(await readFile(convPath, 'utf8'));
      for (const c of conv.components || []) {
        const k = String(c?.definitionKey || '').trim();
        if (k && want.has(k)) {
          hit.push(folder);
          break;
        }
      }
    } catch {
      /* no conversion */
    }
  }
  return hit.sort();
}

/**
 * Resolve `--only` into section folders + explicit definitionKeys for emit allowlist.
 *
 * @param {{
 *   only: string|null|undefined,
 *   sectionsDir: string,
 *   hostComponentsDir?: string|null,
 * }} opts
 * @returns {Promise<{
 *   tokens: string[],
 *   sectionFolders: string[],
 *   definitionKeys: string[],
 *   packages: Array<{ packageName: string, definitionKey: string|null }>,
 *   unresolved: string[],
 * }>}
 */
export async function resolveOnlyTargets(opts) {
  const tokens = parseOnlyTokens(opts.only);
  /** @type {Set<string>} */
  const sectionFolders = new Set();
  /** @type {Set<string>} */
  const definitionKeys = new Set();
  /** @type {Array<{ packageName: string, definitionKey: string|null }>} */
  const packages = [];
  /** @type {string[]} */
  const unresolved = [];

  // Known section folders on disk (for validation)
  /** @type {Set<string>} */
  let knownSections = new Set();
  try {
    const entries = await readdir(opts.sectionsDir, { withFileTypes: true });
    knownSections = new Set(
      entries
        .filter((e) => e.isDirectory() && /^section-\d+/i.test(e.name))
        .map((e) => e.name),
    );
  } catch {
    knownSections = new Set();
  }

  for (const token of tokens) {
    const kind = classifyOnlyToken(token);
    if (kind === 'section') {
      const folder = normalizeSectionFolder(token);
      // Prefer zero-padded match on disk
      let match = [...knownSections].find((f) => f === folder);
      if (!match) {
        const n = Number((folder.match(/section-(\d+)/i) || [])[1]);
        if (Number.isFinite(n)) {
          match = [...knownSections].find((f) => {
            const fn = Number((f.match(/section-(\d+)/i) || [])[1]);
            return fn === n;
          });
        }
      }
      if (match) {
        sectionFolders.add(match);
      } else {
        unresolved.push(token);
      }
      continue;
    }

    if (kind === 'package' || kind === 'definitionKey' || kind === 'unknown') {
      let resolved = null;
      if (opts.hostComponentsDir) {
        resolved = await resolveHostPackage(opts.hostComponentsDir, token);
      }
      if (resolved) {
        packages.push({
          packageName: resolved.packageName,
          definitionKey: resolved.definitionKey,
        });
        if (resolved.definitionKey) {
          definitionKeys.add(resolved.definitionKey);
        } else if (kind === 'definitionKey') {
          // Empty stub: still allow key if token looks like one
          definitionKeys.add(token);
        }
        continue;
      }
      if (kind === 'definitionKey') {
        definitionKeys.add(token);
        continue;
      }
      unresolved.push(token);
    }
  }

  // Sections that already converted these keys (optional conversion scope)
  if (definitionKeys.size && opts.sectionsDir) {
    const fromKeys = await findSectionsForDefinitionKeys(opts.sectionsDir, [
      ...definitionKeys,
    ]);
    for (const f of fromKeys) sectionFolders.add(f);
  }

  return {
    tokens,
    sectionFolders: [...sectionFolders].sort((a, b) => {
      const na = Number((a.match(/section-(\d+)/i) || [])[1] || 0);
      const nb = Number((b.match(/section-(\d+)/i) || [])[1] || 0);
      return na - nb;
    }),
    definitionKeys: [...definitionKeys].sort(),
    packages,
    unresolved,
  };
}
