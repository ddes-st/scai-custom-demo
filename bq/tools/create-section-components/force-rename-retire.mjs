/**
 * Retire an old FE package + BQ YAML + presentation refs after --force rename unlock.
 * Reuses component-delete helpers (does not shell the CLI).
 */
import fs from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bqDotDir, bqRoot } from '../capture/paths.mjs';
import {
  parsePresentationLiteral,
  planComponentDelete,
  presentationDefinitionPath,
} from '../component-delete/lib.mjs';
import { cleanSerializationHashOrphans } from '../site-delete/lib.mjs';
import {
  extractFolderPathsFromDefinitionTs,
  folderPathsFromCaptureMeta,
  retirePriorContentAndMediaFolders,
} from '../shared/retire-prior-content-media-folders.ts';
import { componentDir } from './write-component.mjs';
import { toDefinitionKey, toKebabCase } from './naming.mjs';
import { remapCmInventoryOnForceRename } from '../shared/force-rename-cm-remap.ts';
import { remapLayoutSketchComponentNames } from './sitecoreize-child-names.mjs';

/**
 * Read prior Data/media folder paths from a package's capture-meta + definition.
 * @param {string} hostSlug
 * @param {string} componentName
 * @returns {Promise<{ contentFolderPaths: string[][], mediaFolderPaths: string[][] }>}
 */
export async function readPackageContentMediaFolderPaths(
  hostSlug,
  componentName,
) {
  const name = String(componentName || '').trim();
  const host = String(hostSlug || '').trim();
  if (!host || !name) {
    return { contentFolderPaths: [], mediaFolderPaths: [] };
  }
  const dir = componentDir(host, name);
  const kebab = toKebabCase(name);
  /** @type {Record<string, unknown>|null} */
  let meta = null;
  const metaPath = path.join(dir, `${kebab}.capture-meta.json`);
  try {
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(await readFile(metaPath, 'utf8'));
    }
  } catch {
    meta = null;
  }
  let definitionTs = '';
  const defPath = path.join(dir, `${kebab}.definition.ts`);
  try {
    if (fs.existsSync(defPath)) {
      definitionTs = await readFile(defPath, 'utf8');
    }
  } catch {
    definitionTs = '';
  }

  const fromMeta = folderPathsFromCaptureMeta(meta);
  const fromDef = extractFolderPathsFromDefinitionTs(definitionTs);
  const contentFolderPaths =
    fromMeta.contentFolderPaths.length > 0
      ? fromMeta.contentFolderPaths
      : fromDef;
  const mediaFolderPaths =
    fromMeta.mediaFolderPaths.length > 0
      ? fromMeta.mediaFolderPaths
      : fromDef;
  return { contentFolderPaths, mediaFolderPaths };
}

/**
 * @param {{
 *   hostSlug: string,
 *   oldComponentName: string,
 *   oldDefinitionKey?: string|null,
 *   newComponentName?: string|null,
 *   newDefinitionKey?: string|null,
 *   collectionSystem?: string|null,
 *   siteSystem?: string|null,
 *   dryRun?: boolean,
 * }} opts
 */
export async function retireForceRenamedPackage(opts) {
  const hostSlug = String(opts.hostSlug || '').trim();
  const oldName = String(opts.oldComponentName || '').trim();
  if (!hostSlug || !oldName) {
    return { ok: false, skipped: true, reason: 'missing host or old name' };
  }

  const oldKey =
    String(opts.oldDefinitionKey || '').trim() || toDefinitionKey(oldName);
  const dryRun = Boolean(opts.dryRun);
  const oldDir = componentDir(hostSlug, oldName);
  const collectionSystem = String(opts.collectionSystem || '').trim();
  const siteSystem = String(opts.siteSystem || '').trim();
  const newName = String(opts.newComponentName || '').trim();
  const newKey =
    String(opts.newDefinitionKey || '').trim() ||
    (newName ? toDefinitionKey(newName) : '');

  /** @type {Awaited<ReturnType<typeof remapCmInventoryOnForceRename>>|null} */
  let cmRemap = null;
  /** @type {Awaited<ReturnType<typeof remapLocalRefsOnForceRename>>|null} */
  let localRemap = null;
  if (newName && newKey && newKey !== oldKey) {
    try {
      cmRemap = await remapCmInventoryOnForceRename({
        oldDefinitionKey: oldKey,
        newDefinitionKey: newKey,
        oldComponentName: oldName,
        newComponentName: newName,
        dryRun,
        log: (m) => console.warn(m),
      });
      if (cmRemap) {
        console.warn(
          `  · CM remap ${oldName} → ${newName}: renamed=${cmRemap.renamed} moved=${cmRemap.moved} kept=${cmRemap.kept} deleted=${cmRemap.deleted} failed=${cmRemap.failed ?? 0} skipped=${cmRemap.skipped}`,
        );
      }
    } catch (err) {
      console.warn(
        `  · ⚠ CM remap failed (continuing local retire): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    // Remap FE refs before deleting the old package so nested page wiring /
    // allowedControls / layoutSketch keep pointing at a real definitionKey.
    localRemap = await remapLocalRefsOnForceRename({
      hostSlug,
      oldComponentName: oldName,
      oldDefinitionKey: oldKey,
      newComponentName: newName,
      newDefinitionKey: newKey,
      dryRun,
    });
  }

  /** @type {ReturnType<typeof retirePriorContentAndMediaFolders>|null} */
  let contentMediaRetire = null;
  if (collectionSystem && siteSystem) {
    const prior = await readPackageContentMediaFolderPaths(hostSlug, oldName);
    const keep = newName
      ? await readPackageContentMediaFolderPaths(hostSlug, newName)
      : { contentFolderPaths: [], mediaFolderPaths: [] };
    if (
      prior.contentFolderPaths.length > 0 ||
      prior.mediaFolderPaths.length > 0
    ) {
      contentMediaRetire = retirePriorContentAndMediaFolders({
        collectionSystem,
        siteSystem,
        priorContentFolderPaths: prior.contentFolderPaths,
        priorMediaFolderPaths: prior.mediaFolderPaths,
        keepContentFolderPaths: keep.contentFolderPaths,
        keepMediaFolderPaths: keep.mediaFolderPaths,
        dryRun,
      });
      if (contentMediaRetire.removed.length) {
        console.warn(
          `  · Retired prior content/media YAML after rename (${contentMediaRetire.removed.length} path(s)): ${oldName}` +
            (newName ? ` → ${newName}` : ''),
        );
      }
    }
  }

  // Force even if still wired — presentation scrub removes the old key; generate re-wires the new one.
  const plan = await planComponentDelete({
    target: oldName,
    host: hostSlug,
    apply: !dryRun,
    force: true,
  });

  if (!plan.ok && plan.error && !/not found/i.test(String(plan.error))) {
    // Fall back: package may already be gone but YAML/inventory remain — try by definitionKey.
    const byKey = await planComponentDelete({
      target: oldKey,
      host: hostSlug,
      apply: !dryRun,
      force: true,
    });
    if (!byKey.ok && !dryRun && (await dirExists(oldDir))) {
      await fs.promises.rm(oldDir, { recursive: true, force: true });
    }
    await scrubIndexEntriesForOldName(hostSlug, oldName, {
      dryRun,
      newComponentName: opts.newComponentName || null,
      newDefinitionKey: opts.newDefinitionKey || null,
    });
    const hashClean =
      !dryRun && collectionSystem
        ? cleanSerializationHashOrphans({
            apply: true,
            collectionSystem,
            siteSystem: siteSystem || undefined,
          })
        : null;
    return {
      ok: byKey.ok || plan.ok,
      dryRun,
      oldComponentName: oldName,
      oldDefinitionKey: oldKey,
      plan,
      byKey,
      hashClean,
      contentMediaRetire,
      cmRemap,
      localRemap,
      presentationPath: presentationDefinitionPath(hostSlug),
    };
  }

  await scrubIndexEntriesForOldName(hostSlug, oldName, {
    dryRun,
    newComponentName: opts.newComponentName || null,
    newDefinitionKey: opts.newDefinitionKey || null,
  });

  const hashClean =
    !dryRun && collectionSystem
      ? cleanSerializationHashOrphans({
          apply: true,
          collectionSystem,
          siteSystem: siteSystem || undefined,
        })
      : null;

  return {
    ok: Boolean(plan.ok),
    dryRun,
    oldComponentName: oldName,
    oldDefinitionKey: oldKey,
    plan,
    hashClean,
    contentMediaRetire,
    cmRemap,
    localRemap,
    presentationPath: presentationDefinitionPath(hostSlug),
  };
}

/**
 * Remap old→new definitionKey / componentName across host FE artifacts so
 * nested page children and allowedControls do not keep a retired ghost key.
 *
 * @param {{
 *   hostSlug: string,
 *   oldComponentName: string,
 *   oldDefinitionKey: string,
 *   newComponentName: string,
 *   newDefinitionKey: string,
 *   dryRun?: boolean,
 * }} opts
 */
export async function remapLocalRefsOnForceRename(opts) {
  const hostSlug = String(opts.hostSlug || '').trim();
  const oldName = String(opts.oldComponentName || '').trim();
  const newName = String(opts.newComponentName || '').trim();
  const oldKey = String(opts.oldDefinitionKey || '').trim();
  const newKey = String(opts.newDefinitionKey || '').trim();
  const dryRun = Boolean(opts.dryRun);
  if (!hostSlug || !oldName || !newName || !oldKey || !newKey || oldKey === newKey) {
    return { changed: false, touched: [] };
  }

  /** @type {string[]} */
  const touched = [];

  // 1) Presentation: remap availableRenderings + nested wired children
  const presPath = presentationDefinitionPath(hostSlug);
  if (fs.existsSync(presPath)) {
    try {
      const src = await readFile(presPath, 'utf8');
      const parsed = parsePresentationLiteral(src);
      if (parsed) {
        const { presentation, remapped } = remapPresentationObjectKeys(
          parsed,
          oldKey,
          newKey,
        );
        if (remapped > 0 && !dryRun) {
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
          await writeFile(presPath, body, 'utf8');
          touched.push(`presentation:${remapped}`);
        } else if (remapped > 0) {
          touched.push(`presentation:${remapped}:dry-run`);
        }
      }
    } catch (err) {
      console.warn(
        `  · ⚠ presentation remap failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // 2) Host component definitions: allowedControls + capture-meta children
  const hostDir = path.join(bqRoot, 'src', 'components', hostSlug);
  if (fs.existsSync(hostDir)) {
    for (const ent of fs.readdirSync(hostDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const dir = path.join(hostDir, ent.name);
      for (const file of fs.readdirSync(dir)) {
        const abs = path.join(dir, file);
        if (file.endsWith('.definition.ts')) {
          try {
            const src = await readFile(abs, 'utf8');
            const next = remapQuotedDefinitionKey(src, oldKey, newKey);
            if (next !== src) {
              if (!dryRun) await writeFile(abs, next, 'utf8');
              touched.push(`def:${ent.name}`);
            }
          } catch {
            /* skip */
          }
        }
        if (file.endsWith('.capture-meta.json')) {
          try {
            const raw = await readFile(abs, 'utf8');
            const meta = JSON.parse(raw);
            if (remapCaptureMetaChildren(meta, oldName, oldKey, newName, newKey)) {
              if (!dryRun) {
                await writeFile(abs, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
              }
              touched.push(`meta:${ent.name}`);
            }
          } catch {
            /* skip */
          }
        }
      }
    }
  }

  // 3) Capture layout-sketch.json under .bq/captures
  const capturesRoot = path.join(bqDotDir, 'captures');
  if (fs.existsSync(capturesRoot)) {
    await walkFiles(capturesRoot, async (filePath) => {
      if (path.basename(filePath) !== 'layout-sketch.json') return;
      try {
        const raw = await readFile(filePath, 'utf8');
        if (!raw.includes(oldName) && !raw.includes(oldKey)) return;
        const sketch = JSON.parse(raw);
        remapLayoutSketchComponentNames(sketch, { [oldName]: newName });
        // Also remap datasource-only peers that stored definitionKey
        remapLayoutSketchDefinitionKeys(sketch, oldKey, newKey);
        if (!dryRun) {
          await writeFile(filePath, `${JSON.stringify(sketch, null, 2)}\n`, 'utf8');
        }
        touched.push(`sketch:${path.relative(capturesRoot, filePath)}`);
      } catch {
        /* skip */
      }
    });
  }

  if (touched.length) {
    console.warn(
      `  · Local FE remap ${oldKey} → ${newKey}: ${touched.length} touch(es)`,
    );
  }
  return { changed: touched.length > 0, touched };
}

/**
 * @param {object} presentation
 * @param {string} oldKey
 * @param {string} newKey
 */
export function remapPresentationObjectKeys(presentation, oldKey, newKey) {
  let remapped = 0;
  const remapKey = (k) => {
    if (String(k || '').trim() === oldKey) {
      remapped += 1;
      return newKey;
    }
    return k;
  };
  const visit = (node) => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) {
      return node.map((child) => {
        if (child && typeof child === 'object' && child.definitionKey) {
          const next = { ...child };
          const before = String(next.definitionKey || '');
          next.definitionKey = remapKey(before);
          if (Array.isArray(next.children)) next.children = visit(next.children);
          return next;
        }
        return visit(child);
      });
    }
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = visit(v);
    }
    return out;
  };
  const next = { ...presentation };
  if (next.availableRenderings && typeof next.availableRenderings === 'object') {
    /** @type {Record<string, string[]>} */
    const avail = {};
    for (const [group, list] of Object.entries(next.availableRenderings)) {
      avail[group] = (Array.isArray(list) ? list : []).map((k) => remapKey(k));
    }
    next.availableRenderings = avail;
  }
  if (next.pages) next.pages = visit(next.pages);
  if (next.partialDesigns) next.partialDesigns = visit(next.partialDesigns);
  return { presentation: next, remapped };
}

/**
 * @param {string} src
 * @param {string} oldKey
 * @param {string} newKey
 */
export function remapQuotedDefinitionKey(src, oldKey, newKey) {
  if (!oldKey || !newKey || oldKey === newKey) return src;
  const esc = oldKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(src || '').replace(
    new RegExp(`(['"])${esc}\\1`, 'g'),
    `$1${newKey}$1`,
  );
}

/**
 * Derive placeholder-like key from definitionKey
 * (`menzis-footer-account-links` → `footer-account-links`).
 * @param {string|null|undefined} definitionKey
 * @returns {string}
 */
export function inferPlaceholderFromDefinitionKey(definitionKey) {
  const key = String(definitionKey || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
  if (!key) return '';
  const parts = key.split('-').filter(Boolean);
  if (parts.length >= 2) return parts.slice(1).join('-');
  return key;
}

/**
 * After rename / parent regen: point capture-meta placeholderKey at a current host
 * key (or name-derived key). Never leave retired slots like footer-support-links.
 *
 * @param {object} meta
 * @param {{
 *   hostPlaceholderKeys?: string[]|null,
 *   definitionKey?: string|null,
 * }} [opts]
 * @returns {boolean} whether meta was mutated
 */
export function refreshCaptureMetaPlaceholderAgainstHost(meta, opts = {}) {
  if (!meta || typeof meta !== 'object') return false;
  const definitionKey = String(
    opts.definitionKey || meta.definitionKey || '',
  ).trim();
  const hostKeys = (opts.hostPlaceholderKeys || [])
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  const fromName = inferPlaceholderFromDefinitionKey(definitionKey);
  const current = String(meta.placeholderKey || '').trim();

  /** @type {string} */
  let next = current;
  if (hostKeys.length) {
    if (current && hostKeys.includes(current)) {
      next = current;
    } else if (fromName && hostKeys.includes(fromName)) {
      next = fromName;
    } else {
      const suffix = hostKeys.find(
        (k) =>
          definitionKey === k ||
          definitionKey.endsWith(`-${k}`) ||
          (fromName && fromName === k),
      );
      next = suffix || fromName || '';
    }
  } else if (fromName && current && current !== fromName) {
    // Rename without host keys: prefer name-derived over a clearly divergent stale PH.
    next = fromName;
  } else if (!current && fromName) {
    next = fromName;
  }

  if (!next || next === current) {
    // Still normalize placeholderKeys array when only that is stale.
    if (
      next &&
      Array.isArray(meta.placeholderKeys) &&
      (meta.placeholderKeys.length !== 1 ||
        meta.placeholderKeys[0] !== next)
    ) {
      meta.placeholderKeys = [next];
      return true;
    }
    return false;
  }

  meta.placeholderKey = next;
  meta.placeholderKeys = [next];
  return true;
}

/**
 * @param {object} meta
 * @param {string} oldName
 * @param {string} oldKey
 * @param {string} newName
 * @param {string} newKey
 * @param {{ hostPlaceholderKeys?: string[]|null }} [opts]
 */
export function remapCaptureMetaChildren(
  meta,
  oldName,
  oldKey,
  newName,
  newKey,
  opts = {},
) {
  if (!meta || typeof meta !== 'object') return false;
  let changed = false;
  if (Array.isArray(meta.children)) {
    for (const c of meta.children) {
      if (!c || typeof c !== 'object') continue;
      if (String(c.definitionKey || '') === oldKey) {
        c.definitionKey = newKey;
        changed = true;
      }
      if (String(c.componentName || '') === oldName) {
        c.componentName = newName;
        changed = true;
      }
      if (String(c.definitionKey || '') === newKey || String(c.definitionKey || '') === oldKey) {
        const childKey = String(c.definitionKey || newKey).trim();
        const fromName = inferPlaceholderFromDefinitionKey(childKey);
        const hostKeys = (opts.hostPlaceholderKeys || [])
          .map((k) => String(k || '').trim())
          .filter(Boolean);
        const ph = String(c.placeholderKey || '').trim();
        if (hostKeys.length) {
          if (ph && !hostKeys.includes(ph)) {
            const next =
              (fromName && hostKeys.includes(fromName) && fromName) ||
              hostKeys.find((k) => childKey.endsWith(`-${k}`)) ||
              fromName ||
              '';
            if (next && next !== ph) {
              c.placeholderKey = next;
              changed = true;
            }
          }
        } else if (fromName && ph && ph !== fromName) {
          c.placeholderKey = fromName;
          changed = true;
        }
      }
    }
  }
  // Own package meta (the renamed child itself).
  if (String(meta.definitionKey || '') === newKey || String(meta.definitionKey || '') === oldKey) {
    if (String(meta.definitionKey || '') === oldKey) {
      meta.definitionKey = newKey;
      changed = true;
    }
    if (String(meta.componentName || '') === oldName) {
      meta.componentName = newName;
      changed = true;
    }
    if (
      refreshCaptureMetaPlaceholderAgainstHost(meta, {
        definitionKey: newKey,
        hostPlaceholderKeys: opts.hostPlaceholderKeys,
      })
    ) {
      changed = true;
    }
  }
  return changed;
}

/**
 * @param {object} sketch
 * @param {string} oldKey
 * @param {string} newKey
 */
function remapLayoutSketchDefinitionKeys(sketch, oldKey, newKey) {
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (String(node.definitionKey || '') === oldKey) {
      node.definitionKey = newKey;
    }
    if (node.placeholders && typeof node.placeholders === 'object') {
      for (const list of Object.values(node.placeholders)) visit(list);
    }
    if (Array.isArray(node.renderings)) {
      for (const r of node.renderings) visit(r);
    }
  };
  visit(sketch);
}

/**
 * @param {string} root
 * @param {(filePath: string) => Promise<void>} onFile
 */
async function walkFiles(root, onFile) {
  /** @type {string[]} */
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    if (!dir) continue;
    let ents;
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of ents) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(abs);
      else if (ent.isFile()) await onFile(abs);
    }
  }
}

/**
 * Remap section-name-index rows that still point at the retired package name
 * to the new package (shared registry / other pages). When no new name is given,
 * drop those rows.
 * @param {string} hostSlug
 * @param {string} oldComponentName
 * @param {{
 *   dryRun?: boolean,
 *   newComponentName?: string|null,
 *   newDefinitionKey?: string|null,
 * }} [opts]
 */
export async function scrubIndexEntriesForOldName(
  hostSlug,
  oldComponentName,
  opts = {},
) {
  const dryRun = Boolean(opts.dryRun);
  const newName = String(opts.newComponentName || '').trim();
  const newKey = String(opts.newDefinitionKey || '').trim();
  const indexPath = path.join(
    bqRoot,
    'src',
    'components',
    hostSlug,
    'section-name-index.json',
  );
  if (!fs.existsSync(indexPath)) {
    return { changed: false, touchedKeys: [] };
  }
  let index = {};
  try {
    index = JSON.parse(await readFile(indexPath, 'utf8')) || {};
  } catch {
    return { changed: false, touchedKeys: [] };
  }
  const oldName = String(oldComponentName || '').trim();
  /** @type {string[]} */
  const touchedKeys = [];
  for (const [key, entry] of Object.entries(index)) {
    if (!entry || typeof entry !== 'object') continue;
    if (String(entry.componentName || '').trim() === oldName) {
      if (newName) {
        entry.componentName = newName;
        if (newKey) entry.definitionKey = newKey;
        entry.updatedAt = new Date().toISOString();
        touchedKeys.push(key);
      } else {
        delete index[key];
        touchedKeys.push(key);
      }
      continue;
    }
    if (Array.isArray(entry.children)) {
      let childChanged = false;
      const nextChildren = [];
      for (const c of entry.children) {
        if (c && typeof c === 'object') {
          const childName = String(c.componentName || '').trim();
          const childKey = String(c.definitionKey || '').trim();
          if (childName === oldName || (newKey && childKey === toDefinitionKey(oldName))) {
            childChanged = true;
            if (!newName) continue;
            nextChildren.push({
              ...c,
              componentName: newName,
              ...(newKey ? { definitionKey: newKey } : {}),
            });
            continue;
          }
          nextChildren.push(c);
          continue;
        }
        if (String(c || '').trim() === oldName) {
          childChanged = true;
          if (newName) nextChildren.push(newName);
          continue;
        }
        nextChildren.push(c);
      }
      if (childChanged) {
        entry.children = nextChildren;
        touchedKeys.push(`${key}#child:${oldName}`);
      }
    }
  }
  if (touchedKeys.length && !dryRun) {
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  }
  return { changed: touchedKeys.length > 0, touchedKeys };
}

/**
 * @param {string} dir
 */
async function dirExists(dir) {
  try {
    await fs.promises.access(dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * If resolve result is a force-rename, retire the old package (unless dry-run).
 * @param {object} resolved
 * @param {{
 *   hostSlug: string,
 *   dryRun?: boolean,
 *   collectionSystem?: string|null,
 *   siteSystem?: string|null,
 * }} ctx
 */
export async function maybeRetireForceRenamed(resolved, ctx) {
  const casingFrom = String(resolved?.retireCasingSiblingFrom || '').trim();
  const survivor = String(resolved?.componentName || '').trim();
  if (casingFrom && survivor) {
    const casingResult = await retireCasingSiblingPackageFiles({
      hostSlug: ctx.hostSlug,
      survivorComponentName: survivor,
      siblingComponentName: casingFrom,
      siblingDefinitionKey: resolved.previousDefinitionKey || null,
      dryRun: Boolean(ctx.dryRun),
    });
    if (casingResult?.removed?.length) {
      console.warn(
        `  · Retired casing-sibling package files: ${casingFrom} (kept ${survivor})`,
      );
    }
  }

  const from = String(resolved?.forceRenamedFrom || '').trim();
  if (!from) return casingFrom ? { casingSibling: true } : null;
  if (from === survivor) return null;
  // Casing-only must not run full package delete (same Windows folder as survivor).
  if (from.toLowerCase() === survivor.toLowerCase()) return null;
  console.warn(
    `  · Retiring old package after --force rename: ${from} → ${resolved.componentName}`,
  );
  return retireForceRenamedPackage({
    hostSlug: ctx.hostSlug,
    oldComponentName: from,
    oldDefinitionKey: resolved.previousDefinitionKey || null,
    newComponentName: resolved.componentName || null,
    newDefinitionKey: resolved.definitionKey || null,
    collectionSystem: ctx.collectionSystem || null,
    siteSystem: ctx.siteSystem || null,
    dryRun: Boolean(ctx.dryRun),
  });
}

/**
 * Delete FE package files for a casing-only sibling kebab in the same folder
 * without removing the survivor package (Windows case-insensitive dirs).
 * @param {{
 *   hostSlug: string,
 *   survivorComponentName: string,
 *   siblingComponentName: string,
 *   siblingDefinitionKey?: string|null,
 *   dryRun?: boolean,
 * }} opts
 */
export async function retireCasingSiblingPackageFiles(opts) {
  const hostSlug = String(opts.hostSlug || '').trim();
  const survivor = String(opts.survivorComponentName || '').trim();
  const sibling = String(opts.siblingComponentName || '').trim();
  if (!hostSlug || !survivor || !sibling) {
    return { removed: [], skipped: true };
  }
  const survivorKebab = toKebabCase(survivor);
  const siblingKebab = toKebabCase(sibling);
  if (!siblingKebab || siblingKebab === survivorKebab) {
    return { removed: [], skipped: true, reason: 'same-kebab' };
  }

  const dir = componentDir(hostSlug, survivor);
  const suffixes = [
    '.tsx',
    '.client.tsx',
    '.definition.ts',
    '.capture-meta.json',
  ];
  /** @type {string[]} */
  const removed = [];
  for (const suffix of suffixes) {
    const filePath = path.join(dir, `${siblingKebab}${suffix}`);
    if (!fs.existsSync(filePath)) continue;
    if (!opts.dryRun) {
      try {
        await fs.promises.unlink(filePath);
        removed.push(filePath);
      } catch {
        /* ignore */
      }
    } else {
      removed.push(filePath);
    }
  }

  return { removed, survivorKebab, siblingKebab };
}
