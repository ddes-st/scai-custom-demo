/**
 * Build definitionKey allowlist for authoring:generate when create uses --only.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Collect definitionKeys from section-conversion.json for the given folders.
 * @param {string} sectionsDir
 * @param {string[]|null|undefined} onlyFolders — section-NN folders; empty/null → []
 * @param {string[]} [extraKeys]
 * @returns {Promise<string[]>}
 */
export async function collectDefinitionKeysFromSectionConversions(
  sectionsDir,
  onlyFolders,
  extraKeys = [],
) {
  const keys = new Set(
    (extraKeys || []).map((k) => String(k || '').trim()).filter(Boolean),
  );
  const folders = Array.isArray(onlyFolders) ? onlyFolders : [];
  for (const folder of folders) {
    const convPath = path.join(sectionsDir, folder, 'section-conversion.json');
    try {
      const conv = JSON.parse(await readFile(convPath, 'utf8'));
      for (const c of conv.components || []) {
        const k = String(c?.definitionKey || '').trim();
        if (k) keys.add(k);
      }
    } catch {
      /* conversion may not exist yet (initial generate) */
    }
  }
  return [...keys].sort();
}

/**
 * Walk a presentation / page definition.ts source for `"definitionKey": "…"` refs
 * so --only emit still loads sibling renderings already wired on the page.
 * @param {string} source
 * @returns {string[]}
 */
export function collectDefinitionKeysFromDefinitionSource(source) {
  const keys = new Set();
  const re = /["']definitionKey["']\s*:\s*["']([^"']+)["']/g;
  let m;
  const text = String(source || '');
  while ((m = re.exec(text))) {
    const k = String(m[1] || '').trim();
    if (k) keys.add(k);
  }
  // availableRenderings group lists
  const avail = text.match(
    /availableRenderings\s*:\s*\{([\s\S]*?)\n\}/,
  );
  if (avail) {
    const listRe = /["']([a-z0-9]+(?:-[a-z0-9]+)*)["']/gi;
    let lm;
    while ((lm = listRe.exec(avail[1]))) {
      const k = String(lm[1] || '').trim();
      if (k && k.includes('-')) keys.add(k);
    }
  }
  return [...keys];
}

/**
 * @param {string[]} filePaths
 * @returns {Promise<string[]>}
 */
export async function collectDefinitionKeysFromDefinitionFiles(filePaths) {
  const keys = new Set();
  for (const filePath of filePaths || []) {
    if (!filePath) continue;
    try {
      const src = await readFile(filePath, 'utf8');
      for (const k of collectDefinitionKeysFromDefinitionSource(src)) {
        keys.add(k);
      }
    } catch {
      /* missing */
    }
  }
  return [...keys];
}

/**
 * Format for CLI: `--definitionKeys=a,b,c` (empty set → flag with empty value for infra-only).
 * @param {string[]|Set<string>|null|undefined} keys
 * @returns {string|null} null when allowlist mode should not be activated
 */
export function formatDefinitionKeysCliArg(keys) {
  if (keys == null) return null;
  const list = [...(keys instanceof Set ? keys : keys)]
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  return `--definitionKeys=${list.join(',')}`;
}
