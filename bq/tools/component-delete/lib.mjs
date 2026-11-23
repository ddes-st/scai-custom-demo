/**
 * Core helpers for `npm run component:delete`.
 */
import fs from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot } from '../capture/paths.mjs';
import {
  hostComponentsDir as hostComponentsDirCanonical,
  legacyPresentationDefinitionPath,
  presentationDefinitionPath as presentationDefinitionPathCanonical,
} from '../create-section-components/definition-paths.mjs';
import { resolveHostPackage } from '../create-section-components/resolve-only-targets.mjs';
import {
  deleteApplyInventory,
  loadApplyInventory,
} from '../shared/apply-inventory.ts';
import { isBqGeneratedItem } from '../shared/apply-manifest.ts';
import { getDefinitionPruneRoots } from '../shared/prune-roots.ts';
import { importAllDefinitions } from '../shared/discover.ts';

/**
 * @param {string} host
 * @returns {string}
 */
export function hostComponentsDir(host = 'sitecore-com') {
  return hostComponentsDirCanonical(host);
}

/**
 * Resolve site-presentation definition for a FE host folder.
 * Prefers `components/{host}/*-presentation.definition.ts`, then legacy `sites/`.
 * @param {string} host FE hostSlug (e.g. sitecore-com, dom-security-com)
 * @returns {string}
 */
export function presentationDefinitionPath(host = 'sitecore-com') {
  const preferred = presentationDefinitionPathCanonical(host, host);
  if (fs.existsSync(preferred)) return preferred;

  const hostDir = hostComponentsDir(host);
  if (fs.existsSync(hostDir)) {
    try {
      const match = fs
        .readdirSync(hostDir)
        .find((f) => f.endsWith('-presentation.definition.ts'));
      if (match) return path.join(hostDir, match);
    } catch {
      /* ignore */
    }
  }

  const legacy = legacyPresentationDefinitionPath(host);
  if (fs.existsSync(legacy)) return legacy;

  // dom-security-com host → often siteSystem domsecurity-com
  const compact = String(host || '')
    .replace(/^www-/, '')
    .replace(/-/g, '');
  if (compact.endsWith('com') && compact.length > 3) {
    const siteSystem = `${compact.slice(0, -3)}-com`;
    const alt = presentationDefinitionPathCanonical(host, siteSystem);
    if (fs.existsSync(alt)) return alt;
    const altLegacy = legacyPresentationDefinitionPath(siteSystem);
    if (fs.existsSync(altLegacy)) return altLegacy;
  }

  return preferred;
}

/**
 * Walk pages / partialDesigns for definitionKey refs (not availableRenderings).
 * @param {object|null|undefined} presentation
 * @returns {Set<string>}
 */
export function collectWiredDefinitionKeys(presentation) {
  /** @type {Set<string>} */
  const out = new Set();
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (typeof node.definitionKey === 'string' && node.definitionKey.trim()) {
      out.add(node.definitionKey.trim());
    }
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'availableRenderings') continue;
      walk(v);
    }
  }
  walk(presentation?.pages);
  walk(presentation?.partialDesigns);
  return out;
}

/**
 * @param {string} source
 * @returns {object|null}
 */
export function parsePresentationLiteral(source) {
  const src = String(source || '');
  const exportIdx = src.search(/export const \w+\s*=/);
  if (exportIdx < 0) return null;
  const eq = src.indexOf('=', exportIdx);
  const open = src.indexOf('{', eq);
  if (open < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  const literal = src.slice(open, end + 1).replace(/\s+as const\b/g, '');
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${literal});`)();
}

/**
 * Remove keys from availableRenderings and layout trees.
 * @param {object} presentation
 * @param {Iterable<string>} keys
 * @returns {{ presentation: object, removedAvailable: number, removedWired: number }}
 */
export function scrubPresentationObject(presentation, keys) {
  const remove = new Set(
    [...keys].map((k) => String(k || '').trim()).filter(Boolean),
  );
  let removedAvailable = 0;
  let removedWired = 0;

  function filterNode(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) {
      /** @type {any[]} */
      const next = [];
      for (const child of node) {
        if (
          child &&
          typeof child === 'object' &&
          typeof child.definitionKey === 'string' &&
          remove.has(child.definitionKey)
        ) {
          removedWired += 1;
          continue;
        }
        next.push(filterNode(child));
      }
      return next;
    }
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = filterNode(v);
    }
    return out;
  }

  const next = { ...presentation };
  if (next.availableRenderings && typeof next.availableRenderings === 'object') {
    /** @type {Record<string, string[]>} */
    const avail = {};
    for (const [group, list] of Object.entries(next.availableRenderings)) {
      const filtered = (Array.isArray(list) ? list : []).filter((k) => {
        if (remove.has(k)) {
          removedAvailable += 1;
          return false;
        }
        return true;
      });
      avail[group] = filtered;
    }
    next.availableRenderings = avail;
  }
  if (next.pages) next.pages = filterNode(next.pages);
  if (next.partialDesigns) next.partialDesigns = filterNode(next.partialDesigns);
  return { presentation: next, removedAvailable, removedWired };
}

/**
 * Rewrite presentation *.definition.ts after scrubbing keys.
 * @param {string} filePath
 * @param {Iterable<string>} keys
 * @param {{ apply?: boolean }} [opts]
 */
export async function scrubPresentationFile(filePath, keys, opts = {}) {
  const apply = Boolean(opts.apply);
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      filePath: filePath || '',
      skipped: true,
      reason: 'presentation file missing',
      removedAvailable: 0,
      removedWired: 0,
    };
  }
  const src = await readFile(filePath, 'utf8');
  const parsed = parsePresentationLiteral(src);
  if (!parsed) {
    return {
      filePath,
      skipped: true,
      reason: 'could not parse presentation',
      removedAvailable: 0,
      removedWired: 0,
    };
  }
  const { presentation, removedAvailable, removedWired } = scrubPresentationObject(
    parsed,
    keys,
  );
  if (!removedAvailable && !removedWired) {
    return {
      filePath,
      skipped: true,
      reason: 'no matching refs',
      removedAvailable: 0,
      removedWired: 0,
    };
  }

  const m = src.match(/export const (\w+)\s*=/);
  const exportName = m?.[1] || 'presentation';
  const siteSystem = presentation.siteSystem || 'sitecore-com';
  const collectionSystem = presentation.collectionSystem || 'sitecore';
  const definitionKey =
    presentation.definitionKey || `${siteSystem}-presentation`;
  const culturesLiteral =
    Array.isArray(presentation.cultures) && presentation.cultures.length
      ? `\n  cultures: ${JSON.stringify(presentation.cultures)},`
      : '';

  const body = `import type { SitePresentationDefinition } from "../../../tools/definitions/types";

/**
 * Presentation wiring for site "${siteSystem}" (create:sectioncomponents).
 * Emitted by definitions:generate — do not hand-edit YAML.
 * Secondary page captures merge into this file (home + prior pages are preserved).
 */
export const ${exportName} = {
  kind: "site-presentation",
  definitionKey: "${definitionKey}",
  siteSystem: "${siteSystem}",
  collectionSystem: "${collectionSystem}",${culturesLiteral}
  availableRenderings: ${JSON.stringify(presentation.availableRenderings || {}, null, 2)},
  partialDesigns: ${JSON.stringify(presentation.partialDesigns || [], null, 2)},
  pages: ${JSON.stringify(presentation.pages || {}, null, 2)},
} satisfies SitePresentationDefinition;
`;

  if (apply) {
    await writeFile(filePath, body, 'utf8');
  }
  return {
    filePath,
    skipped: false,
    removedAvailable,
    removedWired,
    applied: apply,
  };
}

/**
 * Filter getDefinitionPruneRoots to paths safe for component:delete.
 * Excludes broad collection layout trees and shared Data/media folders
 * (those are covered by apply-inventory diskPaths when present).
 *
 * @param {string[]} roots
 * @param {{ componentName?: string, name?: string, displayName?: string }} definition
 * @returns {string[]}
 */
export function filterSafeDeleteRoots(roots, definition) {
  const names = new Set(
    [definition?.componentName, definition?.name, definition?.displayName]
      .map((n) => String(n || '').trim())
      .filter(Boolean),
  );
  /** @type {string[]} */
  const out = [];
  for (const root of roots || []) {
    const resolved = path.normalize(path.resolve(root));
    const base = path.basename(resolved);
    // Exact YAML files (template/rendering/scaffolding)
    if (/\.ya?ml$/i.test(resolved)) {
      out.push(resolved);
      continue;
    }
    // Broad layout/Project/{collection} — never walk entire collection
    if (/[\\/]layout[\\/]Project[\\/][^\\/]+$/i.test(resolved)) continue;
    // Shared Data / Media Library folder trees — inventory only
    if (/[\\/](Data|Media Library)([\\/]|$)/i.test(resolved)) continue;
    // Component-named template / variants directories
    if ([...names].some((n) => base === n || base === `${n} Templates` || base.includes(n))) {
      out.push(resolved);
    }
  }
  return out;
}

/**
 * Collect absolute YAML paths under prune roots (files + walk dirs).
 * @param {string[]} roots
 * @returns {string[]}
 */
export function listYamlUnderRoots(roots) {
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {string[]} */
  const out = [];

  function visit(p) {
    const resolved = path.normalize(path.resolve(p));
    if (!fs.existsSync(resolved) || seen.has(resolved)) return;
    seen.add(resolved);
    const st = fs.statSync(resolved);
    if (st.isFile()) {
      if (resolved.endsWith('.yml') || resolved.endsWith('.yaml')) {
        out.push(resolved);
      }
      return;
    }
    if (!st.isDirectory()) return;
    for (const ent of fs.readdirSync(resolved, { withFileTypes: true })) {
      visit(path.join(resolved, ent.name));
    }
  }

  for (const root of roots || []) visit(root);
  return out;
}

/**
 * @param {string[]} yamlPaths
 * @param {{ apply?: boolean }} [opts]
 * @returns {{ deleted: string[], skipped: string[] }}
 */
export function deleteBqOwnedYaml(yamlPaths, opts = {}) {
  const apply = Boolean(opts.apply);
  /** @type {string[]} */
  const deleted = [];
  /** @type {string[]} */
  const skipped = [];
  for (const yamlPath of yamlPaths) {
    if (!fs.existsSync(yamlPath)) continue;
    if (!isBqGeneratedItem(yamlPath)) {
      skipped.push(yamlPath);
      continue;
    }
    if (apply) fs.unlinkSync(yamlPath);
    deleted.push(yamlPath);
  }
  return { deleted, skipped };
}

/**
 * Plan + optionally apply deletion for one target (package folder or definitionKey).
 * @param {{
 *   target: string,
 *   host?: string,
 *   apply?: boolean,
 *   force?: boolean,
 * }} opts
 */
export async function planComponentDelete(opts) {
  const host = opts.host || 'sitecore-com';
  const apply = Boolean(opts.apply);
  const force = Boolean(opts.force);
  const hostDir = hostComponentsDir(host);
  const presentationPath = presentationDefinitionPath(host);

  const resolved = await resolveHostPackage(hostDir, opts.target);
  if (!resolved) {
    return {
      target: opts.target,
      ok: false,
      error: `not found under ${hostDir}`,
    };
  }

  /** @type {string|null} */
  let definitionKey = resolved.definitionKey;
  /** @type {object|null} */
  let definition = null;
  /** @type {string[]} */
  let pruneRoots = [];
  /** @type {string[]} */
  let yamlCandidates = [];

  if (resolved.definitionFile) {
    try {
      const defs = await importAllDefinitions(resolved.definitionFile);
      definition = defs[0] || null;
      if (definition?.definitionKey) {
        definitionKey = definition.definitionKey;
      }
      if (definition) {
        const rawRoots = getDefinitionPruneRoots(definition);
        pruneRoots = filterSafeDeleteRoots(rawRoots, definition);
        yamlCandidates = listYamlUnderRoots(pruneRoots);
      }
    } catch (err) {
      return {
        target: opts.target,
        ok: false,
        error: `failed to load definition: ${err instanceof Error ? err.message : err}`,
        packageDir: resolved.packageDir,
      };
    }
  }

  // Also include inventory disk paths
  if (definitionKey) {
    const inv = loadApplyInventory(definitionKey);
    for (const e of inv?.entries || []) {
      if (e.diskPath && fs.existsSync(e.diskPath)) {
        yamlCandidates.push(path.normalize(path.resolve(e.diskPath)));
      }
    }
  }
  yamlCandidates = [...new Set(yamlCandidates)];

  let wired = false;
  /** @type {Set<string>} */
  let wiredKeys = new Set();
  const presentationExists = Boolean(
    presentationPath && fs.existsSync(presentationPath),
  );
  if (presentationExists) {
    try {
      const presSrc = await readFile(presentationPath, 'utf8');
      const pres = parsePresentationLiteral(presSrc);
      wiredKeys = collectWiredDefinitionKeys(pres);
      if (definitionKey && wiredKeys.has(definitionKey)) wired = true;
    } catch {
      /* no presentation */
    }
  }

  if (wired && !force) {
    return {
      target: opts.target,
      ok: false,
      error: `definitionKey "${definitionKey}" is still wired on a page/partial — pass --force to delete anyway`,
      packageDir: resolved.packageDir,
      definitionKey,
      wired: true,
    };
  }

  const yamlPlan = deleteBqOwnedYaml(yamlCandidates, { apply: false });

  /** @type {{ filePath: string, removedAvailable: number, removedWired: number }|null} */
  let scrubPreview = null;
  if (definitionKey && presentationExists) {
    const scrub = await scrubPresentationFile(
      presentationPath,
      [definitionKey],
      { apply: false },
    );
    if (!scrub.skipped) {
      scrubPreview = {
        filePath: scrub.filePath,
        removedAvailable: scrub.removedAvailable,
        removedWired: scrub.removedWired,
      };
    }
  }

  if (apply) {
    deleteBqOwnedYaml(yamlCandidates, { apply: true });
    if (definitionKey) {
      if (presentationExists) {
        await scrubPresentationFile(presentationPath, [definitionKey], {
          apply: true,
        });
      }
      deleteApplyInventory(definitionKey);
    }
    await rm(resolved.packageDir, { recursive: true, force: true });
  }

  return {
    target: opts.target,
    ok: true,
    apply,
    packageDir: resolved.packageDir,
    packageName: resolved.packageName,
    definitionKey,
    wired,
    pruneRoots,
    yamlWouldDelete: yamlPlan.deleted,
    yamlSkippedNotBq: yamlPlan.skipped,
    scrub: scrubPreview,
    inventoryDeleted: Boolean(apply && definitionKey),
  };
}
