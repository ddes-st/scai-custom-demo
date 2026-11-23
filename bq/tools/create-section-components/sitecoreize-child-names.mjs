/**
 * Sitecoreize child naming: unique vs takenNames (same invent rule as visual).
 * Pure helpers — no Azure imports (safe for unit tests).
 */
import { toDefinitionKey, toKebabCase } from './naming.mjs';
import {
  normalizeProposedComponentName,
  validateProposedComponentName,
} from './early-naming.mjs';

/**
 * Sitecoreize task HARD — child names unique vs takenNames / host / siblings.
 * Kept here and re-exported from section-codegen for the live task message.
 */
export const SITECOREIZE_CHILD_UNIQUE_NAME_HARD =
  'HARD — for each role:"child" package: invent one componentName that is unique vs takenNames (case-insensitive), not equal to the section host / lockedSectionName, and unique among packages in this response — same invent rule as visual section naming. Never reuse the host componentName as a child. Nested layoutSketch componentName entries under placeholders must match those child package names (never re-use the host name as a nested peer). Never reuse another page’s taken package name; no Foo2 numeric twins.';

/**
 * @param {string[]} takenNames
 * @returns {Set<string>}
 */
function takenLowerSet(takenNames) {
  return new Set(
    (takenNames || [])
      .map((n) => String(n || '').trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Rewrite nested layoutSketch componentName nodes when packages were renamed.
 * Mutates sketch in place; returns the same reference.
 *
 * @param {object|null|undefined} sketch
 * @param {Record<string, string>|Map<string, string>|null|undefined} renames oldName → newName
 * @returns {object|null|undefined}
 */
export function remapLayoutSketchComponentNames(sketch, renames) {
  if (!sketch || typeof sketch !== 'object') return sketch;
  /** @type {Map<string, string>} */
  const map = new Map();
  if (renames instanceof Map) {
    for (const [k, v] of renames) {
      const from = String(k || '').trim();
      const to = String(v || '').trim();
      if (from && to) map.set(from.toLowerCase(), to);
    }
  } else if (renames && typeof renames === 'object') {
    for (const [k, v] of Object.entries(renames)) {
      const from = String(k || '').trim();
      const to = String(v || '').trim();
      if (from && to) map.set(from.toLowerCase(), to);
    }
  }
  if (!map.size) return sketch;

  /**
   * Only rewrite names under placeholder peer lists — never the host rendering
   * that owns those placeholders (host+child often shared a name before repair).
   * @param {unknown} node
   * @param {boolean} underPlaceholder
   */
  const visit = (node, underPlaceholder = false) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, underPlaceholder);
      return;
    }
    const name = String(node.componentName || '').trim();
    if (underPlaceholder && name) {
      const next = map.get(name.toLowerCase());
      if (next) node.componentName = next;
    }
    if (node.placeholders && typeof node.placeholders === 'object') {
      for (const list of Object.values(node.placeholders)) {
        visit(list, true);
      }
    }
    if (Array.isArray(node.renderings)) {
      for (const r of node.renderings) visit(r, false);
    }
  };
  visit(sketch, false);
  return sketch;
}

/**
 * Ensure each unlocked child package name is free vs taken + siblings.
 * If preferred is taken → one repairChildName call (mirrors visual section repair).
 *
 * @param {{
 *   childPkgs: object[],
 *   sectionComponentName: string,
 *   codePrefix?: string,
 *   takenNames?: string[],
 *   lockedChildList?: object[],
 *   repairChildName?: (opts: { badName: string, reason: string, takenNames: string[] }) => Promise<string>,
 * }} opts
 * @returns {Promise<{ childPkgs: object[], renames: Record<string, string> }>}
 */
export async function ensureUniqueChildPackageNames(opts = {}) {
  const childPkgs = Array.isArray(opts.childPkgs) ? opts.childPkgs : [];
  const prefix = opts.codePrefix || '';
  const lockedChildList = Array.isArray(opts.lockedChildList)
    ? opts.lockedChildList
    : [];
  const sectionName = normalizeProposedComponentName(
    opts.sectionComponentName || '',
    prefix,
  );
  const taken = takenLowerSet([
    ...(opts.takenNames || []),
    sectionName,
    sectionName ? toDefinitionKey(sectionName) : '',
  ]);
  /** @type {Record<string, string>} */
  const renames = {};

  for (let i = 0; i < childPkgs.length; i++) {
    const pkg = childPkgs[i];
    if (!pkg) continue;
    const lock = lockedChildList[i];
    const oldName = String(pkg.componentName || '').trim();

    if (lock?.componentName) {
      const locked = normalizeProposedComponentName(lock.componentName, prefix);
      taken.add(locked.toLowerCase());
      const lockKey =
        String(lock.definitionKey || '').trim() || toDefinitionKey(locked);
      taken.add(lockKey.toLowerCase());
      if (
        oldName &&
        normalizeProposedComponentName(oldName, prefix).toLowerCase() !==
          locked.toLowerCase()
      ) {
        renames[oldName] = locked;
      }
      pkg.componentName = locked;
      pkg.definitionKey = lockKey;
      pkg.kebab = toKebabCase(locked);
      continue;
    }

    let pick = validateProposedComponentName(
      pkg.componentName,
      prefix,
      taken,
    );

    if (!pick.ok && typeof opts.repairChildName === 'function') {
      console.warn(
        `  ⚠ sitecoreize child name rejected (${pick.reason}) — one repair…`,
      );
      try {
        const repaired = await opts.repairChildName({
          badName: pick.componentName || pkg.componentName,
          reason: pick.reason || 'name taken',
          takenNames: [...taken],
        });
        pick = validateProposedComponentName(repaired, prefix, taken);
      } catch (err) {
        throw new Error(
          `sitecoreize child name repair failed for "${pkg.componentName}": ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    if (!pick.ok) {
      throw new Error(
        `sitecoreize child "${pkg.componentName}" collides with takenNames (${pick.reason})`,
      );
    }

    if (
      normalizeProposedComponentName(pkg.componentName, prefix).toLowerCase() !==
      pick.componentName.toLowerCase()
    ) {
      console.warn(
        `  ⚠ sitecoreize child name taken: ${pkg.componentName} → ${pick.componentName}`,
      );
    }

    if (oldName && oldName.toLowerCase() !== pick.componentName.toLowerCase()) {
      renames[oldName] = pick.componentName;
    }

    pkg.componentName = pick.componentName;
    pkg.definitionKey = pick.definitionKey;
    pkg.kebab = toKebabCase(pick.componentName);
    taken.add(pick.componentName.toLowerCase());
    taken.add(pick.definitionKey.toLowerCase());
  }

  return { childPkgs, renames };
}
