/**
 * Core helpers for `npm run site:delete` / `create:sectioncomponents:reset`.
 *
 * Wipes a BQ site or entire collection: FE packages, defs, authoring YAML,
 * create:sectioncomponents caches (not raw capture:webpage crops), and remote Sites API.
 */
import fs from 'node:fs';
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot, bqDotDir, defaultCapturesDir } from '../capture/paths.mjs';
import { hostSlugFromUrl } from '../capture/lib/url-utils.mjs';
import {
  COMPONENTS_ROOT,
  collectionDefinitionPath,
  legacyCollectionDefinitionPath,
  LEGACY_COLLECTIONS_DIR,
  LEGACY_SITES_DIR,
  presentationDefinitionPath,
  siteDefinitionPath,
} from '../create-section-components/definition-paths.mjs';
import {
  parseHostnameBrandMarket,
  hostToHostSlugFolder,
} from '../create-section-components/naming.mjs';
import {
  deleteApplyInventory,
  loadApplyInventory,
} from '../shared/apply-inventory.ts';
import {
  createSitesApiContext,
  deleteCollectionViaApi,
  deleteSiteViaApi,
  findCollectionByName,
  findSiteByName,
  listSites,
} from '../definitions/apply/sites-api.ts';
import {
  readSitesApiOwnedState,
  writeSitesApiOwnedState,
} from '../shared/sites-api-owned-state.ts';
import { applySourceScopeKey } from '../shared/apply-source-cache.mjs';
import { BQ_CACHE_DIR, BQ_DEFINITIONS_DIR } from '../shared/paths.ts';
import {
  filterSafeDeleteRoots,
  listYamlUnderRoots,
  deleteBqOwnedYaml,
  hostComponentsDir,
} from '../component-delete/lib.mjs';
import { getDefinitionPruneRoots } from '../shared/prune-roots.ts';
import { importAllDefinitions } from '../shared/discover.ts';
import {
  expandModuleForSerSession,
  resetModuleJsonToMinimal,
} from '../definitions/apply/module-json.ts';
import { pullSerializationNow } from '../shared/ser-cli.ts';
import { packageCollectionDeleteArchive } from './delete-package.mjs';

const URL_ROUTES_PATH = path.join(BQ_CACHE_DIR, 'url-routes.json');
const EMIT_SOURCE_PATH = path.join(BQ_CACHE_DIR, 'apply-source.json');
const EMIT_INVENTORY_DIR = path.join(BQ_DEFINITIONS_DIR, 'apply-inventory');
const PRESENTATION_CACHE_DIR = path.join(BQ_DEFINITIONS_DIR, 'presentation');
const VISUAL_FIDELITY_DIR = path.join(bqDotDir, 'visual-fidelity');
const SOURCE_FIDELITY_DIR = path.join(bqDotDir, 'source-fidelity');

/**
 * Normalize a URL / hostname / system-name token into collection + site identity.
 * Deep paths are ignored — only the hostname matters (any page under the site).
 *
 * @param {string} urlOrHostOrName
 * @returns {{
 *   input: string,
 *   lookLikeUrl: boolean,
 *   collectionSystem: string,
 *   siteSystem: string,
 *   hostname: string,
 *   hostFolder: string,
 *   captureHostSlugs: string[],
 * }}
 */
export function resolveIdentityFromInput(urlOrHostOrName) {
  const input = String(urlOrHostOrName || '').trim();
  if (!input) {
    throw new Error('Empty site/collection/url input');
  }

  const lookLikeUrl =
    /^(https?:\/\/)/i.test(input) ||
    /\./.test(input.split('/')[0]) ||
    /^www[.-]/i.test(input);

  if (lookLikeUrl) {
    const parts = parseHostnameBrandMarket(input);
    const bareHost = parts.hostname; // no www
    const withWww = bareHost.startsWith('www.') ? bareHost : `www.${bareHost}`;
    /** @type {Set<string>} */
    const slugs = new Set();
    for (const host of [bareHost, withWww, parts.hostname]) {
      try {
        slugs.add(hostSlugFromUrl(`https://${host}`));
      } catch {
        /* ignore */
      }
    }
    // FE folder drops leading www- (www-sitecore-com → sitecore-com)
    const hostFolder =
      hostToHostSlugFolder([...slugs][0] || parts.siteSystemName) ||
      parts.siteSystemName;

    return {
      input,
      lookLikeUrl: true,
      collectionSystem: parts.collectionSystemName,
      siteSystem: parts.siteSystemName,
      hostname: bareHost,
      hostFolder,
      captureHostSlugs: [...slugs],
    };
  }

  // System name: sitecore-com or sitecore
  const system = input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
  if (!system) {
    throw new Error(`Invalid system name: ${urlOrHostOrName}`);
  }

  // Heuristic: name with hyphen is a site (sitecore-com); bare brand is collection
  const isSiteName = system.includes('-');
  const collectionSystem = isSiteName ? system.split('-')[0] : system;
  const siteSystem = isSiteName ? system : `${system}-com`;

  return {
    input,
    lookLikeUrl: false,
    collectionSystem,
    siteSystem,
    hostname: isSiteName
      ? system.replace(/-/g, '.')
      : `${system}.com`,
    hostFolder: isSiteName ? system : `${system}-com`,
    captureHostSlugs: isSiteName
      ? [system, `www-${system}`]
      : [`${system}-com`, `www-${system}-com`],
  };
}

/**
 * @param {string} filePath
 * @returns {Promise<{ systemName?: string, collectionSystem?: string, definitionKey?: string, kind?: string }|null>}
 */
async function readDefinitionMeta(filePath) {
  try {
    const src = await readFile(filePath, 'utf8');
    const systemName = (src.match(/systemName:\s*["']([^"']+)["']/) || [])[1];
    const collectionSystem = (src.match(/collectionSystem:\s*["']([^"']+)["']/) ||
      [])[1];
    const definitionKey = (src.match(/definitionKey:\s*["']([^"']+)["']/) ||
      [])[1];
    const kind = (src.match(/kind:\s*["']([^"']+)["']/) || [])[1];
    return { systemName, collectionSystem, definitionKey, kind };
  } catch {
    return null;
  }
}

/**
 * Discover local sites whose collectionSystem matches.
 * @param {string} collectionSystem
 * @returns {Promise<{ siteSystem: string, collectionSystem: string, siteDefPath: string, presentationDefPath: string, hostFolder: string }[]>}
 */
/**
 * Collect `*-site.definition.ts` under host folders + legacy `sites/`.
 * @returns {Promise<{ siteDefPath: string, hostFolder: string }[]>}
 */
async function listSiteDefinitionFiles() {
  /** @type {{ siteDefPath: string, hostFolder: string }[]} */
  const out = [];
  /** @type {string[]} */
  let hostEntries = [];
  try {
    hostEntries = await readdir(COMPONENTS_ROOT);
  } catch {
    return out;
  }
  for (const name of hostEntries) {
    if (name === 'sites' || name === 'collections') continue;
    const hostDir = path.join(COMPONENTS_ROOT, name);
    let st;
    try {
      st = fs.statSync(hostDir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    let files = [];
    try {
      files = await readdir(hostDir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('-site.definition.ts')) continue;
      out.push({ siteDefPath: path.join(hostDir, f), hostFolder: name });
    }
  }
  // Legacy flat sites/
  if (exists(LEGACY_SITES_DIR)) {
    let files = [];
    try {
      files = await readdir(LEGACY_SITES_DIR);
    } catch {
      files = [];
    }
    for (const f of files) {
      if (!f.endsWith('-site.definition.ts')) continue;
      const siteSystem = f.replace(/-site\.definition\.ts$/i, '');
      out.push({
        siteDefPath: path.join(LEGACY_SITES_DIR, f),
        hostFolder: hostToHostSlugFolder(siteSystem),
      });
    }
  }
  return out;
}

export async function discoverSitesForCollection(collectionSystem) {
  const want = String(collectionSystem || '')
    .trim()
    .toLowerCase();
  /** @type {Awaited<ReturnType<typeof discoverSitesForCollection>>} */
  const out = [];
  const files = await listSiteDefinitionFiles();
  for (const { siteDefPath, hostFolder } of files) {
    const name = path.basename(siteDefPath);
    const meta = await readDefinitionMeta(siteDefPath);
    const siteSystem =
      meta?.systemName || name.replace(/-site\.definition\.ts$/i, '');
    const coll = (meta?.collectionSystem || '').toLowerCase();
    if (coll && coll !== want) continue;
    // Fallback: site system starts with collection-
    if (
      !coll &&
      !siteSystem.toLowerCase().startsWith(`${want}-`) &&
      siteSystem.toLowerCase() !== want
    ) {
      continue;
    }
    const presentationDefPath = presentationDefinitionPath(
      hostFolder,
      siteSystem,
    );
    out.push({
      siteSystem,
      collectionSystem: want,
      siteDefPath,
      presentationDefPath,
      hostFolder,
    });
  }
  return out.sort((a, b) => a.siteSystem.localeCompare(b.siteSystem));
}

/**
 * Capture project folders under `.bq/captures` that belong to a site.
 * Matches www-sitecore-com, sitecore-com, and any hostname whose brand+tld maps to the site.
 *
 * @param {{ siteSystem: string, collectionSystem: string, captureHostSlugs?: string[] }} site
 * @param {string} [capturesRoot]
 * @returns {string[]}
 */
export function listCaptureDirsForSite(site, capturesRoot = defaultCapturesDir) {
  /** @type {Set<string>} */
  const want = new Set(
    (site.captureHostSlugs || []).map((s) => s.toLowerCase()),
  );
  want.add(String(site.siteSystem || '').toLowerCase());
  want.add(`www-${site.siteSystem}`.toLowerCase());

  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(capturesRoot)) return out;
  for (const ent of fs.readdirSync(capturesRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const name = ent.name.toLowerCase();
    if (want.has(name)) {
      out.push(path.join(capturesRoot, ent.name));
      continue;
    }
    // Hostname slug → identity (www-sitecore-com → sitecore-com)
    try {
      const hostLike = name.replace(/-/g, '.');
      const id = resolveIdentityFromInput(hostLike);
      if (
        id.siteSystem === site.siteSystem ||
        id.hostFolder === site.siteSystem
      ) {
        out.push(path.join(capturesRoot, ent.name));
      }
    } catch {
      /* ignore */
    }
  }
  return [...new Set(out)];
}

/**
 * @param {string} p
 * @returns {boolean}
 */
function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * Collect absolute paths that currently exist (files or dirs).
 * @param {string[]} candidates
 * @returns {string[]}
 */
export function existingPaths(candidates) {
  return [...new Set(candidates.map((p) => path.normalize(path.resolve(p))))].filter(
    exists,
  );
}

/**
 * Build local delete plan for one site (does not include collection-wide roots).
 * @param {{
 *   siteSystem: string,
 *   collectionSystem: string,
 *   hostFolder?: string,
 *   captureHostSlugs?: string[],
 * }} site
 */
export async function buildSiteLocalPlan(site) {
  const siteSystem = site.siteSystem;
  const collectionSystem = site.collectionSystem;
  const hostFolder = site.hostFolder || siteSystem;
  const hostDir = hostComponentsDir(hostFolder);

  const siteDefCanonical = siteDefinitionPath(hostFolder, siteSystem);
  const siteDefLegacy = path.join(
    LEGACY_SITES_DIR,
    `${siteSystem}-site.definition.ts`,
  );
  const siteDefPath = exists(siteDefCanonical)
    ? siteDefCanonical
    : exists(siteDefLegacy)
      ? siteDefLegacy
      : siteDefCanonical;

  const presentationCanonical = presentationDefinitionPath(
    hostFolder,
    siteSystem,
  );
  const presentationLegacy = path.join(
    LEGACY_SITES_DIR,
    `${siteSystem}-presentation.definition.ts`,
  );
  const presentationDefPath = exists(presentationCanonical)
    ? presentationCanonical
    : exists(presentationLegacy)
      ? presentationLegacy
      : presentationCanonical;

  /** @type {string[]} */
  const packageDirs = [];
  /** @type {string[]} */
  const definitionKeys = [
    `${siteSystem}-site`,
    `${siteSystem}-presentation`,
  ];
  /** @type {string[]} */
  const componentYaml = [];

  if (exists(hostDir)) {
    for (const ent of fs.readdirSync(hostDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const pkgDir = path.join(hostDir, ent.name);
      packageDirs.push(pkgDir);
      // Load definition for prune roots + inventory
      const defFiles = fs
        .readdirSync(pkgDir)
        .filter((f) => f.endsWith('.definition.ts'));
      for (const df of defFiles) {
        const defPath = path.join(pkgDir, df);
        try {
          const defs = await importAllDefinitions(defPath);
          for (const def of defs || []) {
            if (def?.definitionKey) definitionKeys.push(def.definitionKey);
            if (def) {
              const roots = filterSafeDeleteRoots(
                getDefinitionPruneRoots(def),
                def,
              );
              componentYaml.push(...listYamlUnderRoots(roots));
              const inv = loadApplyInventory(def.definitionKey);
              for (const e of inv?.entries || []) {
                if (e.diskPath && exists(e.diskPath)) {
                  componentYaml.push(path.normalize(path.resolve(e.diskPath)));
                }
              }
            }
          }
        } catch {
          /* empty stub / bad def — still delete package dir */
        }
      }
    }
  }

  const captures = listCaptureDirsForSite({
    siteSystem,
    collectionSystem,
    captureHostSlugs: site.captureHostSlugs,
  });

  const cachePaths = [
    path.join(PRESENTATION_CACHE_DIR, collectionSystem, siteSystem),
    path.join(VISUAL_FIDELITY_DIR, siteSystem),
    path.join(VISUAL_FIDELITY_DIR, hostFolder),
    path.join(SOURCE_FIDELITY_DIR, siteSystem),
    path.join(SOURCE_FIDELITY_DIR, hostFolder),
    path.join(bqDotDir, `ser-push-${siteSystem}.log`),
  ];

  return {
    siteSystem,
    collectionSystem,
    hostFolder,
    hostDir,
    siteDefPath,
    presentationDefPath,
    packageDirs,
    definitionKeys: [...new Set(definitionKeys)],
    componentYamlCandidates: [...new Set(componentYaml)],
    serializationRoots: [],
    captureDirs: captures,
    cachePaths,
    emitSourceKey: applySourceScopeKey({
      collectionSystem,
      siteSystem,
    }),
    urlRoutesKey: `${collectionSystem}/${siteSystem}`,
  };
}

/**
 * @param {string} collectionSystem
 */
export async function buildCollectionLocalPlan(collectionSystem) {
  const coll = String(collectionSystem || '')
    .trim()
    .toLowerCase();
  const sites = await discoverSitesForCollection(coll);
  /** @type {Awaited<ReturnType<typeof buildSiteLocalPlan>>[]} */
  const sitePlans = [];
  for (const s of sites) {
    sitePlans.push(
      await buildSiteLocalPlan({
        siteSystem: s.siteSystem,
        collectionSystem: coll,
        hostFolder: s.hostFolder,
        captureHostSlugs: [
          s.siteSystem,
          `www-${s.siteSystem}`,
        ],
      }),
    );
  }

  // Also include a synthetic plan when site defs are gone but host folder remains
  const hostGuess = path.join(bqRoot, 'src', 'components', `${coll}-com`);
  if (exists(hostGuess) && !sitePlans.some((p) => p.hostDir === hostGuess)) {
    sitePlans.push(
      await buildSiteLocalPlan({
        siteSystem: `${coll}-com`,
        collectionSystem: coll,
        hostFolder: `${coll}-com`,
      }),
    );
  }

  // Collection def lives under a host folder (or legacy collections/)
  let collectionDefPath = legacyCollectionDefinitionPath(coll);
  for (const sp of sitePlans) {
    const candidate = collectionDefinitionPath(sp.hostFolder, coll);
    if (exists(candidate)) {
      collectionDefPath = candidate;
      break;
    }
  }
  if (!exists(collectionDefPath) && exists(LEGACY_COLLECTIONS_DIR)) {
    const legacy = legacyCollectionDefinitionPath(coll);
    if (exists(legacy)) collectionDefPath = legacy;
  }

  /** Collection-scoped caches / logs from capture + create:sectioncomponents */
  const collectionCachePaths = [
    path.join(PRESENTATION_CACHE_DIR, coll),
    path.join(VISUAL_FIDELITY_DIR, coll),
    path.join(SOURCE_FIDELITY_DIR, coll),
    path.join(bqDotDir, `ser-push-${coll}.log`),
  ];

  // Any capture host whose brand maps to this collection
  /** @type {string[]} */
  const extraCaptureDirs = [];
  if (fs.existsSync(defaultCapturesDir)) {
    for (const ent of fs.readdirSync(defaultCapturesDir, {
      withFileTypes: true,
    })) {
      if (!ent.isDirectory()) continue;
      try {
        const hostLike = ent.name.replace(/-/g, '.');
        const id = resolveIdentityFromInput(hostLike);
        if (id.collectionSystem === coll) {
          extraCaptureDirs.push(path.join(defaultCapturesDir, ent.name));
        }
      } catch {
        /* ignore */
      }
    }
  }

  return {
    mode: /** @type {'collection'} */ ('collection'),
    collectionSystem: coll,
    collectionDefPath,
    collectionSerializationRoots: [],
    collectionCachePaths,
    extraCaptureDirs: [...new Set(extraCaptureDirs)],
    sitePlans,
    definitionKeys: [
      `${coll}-collection`,
      ...sitePlans.flatMap((p) => p.definitionKeys),
    ],
  };
}

/**
 * Resolve CLI target into a full delete plan (local paths + remote names).
 * @param {{
 *   site?: string|null,
 *   collection?: string|null,
 *   url?: string|null,
 * }} args
 */
export async function resolveDeletePlan(args) {
  const siteArg = args.site?.trim() || '';
  const collArg = args.collection?.trim() || '';
  const urlArg = args.url?.trim() || '';

  const set = [siteArg, collArg, urlArg].filter(Boolean);
  if (set.length !== 1) {
    throw new Error(
      'Require exactly one of --site, --collection, or --url',
    );
  }

  if (collArg) {
    const id = resolveIdentityFromInput(collArg);
    // URL/hostname → brand; "sitecore-com" → sitecore; bare "sitecore" stays
    const cleaned = String(collArg)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    const coll = id.lookLikeUrl
      ? id.collectionSystem
      : cleaned.includes('-')
        ? id.collectionSystem
        : cleaned;
    if (!coll) {
      throw new Error(`Could not resolve collection from: ${collArg}`);
    }

    const local = await buildCollectionLocalPlan(coll);
    return {
      mode: /** @type {'collection'} */ ('collection'),
      collectionSystem: coll,
      remote: { collectionSystem: coll, siteSystem: null },
      local,
    };
  }

  // --site or --url → single site
  const raw = siteArg || urlArg;
  const id = resolveIdentityFromInput(raw);
  const siteSystem = id.siteSystem;
  const collectionSystem = id.collectionSystem;
  const sitePlan = await buildSiteLocalPlan({
    siteSystem,
    collectionSystem,
    hostFolder: id.hostFolder,
    captureHostSlugs: id.captureHostSlugs,
  });

  return {
    mode: /** @type {'site'} */ ('site'),
    collectionSystem,
    siteSystem,
    remote: { collectionSystem, siteSystem },
    local: {
      mode: /** @type {'site'} */ ('site'),
      collectionSystem,
      sitePlans: [sitePlan],
      collectionDefPath: null,
      collectionSerializationRoots: [],
      definitionKeys: sitePlan.definitionKeys,
    },
  };
}

/**
 * Rename a definition file to `name.ext.disabled` (idempotent).
 * @param {string} filePath
 * @param {{ apply?: boolean }} [opts]
 * @returns {{ from: string, to: string, renamed: boolean, skipped?: string }}
 */
export async function disableDefinitionFile(filePath, opts = {}) {
  const from = path.normalize(path.resolve(filePath));
  if (!exists(from)) {
    return { from, to: from, renamed: false, skipped: 'missing' };
  }
  if (/\.disabled$/i.test(from)) {
    return { from, to: from, renamed: false, skipped: 'already-disabled' };
  }
  const to = `${from}.disabled`;
  if (exists(to)) {
    return { from, to, renamed: false, skipped: 'target-exists' };
  }
  if (opts.apply) {
    await rename(from, to);
  }
  return { from, to, renamed: true };
}

/**
 * Capture project/page roots to scrub (create artifacts only — never wipe whole trees).
 * @param {Awaited<ReturnType<typeof resolveDeletePlan>>} plan
 * @returns {string[]}
 */
export function collectCaptureRootsForScrub(plan) {
  /** @type {string[]} */
  const roots = [];
  const local = plan.local;
  for (const sp of local.sitePlans || []) {
    roots.push(...(sp.captureDirs || []));
  }
  if (local.mode === 'collection') {
    roots.push(...(local.extraCaptureDirs || []));
  }
  return existingPaths(roots);
}

/**
 * Host-level create/merge artifacts (not capture:webpage outputs).
 * @type {string[]}
 */
const CREATE_HOST_ARTIFACT_NAMES = [
  'section-registry',
  'section-registry-ai',
  'ai-website-design.md',
  'ai-website-design.meta.json',
  'site-summary.json',
];

/**
 * Scrub create:sectioncomponents / merge artifacts under capture roots.
 * Preserves capture:webpage outputs (HTML, screenshots, section-information, etc.).
 * Also removes page-local sections/<sectionId>/visual-fidelity and source-fidelity dirs.
 *
 * Hard invariant: never wholesale-delete a capture project root (e.g.
 * `.bq/captures/www-crelan-be/`). Only named create/merge artifacts are removed;
 * crops, page-meta, css/fonts, and section.html/png stay for recreate.
 *
 * @param {string[]} captureRoots
 * @param {{ apply?: boolean }} [opts]
 * @returns {Promise<{
 *   removedPaths: string[],
 *   strippedSectionInfo: string[],
 * }>}
 */
export async function scrubCreateArtifactsFromCaptures(captureRoots, opts = {}) {
  const apply = Boolean(opts.apply);
  /** @type {string[]} */
  const removedPaths = [];
  /** @type {string[]} */
  const strippedSectionInfo = [];

  /**
   * @param {string} target
   */
  const removeIfExists = async (target) => {
    const r = await removePath(target, { apply });
    if (r.removed) removedPaths.push(r.path);
  };

  /**
   * Walk one capture project or page directory.
   * @param {string} root
   */
  const scrubOneRoot = async (root) => {
    const resolved = path.normalize(path.resolve(root));
    if (!exists(resolved)) return;

    for (const name of CREATE_HOST_ARTIFACT_NAMES) {
      await removeIfExists(path.join(resolved, name));
    }
    await removeIfExists(path.join(resolved, 'page-conversion.json'));

    // Page dirs nested under the project (www-sitecore-com--home, …)
    let children = [];
    try {
      children = await readdir(resolved, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of children) {
      if (!ent.isDirectory()) continue;
      const childPath = path.join(resolved, ent.name);

      if (ent.name === 'sections') {
        await scrubSectionsDir(childPath);
        continue;
      }

      // Nested page folder (e.g. www-sitecore-com--home)
      await removeIfExists(path.join(childPath, 'page-conversion.json'));
      const nestedSections = path.join(childPath, 'sections');
      if (exists(nestedSections)) {
        await scrubSectionsDir(nestedSections);
      }
    }
  };

  /**
   * @param {string} sectionsDir
   */
  const scrubSectionsDir = async (sectionsDir) => {
    let ents = [];
    try {
      ents = await readdir(sectionsDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of ents) {
      if (!ent.isDirectory()) continue;
      const sectionAbs = path.join(sectionsDir, ent.name);
      await removeIfExists(path.join(sectionAbs, 'section-conversion.json'));
      await removeIfExists(path.join(sectionAbs, 'ai-debug'));
      await removeIfExists(path.join(sectionAbs, 'visual-fidelity'));
      await removeIfExists(path.join(sectionAbs, 'source-fidelity'));
      const infoPath = path.join(sectionAbs, 'section-information.json');
      if (!exists(infoPath)) continue;
      const stripped = await stripRegistrySectionBacklinks(infoPath, { apply });
      if (stripped.changed) strippedSectionInfo.push(stripped.path);
    }
  };

  for (const root of captureRoots || []) {
    await scrubOneRoot(root);
  }

  return {
    removedPaths: [...new Set(removedPaths)],
    strippedSectionInfo: [...new Set(strippedSectionInfo)],
  };
}

/**
 * Remove registrySection / sharedSection from section-information.json.
 * @param {string} filePath
 * @param {{ apply?: boolean }} [opts]
 */
export async function stripRegistrySectionBacklinks(filePath, opts = {}) {
  const apply = Boolean(opts.apply);
  const resolved = path.normalize(path.resolve(filePath));
  if (!exists(resolved)) {
    return { path: resolved, changed: false, missing: true };
  }
  let data;
  try {
    data = JSON.parse(await readFile(resolved, 'utf8'));
  } catch {
    return { path: resolved, changed: false };
  }
  if (!data || typeof data !== 'object') {
    return { path: resolved, changed: false };
  }
  const hadRegistry = Object.prototype.hasOwnProperty.call(data, 'registrySection');
  const hadShared = Object.prototype.hasOwnProperty.call(data, 'sharedSection');
  if (!hadRegistry && !hadShared) {
    return { path: resolved, changed: false };
  }
  if (apply) {
    delete data.registrySection;
    delete data.sharedSection;
    await writeFile(resolved, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }
  return { path: resolved, changed: true };
}

/**
 * Flatten plan into concrete path lists for logging / apply.
 * Capture roots are listed for scrubbing — not wholesale directory removal.
 * @param {Awaited<ReturnType<typeof resolveDeletePlan>>} plan
 */
export function flattenPlanPaths(plan) {
  /** @type {string[]} */
  const dirs = [];
  /** @type {string[]} */
  const definitionFiles = [];
  /** @type {string[]} */
  const yamlRoots = [];

  const local = plan.local;
  for (const sp of local.sitePlans || []) {
    if (exists(sp.hostDir)) dirs.push(sp.hostDir);
    dirs.push(...sp.packageDirs.filter(exists));
    dirs.push(...existingPaths(sp.cachePaths));
    definitionFiles.push(
      ...existingPaths([sp.siteDefPath, sp.presentationDefPath]),
    );
    yamlRoots.push(...sp.serializationRoots);
  }

  if (local.collectionDefPath) {
    definitionFiles.push(...existingPaths([local.collectionDefPath]));
  }
  if (local.mode === 'collection') {
    yamlRoots.push(...(local.collectionSerializationRoots || []));
    dirs.push(...existingPaths(local.collectionCachePaths || []));
  } else {
    for (const sp of local.sitePlans || []) {
      yamlRoots.push(...sp.serializationRoots);
    }
  }

  const captureRoots = collectCaptureRootsForScrub(plan);

  return {
    dirs: [...new Set(dirs.map((p) => path.normalize(p)))],
    /** Capture project roots to scrub (create artifacts only) */
    captureRoots,
    /** Site / collection / presentation *.definition.ts — renamed to *.disabled */
    definitionFiles: [
      ...new Set(definitionFiles.map((p) => path.normalize(p))),
    ],
    /** @deprecated use definitionFiles */
    files: [...new Set(definitionFiles.map((p) => path.normalize(p)))],
    yamlRoots: existingPaths(yamlRoots),
    definitionKeys: [...new Set(local.definitionKeys || [])],
    // Include null-collection siblings (`::site`) so orphan cache keys from
    // older emits (collectionSystem: null) are scrubbed with `coll::site`.
    emitSourceKeys: [
      ...new Set(
        (local.sitePlans || []).flatMap((sp) => {
          /** @type {string[]} */
          const keys = [];
          if (sp.emitSourceKey) keys.push(sp.emitSourceKey);
          const site = String(sp.siteSystem || '')
            .trim()
            .toLowerCase();
          if (site) keys.push(`::${site}`);
          return keys;
        }),
      ),
    ],
    urlRoutesKeys: [
      ...new Set(
        (local.sitePlans || []).map((sp) => sp.urlRoutesKey).filter(Boolean),
      ),
    ],
    /** Collection delete: wipe all routes keys under these `collection/` prefixes */
    urlRoutesCollectionPrefixes:
      plan.mode === 'collection' && plan.collectionSystem
        ? [String(plan.collectionSystem).trim().toLowerCase()]
        : [],
    componentYaml:
      local.mode === 'site'
        ? [
            ...new Set(
              (local.sitePlans || []).flatMap(
                (sp) => sp.componentYamlCandidates || [],
              ),
            ),
          ]
        : [],
    // Preview of SCS hash-folder orphans that cleanSerializationHashOrphans will remove
    hashOrphanDirs: cleanSerializationHashOrphans({
      collectionSystem: plan.collectionSystem,
      siteSystem: plan.mode === 'site' ? plan.siteSystem : null,
      apply: false,
    }).removed,
  };
}

/**
 * @param {string} filePath
 * @param {(data: any) => any} mutator
 * @param {{ apply?: boolean }} [opts]
 */
async function mutateJsonFile(filePath, mutator, opts = {}) {
  if (!exists(filePath)) {
    return { path: filePath, changed: false, missing: true };
  }
  const raw = await readFile(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { path: filePath, changed: false, error: 'invalid json' };
  }
  const next = mutator(data);
  if (next === data || JSON.stringify(next) === JSON.stringify(data)) {
    return { path: filePath, changed: false };
  }
  if (opts.apply) {
    await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  }
  return { path: filePath, changed: true };
}

/**
 * Expand apply-source scrub keys so `coll::site` also drops orphan `::site`
 * (written when collectionSystem was null).
 *
 * @param {string[]} keys
 * @returns {string[]}
 */
export function expandEmitSourceScrubKeys(keys) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const raw of keys || []) {
    const k = String(raw || '').trim();
    if (!k) continue;
    out.add(k);
    const parts = k.split('::');
    if (parts.length === 2) {
      const site = parts[1].trim().toLowerCase();
      if (site) out.add(`::${site}`);
      // Also drop the canonical form if only `::site` was passed.
      if (!parts[0] && site) {
        /* already added ::site */
      }
    }
  }
  return [...out];
}

/**
 * Scrub apply-source.json scope keys.
 * Exact keys plus null-collection siblings (`coll::site` → also `::site`).
 * @param {string[]} keys
 * @param {{ apply?: boolean }} [opts]
 */
export async function scrubEmitSourceKeys(keys, opts = {}) {
  const expanded = expandEmitSourceScrubKeys(keys);
  return mutateJsonFile(
    EMIT_SOURCE_PATH,
    (data) => {
      const next = { ...data };
      let changed = false;
      for (const k of expanded) {
        if (k in next) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : data;
    },
    opts,
  );
}

/**
 * Pure mutator: remove exact `collection/site` keys and/or every routes key
 * under `collection/` (covers discover-miss after defs are already gone).
 *
 * @param {any} data
 * @param {{
 *   keys?: string[],
 *   collectionPrefixes?: string[],
 * }} [opts]
 * @returns {any} same `data` when unchanged, else new object
 */
export function scrubUrlRoutesData(data, opts = {}) {
  if (!data?.routes || typeof data.routes !== 'object') return data;
  const keys = Array.isArray(opts.keys) ? opts.keys : [];
  const prefixes = Array.isArray(opts.collectionPrefixes)
    ? opts.collectionPrefixes
    : [];
  if (!keys.length && !prefixes.length) return data;

  const routes = { ...data.routes };
  let changed = false;

  for (const k of keys) {
    const key = String(k || '').trim();
    if (!key) continue;
    if (key in routes) {
      delete routes[key];
      changed = true;
    }
  }

  for (const coll of prefixes) {
    const system = String(coll || '')
      .trim()
      .toLowerCase();
    if (!system) continue;
    const prefix = `${system}/`;
    for (const rk of Object.keys(routes)) {
      const lower = rk.toLowerCase();
      if (lower === system || lower.startsWith(prefix)) {
        delete routes[rk];
        changed = true;
      }
    }
  }

  if (!changed) return data;
  return { ...data, routes };
}

/**
 * Scrub url-routes.json site keys (`collection/site`) and optional collection
 * prefixes (all `collection/…` route blocks, including cached itemIds).
 *
 * @param {string[]} keys
 * @param {{ apply?: boolean, collectionPrefixes?: string[] }} [opts]
 */
export async function scrubUrlRoutesKeys(keys, opts = {}) {
  return mutateJsonFile(
    URL_ROUTES_PATH,
    (data) =>
      scrubUrlRoutesData(data, {
        keys,
        collectionPrefixes: opts.collectionPrefixes,
      }),
    opts,
  );
}

/**
 * Remove owned-ledger entries for collection and/or sites.
 * @param {{
 *   collectionSystem?: string|null,
 *   siteSystems?: string[],
 *   wipeCollection?: boolean,
 *   apply?: boolean,
 * }} opts
 */
export function scrubOwnedLedger(opts) {
  const state = readSitesApiOwnedState();
  const next = {
    version: /** @type {1} */ (1),
    collections: { ...state.collections },
    sites: { ...state.sites },
  };
  let changed = false;

  if (opts.wipeCollection && opts.collectionSystem) {
    const coll = opts.collectionSystem;
    for (const [key, rec] of Object.entries(next.collections)) {
      if (
        key === `${coll}-collection` ||
        rec?.systemName === coll
      ) {
        delete next.collections[key];
        changed = true;
      }
    }
    for (const [key, rec] of Object.entries(next.sites)) {
      if (rec?.collectionSystem === coll) {
        delete next.sites[key];
        changed = true;
      }
    }
  } else if (opts.siteSystems?.length) {
    const want = new Set(opts.siteSystems);
    for (const [key, rec] of Object.entries(next.sites)) {
      if (want.has(rec?.systemName) || want.has(key.replace(/-site$/, ''))) {
        delete next.sites[key];
        changed = true;
      }
    }
  }

  if (changed && opts.apply) {
    writeSitesApiOwnedState(next);
  }
  return { changed, state: next };
}

/**
 * @param {string} key
 * @param {string} site lowercased siteSystem
 */
export function inventoryKeyMatchesSite(key, site) {
  const k = String(key || '').toLowerCase();
  const s = String(site || '').toLowerCase();
  if (!k || !s) return false;
  return (
    k === `${s}-site` ||
    k === `${s}-presentation` ||
    k.startsWith(`${s}-`) ||
    k.startsWith(`stub-${s}-`) ||
    k.includes(`-${s}-`)
  );
}

/**
 * @param {string} key
 * @param {string} coll lowercased collectionSystem
 */
export function inventoryKeyMatchesCollection(key, coll) {
  const k = String(key || '').toLowerCase();
  const c = String(coll || '').toLowerCase();
  if (!k || !c) return false;
  return (
    k === c ||
    k === `${c}-collection` ||
    k.startsWith(`${c}-`) ||
    k.includes(`-${c}-`) ||
    k.endsWith(`-${c}`)
  );
}

/**
 * True when inventory JSON points under /sitecore/content/{collection}/.
 * @param {any} data
 * @param {string} coll lowercased collectionSystem
 */
export function inventoryJsonBelongsToCollection(data, coll) {
  const c = String(coll || '').toLowerCase();
  if (!c || !data || typeof data !== 'object') return false;
  const prefix = `/sitecore/content/${c}/`;
  const root = `/sitecore/content/${c}`;
  /** @type {string[]} */
  const paths = [];
  if (typeof data.path === 'string') paths.push(data.path);
  if (Array.isArray(data.entries)) {
    for (const e of data.entries) {
      if (typeof e?.path === 'string') paths.push(e.path);
    }
  }
  return paths.some((p) => {
    const pl = String(p).toLowerCase();
    return pl === root || pl.startsWith(prefix);
  });
}

/**
 * Pure key selection for apply-inventory wipe (testable without touching disk).
 *
 * @param {Array<{ key: string, data?: any }>} candidates
 * @param {{
 *   definitionKeys?: string[],
 *   siteSystem?: string|null,
 *   siteSystems?: string[],
 *   collectionSystem?: string|null,
 *   wipeCollection?: boolean,
 * }} opts
 * @returns {string[]}
 */
export function collectInventoryKeysToDelete(candidates, opts = {}) {
  const keys = new Set(
    (opts.definitionKeys || []).filter(Boolean).map((k) => String(k)),
  );
  const wipe = Boolean(opts.wipeCollection);
  const coll = String(opts.collectionSystem || '')
    .trim()
    .toLowerCase();
  /** @type {string[]} */
  const sites = [
    ...new Set(
      [...(opts.siteSystems || []), opts.siteSystem]
        .filter(Boolean)
        .map((s) => String(s).trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  for (const cand of candidates || []) {
    const key = String(cand?.key || '').trim();
    if (!key || keys.has(key)) continue;

    if (sites.some((s) => inventoryKeyMatchesSite(key, s))) {
      keys.add(key);
      continue;
    }

    if (wipe && coll) {
      if (inventoryKeyMatchesCollection(key, coll)) {
        keys.add(key);
        continue;
      }
      if (inventoryJsonBelongsToCollection(cand?.data, coll)) {
        keys.add(key);
      }
      continue;
    }

    // Site (or non-wipe) mode: only exact collection def inventory
    if (coll && key.toLowerCase() === `${coll}-collection`) {
      keys.add(key);
    }
  }

  return [...keys];
}

/**
 * Delete apply-inventory JSON files for definition keys (+ site/collection sweep).
 * Collection wipe also drops stub-* inventories and any file whose entries live
 * under `/sitecore/content/{collection}/`.
 *
 * @param {string[]} definitionKeys
 * @param {{
 *   apply?: boolean,
 *   siteSystem?: string,
 *   siteSystems?: string[],
 *   collectionSystem?: string,
 *   wipeCollection?: boolean,
 * }} [opts]
 */
export function deleteInventoriesForKeys(definitionKeys, opts = {}) {
  /** @type {string[]} */
  const deleted = [];
  /** @type {Array<{ key: string, data?: any }>} */
  const candidates = [];

  if (exists(EMIT_INVENTORY_DIR)) {
    for (const ent of fs.readdirSync(EMIT_INVENTORY_DIR, {
      withFileTypes: true,
    })) {
      if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
      const key = ent.name.replace(/\.json$/i, '');
      /** @type {any} */
      let data;
      if (opts.wipeCollection && opts.collectionSystem) {
        try {
          data = JSON.parse(
            fs.readFileSync(path.join(EMIT_INVENTORY_DIR, ent.name), 'utf8'),
          );
        } catch {
          data = undefined;
        }
      }
      candidates.push({ key, data });
    }
  }

  // Ensure explicit definitionKeys are considered even if the file is gone
  for (const k of definitionKeys || []) {
    if (k && !candidates.some((c) => c.key === k)) {
      candidates.push({ key: k });
    }
  }

  const keys = collectInventoryKeysToDelete(candidates, {
    definitionKeys,
    siteSystem: opts.siteSystem,
    siteSystems: opts.siteSystems,
    collectionSystem: opts.collectionSystem,
    wipeCollection: opts.wipeCollection,
  });

  for (const key of keys) {
    const file = path.join(EMIT_INVENTORY_DIR, `${key}.json`);
    if (!exists(file)) continue;
    if (opts.apply) {
      deleteApplyInventory(key);
    }
    deleted.push(file);
  }
  return deleted;
}

/**
 * Recursively remove path if it exists.
 * @param {string} target
 * @param {{ apply?: boolean }} [opts]
 */
export async function removePath(target, opts = {}) {
  const resolved = path.normalize(path.resolve(target));
  if (!exists(resolved)) {
    return { path: resolved, removed: false };
  }
  if (opts.apply) {
    await rm(resolved, { recursive: true, force: true });
  }
  return { path: resolved, removed: true };
}

/**
 * SCS path-length hash folders (`sai/{sites|templates|…}/{16-hex}/`).
 * When a collection/site tree is deleted, those hash children are left behind
 * and `ser validate` reports ORPHAN ITEM (parent not serialized).
 *
 * @param {{
 *   collectionSystem?: string|null,
 *   siteSystem?: string|null,
 *   apply?: boolean,
 *   saiRoot?: string,
 * }} opts
 * @returns {{ removed: string[], kept: number }}
 */
export function cleanSerializationHashOrphans(opts = {}) {
  const collectionSystem = String(opts.collectionSystem || '')
    .trim()
    .toLowerCase();
  const siteSystem = String(opts.siteSystem || '')
    .trim()
    .toLowerCase();
  /** @type {string[]} */
  const prefixes = [];
  if (collectionSystem && siteSystem) {
    prefixes.push(
      `/sitecore/content/${collectionSystem}/${siteSystem}/`.toLowerCase(),
      `/sitecore/templates/Project/${collectionSystem}/`.toLowerCase(),
      `/sitecore/layout/Project/${collectionSystem}/`.toLowerCase(),
      `/sitecore/media library/Project/${collectionSystem}/${siteSystem}/`.toLowerCase(),
      `/sitecore/media library/Project/${collectionSystem}/`.toLowerCase(),
    );
  } else if (collectionSystem) {
    prefixes.push(
      `/sitecore/content/${collectionSystem}/`.toLowerCase(),
      `/sitecore/templates/Project/${collectionSystem}/`.toLowerCase(),
      `/sitecore/layout/Project/${collectionSystem}/`.toLowerCase(),
      `/sitecore/media library/Project/${collectionSystem}/`.toLowerCase(),
      `/sitecore/templates/Branches/Project/${collectionSystem}/`.toLowerCase(),
      `/sitecore/system/Settings/Project/${collectionSystem}/`.toLowerCase(),
    );
  }
  if (!prefixes.length) return { removed: [], kept: 0 };

  const saiRoot =
    opts.saiRoot ||
    path.join(bqRoot, '..', 'authoring', 'items', 'bq-demo', 'sai');
  const scanRoots = [
    path.join(saiRoot, 'sites'),
    path.join(saiRoot, 'templates'),
    path.join(saiRoot, 'branchTemplates'),
    path.join(saiRoot, 'layout'),
    path.join(saiRoot, 'media-library'),
    path.join(saiRoot, 'renderings'),
    path.join(saiRoot, 'systemSettings'),
  ];

  /** @type {string[]} */
  const removed = [];
  let kept = 0;

  for (const scanRoot of scanRoots) {
    if (!exists(scanRoot)) continue;
    for (const ent of fs.readdirSync(scanRoot, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      if (!/^[0-9A-F]{16}$/i.test(ent.name)) continue;
      const dir = path.join(scanRoot, ent.name);
      let itemPath = '';
      try {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!f.isFile() || !/\.ya?ml$/i.test(f.name)) continue;
          const text = fs.readFileSync(path.join(dir, f.name), 'utf8');
          const m = text.match(/^Path:\s*["']([^"']+)["']/m);
          if (m) {
            itemPath = m[1];
            break;
          }
        }
      } catch {
        continue;
      }
      const lower = itemPath.toLowerCase();
      const match = prefixes.some((pre) => lower.startsWith(pre));
      if (!match) {
        kept += 1;
        continue;
      }
      if (opts.apply) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      removed.push(dir);
    }
  }
  return { removed, kept };
}

/**
 * Probe Sitecore AI Sites API for whether the delete target still exists remotely.
 * Used for early status logging (does not delete).
 *
 * @param {Awaited<ReturnType<typeof resolveDeletePlan>>} plan
 * @returns {Promise<{ found: boolean, name: string|null, id: string|null, error: string|null }>}
 */
export async function probeRemoteDeleteTarget(plan) {
  try {
    const ctx = await createSitesApiContext();
    if (plan.mode === 'collection') {
      const existing = await findCollectionByName(ctx, plan.collectionSystem);
      if (!existing?.id) {
        return { found: false, name: null, id: null, error: null };
      }
      return {
        found: true,
        name: existing.name || plan.collectionSystem,
        id: existing.id,
        error: null,
      };
    }
    const existing = await findSiteByName(ctx, plan.siteSystem);
    if (!existing?.id) {
      return { found: false, name: null, id: null, error: null };
    }
    return {
      found: true,
      name: existing.name || plan.siteSystem,
      id: existing.id,
      error: null,
    };
  } catch (err) {
    return {
      found: false,
      name: null,
      id: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Soft-fail ser pull noise after expand (EXTRA ITEM / integrity) so local wipe
 * can still proceed. Kept for unit tests + delete CLI messaging.
 *
 * @param {string} message
 * @param {{ moduleExpanded?: boolean }} [ctx]
 */
export function isSoftFailSerPullAfterModuleScrub(message, ctx = {}) {
  if (!ctx.moduleExpanded && !ctx.moduleScrubbed) return false;
  const text = String(message || '');
  return (
    /Filesystem integrity validation found errors/i.test(text) ||
    /EXTRA ITEM/i.test(text) ||
    /is not included, but is serialized/i.test(text) ||
    /Discovered changes will not be applied/i.test(text) ||
    /ser pull exited with code [1-9]/i.test(text)
  );
}

/**
 * Apply (or dry-run) a resolved delete plan.
 *
 * Default (no zip): Sites API delete → local FE/YAML/cache scrub → reset
 * module.json to `.minimal`. No module expand / ser pull.
 *
 * With `--package` (collection only): expand module for target → ser pull →
 * write restorable archive → Sites API delete → local scrub → reset to `.minimal`.
 * With `localOnly`: skip expand/pull/Sites API; still runs local cleanup and
 * resets module.json to `.minimal` (archive uses on-disk trees as-is).
 * Never touches `.bq/definitions/cache/translations.json`.
 * Collection delete scrubs every `url-routes.json` routes key under `collection/`
 * (not only discovered sitePlan keys) so cached itemIds cannot survive a wipe.
 * Never deletes raw capture:webpage crops (only create/merge artifacts under captures).
 *
 * @param {Awaited<ReturnType<typeof resolveDeletePlan>>} plan
 * @param {{
 *   apply?: boolean,
 *   localOnly?: boolean,
 *   package?: boolean,
 *   cliArgs?: string[],
 *   expandModuleForSerSession?: typeof expandModuleForSerSession,
 *   pullSerializationNow?: typeof pullSerializationNow,
 *   resetModuleJsonToMinimal?: typeof resetModuleJsonToMinimal,
 *   packageCollectionDeleteArchive?: typeof packageCollectionDeleteArchive,
 *   remoteDeleteFn?: (plan: object) => Promise<{
 *     action: string,
 *     id?: string|null,
 *     deletedSites?: string[],
 *   }>,
 * }} [opts]
 */
export async function applyDeletePlan(plan, opts = {}) {
  const apply = Boolean(opts.apply);
  const localOnly = Boolean(opts.localOnly);
  const wantPackage = Boolean(opts.package);
  /** Expand + ser pull only when packaging a restorable collection archive. */
  const needSerSession =
    wantPackage && plan.mode === 'collection' && !localOnly;
  const expandFn = opts.expandModuleForSerSession || expandModuleForSerSession;
  const pullFn = opts.pullSerializationNow || pullSerializationNow;
  const resetFn = opts.resetModuleJsonToMinimal || resetModuleJsonToMinimal;
  const packageFn =
    opts.packageCollectionDeleteArchive || packageCollectionDeleteArchive;
  const remoteDeleteFn = opts.remoteDeleteFn;
  const flat = flattenPlanPaths(plan);
  /** @type {{ local: object, remote: object, pull: object, validate: object, package: object|null }} */
  const result = {
    local: {
      removedDirs: /** @type {string[]} */ ([]),
      disabledDefinitions: /** @type {{ from: string, to: string }[]} */ ([]),
      removedYaml: /** @type {string[]} */ ([]),
      skippedYamlNotBq: /** @type {string[]} */ ([]),
      hashOrphansRemoved: /** @type {string[]} */ ([]),
      inventories: /** @type {string[]} */ ([]),
      captureScrubRemoved: /** @type {string[]} */ ([]),
      captureScrubStripped: /** @type {string[]} */ ([]),
      emitSource: null,
      urlRoutes: null,
      owned: null,
      moduleJson: null,
      moduleExpanded: null,
      moduleReset: null,
      yamlRootsRemovedBeforePull: /** @type {string[]} */ ([]),
      // translations.json is intentionally never scrubbed
    },
    remote: {
      skipped: localOnly,
      action: null,
      id: null,
      error: null,
      deletedSites: /** @type {string[]} */ ([]),
    },
    pull: {
      skipped: !needSerSession,
      ok: false,
      error: null,
      softFailed: false,
    },
    validate: {
      skipped: true,
      ok: false,
      exitCode: null,
      error: null,
      output: '',
    },
    package: null,
  };

  if (wantPackage && plan.mode !== 'collection') {
    console.warn(
      `[site:delete] --package is only supported for delete:collection; ignoring`,
    );
  }

  // --- 1) Expand + ser pull only when --package (so the zip has CM YAML) ---
  if (apply && needSerSession) {
    try {
      result.local.moduleExpanded = expandFn({
        collectionSystem: plan.collectionSystem,
        siteSystem: undefined,
      });
      console.log(
        `[site:delete] expanded module.json for ser pull (package): ${plan.collectionSystem}`,
      );
    } catch (err) {
      result.pull.error =
        err instanceof Error ? err.message : String(err);
    }

    if (!result.pull.error) {
      try {
        await pullFn({
          reason: `site:delete package collection ${plan.collectionSystem}`,
        });
        result.pull.ok = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          isSoftFailSerPullAfterModuleScrub(msg, { moduleExpanded: true })
        ) {
          result.pull.softFailed = true;
          result.pull.ok = false;
          console.warn(
            `[site:delete] ser pull soft-failed; continuing with package/wipe: ${msg}`,
          );
        } else {
          result.pull.error = msg;
        }
      }
    }
  }

  // --- 1b) Optional restorable archive (after pull when not local-only) ---
  if (wantPackage && plan.mode === 'collection' && !result.pull.error) {
    if (!apply) {
      result.package = await packageFn({
        plan,
        flat,
        localOnly,
        dryRun: true,
        cliArgs: opts.cliArgs,
      });
      console.log(
        `[site:delete] --package dry-run: would archive ${result.package.deletedCount} path(s), ` +
          `${result.package.snapshotCount} snapshot(s), ${result.package.renameCount} rename(s) ` +
          `→ ${result.package.archivePath}`,
      );
    } else {
      console.log(
        `[site:delete] --package: creating restorable archive before delete…`,
      );
      result.package = await packageFn({
        plan,
        flat,
        localOnly,
        dryRun: false,
        cliArgs: opts.cliArgs,
      });
      console.log(
        `[site:delete] packaged ${result.package.deletedCount} path(s), ` +
          `${result.package.snapshotCount} snapshot(s) → ${result.package.archivePath}`,
      );
      console.log(
        `  restore later: npm run restore:collection -- --package "${result.package.archivePath}"`,
      );
    }
  }

  // --- 2) Remote Sites API ---
  if (localOnly) {
    result.remote.action = 'local-only';
  } else if (apply && !result.pull.error) {
    try {
      if (typeof remoteDeleteFn === 'function') {
        const remote = await remoteDeleteFn(plan);
        result.remote.action = remote?.action || 'deleted';
        result.remote.id = remote?.id ?? null;
        result.remote.deletedSites = remote?.deletedSites || [];
      } else {
        const ctx = await createSitesApiContext();
        if (plan.mode === 'collection') {
          const existing = await findCollectionByName(
            ctx,
            plan.collectionSystem,
          );
          if (!existing?.id) {
            result.remote.action = 'missing';
          } else {
            const collId = String(existing.id)
              .replace(/[{}]/g, '')
              .toLowerCase();
            // Force-delete child sites first — collection DELETE alone can hang
            // while sites remain. Then delete the collection.
            const allSites = await listSites(ctx);
            const children = allSites.filter((s) => {
              const cid = String(
                s.collectionId || s.collection || s.collectionName || '',
              )
                .replace(/[{}]/g, '')
                .toLowerCase();
              return cid === collId;
            });
            /** @type {string[]} */
            const deletedSites = [];
            for (const child of children) {
              if (!child?.id) continue;
              console.log(
                `[site:delete] remote force-delete site ${child.name} (${child.id})…`,
              );
              await deleteSiteViaApi(ctx, child.id, { force: true });
              deletedSites.push(child.name || child.id);
            }
            console.log(
              `[site:delete] remote delete collection ${existing.name} (${existing.id})…`,
            );
            await deleteCollectionViaApi(ctx, existing.id);
            result.remote.action = 'deleted-collection';
            result.remote.id = existing.id;
            result.remote.deletedSites = deletedSites;
          }
        } else {
          const existing = await findSiteByName(ctx, plan.siteSystem);
          if (!existing?.id) {
            result.remote.action = 'missing';
          } else {
            await deleteSiteViaApi(ctx, existing.id, { force: true });
            result.remote.action = 'deleted-site';
            result.remote.id = existing.id;
          }
        }
      }
    } catch (err) {
      result.remote.error =
        err instanceof Error ? err.message : String(err);
      // Continue to local wipe; caller checks remote.error
    }
  } else if (!apply) {
    result.remote.action = 'dry-run';
  }

  // --- 3) Local hash-folder + YAML leftovers ---
  const hashClean = cleanSerializationHashOrphans({
    collectionSystem: plan.collectionSystem,
    siteSystem: plan.mode === 'site' ? plan.siteSystem : null,
    apply,
  });
  result.local.hashOrphansRemoved = hashClean.removed;
  if (hashClean.removed.length) {
    result.local.removedDirs.push(...hashClean.removed);
    if (apply) {
      console.log(
        `[site:delete] removed ${hashClean.removed.length} SCS hash-folder orphan dir(s)`,
      );
    }
  }

  // Wipe pulled/leftover YAML trees for this collection/site when present.
  result.local.yamlRootsRemovedBeforePull = [];
  if (flat.yamlRoots?.length) {
    for (const root of flat.yamlRoots) {
      const r = await removePath(root, { apply });
      if (r.removed) {
        result.local.yamlRootsRemovedBeforePull.push(r.path);
        result.local.removedDirs.push(r.path);
      }
    }
  }
  if (plan.mode === 'site') {
    const yamlPlan = deleteBqOwnedYaml(flat.componentYaml, { apply });
    result.local.removedYaml = yamlPlan.deleted;
    result.local.skippedYamlNotBq = yamlPlan.skipped;
  }

  // --- 4) Local FE / caches ---
  for (const d of flat.dirs) {
    const r = await removePath(d, { apply });
    if (r.removed) result.local.removedDirs.push(r.path);
  }
  for (const f of flat.definitionFiles || flat.files || []) {
    const r = await disableDefinitionFile(f, { apply });
    if (r.renamed) {
      result.local.disabledDefinitions.push({ from: r.from, to: r.to });
    }
  }

  const inventorySiteSystems =
    plan.mode === 'collection'
      ? (plan.local.sitePlans || []).map((s) => s.siteSystem).filter(Boolean)
      : plan.siteSystem
        ? [plan.siteSystem]
        : [];

  result.local.inventories = deleteInventoriesForKeys(flat.definitionKeys, {
    apply,
    siteSystem: plan.siteSystem,
    siteSystems: inventorySiteSystems,
    collectionSystem: plan.collectionSystem,
    wipeCollection: plan.mode === 'collection',
  });

  if (plan.mode === 'collection') {
    const collPres = path.join(
      PRESENTATION_CACHE_DIR,
      plan.collectionSystem,
    );
    const r = await removePath(collPres, { apply });
    if (r.removed) result.local.removedDirs.push(r.path);
    const collVf = path.join(VISUAL_FIDELITY_DIR, plan.collectionSystem);
    const r2 = await removePath(collVf, { apply });
    if (r2.removed) result.local.removedDirs.push(r2.path);
    const collSf = path.join(SOURCE_FIDELITY_DIR, plan.collectionSystem);
    const r3 = await removePath(collSf, { apply });
    if (r3.removed) result.local.removedDirs.push(r3.path);
  }

  const captureScrub = await scrubCreateArtifactsFromCaptures(flat.captureRoots, {
    apply,
  });
  result.local.captureScrubRemoved = captureScrub.removedPaths;
  result.local.captureScrubStripped = captureScrub.strippedSectionInfo;
  result.local.removedDirs.push(...captureScrub.removedPaths);

  result.local.emitSource = await scrubEmitSourceKeys(flat.emitSourceKeys, {
    apply,
  });
  result.local.urlRoutes = await scrubUrlRoutesKeys(flat.urlRoutesKeys, {
    apply,
    collectionPrefixes: flat.urlRoutesCollectionPrefixes,
  });
  result.local.owned = scrubOwnedLedger({
    collectionSystem: plan.collectionSystem,
    siteSystems:
      plan.mode === 'site'
        ? [plan.siteSystem]
        : (plan.local.sitePlans || []).map((s) => s.siteSystem),
    wipeCollection: plan.mode === 'collection',
    apply,
  });

  result.local.removedDirs = [...new Set(result.local.removedDirs)];
  result.local.inventories = [...new Set(result.local.inventories)];

  // --- 5) Always reset module.json to .minimal (last step) ---
  if (apply) {
    try {
      result.local.moduleReset = resetFn();
      result.local.moduleJson = result.local.moduleReset;
      if (result.local.moduleReset?.changed) {
        console.log(
          `[site:delete] reset module.json to minimal (${result.local.moduleReset.path})`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[site:delete] failed to reset module.json: ${msg}`);
    }
  } else {
    result.local.moduleJson = { path: '', changed: false, dryRun: true };
  }

  if (result.pull.error) {
    throw new Error(result.pull.error);
  }
  if (result.remote.error) {
    throw new Error(result.remote.error);
  }
  if (result.validate.error) {
    throw new Error(result.validate.error);
  }

  return { plan, flat, result, apply };
}
