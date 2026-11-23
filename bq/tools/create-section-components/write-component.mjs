/**
 * Resolve component names (overwrite vs alternatives) and write TSX + definition + capture-meta.
 */
import { access, mkdir, readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot, defaultCapturesDir } from '../capture/paths.mjs';
import { slugFromUrl } from '../capture/lib/url-utils.mjs';
import {
  ensureBrandComponentPrefix,
  ensureBrandDefinitionKeyPrefix,
  roleDerivedComponentNameStems,
  toDefinitionKey,
  namesDifferOnlyByCase,
  toKebabCase,
  toPascalCase,
} from './naming.mjs';
import {
  normalizeComponentTsx,
  normalizeClientTsx,
  normalizeDefinitionTs,
  buildMobileNavChromeStub,
  buildCarouselChromeStub,
  clientMatchesCarouselChromeMode,
  rewriteCompanionClientImport,
  ensureCompanionClientImport,
  mapEntryImportsCompanionClient,
  stripUnknownChromeProps,
  parseCompanionClientImportAlias,
  applyWritePathAlwaysOnTsxSanitizers,
  hoistClientAppPlaceholderToServerChildren,
} from './ai-source-fixup.mjs';

/** True when AppPlaceholder is already under the imported *.client chrome alias. */
function appPlaceholderUnderImportedClientChrome(tsx) {
  const text = String(tsx || '');
  if (!/<AppPlaceholder\b/.test(text)) return false;
  const alias = parseCompanionClientImportAlias(text);
  if (!alias) return false;
  const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<${esc}\\b[\\s\\S]{0,800}<AppPlaceholder\\b`).test(text);
}
import { syncDefinitionFromTsx } from './sync-definition-from-tsx.mjs';
import { forceEmptyPlaceholdersForPlatformLinkLists } from './composite-layout-fixups.mjs';
import { assertLogoRailChildHasImage } from './html-image-coverage.mjs';
import {
  inferPlaceholderLayoutMode,
  inferCarouselChromeMode,
  prefersContinuousMarquee,
} from './layout-hints.mjs';
import { ensureNewline, normalizeAiSource } from './source-text.mjs';
import { formatGeneratedSource } from './format-generated-source.mjs';
import { writeFileIfChanged } from '../shared/write-file-if-changed.mjs';
import {
  extractFolderPathsFromDefinitionTs,
  folderPathKey,
  folderPathsFromCaptureMeta,
  retirePriorContentAndMediaFolders,
} from '../shared/retire-prior-content-media-folders.ts';
import { ensureNavigationReferenceImports } from './ensure-navigation-reference.mjs';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export function componentDir(hostSlug, componentName) {
  return path.join(bqRoot, 'src', 'components', hostSlug, componentName);
}

export async function readCaptureMeta(hostSlug, componentName) {
  const kebab = toKebabCase(componentName);
  const metaPath = path.join(componentDir(hostSlug, componentName), `${kebab}.capture-meta.json`);
  if (!(await exists(metaPath))) return null;
  try {
    return JSON.parse(await readFile(metaPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Read any `*.capture-meta.json` in a component dir (casing remints share one folder).
 * Prefers a meta whose componentName is set.
 * @param {string} dirAbs
 */
export async function readAnyCaptureMetaInDir(dirAbs) {
  let entries;
  try {
    entries = await readdir(dirAbs);
  } catch {
    return null;
  }
  /** @type {object|null} */
  let first = null;
  for (const name of entries) {
    if (!/\.capture-meta\.json$/i.test(name)) continue;
    try {
      const meta = JSON.parse(
        await readFile(path.join(dirAbs, name), 'utf8'),
      );
      if (!meta || typeof meta !== 'object') continue;
      if (!first) first = meta;
      if (String(meta.componentName || '').trim()) return meta;
    } catch {
      /* skip */
    }
  }
  return first;
}

/**
 * Remove other `*.definition.ts` / companion package prefixes in the same dir
 * so casing remints cannot leave two definitionKeys under one Windows folder.
 * @param {string} dirAbs
 * @param {string} keepKebab
 */
export async function retireSiblingKebabFilesInDir(dirAbs, keepKebab) {
  const keep = String(keepKebab || '').trim().toLowerCase();
  if (!keep) return [];
  let entries;
  try {
    entries = await readdir(dirAbs);
  } catch {
    return [];
  }
  const siblingKebabs = new Set();
  for (const name of entries) {
    const m = String(name).match(/^(.*)\.definition\.ts$/i);
    if (!m?.[1]) continue;
    const other = m[1].toLowerCase();
    if (other && other !== keep) siblingKebabs.add(m[1]);
  }
  /** @type {string[]} */
  const removed = [];
  const suffixes = [
    '.tsx',
    '.client.tsx',
    '.definition.ts',
    '.capture-meta.json',
  ];
  for (const sibling of siblingKebabs) {
    for (const suffix of suffixes) {
      const filePath = path.join(dirAbs, `${sibling}${suffix}`);
      try {
        await unlink(filePath);
        removed.push(filePath);
      } catch {
        /* missing ok */
      }
    }
  }
  if (removed.length) {
    console.warn(
      `  · Retired ${siblingKebabs.size} casing-sibling package prefix(es) in ${path.basename(dirAbs)} (kept ${keep})`,
    );
  }
  return removed;
}

/**
 * Page-qualify a section path so home/platform `sections/section-06` do not collide.
 * @param {string|null|undefined} pageSlug e.g. www-sitecore-com--home
 * @param {string|null|undefined} sectionDirRel e.g. sections/section-06
 */
export function qualifySectionDir(pageSlug, sectionDirRel) {
  const rel = String(sectionDirRel || '')
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\//, '');
  const slug = String(pageSlug || '').trim();
  if (!rel) return slug;
  if (slug && (rel === slug || rel.startsWith(`${slug}/`))) return rel;
  if (slug) return `${slug}/${rel}`;
  return rel;
}

/**
 * Relative `sections/…` segment from a bare or page-qualified sectionDir.
 * @param {string} sectionDir
 */
export function sectionDirRelativePart(sectionDir) {
  const d = String(sectionDir || '').replace(/\\/g, '/').trim();
  const idx = d.indexOf('sections/');
  if (idx >= 0) return d.slice(idx);
  return d;
}

/**
 * Resolve page slug from capture-meta (explicit field or URL).
 * @param {Record<string, unknown>|null|undefined} meta
 * @param {string|null|undefined} [fallback]
 */
export function metaPageSlug(meta, fallback = '') {
  const explicit = String(meta?.pageSlug || '').trim();
  if (explicit) return explicit;
  const url = String(meta?.url || '').trim();
  if (url) {
    try {
      return String(slugFromUrl(url) || '').trim();
    } catch {
      /* ignore */
    }
  }
  return String(fallback || '').trim();
}

/**
 * True when capture-meta belongs to the same page-qualified section slot.
 * Legacy bare `sections/NN` matches only when pageSlug (or URL-derived slug) agrees.
 * @param {Record<string, unknown>|null|undefined} meta
 * @param {string} sectionDir requested (bare or qualified)
 * @param {string|null|undefined} pageSlug
 */
export function sectionIdentityMatches(meta, sectionDir, pageSlug = null) {
  if (!meta) return false;
  const want = qualifySectionDir(pageSlug, sectionDir);
  const metaDir = String(meta.sectionDir || '').replace(/\\/g, '/').trim();
  if (!want || !metaDir) return false;
  if (metaDir === want) return true;

  const wantRel = sectionDirRelativePart(want);
  const metaRel = sectionDirRelativePart(metaDir);
  if (!wantRel || metaRel !== wantRel) return false;

  const slug = String(pageSlug || '').trim();
  const metaSlug = metaPageSlug(meta, '');
  if (slug && metaSlug) return slug === metaSlug;
  // Qualified metaDir for a different page
  if (metaDir.includes('/sections/') && slug) {
    return metaDir.startsWith(`${slug}/`);
  }
  // Legacy bare meta with no pageSlug/url — do not match a page-qualified request
  if (slug && !metaSlug && metaDir === wantRel) return false;
  if (!slug && !metaSlug && metaDir === wantRel) return true;
  return false;
}

/**
 * Strip trailing numeric suffix used for collision packages (Social2 → Social).
 * @param {string} name
 */
export function stripComponentNameCollisionSuffix(name) {
  return String(name || '').replace(/(\d+)$/, '');
}

/**
 * Cross-page child package reuse by registry folder + enrich role / preferred stem.
 * @param {{
 *   hostSlug: string,
 *   registryFolder: string,
 *   preferred: string,
 *   enrichChildRole?: string|null,
 *   codePrefix?: string,
 *   excludeNames?: Set<string>,
 * }} opts
 * @returns {Promise<{ componentName: string, meta: Record<string, unknown> }|null>}
 */
export async function findRegistryChildPackageReuse(opts) {
  const folder = String(opts.registryFolder || '')
    .replace(/\\/g, '/')
    .trim();
  if (!folder) return null;
  const preferred = toPascalCase(String(opts.preferred || '').trim());
  const roleName = toPascalCase(String(opts.enrichChildRole || '').trim());
  const stem = stripComponentNameCollisionSuffix(preferred);
  const roleStem = stripComponentNameCollisionSuffix(roleName);
  const prefix = String(opts.codePrefix || '');
  const excluded = opts.excludeNames || new Set();
  const hostRoot = path.join(bqRoot, 'src', 'components', opts.hostSlug);
  if (!(await exists(hostRoot))) return null;
  /** @type {Array<{ componentName: string, meta: Record<string, unknown> }>} */
  const hits = [];
  let entries;
  try {
    entries = await readdir(hostRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (excluded.has(ent.name)) continue;
    const meta = await readCaptureMeta(opts.hostSlug, ent.name);
    if (!meta || String(meta.role || '') !== 'child') continue;
    const metaFolder = String(
      meta.registryFolder || meta.registrySection?.componentFolder || '',
    )
      .replace(/\\/g, '/')
      .trim();
    if (metaFolder && metaFolder !== folder) continue;
    // When meta lacks registryFolder, still match by preferred/role stem so
    // first-time migration can reuse home packages from platform converts.
    const pkgStem = stripComponentNameCollisionSuffix(ent.name);
    const prefMatch =
      (stem && (pkgStem === stem || pkgStem.endsWith(stem) || stem.endsWith(pkgStem))) ||
      (roleStem &&
        (pkgStem === roleStem ||
          pkgStem.endsWith(roleStem) ||
          roleStem.endsWith(pkgStem)));
    if (!prefMatch) continue;
    // Prefer packages that already record this registry folder; allow stem-only
    // when folder unset (legacy capture-meta).
    if (!metaFolder && folder) {
      // Keep as candidate; prefer metaFolder hits via sort below
    }
    hits.push({ componentName: ent.name, meta });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => {
    const aFolder = String(
      a.meta.registryFolder || a.meta.registrySection?.componentFolder || '',
    );
    const bFolder = String(
      b.meta.registryFolder || b.meta.registrySection?.componentFolder || '',
    );
    if (aFolder === folder && bFolder !== folder) return -1;
    if (bFolder === folder && aFolder !== folder) return 1;
    // Prefer non-…2 names
    const aNum = /\d+$/.test(a.componentName) ? 1 : 0;
    const bNum = /\d+$/.test(b.componentName) ? 1 : 0;
    if (aNum !== bNum) return aNum - bNum;
    return String(a.meta.generatedAt || '').localeCompare(
      String(b.meta.generatedAt || ''),
    );
  });
  const hit = hits[0];
  if (prefix && !hit.componentName.startsWith(prefix)) {
    // Brand packages should already be prefixed
  }
  return hit;
}

/**
 * Find packages under a host whose capture-meta matches the page-qualified section.
 * @param {string} hostSlug
 * @param {string} sectionDir
 * @param {string|null|undefined} [pageSlug]
 * @returns {Promise<Array<{ componentName: string, meta: Record<string, unknown> }>>}
 */
export async function findPackagesBySectionDir(hostSlug, sectionDir, pageSlug = null) {
  const needle = String(sectionDir || '').replace(/\\/g, '/').trim();
  if (!needle) return [];
  const hostRoot = path.join(bqRoot, 'src', 'components', hostSlug);
  if (!(await exists(hostRoot))) return [];
  /** @type {Array<{ componentName: string, meta: Record<string, unknown> }>} */
  const out = [];
  let entries;
  try {
    entries = await readdir(hostRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const meta = await readCaptureMeta(hostSlug, ent.name);
    if (!meta) continue;
    if (!sectionIdentityMatches(meta, needle, pageSlug)) continue;
    out.push({ componentName: ent.name, meta });
  }
  return out;
}

/**
 * @param {Record<string, unknown>|null|undefined} meta
 * @param {string|null|undefined} role
 */
function metaMatchesRole(meta, role) {
  if (!role) return true;
  const r = String(meta?.role || '');
  if (role === 'section' || role === 'parent') {
    return !r || r === 'section' || r === 'parent';
  }
  return r === role;
}

/**
 * Extract content.location.folder / datasourceLocation.folder from definition TS.
 * Flat unique segment names (legacy capture-meta.mediaFolders).
 * @param {string} definitionTs
 * @returns {string[]}
 */
export function extractMediaFoldersFromDefinition(definitionTs) {
  const paths = extractFolderPathsFromDefinitionTs(definitionTs);
  /** @type {string[]} */
  const folders = [];
  for (const segs of paths) {
    for (const seg of segs) {
      if (seg && !folders.includes(seg)) folders.push(seg);
    }
  }
  return folders;
}

/**
 * @param {string} definitionTs
 * @param {string} field
 */
function readSystemNameFromDefinitionTs(definitionTs, field) {
  const re = new RegExp(`${field}\\s*:\\s*["']([^"']+)["']`);
  const m = String(definitionTs || '').match(re);
  return m ? String(m[1] || '').trim() : '';
}

/**
 * Stable pick among child packages for the same sectionDir (earliest generatedAt, then name).
 * @param {Array<{ componentName: string, meta: Record<string, unknown> }>} pkgs
 */
function pickStableChildPackage(pkgs) {
  if (!pkgs?.length) return null;
  return [...pkgs].sort((a, b) => {
    const ta = String(a.meta?.generatedAt || '');
    const tb = String(b.meta?.generatedAt || '');
    if (ta && tb && ta !== tb) return ta.localeCompare(tb);
    if (ta && !tb) return -1;
    if (!ta && tb) return 1;
    return String(a.componentName).localeCompare(String(b.componentName));
  })[0];
}

/**
 * @param {string|null|undefined} stickyName
 * @param {string} prefix Pascal brand prefix or ''
 */
function normalizeStickyComponentName(stickyName, prefix) {
  const raw = toPascalCase(String(stickyName || '').trim());
  if (!raw) return '';
  return prefix ? ensureBrandComponentPrefix(raw, prefix) : raw;
}

/**
 * @param {string} hostSlug
 */
export function sectionNameIndexPath(hostSlug) {
  return path.join(bqRoot, 'src', 'components', hostSlug, 'section-name-index.json');
}

/**
 * @param {string} hostSlug
 * @returns {Promise<Record<string, { componentName?: string, children?: string[], definitionKey?: string, role?: string }>>}
 */
export async function readSectionNameIndex(hostSlug) {
  const indexPath = sectionNameIndexPath(hostSlug);
  if (!(await exists(indexPath))) return {};
  try {
    const raw = JSON.parse(await readFile(indexPath, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

/**
 * Lookup locked names for a page-qualified sectionDir.
 * @param {string} hostSlug
 * @param {string|null|undefined} sectionDir
 * @param {string|null|undefined} [pageSlug]
 */
export async function lookupSectionNameIndexEntry(
  hostSlug,
  sectionDir,
  pageSlug = null,
) {
  const want = qualifySectionDir(pageSlug, sectionDir);
  if (!want) return null;
  const index = await readSectionNameIndex(hostSlug);
  if (index[want] && typeof index[want] === 'object') return index[want];
  // Legacy bare keys (sections/section-NN) from before page-qualified index.
  const rel = sectionDirRelativePart(want);
  if (rel && rel !== want && index[rel] && typeof index[rel] === 'object') {
    return index[rel];
  }
  return null;
}

/**
 * Pick a free component name: prefer locked index/sticky names, then existing
 * package for the same sectionDir, else brand-prefixed preferred / alternatives.
 * Always applies `codePrefix` so component-map aliases stay unique across collections.
 *
 * @param {object} opts
 * @param {string|null} [opts.stickyName] Prior package name to keep across runs
 * @param {number|null} [opts.childIndex] Child slot index for index.children[]
 * @param {Iterable<string>|null} [opts.excludeNames] Child names already claimed this run
 * @param {string|null} [opts.pageSlug] Capture page slug (scopes sectionDir reuse)
 * @param {string|null} [opts.registryFolder] Registry componentFolder for cross-page child reuse
 * @param {string|null} [opts.enrichChildRole] Enrich child role / canonical plan name (e.g. FooterBrandingSocial)
 * @param {string|null} [opts.presentationRole] Enrich/plan role (partial-header, page, …)
 * @param {string|null} [opts.chromeKind] Capture chromeKind (header-stack, …)
 * @param {string|null} [opts.track] Capture track (header, footer, …)
 * @param {string|null} [opts.purpose] Section purpose / description for role stems
 */
export async function resolveComponentName({
  preferred,
  alternatives = [],
  hostSlug,
  codePrefix = '',
  sectionDir,
  contentHash,
  force = false,
  role = null,
  stickyName = null,
  childIndex = null,
  excludeNames = null,
  pageSlug = null,
  registryFolder = null,
  enrichChildRole = null,
  presentationRole = null,
  chromeKind = null,
  track = null,
  purpose = null,
}) {
  const prefix = toPascalCase(codePrefix);
  const excluded = new Set(
    [...(excludeNames || [])]
      .map((n) => toPascalCase(String(n || '').trim()))
      .filter(Boolean),
  );
  const roleStems = roleDerivedComponentNameStems({
    presentationRole,
    chromeKind,
    track,
    purpose,
    packageRole: role,
  });
  const rawCandidates = [
    toPascalCase(preferred),
    ...alternatives.map((a) => toPascalCase(a)),
    ...roleStems,
  ].filter(Boolean);
  const candidates = rawCandidates.map((c) =>
    prefix ? ensureBrandComponentPrefix(c, prefix) : c,
  );
  // de-dupe; invent order = preferred → alternatives → role-derived stems.
  // Never invent Preferred2…8 numeric twins — fail if no free semantic name.
  const seen = new Set();
  const list = [];
  const pushUnique = (c) => {
    if (!c || seen.has(c)) return;
    seen.add(c);
    list.push(c);
  };
  for (const c of candidates) {
    pushUnique(c);
  }
  const primary = list[0] || '';

  const brandedDefinitionKey = (componentName) => {
    const key = toDefinitionKey(componentName);
    return prefix ? ensureBrandDefinitionKeyPrefix(key, prefix) : key;
  };

  const reuseHit = (hit, { locked = false } = {}) => {
    const name = hit.componentName;
    if (list[0] && name !== list[0]) {
      console.warn(
        `  ⚠ Name lock: keep ${name} (AI preferred ${list[0]})`,
      );
    }
    return {
      componentName: name,
      overwrite: true,
      definitionKey: brandedDefinitionKey(name),
      reusedBySectionDir: true,
      nameLocked: locked,
    };
  };

  /**
   * Authoritative lock: stickyName → section-name-index → (later) package scan.
   * @param {string} lockName
   * @param {boolean} [locked]
   */
  const tryPackageLock = async (lockName, locked = true) => {
    if (!lockName || excluded.has(lockName)) return null;
    const dir = componentDir(hostSlug, lockName);
    if (!(await exists(dir))) return null;
    const meta = await readCaptureMeta(hostSlug, lockName);
    if (meta) {
      if (
        sectionDir &&
        !sectionIdentityMatches(meta, sectionDir, pageSlug)
      ) {
        return null;
      }
      if (role && !metaMatchesRole(meta, role)) return null;
    }
    return reuseHit({ componentName: lockName, meta: meta || {} }, { locked });
  };

  // Compute lock name first (index → sticky) so --force can unlock before reuse hits.
  let lockName = '';
  if (sectionDir) {
    const indexEntry = await lookupSectionNameIndexEntry(
      hostSlug,
      sectionDir,
      pageSlug,
    );
    if (indexEntry) {
      if (role === 'child') {
        const idx =
          childIndex != null && Number.isFinite(Number(childIndex))
            ? Math.trunc(Number(childIndex))
            : -1;
        let fromChildren = null;
        if (idx >= 0 && Array.isArray(indexEntry.children)) {
          const raw = indexEntry.children[idx];
          fromChildren =
            typeof raw === 'string'
              ? raw
              : raw && typeof raw === 'object'
                ? String(raw.componentName || raw.name || '').trim()
                : null;
        }
        lockName = normalizeStickyComponentName(fromChildren, prefix);
      } else {
        lockName = normalizeStickyComponentName(
          indexEntry.componentName,
          prefix,
        );
      }
    }
  }
  if (!lockName) {
    lockName = normalizeStickyComponentName(stickyName, prefix);
  }

  const preferredName = list[0] || '';
  /** @type {string|null} */
  let forceRenamedFrom = null;
  /** @type {string|null} */
  let previousDefinitionKey = null;
  /** @type {string|null} */
  let retireCasingSiblingFrom = null;
  const casingOnlyVsLock = namesDifferOnlyByCase(preferredName, lockName);
  // Casing-only must keep the lock identity (no GUID remint) — not a --force unlock.
  const forceUnlock =
    Boolean(force) &&
    Boolean(preferredName) &&
    Boolean(lockName) &&
    preferredName !== lockName &&
    !casingOnlyVsLock &&
    !excluded.has(preferredName);

  if (forceUnlock) {
    const lockMeta = await readCaptureMeta(hostSlug, lockName);
    previousDefinitionKey =
      String(lockMeta?.definitionKey || '').trim() ||
      brandedDefinitionKey(lockName);
    forceRenamedFrom = lockName;
    console.warn(
      `  ⚠ Name unlock (--force): ${lockName} → ${preferredName}`,
    );
  }

  if (casingOnlyVsLock && preferredName && lockName) {
    retireCasingSiblingFrom = preferredName;
    previousDefinitionKey = brandedDefinitionKey(preferredName);
    console.warn(
      `  ⚠ Casing-only remint: keep ${lockName} (AI preferred ${preferredName}); retire sibling kebab if present`,
    );
  }

  const withForceRenameMeta = (result) => {
    const out = { ...result };
    if (forceRenamedFrom) {
      out.forceRenamedFrom = forceRenamedFrom;
      out.previousDefinitionKey = previousDefinitionKey;
      out.nameLocked = false;
    }
    if (retireCasingSiblingFrom) {
      out.retireCasingSiblingFrom = retireCasingSiblingFrom;
      out.previousDefinitionKey =
        out.previousDefinitionKey || previousDefinitionKey;
    }
    return out;
  };

  // 0) Cross-page child reuse: same registry folder + same enrich child role →
  // existing package (no …2), even when sectionDir / pageSlug differ.
  // Skipped under --force rename unlock (preferred ≠ lock).
  if (!forceUnlock && role === 'child' && registryFolder) {
    const registryHit = await findRegistryChildPackageReuse({
      hostSlug,
      registryFolder,
      preferred: list[0] || preferred,
      enrichChildRole,
      codePrefix: prefix,
      excludeNames: excluded,
    });
    if (registryHit) {
      return reuseHit(registryHit, { locked: true });
    }
  }

  // 1) Name lock before AI preferred (skipped under --force rename unlock)
  if (!forceUnlock && lockName) {
    const locked = await tryPackageLock(lockName, true);
    if (locked) return withForceRenameMeta(locked);
  }

  // sectionDir-first reuse — page-qualified so home/platform section-NN do not collide
  // Skipped under --force rename unlock so preferred invents a new package.
  if (!forceUnlock && sectionDir) {
    const bySection = await findPackagesBySectionDir(
      hostSlug,
      sectionDir,
      pageSlug,
    );
    const roleMatches = bySection.filter(
      (p) =>
        metaMatchesRole(p.meta, role) && !excluded.has(p.componentName),
    );

    // Prefer a candidate name that already owns this sectionDir
    for (const name of list) {
      if (excluded.has(name)) continue;
      const hit = roleMatches.find((p) => p.componentName === name);
      if (!hit) continue;
      const sameHash =
        !contentHash ||
        !hit.meta.contentHash ||
        hit.meta.contentHash === contentHash;
      // Same page-qualified section only — never ignore contentHash via bare path equality
      if (force || sameHash) {
        return reuseHit(hit, { locked: true });
      }
    }

    // Preferred renamed: reuse the existing section package(s) for this slot
    if (role === 'section' || role === 'parent' || !role) {
      const sectionPkgs = roleMatches.filter((p) =>
        metaMatchesRole(p.meta, 'section'),
      );
      if (sectionPkgs.length === 1) {
        const hit = sectionPkgs[0];
        const sameHash =
          !contentHash ||
          !hit.meta.contentHash ||
          hit.meta.contentHash === contentHash;
        if (force || sameHash) {
          return reuseHit(hit, { locked: true });
        }
      } else if (sectionPkgs.length > 1) {
        // Orphan rename leak: never invent a third name — keep oldest lock.
        const sorted = [...sectionPkgs].sort((a, b) => {
          const at = String(a.meta?.generatedAt || a.meta?.updatedAt || '');
          const bt = String(b.meta?.generatedAt || b.meta?.updatedAt || '');
          if (at && bt && at !== bt) return at.localeCompare(bt);
          return String(a.componentName).localeCompare(String(b.componentName));
        });
        const hit = sorted[0];
        const sameHash =
          !contentHash ||
          !hit.meta.contentHash ||
          hit.meta.contentHash === contentHash;
        if (force || sameHash) {
          console.warn(
            `  ⚠ Name lock: ${sectionPkgs.length} packages share sectionDir — keep ${hit.componentName}`,
          );
          return reuseHit(hit, { locked: true });
        }
      }
    }

    // Child: sticky already tried above; by-key, single-package, then multi-orphan stable
    if (role === 'child') {
      const childPkgs = roleMatches.filter((p) => metaMatchesRole(p.meta, 'child'));

      const sticky = normalizeStickyComponentName(stickyName, prefix);
      if (sticky) {
        const stickyHit = childPkgs.find((p) => p.componentName === sticky);
        if (stickyHit) {
          return reuseHit(stickyHit, { locked: true });
        }
      }

      const prefKey = toDefinitionKey(list[0]);
      const byKey = childPkgs.find(
        (p) =>
          String(p.meta.definitionKey || '') === prefKey ||
          toDefinitionKey(p.componentName) === prefKey,
      );
      if (byKey) {
        const sameHash =
          !contentHash ||
          !byKey.meta.contentHash ||
          byKey.meta.contentHash === contentHash;
        if (force || sameHash) {
          return reuseHit(byKey, { locked: true });
        }
      }

      if (childPkgs.length === 1) {
        const hit = childPkgs[0];
        const sameHash =
          !contentHash ||
          !hit.meta.contentHash ||
          hit.meta.contentHash === contentHash;
        if (force || sameHash) {
          return reuseHit(hit, { locked: true });
        }
      }

      if (childPkgs.length > 1) {
        const stable = pickStableChildPackage(childPkgs);
        if (stable) {
          return reuseHit(stable, { locked: true });
        }
      }
    }
  }

  /** @type {string[]} */
  const rejectedTaken = [];
  for (const name of list) {
    if (excluded.has(name)) continue;
    const branded = prefix ? ensureBrandComponentPrefix(name, prefix) : name;
    const dir = componentDir(hostSlug, branded);
    const dirExists = await exists(dir);
    if (!dirExists) {
      if (
        primary &&
        branded !== primary &&
        rejectedTaken.includes(primary)
      ) {
        console.warn(
          `  ⚠ preferred name taken: ${primary} owned by another section — using ${branded}`,
        );
      }
      return withForceRenameMeta({
        componentName: branded,
        overwrite: false,
        definitionKey: brandedDefinitionKey(branded),
        preferredRejectedAsTaken: rejectedTaken.includes(primary)
          ? primary
          : null,
      });
    }
    let meta = await readCaptureMeta(hostSlug, branded);
    // Case-insensitive folder already has another kebab (Ai vs AI) — reuse survivor.
    if (!meta) {
      meta = await readAnyCaptureMetaInDir(dir);
      const existingName = String(meta?.componentName || '').trim();
      if (
        meta &&
        existingName &&
        namesDifferOnlyByCase(branded, existingName)
      ) {
        const sameIdentity =
          sectionIdentityMatches(meta, sectionDir, pageSlug) &&
          metaMatchesRole(meta, role);
        const sameHash =
          !contentHash ||
          !meta?.contentHash ||
          meta.contentHash === contentHash;
        if (sameIdentity && (force || sameHash || !sectionDir)) {
          return withForceRenameMeta({
            componentName: existingName,
            overwrite: true,
            definitionKey:
              String(meta.definitionKey || '').trim() ||
              brandedDefinitionKey(existingName),
            retireCasingSiblingFrom: branded,
            previousDefinitionKey: brandedDefinitionKey(branded),
          });
        }
      }
    }
    const sameIdentity =
      meta &&
      sectionIdentityMatches(meta, sectionDir, pageSlug) &&
      metaMatchesRole(meta, role);
    const sameHash =
      !contentHash || !meta?.contentHash || meta.contentHash === contentHash;
    if (sameIdentity && (force || sameHash)) {
      const existingName =
        String(meta?.componentName || '').trim() || branded;
      return withForceRenameMeta({
        componentName: existingName,
        overwrite: true,
        definitionKey:
          String(meta?.definitionKey || '').trim() ||
          brandedDefinitionKey(existingName),
        ...(namesDifferOnlyByCase(branded, existingName)
          ? {
              retireCasingSiblingFrom: branded,
              previousDefinitionKey: brandedDefinitionKey(branded),
            }
          : {}),
      });
    }
    rejectedTaken.push(branded);
  }

  const takenHint = rejectedTaken.length
    ? ` taken=[${rejectedTaken.join(', ')}]`
    : '';
  throw new Error(
    `Could not resolve free component name for ${preferred} under ${hostSlug} ` +
      `(no free semantic candidate; numeric Preferred2 invent is disabled)${takenHint}`,
  );
}

export async function writeComponentPackage({
  hostSlug,
  componentName,
  kebab,
  tsx,
  clientTsx = null,
  definitionTs,
  captureMeta,
  imageInventory = null,
  sectionInfo = null,
  sectionHtml = null,
  definitionKey = null,
  codePrefix = null,
  layoutMode = null,
  planMode = null,
  plan = null,
  /** @type {Array<object>|null} */
  childPackages = null,
  role = null,
  /** @type {'default'|'navigation'|null} */
  packageKind = null,
  dryRun = false,
  /**
   * After AI validate loop is clean: Prettier + companion import path only —
   * no mechanical TSX remaps/strips (AI must already satisfy contracts).
   */
  validateClean = false,
  /**
   * When set, section-name-index writes the new package name (force-rename unlock)
   * instead of keeping the prior locked name.
   * @type {string|null}
   */
  forceRenamedFrom = null,
  /** @type {string|null} */
  previousDefinitionKey = null,
}) {
  const dir = componentDir(hostSlug, componentName);
  const tsxPath = path.join(dir, `${kebab}.tsx`);
  const clientPath = path.join(dir, `${kebab}.client.tsx`);
  const defPath = path.join(dir, `${kebab}.definition.ts`);
  const metaPath = path.join(dir, `${kebab}.capture-meta.json`);
  const key =
    String(definitionKey || '').trim() ||
    toDefinitionKey(componentName) ||
    kebab;
  const resolvedLayoutMode =
    layoutMode || inferPlaceholderLayoutMode(sectionInfo, sectionHtml);
  const carouselChromeMode = inferCarouselChromeMode(sectionInfo, sectionHtml);
  let wroteClient = Boolean(clientTsx && String(clientTsx).trim());

  // Pre-normalize peek: TSX decides composite vs single before definition fixups.
  const peekTsx = validateClean
    ? ensureCompanionClientImport(normalizeAiSource(tsx), {
        kebab,
        clientTsx,
        componentName,
      })
    : normalizeComponentTsx(tsx, {
        layoutMode: resolvedLayoutMode,
        kebab,
        planMode,
        clientTsx,
      });
  // Validate-clean path: no plan-fill / self-nested salvage — AI must satisfy contracts.
  // Never fill placeholders from plan — TSX extract + child packages only.
  const allowPlanFill = false;
  const plannedMode =
    String(planMode || '').toLowerCase() === 'composite' ? 'composite' : 'single';
  // Sitecoreize packages + TSX are authoritative (not planned-mode pinning).
  const trustTsxStructure = true;
  const resolvedChildPackages = Array.isArray(childPackages)
    ? childPackages
    : Array.isArray(captureMeta?.children)
      ? captureMeta.children
      : [];
  const synced = syncDefinitionFromTsx(definitionTs, {
    tsxSource: peekTsx,
    clientTsxSource: wroteClient ? clientTsx : null,
    plan,
    childPackages: resolvedChildPackages,
    role,
    allowPlanFill,
    plannedMode,
    nodeMode: plannedMode,
    trustTsxStructure,
    definitionKey: key,
  });
  // synced.planMode follows TSX.
  const effectivePlanMode = synced.planMode || plannedMode;
  let definitionForWrite = synced.definitionTs;
  const resolvedPackageKind =
    String(packageKind || plan?.packageKind || 'default').toLowerCase() ===
    'navigation'
      ? 'navigation'
      : 'default';
  const metaExtras = {
    mode: effectivePlanMode,
    packageKind: resolvedPackageKind,
    placeholderKeys: synced.placeholderKeys || [],
    placeholderKey: synced.placeholderKeys?.[0] || null,
  };

  if (!dryRun) {
    await mkdir(dir, { recursive: true });
    // Casing remints: drop sibling kebab package files in this folder before write.
    await retireSiblingKebabFilesInDir(dir, kebab);
    let normalizedTsx = ensureNewline(peekTsx);
    let hasClient = wroteClient;
    let clientSource = hasClient ? String(clientTsx) : '';

    const needsMobileNavClient =
      !validateClean &&
      !hasClient &&
      (/\bdata-mobile-menu-toggle\b/.test(normalizedTsx) ||
        (/lg:hidden[\s\S]{0,200}h-0\.5[\s\S]{0,80}h-0\.5/.test(normalizedTsx) &&
          /Mobile Menu Label|aria-label=["'][^"']*[Mm]enu/.test(normalizedTsx)));

    if (needsMobileNavClient) {
      clientSource = buildMobileNavChromeStub(componentName);
      hasClient = true;
      // Wire stub into server TSX when no chrome import yet
      if (!/from\s+['"]\.\/[^'"]+\.client['"]/.test(normalizedTsx)) {
        const chromeIdent = `${componentName.replace(/[^A-Za-z0-9]/g, '') || 'Component'}Chrome`;
        const clientImport = `import ${chromeIdent} from './${kebab}.client';\n`;
        if (/^import\s/m.test(normalizedTsx)) {
          normalizedTsx = normalizedTsx.replace(
            /^(import\s[^\n]+\n)/m,
            `${clientImport}$1`,
          );
        } else {
          normalizedTsx = clientImport + normalizedTsx;
        }
        // Wrap outermost return element children lightly — prefer wrapping full return JSX
        if (
          !new RegExp(`<${chromeIdent}\\b`).test(normalizedTsx) &&
          /\breturn\s*\(/.test(normalizedTsx)
        ) {
          normalizedTsx = normalizedTsx.replace(
            /return\s*\(\s*/,
            `return (\n    <${chromeIdent}>\n      `,
          );
          // Close before final );
          const lastClose = normalizedTsx.lastIndexOf(');');
          if (lastClose > 0) {
            normalizedTsx =
              normalizedTsx.slice(0, lastClose) +
              `\n    </${chromeIdent}>\n  );` +
              normalizedTsx.slice(lastClose + 2);
          }
        }
        console.warn(
          `  ⚠ ${componentName}: generated mobile-nav client chrome (hamburger without toggle handler)`,
        );
      }
    }

    const needsCarouselClient =
      !validateClean &&
      resolvedLayoutMode === 'carousel' &&
      carouselChromeMode !== 'none' &&
      /\bAppPlaceholder\b/.test(normalizedTsx) &&
      (!hasClient ||
        !clientMatchesCarouselChromeMode(clientSource, carouselChromeMode));

    if (needsCarouselClient) {
      clientSource = buildCarouselChromeStub(componentName, carouselChromeMode, {
        continuousMarquee: prefersContinuousMarquee(sectionInfo),
        bandTicker:
          String(sectionInfo?.layout?.motion?.surface || '').toLowerCase() ===
            'band-ticker' ||
          /announcement|notification.?bar|band.?ticker/i.test(
            String(sectionInfo?.cmsName || sectionInfo?.componentName || ''),
          ),
      });
      hasClient = true;
      const preferredChromeIdent = `${componentName.replace(/[^A-Za-z0-9]/g, '') || 'Component'}Chrome`;
      if (!/from\s+['"]\.\/[^'"]+\.client['"]/.test(normalizedTsx)) {
        const clientImport = `import ${preferredChromeIdent} from './${kebab}.client';\n`;
        if (/^import\s/m.test(normalizedTsx)) {
          normalizedTsx = normalizedTsx.replace(
            /^(import\s[^\n]+\n)/m,
            `${clientImport}$1`,
          );
        } else {
          normalizedTsx = clientImport + normalizedTsx;
        }
      }
      // Wrap with the actual import alias only — never invent a second undeclared *Chrome tag.
      const chromeAlias =
        parseCompanionClientImportAlias(normalizedTsx) || preferredChromeIdent;
      if (
        /<AppPlaceholder\b/.test(normalizedTsx) &&
        !appPlaceholderUnderImportedClientChrome(normalizedTsx)
      ) {
        normalizedTsx = normalizedTsx.replace(
          /(<AppPlaceholder\b[\s\S]*?\/>)/,
          `<${chromeAlias}>\n            $1\n          </${chromeAlias}>`,
        );
      }
      console.warn(
        `  ⚠ ${componentName}: generated carousel client chrome (mode=${carouselChromeMode})`,
      );
      // Re-run normalize so unwrapNestedTrackInsideCarouselChrome can clean nested tracks
      normalizedTsx = normalizeComponentTsx(normalizedTsx, {
        layoutMode: resolvedLayoutMode,
        kebab,
        planMode,
      });
    }

    // Always-on RSC fixup: hoist AppPlaceholder/component-map out of clientTsx
    // into thin map-entry as children (prevents {Default: function Default}).
    if (hasClient) {
      const hoisted = hoistClientAppPlaceholderToServerChildren({
        tsx: normalizedTsx,
        clientTsx: clientSource,
      });
      normalizedTsx = hoisted.tsx;
      clientSource = hoisted.clientTsx || '';
    }

    let normalizedClient = '';
    if (hasClient) {
      wroteClient = true;
      normalizedClient = validateClean
        ? normalizeAiSource(clientSource)
        : normalizeClientTsx(clientSource);
      if (!validateClean) {
        normalizedTsx = stripUnknownChromeProps(normalizedTsx, normalizedClient);
      }
    }
    // Write-path filename contract: companion is always `{kebab}.client.tsx`.
    // Apply even when prompt-first / validateClean skips bulk normalizeComponentTsx fixups.
    // Also inject a missing `./{kebab}.client` import (FAQ Chrome crash pattern).
    if (
      hasClient ||
      /from\s+['"]\.\/[^'"]+\.client['"]/.test(normalizedTsx)
    ) {
      normalizedTsx = hasClient
        ? ensureCompanionClientImport(normalizedTsx, {
            kebab,
            clientTsx: clientSource,
            componentName,
          })
        : rewriteCompanionClientImport(normalizedTsx, kebab);
    }
    // Always-on write-path sanitizers (also used by the build gate before AI repair).
    {
      let fontSvg = '';
      try {
        const sectionDir =
          captureMeta?.sectionDir ||
          sectionInfo?.sectionDir ||
          null;
        if (sectionDir && sectionHtml) {
          const { loadIconFontSvgForSection } = await import(
            './icon-font-svg-markup.mjs'
          );
          const htmlPathGuess = path.join(
            defaultCapturesDir,
            String(sectionDir).replace(/\\/g, '/'),
            'section.html',
          );
          fontSvg = await loadIconFontSvgForSection(htmlPathGuess);
        }
      } catch {
        fontSvg = '';
      }
      const sanitized = applyWritePathAlwaysOnTsxSanitizers({
        tsx: normalizedTsx,
        clientTsx: hasClient ? normalizedClient : null,
        kebab,
        sectionInfo,
        role,
        definitionTs: definitionForWrite || definitionTs || null,
        sectionHtml,
        fontSvg,
      });
      normalizedTsx = sanitized.tsx;
      if (hasClient) normalizedClient = sanitized.clientTsx || normalizedClient;
      if (sanitized.definitionTs) {
        definitionForWrite = sanitized.definitionTs;
      }
    }
    if (!hasClient && mapEntryImportsCompanionClient(normalizedTsx)) {
      // Fail closed: writing map-entry that imports ./….client without companion
      // produces Next "Module not found" on build (HeaderMenuBand failure mode).
      throw new Error(
        `[codegen] ${componentName}: map-entry imports './….client' but clientTsx is missing/empty — refusing to write broken package (emit complete companion with 'use client' + export default)`,
      );
    }
    const prettyTsx = await formatGeneratedSource(normalizedTsx, {
      filepath: tsxPath,
    });
    await writeFileIfChanged(tsxPath, ensureNewline(prettyTsx));
    await ensureNavigationReferenceImports(prettyTsx, dir);
    if (hasClient) {
      const prettyClient = await formatGeneratedSource(normalizedClient, {
        filepath: clientPath,
      });
      await writeFileIfChanged(clientPath, ensureNewline(prettyClient));
      await ensureNavigationReferenceImports(prettyClient, dir);
    } else if (
      !validateClean &&
      resolvedLayoutMode === 'carousel' &&
      /\bAppPlaceholder\b/.test(normalizedTsx)
    ) {
      console.warn(
        `  ⚠ ${componentName}: layoutMode=carousel but no clientTsx — expected chromeMode=${carouselChromeMode}`,
      );
    }
    const normalizedDef = ensureNewline(
      normalizeDefinitionTs(definitionForWrite, {
        imageInventory,
        sectionInfo,
        sectionHtml,
        definitionKey: key,
        componentName,
        codePrefix,
        tsxSource: normalizedTsx,
        planMode: effectivePlanMode,
        plan,
        allowSelfNestedFixup: allowPlanFill,
        // Never salvage seeds on write — validate loop CONTRACTs + AI retries own repairs.
        // Opt-in only: BQ_ALLOW_SEED_SALVAGE=1 or explicit allowSeedSalvage (tests).
        allowSeedSalvage:
          process.env.BQ_ALLOW_SEED_SALVAGE === '1' ||
          process.env.BQ_ALLOW_SEED_SALVAGE === 'true',
      }),
    );
    // Re-sync after normalize — stripPlaceholdersWhenSingleMode / other fixups
    // must not leave composite TSX with placeholders: [].
    const resynced = syncDefinitionFromTsx(normalizedDef, {
      tsxSource: normalizedTsx,
      clientTsxSource: hasClient ? clientSource : null,
      plan,
      childPackages: resolvedChildPackages,
      role,
      allowPlanFill,
      plannedMode: effectivePlanMode,
      nodeMode: effectivePlanMode,
      trustTsxStructure,
      definitionKey: key,
    });
    // Post-sync: platform Link Lists must stay leaves even if sync refilled slots.
    const defForWrite = forceEmptyPlaceholdersForPlatformLinkLists(
      resynced.definitionTs,
    );
    const prettyDef = await formatGeneratedSource(defForWrite, {
      filepath: defPath,
    });
    await writeFileIfChanged(defPath, ensureNewline(prettyDef));

    const logoRailCheck = assertLogoRailChildHasImage({
      role,
      sectionInfo,
      parentComponentName: captureMeta?.parentComponentName,
      plan,
      tsx: normalizedTsx,
      definitionTs: defForWrite,
      componentName,
    });

    const contentFolders = extractFolderPathsFromDefinitionTs(defForWrite);
    const mediaFolders = extractMediaFoldersFromDefinition(defForWrite);

    // Same-package folder rename: retire prior Data/media YAML before meta update.
    try {
      const priorMeta = await readCaptureMeta(hostSlug, componentName);
      const prior = folderPathsFromCaptureMeta(priorMeta);
      const keepKeys = new Set(contentFolders.map((p) => folderPathKey(p)));
      const priorChanged = [...prior.contentFolderPaths, ...prior.mediaFolderPaths]
        .map((p) => folderPathKey(p))
        .some((k) => k && !keepKeys.has(k));
      if (priorChanged) {
        const collectionSystem = readSystemNameFromDefinitionTs(
          resynced.definitionTs,
          'collectionSystem',
        );
        const siteSystem =
          readSystemNameFromDefinitionTs(resynced.definitionTs, 'siteSystem') ||
          hostSlug;
        if (collectionSystem && siteSystem) {
          const retired = retirePriorContentAndMediaFolders({
            collectionSystem,
            siteSystem,
            priorContentFolderPaths: prior.contentFolderPaths,
            priorMediaFolderPaths: prior.mediaFolderPaths,
            keepContentFolderPaths: contentFolders,
            keepMediaFolderPaths: contentFolders,
          });
          if (retired.removed.length) {
            console.warn(
              `  · Retired prior content/media YAML on folder change for ${componentName} (${retired.removed.length} path(s))`,
            );
          }
        }
      }
    } catch {
      /* non-fatal */
    }

    const renamedFrom = String(forceRenamedFrom || '').trim();
    const prevKey = String(previousDefinitionKey || '').trim();
    const metaOut = {
      ...(captureMeta && typeof captureMeta === 'object' ? captureMeta : {}),
      ...metaExtras,
      componentName,
      definitionKey: key,
      mediaFolders,
      contentFolders,
      mode: resynced.planMode,
      placeholderKeys: resynced.placeholderKeys,
      placeholderKey: resynced.placeholderKeys?.[0] || null,
      ...(renamedFrom
        ? {
            forceRenamedFrom: renamedFrom,
            ...(prevKey ? { previousDefinitionKey: prevKey } : {}),
          }
        : {}),
      // HTML↔Image coverage assert removed (false positives on composite children).
      htmlImageCoverage: {
        ok: logoRailCheck.ok,
        uncoveredCount: 0,
        revisionHints: logoRailCheck.revisionHints || [],
        logoRailChildOk: logoRailCheck.ok,
      },
    };
    await writeFileIfChanged(metaPath, `${JSON.stringify(metaOut, null, 2)}\n`);

    // Host-level sectionDir index for fast reuse across runs
    try {
      const hostRoot = path.join(bqRoot, 'src', 'components', hostSlug);
      const indexPath = path.join(hostRoot, 'section-name-index.json');
      /** @type {Record<string, { componentName: string, role?: string, children?: string[], mediaFolders?: string[] }>} */
      let index = {};
      if (await exists(indexPath)) {
        try {
          index = JSON.parse(await readFile(indexPath, 'utf8')) || {};
        } catch {
          index = {};
        }
      }
      const sectionKeyRaw = String(
        metaOut.sectionDir || captureMeta?.sectionDir || '',
      )
        .replace(/\\/g, '/')
        .trim();
      const pageSlugForIndex = String(
        metaOut.pageSlug || captureMeta?.pageSlug || '',
      ).trim();
      const sectionKey = qualifySectionDir(pageSlugForIndex, sectionKeyRaw);
      if (sectionKey && (metaOut.role === 'section' || metaOut.role === 'parent' || !metaOut.role)) {
        const rel = sectionDirRelativePart(sectionKey);
        const prior =
          (index[sectionKey] && typeof index[sectionKey] === 'object'
            ? index[sectionKey]
            : null) ||
          (rel && rel !== sectionKey && index[rel] && typeof index[rel] === 'object'
            ? index[rel]
            : null);
        // Normal runs keep the prior lock. Force-rename unlock writes the new name.
        const allowIndexRename = Boolean(
          String(forceRenamedFrom || '').trim(),
        );
        const lockedName = allowIndexRename
          ? componentName
          : String(prior?.componentName || '').trim() || componentName;
        const priorChildren = Array.isArray(prior?.children)
          ? prior.children
          : [];
        const nextChildrenRaw = Array.isArray(metaOut.children)
          ? metaOut.children
          : priorChildren;
        const nextChildren = nextChildrenRaw.map((raw) => {
          if (typeof raw === 'string') {
            const n = toPascalCase(raw);
            return {
              componentName: n,
              definitionKey: toDefinitionKey(n),
              placeholderKey: null,
            };
          }
          if (raw && typeof raw === 'object') {
            const n = toPascalCase(
              String(raw.componentName || raw.name || '').trim(),
            );
            if (!n) return null;
            return {
              componentName: n,
              definitionKey:
                String(raw.definitionKey || '').trim() || toDefinitionKey(n),
              placeholderKey:
                String(raw.placeholderKey || raw.placeholder || '').trim() ||
                null,
            };
          }
          return null;
        }).filter(Boolean);
        index[sectionKey] = {
          componentName: lockedName,
          role: metaOut.role || 'section',
          children: nextChildren,
          mediaFolders,
          definitionKey:
            allowIndexRename || lockedName === componentName
              ? key
              : String(prior?.definitionKey || key),
          updatedAt: new Date().toISOString(),
        };
        if (rel && rel !== sectionKey && index[rel]) {
          delete index[rel];
        }
        await writeFileIfChanged(
          indexPath,
          `${JSON.stringify(index, null, 2)}\n`,
        );
      }
    } catch {
      /* non-fatal */
    }
  }

  return {
    dir,
    tsx: tsxPath,
    clientTsx: wroteClient ? clientPath : null,
    definition: defPath,
    captureMeta: metaPath,
    layoutMode: resolvedLayoutMode,
    planMode: effectivePlanMode,
    placeholderKeys: synced.placeholderKeys,
  };
}
