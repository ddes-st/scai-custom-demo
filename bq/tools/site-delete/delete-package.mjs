/**
 * Package / restore helpers for `delete:collection --package` and `restore:collection`.
 *
 * Archive: `.bq/delete-packages/collection-{name}-{stamp}.tar.gz`
 * Layout: manifest.json + files/ (deleted trees) + snapshots/ (pre-scrub file copies)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bqDotDir, repoRoot as defaultRepoRoot } from '../capture/paths.mjs';
import { findSaiModuleJsonPath } from '../definitions/apply/module-json.ts';
import { BQ_CACHE_DIR } from '../shared/paths.ts';
import { sitesApiOwnedStatePath } from '../shared/sites-api-owned-state.ts';

export const DELETE_PACKAGE_VERSION = 1;
export const DELETE_PACKAGES_DIR = path.join(bqDotDir, 'delete-packages');
const URL_ROUTES_PATH = path.join(BQ_CACHE_DIR, 'url-routes.json');
const EMIT_SOURCE_PATH = path.join(BQ_CACHE_DIR, 'apply-source.json');

/**
 * @param {string} abs
 * @param {string} [root]
 */
export function toRepoRelative(abs, root = defaultRepoRoot) {
  const resolved = path.normalize(path.resolve(abs));
  const base = path.normalize(path.resolve(root));
  const rel = path.relative(base, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `[delete-package] path escapes repo root: ${resolved} (root=${base})`,
    );
  }
  return rel.split(path.sep).join('/');
}

/**
 * @param {string} repoRel posix-ish
 */
export function archiveEntryPath(kind, repoRel) {
  const safe = String(repoRel || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');
  return `${kind}/${safe}`;
}

/**
 * @param {string} collectionSystem
 * @param {Date} [when]
 */
export function defaultArchiveFileName(collectionSystem, when = new Date()) {
  const stamp = when
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z')
    .replace('T', '-');
  const name = String(collectionSystem || 'collection')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-');
  return `collection-${name}-${stamp}.tar.gz`;
}

/**
 * @param {string} collectionSystem
 * @param {Date} [when]
 */
export function defaultArchivePath(collectionSystem, when = new Date()) {
  return path.join(
    DELETE_PACKAGES_DIR,
    defaultArchiveFileName(collectionSystem, when),
  );
}

/**
 * @param {string} filePath
 */
function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * @param {string} stageDir
 * @param {'files'|'snapshots'} kind
 * @param {string} absPath
 * @param {string} repoRoot
 * @returns {Promise<{ repoPath: string, archivePath: string }|null>}
 */
async function stageCopy(stageDir, kind, absPath, repoRoot) {
  if (!exists(absPath)) return null;
  const repoPath = toRepoRelative(absPath, repoRoot);
  const archivePath = archiveEntryPath(kind, repoPath);
  const dest = path.join(stageDir, ...archivePath.split('/'));
  await mkdir(path.dirname(dest), { recursive: true });
  const st = fs.statSync(absPath);
  if (st.isDirectory()) {
    await cp(absPath, dest, { recursive: true, force: true });
  } else {
    await copyFile(absPath, dest);
  }
  return { repoPath, archivePath };
}

/**
 * @typedef {{
 *   moduleJson?: string,
 *   urlRoutes?: string,
 *   emitSource?: string,
 *   ownedState?: string,
 * }} PackagePathOverrides
 */

/**
 * Build deleted + snapshot + rename lists for a collection delete plan.
 *
 * @param {{
 *   plan: any,
 *   flat: ReturnType<import('./lib.mjs').flattenPlanPaths>,
 *   repoRoot?: string,
 *   paths?: PackagePathOverrides,
 *   includeInventories?: boolean,
 *   includeCaptureScrub?: boolean,
 * }} opts
 */
export async function collectCollectionPackageEntries(opts) {
  const plan = opts.plan;
  const flat = opts.flat;
  const repoRoot = opts.repoRoot || defaultRepoRoot;
  const pathOverrides = opts.paths || {};
  const includeInventories = opts.includeInventories !== false;
  const includeCaptureScrub = opts.includeCaptureScrub !== false;

  /** @type {Map<string, { repoPath: string, absPath: string }>} */
  const deletedMap = new Map();
  /** @type {Map<string, { repoPath: string, absPath: string, reason: string }>} */
  const snapshotMap = new Map();
  /** @type {Array<{ from: string, to: string }>} */
  const renames = [];

  /**
   * @param {string} abs
   */
  const addDeleted = (abs) => {
    if (!exists(abs)) return;
    const resolved = path.normalize(path.resolve(abs));
    try {
      const repoPath = toRepoRelative(resolved, repoRoot);
      deletedMap.set(repoPath, { repoPath, absPath: resolved });
    } catch {
      /* skip paths outside repo */
    }
  };

  /**
   * @param {string} abs
   * @param {string} reason
   */
  const addSnapshot = (abs, reason) => {
    if (!exists(abs)) return;
    const resolved = path.normalize(path.resolve(abs));
    try {
      const repoPath = toRepoRelative(resolved, repoRoot);
      if (!snapshotMap.has(repoPath)) {
        snapshotMap.set(repoPath, { repoPath, absPath: resolved, reason });
      }
    } catch {
      /* skip */
    }
  };

  for (const d of flat.dirs || []) addDeleted(d);
  for (const y of flat.yamlRoots || []) addDeleted(y);
  for (const h of flat.hashOrphanDirs || []) addDeleted(h);

  for (const f of flat.definitionFiles || flat.files || []) {
    if (!exists(f)) continue;
    const from = path.normalize(path.resolve(f));
    const to = `${from}.disabled`;
    try {
      const fromRel = toRepoRelative(from, repoRoot);
      const toRel = toRepoRelative(to, repoRoot);
      renames.push({ from: fromRel, to: toRel });
      addDeleted(from);
    } catch {
      /* skip */
    }
  }

  if (includeInventories || includeCaptureScrub) {
    // Dynamic import avoids circular load with lib.mjs (which imports this module).
    const {
      deleteInventoriesForKeys,
      scrubCreateArtifactsFromCaptures,
    } = await import('./lib.mjs');

    if (includeInventories) {
      const inventorySiteSystems =
        plan.mode === 'collection'
          ? (plan.local.sitePlans || []).map((s) => s.siteSystem).filter(Boolean)
          : plan.siteSystem
            ? [plan.siteSystem]
            : [];
      const inventoryFiles = deleteInventoriesForKeys(flat.definitionKeys || [], {
        apply: false,
        siteSystem: plan.siteSystem,
        siteSystems: inventorySiteSystems,
        collectionSystem: plan.collectionSystem,
        wipeCollection: plan.mode === 'collection',
      });
      for (const inv of inventoryFiles) addDeleted(inv);
    }

    if (includeCaptureScrub) {
      const capturePreview = await scrubCreateArtifactsFromCaptures(
        flat.captureRoots || [],
        { apply: false },
      );
      for (const p of capturePreview.removedPaths || []) addDeleted(p);
      for (const p of capturePreview.strippedSectionInfo || []) {
        addSnapshot(p, 'section-information');
      }
    }
  }

  try {
    addSnapshot(
      pathOverrides.moduleJson || findSaiModuleJsonPath(),
      'module-json',
    );
  } catch {
    /* no SAI module */
  }
  addSnapshot(pathOverrides.urlRoutes || URL_ROUTES_PATH, 'url-routes');
  addSnapshot(pathOverrides.emitSource || EMIT_SOURCE_PATH, 'apply-source');
  try {
    addSnapshot(
      pathOverrides.ownedState || sitesApiOwnedStatePath(),
      'sites-api-owned',
    );
  } catch {
    /* no owned state */
  }

  return {
    deleted: [...deletedMap.values()],
    snapshots: [...snapshotMap.values()],
    renames,
    repoRoot,
  };
}

/**
 * @param {{
 *   plan: any,
 *   flat: any,
 *   localOnly?: boolean,
 *   dryRun?: boolean,
 *   archivePath?: string,
 *   repoRoot?: string,
 *   packagesDir?: string,
 *   paths?: PackagePathOverrides,
 *   includeInventories?: boolean,
 *   includeCaptureScrub?: boolean,
 *   cliArgs?: string[],
 * }} opts
 */
export async function packageCollectionDeleteArchive(opts) {
  const plan = opts.plan;
  if (plan?.mode !== 'collection') {
    throw new Error(
      '[delete-package] packaging is only supported for collection mode',
    );
  }
  const dryRun = Boolean(opts.dryRun);
  const repoRoot = opts.repoRoot || defaultRepoRoot;
  const packagesDir = opts.packagesDir || DELETE_PACKAGES_DIR;
  const archivePath =
    opts.archivePath ||
    path.join(packagesDir, defaultArchiveFileName(plan.collectionSystem));

  const collected = await collectCollectionPackageEntries({
    plan,
    flat: opts.flat,
    repoRoot,
    paths: opts.paths,
    includeInventories: opts.includeInventories,
    includeCaptureScrub: opts.includeCaptureScrub,
  });

  const siteSystems = (plan.local?.sitePlans || [])
    .map((s) => s.siteSystem)
    .filter(Boolean);

  /** @type {object} */
  const manifest = {
    version: DELETE_PACKAGE_VERSION,
    mode: 'collection',
    collectionSystem: plan.collectionSystem,
    siteSystems,
    createdAt: new Date().toISOString(),
    localOnly: Boolean(opts.localOnly),
    cliArgs: opts.cliArgs || [],
    remote: {
      // Actual Sites API outcome is recorded after delete; at package time we only know intent.
      status: opts.localOnly ? 'skipped-local-only' : 'will-delete-remote',
    },
    deleted: /** @type {Array<{ repoPath: string, archivePath: string }>} */ (
      []
    ),
    snapshots: /** @type {Array<{ repoPath: string, archivePath: string, reason: string }>} */ (
      []
    ),
    renames: collected.renames,
  };

  if (dryRun) {
    return {
      dryRun: true,
      archivePath,
      deletedCount: collected.deleted.length,
      snapshotCount: collected.snapshots.length,
      renameCount: collected.renames.length,
      deleted: collected.deleted.map((d) => d.repoPath),
      snapshots: collected.snapshots.map((s) => ({
        repoPath: s.repoPath,
        reason: s.reason,
      })),
      renames: collected.renames,
      manifest,
    };
  }

  await mkdir(path.dirname(archivePath), { recursive: true });
  await mkdir(packagesDir, { recursive: true });
  const stageDir = await mkdtemp(
    path.join(packagesDir, `_stage-${plan.collectionSystem}-`),
  );

  try {
    for (const entry of collected.deleted) {
      const staged = await stageCopy(
        stageDir,
        'files',
        entry.absPath,
        repoRoot,
      );
      if (staged) manifest.deleted.push(staged);
    }
    for (const entry of collected.snapshots) {
      const staged = await stageCopy(
        stageDir,
        'snapshots',
        entry.absPath,
        repoRoot,
      );
      if (staged) {
        manifest.snapshots.push({
          ...staged,
          reason: entry.reason,
        });
      }
    }

    await writeFile(
      path.join(stageDir, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );

    await createTarGz(stageDir, archivePath);

    return {
      dryRun: false,
      archivePath,
      deletedCount: manifest.deleted.length,
      snapshotCount: manifest.snapshots.length,
      renameCount: manifest.renames.length,
      manifest,
    };
  } finally {
    await rm(stageDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * @param {string} stageDir
 * @param {string} archivePath
 */
export function createTarGz(stageDir, archivePath) {
  if (exists(archivePath)) {
    fs.unlinkSync(archivePath);
  }
  const result = spawnSync(
    'tar',
    ['-czf', archivePath, '-C', stageDir, '.'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(
      `[delete-package] tar create failed (exit ${result.status}): ${
        result.stderr || result.stdout || 'no output'
      }`,
    );
  }
  if (!exists(archivePath)) {
    throw new Error(`[delete-package] tar did not create ${archivePath}`);
  }
}

/**
 * @param {string} archivePath
 * @param {string} destDir
 */
export function extractTarGz(archivePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const result = spawnSync(
    'tar',
    ['-xzf', archivePath, '-C', destDir],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(
      `[delete-package] tar extract failed (exit ${result.status}): ${
        result.stderr || result.stdout || 'no output'
      }`,
    );
  }
}

/**
 * @param {{
 *   archivePath: string,
 *   dryRun?: boolean,
 *   repoRoot?: string,
 * }} opts
 */
export async function restoreCollectionPackage(opts) {
  const archivePath = path.resolve(opts.archivePath);
  if (!exists(archivePath)) {
    throw new Error(`[restore:collection] package not found: ${archivePath}`);
  }
  const dryRun = Boolean(opts.dryRun);
  const repoRoot = opts.repoRoot || defaultRepoRoot;

  const extractDir = await mkdtemp(path.join(os.tmpdir(), 'bq-restore-coll-'));
  try {
    extractTarGz(archivePath, extractDir);
    const manifestPath = path.join(extractDir, 'manifest.json');
    if (!exists(manifestPath)) {
      throw new Error(
        `[restore:collection] manifest.json missing in ${archivePath}`,
      );
    }
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (manifest.version !== DELETE_PACKAGE_VERSION) {
      throw new Error(
        `[restore:collection] unsupported package version ${manifest.version}`,
      );
    }
    if (manifest.mode !== 'collection') {
      throw new Error(
        `[restore:collection] package mode is ${manifest.mode}, expected collection`,
      );
    }

    /** @type {string[]} */
    const restoredFiles = [];
    /** @type {string[]} */
    const restoredSnapshots = [];
    /** @type {string[]} */
    const clearedDisabled = [];

    for (const entry of manifest.deleted || []) {
      const src = path.join(extractDir, ...String(entry.archivePath).split('/'));
      const dest = path.join(repoRoot, ...String(entry.repoPath).split('/'));
      if (!exists(src)) {
        throw new Error(
          `[restore:collection] missing archive entry ${entry.archivePath}`,
        );
      }
      if (!dryRun) {
        await mkdir(path.dirname(dest), { recursive: true });
        const st = fs.statSync(src);
        if (st.isDirectory()) {
          await rm(dest, { recursive: true, force: true }).catch(() => {});
          await cp(src, dest, { recursive: true, force: true });
        } else {
          await mkdir(path.dirname(dest), { recursive: true });
          await copyFile(src, dest);
        }
      }
      restoredFiles.push(entry.repoPath);
    }

    for (const entry of manifest.snapshots || []) {
      const src = path.join(extractDir, ...String(entry.archivePath).split('/'));
      const dest = path.join(repoRoot, ...String(entry.repoPath).split('/'));
      if (!exists(src)) {
        throw new Error(
          `[restore:collection] missing snapshot ${entry.archivePath}`,
        );
      }
      if (!dryRun) {
        await mkdir(path.dirname(dest), { recursive: true });
        await copyFile(src, dest);
      }
      restoredSnapshots.push(entry.repoPath);
    }

    for (const ren of manifest.renames || []) {
      const fromAbs = path.join(repoRoot, ...String(ren.from).split('/'));
      const toAbs = path.join(repoRoot, ...String(ren.to).split('/'));
      if (!dryRun && exists(toAbs)) {
        // Prefer restored enabled file; drop leftover .disabled
        if (exists(fromAbs)) {
          await rm(toAbs, { force: true });
          clearedDisabled.push(ren.to);
        } else {
          await mkdir(path.dirname(fromAbs), { recursive: true });
          await rename(toAbs, fromAbs);
          clearedDisabled.push(ren.to);
        }
      } else if (dryRun && exists(toAbs)) {
        clearedDisabled.push(ren.to);
      }
    }

    const remoteStatus = String(
      manifest.remote?.status || manifest.remote?.action || '',
    );
    const remoteWasDeleted =
      !manifest.localOnly &&
      (/deleted/i.test(remoteStatus) ||
        /will-delete-remote/i.test(remoteStatus));

    return {
      dryRun,
      archivePath,
      manifest,
      restoredFiles,
      restoredSnapshots,
      clearedDisabled,
      remoteWasDeleted,
      remote: manifest.remote || null,
    };
  } finally {
    await rm(extractDir, { recursive: true, force: true }).catch(() => {});
  }
}
