/**
 * Bridge between host section-registry/ catalog and create:sectioncomponents.
 */
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot } from '../capture/paths.mjs';
import {
  SECTION_REGISTRY_DIR,
  getRegistrySection,
  registryComponentDir,
  registryPath,
  resolveRegistryInstanceDir,
} from '../capture/lib/section-registry-paths.mjs';
import {
  writeSharedSectionBacklink,
  loadGlobalManifest,
  saveGlobalManifest,
  resolveCanonicalInstanceDir,
  loadOrMigrateInstances,
} from '../capture/lib/merge-domain-sections.mjs';
import { componentDir, readCaptureMeta } from './write-component.mjs';
import { toKebabCase } from './naming.mjs';
import {
  computeEnrichStructureFingerprint,
  enrichStructureFingerprintsMatch,
} from './enrich-structure-fingerprint.mjs';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} hostSlug — FE folder under src/components (e.g. dom-security-com)
 * @param {string} componentName
 * @param {string} [definitionKey]
 */
export async function sharedPackageExists(hostSlug, componentName, definitionKey) {
  if (!componentName && !definitionKey) return false;
  if (componentName) {
    const dir = componentDir(hostSlug, componentName);
    const kebab = toKebabCase(componentName);
    const tsx = path.join(dir, `${kebab}.tsx`);
    const def = path.join(dir, `${kebab}.definition.ts`);
    if ((await exists(tsx)) && (await exists(def))) return true;
  }
  if (definitionKey) {
    const root = path.join(bqRoot, 'src', 'components', hostSlug);
    try {
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(root, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const meta = await readCaptureMeta(hostSlug, e.name);
        if (meta?.definitionKey === definitionKey) {
          const kebab = toKebabCase(e.name);
          const tsx = path.join(root, e.name, `${kebab}.tsx`);
          const def = path.join(root, e.name, `${kebab}.definition.ts`);
          if ((await exists(tsx)) && (await exists(def))) {
            return { componentName: e.name, definitionKey, dir: path.join(root, e.name) };
          }
        }
      }
    } catch {
      /* none */
    }
  }
  return false;
}

/**
 * Guess FE component from registry cmsName + host packages (DomSecurity*).
 */
async function findPackageByCmsName(hostSlug, codePrefix, cmsName, alsoKnownAs = []) {
  const { ensureBrandComponentPrefix, toPascalCase, toDefinitionKey } = await import(
    './naming.mjs'
  );
  const candidates = [cmsName, ...alsoKnownAs].filter(Boolean).map((n) => {
    const pascal = toPascalCase(n);
    return codePrefix
      ? ensureBrandComponentPrefix(pascal, toPascalCase(codePrefix))
      : pascal;
  });
  for (const componentName of candidates) {
    const ok = await sharedPackageExists(hostSlug, componentName, toDefinitionKey(componentName));
    if (ok) {
      return {
        componentName,
        definitionKey: toDefinitionKey(componentName),
      };
    }
  }
  return null;
}

/**
 * Load enrich fingerprint stored on registry entry / component.json / section-plan.
 * @param {string} projectRoot
 * @param {string} componentFolder
 * @param {object|null} registryEntry
 */
export async function loadRegistryEnrichFingerprint(
  projectRoot,
  componentFolder,
  registryEntry = null,
) {
  if (registryEntry?.enrichStructureFingerprint || registryEntry?.enrichStructurePayload) {
    return {
      enrichStructureFingerprint: registryEntry.enrichStructureFingerprint || null,
      enrichStructurePayload: registryEntry.enrichStructurePayload || null,
    };
  }
  if (!projectRoot || !componentFolder) return null;
  const dir = registryComponentDir(projectRoot, componentFolder);
  for (const file of ['component.json', 'section-plan.json']) {
    try {
      const raw = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
      if (raw?.enrichStructureFingerprint || raw?.enrichStructurePayload) {
        return {
          enrichStructureFingerprint: raw.enrichStructureFingerprint || null,
          enrichStructurePayload: raw.enrichStructurePayload || null,
        };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * True when a registry folder / entry is site chrome (header|footer).
 * Used to prefer home as canonical chrome evidence.
 * @param {string|null|undefined} folder
 * @param {object|null|undefined} entry
 * @param {object|null|undefined} [info]
 */
export function isChromeRegistryFolder(folder, entry = null, info = null) {
  const f = String(folder || entry?.folderName || entry?.componentFolder || '')
    .trim()
    .toLowerCase();
  if (f === 'header' || f === 'footer') return true;
  const pageRole = String(
    entry?.enrichStructurePayload?.pageRole ||
      info?.enrichStructurePayload?.pageRole ||
      info?.pageRole ||
      '',
  )
    .trim()
    .toLowerCase();
  if (pageRole === 'partial-header' || pageRole === 'partial-footer') return true;
  const track = String(info?.track || info?.chromeCatalogue || '').trim().toLowerCase();
  return track === 'header' || track === 'footer' || track === 'partial-header' || track === 'partial-footer';
}

/**
 * @deprecated Force clears all name locks (including chrome). Always returns false.
 * Kept for callers/tests that still import the symbol.
 */
export function shouldPreserveChromeLocksUnderForce() {
  return false;
}

/**
 * Resolve prior conversion-like reuse from registrySection + disk packages.
 * Skip when enrich fingerprint matches AND (built this run OR, without --force,
 * package exists). --force recreates each registry key once (including chrome);
 * never re-AI's the same folder after sharedBuiltThisRun records it.
 */
export async function canSkipViaSharedSection({
  force,
  info,
  hostSlug,
  codePrefix = '',
  sharedBuiltThisRun,
  registryEntry = null,
  projectRoot = null,
}) {
  const shared = getRegistrySection(info);
  if (!shared?.componentFolder && !shared?.registryPath) {
    return { skip: false, reason: 'no registrySection' };
  }
  const folder = shared.componentFolder || String(shared.registryPath || '').split('/').pop();

  const storedFp =
    (await loadRegistryEnrichFingerprint(projectRoot, folder, registryEntry)) ||
    (shared.enrichStructureFingerprint || shared.enrichStructurePayload
      ? {
          enrichStructureFingerprint: shared.enrichStructureFingerprint || null,
          enrichStructurePayload: shared.enrichStructurePayload || null,
        }
      : null);
  const fpCheck = enrichStructureFingerprintsMatch(info, storedFp);
  if (!fpCheck.match) {
    return {
      skip: false,
      reason: `enrich structure changed vs registry — converting (${fpCheck.reason})`,
      enrichFingerprint: fpCheck.live,
    };
  }

  // Always reuse within the same --all run (including --force).
  if (sharedBuiltThisRun?.has(folder)) {
    const built = sharedBuiltThisRun.get(folder);
    return {
      skip: true,
      reason: `registrySection reused (built this run: ${folder})`,
      reuse: built,
    };
  }

  // --force: ignore disk package / prior-run cache; recreate this unique key once.
  if (force) {
    return { skip: false, reason: 'force' };
  }

  let defKey = shared.definitionKey || registryEntry?.definitionKey || null;
  let name = shared.componentName || registryEntry?.componentName || null;

  if (!name && !defKey) {
    const guessed = await findPackageByCmsName(
      hostSlug,
      codePrefix,
      registryEntry?.cmsName || info.cmsName,
      [...(registryEntry?.alsoKnownAs || []), ...(info.alternativeNames || [])],
    );
    if (guessed) {
      name = guessed.componentName;
      defKey = guessed.definitionKey;
    }
  }

  const pkg = await sharedPackageExists(hostSlug, name, defKey);
  if (pkg) {
    const componentName = typeof pkg === 'object' ? pkg.componentName : name;
    const definitionKey = typeof pkg === 'object' ? pkg.definitionKey : defKey;
    return {
      skip: true,
      reason: `registrySection package exists (${folder}; enrich fingerprint ok)`,
      reuse: {
        componentFolder: folder,
        componentName,
        definitionKey,
        status: 'reused',
        contentFamilyId: shared.contentFamilyId || registryEntry?.contentFamilyId || null,
      },
    };
  }

  return { skip: false, reason: 'registrySection not yet created' };
}

/**
 * Overwrite section-registry/<folder>/section-plan.json from live decompose + enrich.
 * Prevents a wrong first plan from freezing the catalog.
 */
export async function rewriteRegistrySectionPlanFromCreate({
  projectRoot,
  componentFolder,
  info,
  plan,
}) {
  if (!projectRoot || !componentFolder || !plan) return null;
  const dir = registryComponentDir(projectRoot, componentFolder);
  await mkdir(dir, { recursive: true });
  const { payload, fingerprint } = computeEnrichStructureFingerprint(info);
  const screenshots = {
    desktop: enrichScreenshotBase(info, 'desktop'),
    tablet: enrichScreenshotBase(info, 'tablet'),
    mobile: enrichScreenshotBase(info, 'mobile'),
  };
  const components = [
    {
      role: 'section',
      cmsName: plan.section?.componentName || info.cmsName,
      componentType: 'Section',
      description: plan.reason || info.purpose || '',
      placeholders: stackedFooterPlaceholderKeys(info, plan),
      fields: [],
      variants: ['Default'],
    },
    ...(plan.mode === 'composite'
      ? (plan.children || []).map((c) => ({
          role: 'child',
          cmsName: c.componentName,
          componentType: 'Component',
          description: c.enrichRepeat || '',
          placeholders: [],
          fields: [],
          repeatHint: c.repeatHint || null,
          variants: ['Default'],
          registrySubfolder: String(c.componentName || '')
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase(),
        }))
      : []),
  ];
  const sectionPlan = {
    version: 1,
    generatedAt: new Date().toISOString(),
    reviewStatus: 'from-create',
    sectionFolder: componentFolder,
    enrichStructureFingerprint: fingerprint,
    enrichStructurePayload: payload,
    review: {
      narrativeSummary: plan.reason || info.description || '',
      notes: [
        `layout.pattern=${payload.layoutPattern}`,
        `pageRole=${payload.pageRole}`,
        `repeats=${payload.repeatRoles.join(',') || '(none)'}`,
      ],
      contentGuidance: null,
      nextSteps: [],
    },
    responsiveLayout: null,
    detection: {
      cmsName: info.cmsName || null,
      folderName: info.folderName || null,
      selector: info.selector || null,
      heading: info.heading || null,
      source: 'create-sectioncomponents',
    },
    assets: {
      screenshots,
      sectionHtml: 'section.html',
      outputDir: componentFolder,
    },
    implementationPlan: {
      confidence: 'high',
      summary: plan.reason || `Build from enrich (${payload.layoutPattern})`,
      placeholderKey: plan.section?.placeholderKey || null,
      repeatCount: payload.repeatRoles.length,
      components,
    },
  };
  const planPath = path.join(dir, 'section-plan.json');
  await writeFile(planPath, `${JSON.stringify(sectionPlan, null, 2)}\n`, 'utf8');
  return { planPath, fingerprint, payload };
}

function enrichScreenshotBase(info, viewport) {
  const p = info?.outputs?.[viewport]?.path;
  if (!p) return null;
  return String(p).replace(/\\/g, '/').split('/').pop() || null;
}

/**
 * Placeholder keys for enrich section-plan.json — follow AI plan, not a hardcoded
 * four-band footer checklist.
 * @param {object|null|undefined} info
 * @param {object|null|undefined} plan
 * @returns {Array<{ key: string }>}
 */
export function stackedFooterPlaceholderKeys(info, plan) {
  const planKey = String(plan?.section?.placeholderKey || '').trim();
  if (planKey) return [{ key: planKey }];

  /** @type {string[]} */
  const fromChildren = [];
  const seen = new Set();
  for (const c of plan?.children || []) {
    const k = String(c?.placeholder || c?.placeholderKey || '').trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    fromChildren.push(k);
  }
  if (fromChildren.length) return fromChildren.map((key) => ({ key }));

  // No legacy header-navigation / four-band inject when plan is silent.
  return [];
}

/**
 * Persist definitionKey/componentName onto section-registry manifest + page backlinks.
 */
export async function markSharedSectionCreated({
  projectRoot,
  pageDir,
  sectionFolder,
  info,
  componentName,
  definitionKey,
  status = 'created',
  plan = null,
}) {
  const shared = getRegistrySection(info) || {};
  const componentFolder =
    shared.componentFolder || String(shared.registryPath || '').split('/').pop();
  if (!componentFolder) return null;

  const { payload, fingerprint } = computeEnrichStructureFingerprint(info);

  const registrySection = {
    ...shared,
    registryPath: registryPath(componentFolder),
    componentFolder,
    definitionKey: definitionKey || shared.definitionKey || null,
    componentName: componentName || shared.componentName || null,
    status,
    enrichStructureFingerprint: fingerprint,
    enrichStructurePayload: payload,
  };

  const pageSectionDir = path.join(pageDir, 'sections', sectionFolder);
  await writeSharedSectionBacklink({ pageSectionDir, registrySection });

  // Always rewrite registry plan from live create (created or force-reused) so stubs cannot freeze.
  if (plan && (status === 'created' || status === 'reused')) {
    try {
      await rewriteRegistrySectionPlanFromCreate({
        projectRoot,
        componentFolder,
        info,
        plan,
      });
    } catch (err) {
      console.warn(
        `  ⚠ Could not rewrite section-registry/${componentFolder}/section-plan.json: ${err?.message || err}`,
      );
    }
  }

  const registryRoot = path.join(projectRoot, SECTION_REGISTRY_DIR);
  const manifest = await loadGlobalManifest(registryRoot);
  const entry =
    Object.values(manifest.components || {}).find((e) => e.folderName === componentFolder) ||
    null;
  if (entry) {
    entry.definitionKey = registrySection.definitionKey;
    entry.componentName = registrySection.componentName;
    entry.status = status;
    entry.enrichStructureFingerprint = fingerprint;
    entry.enrichStructurePayload = payload;
    manifest.components[entry.cmsName] = entry;
    await saveGlobalManifest(registryRoot, manifest);

    try {
      const compJsonPath = path.join(
        registryComponentDir(projectRoot, componentFolder),
        'component.json',
      );
      let comp = {};
      try {
        comp = JSON.parse(await readFile(compJsonPath, 'utf8'));
      } catch {
        comp = {};
      }
      comp.definitionKey = registrySection.definitionKey;
      comp.componentName = registrySection.componentName;
      comp.status = status;
      comp.enrichStructureFingerprint = fingerprint;
      comp.enrichStructurePayload = payload;
      await writeFile(compJsonPath, `${JSON.stringify(comp, null, 2)}\n`, 'utf8');
    } catch {
      /* optional */
    }
  }

  info.registrySection = registrySection;
  info.sharedSection = registrySection;
  return registrySection;
}

/**
 * List unique section-registry component folder names (manifest first, else disk).
 * @param {string} projectRoot — host capture root
 * @param {{ manifest?: object|null }} [opts]
 * @returns {Promise<string[]>}
 */
export async function listRegistryComponentFolders(projectRoot, opts = {}) {
  if (!projectRoot) return [];
  const registryRoot = path.join(projectRoot, SECTION_REGISTRY_DIR);
  let manifest = opts.manifest || null;
  if (!manifest) {
    try {
      manifest = await loadGlobalManifest(registryRoot);
    } catch {
      manifest = null;
    }
  }
  const fromManifest = Object.values(manifest?.components || {})
    .map((e) => String(e?.folderName || '').trim())
    .filter(Boolean);
  if (fromManifest.length) {
    return [...new Set(fromManifest)].sort((a, b) => a.localeCompare(b));
  }
  try {
    const entries = await readdir(registryRoot, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .filter((name) => name !== 'content-families')
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * Pick richest / preferred instance from registry entry + instances.json.
 * Prefer canonicalRef / canonicalPageSlug, then --home slug, then highest extensionScore.
 * @param {object|null} entry
 * @param {object[]} instances
 * @returns {object|null}
 */
export function pickCanonicalInstance(entry, instances = []) {
  const list = Array.isArray(instances) ? instances.filter(Boolean) : [];
  const home = list.find((i) => /--home$/i.test(String(i.pageSlug || '')));
  // Site chrome: prefer home over tiny secondary-page extensionScore / stale canonicalPageSlug.
  if (isChromeRegistryFolder(entry?.folderName || entry?.componentFolder, entry) && home) {
    return home;
  }
  if (entry?.canonicalRef?.pageSlug || entry?.canonicalRef?.sourcePath) {
    const ref = entry.canonicalRef;
    const match =
      list.find(
        (i) =>
          (ref.sourcePath && i.sourcePath === ref.sourcePath) ||
          (ref.pageSlug &&
            i.pageSlug === ref.pageSlug &&
            (i.sectionFolder || i.sourceFolder) ===
              (ref.sectionFolder || ref.sourceFolder)),
      ) || null;
    if (match) return match;
    if (ref.pageSlug && (ref.sectionFolder || ref.sourceFolder || ref.sourcePath)) {
      return {
        pageSlug: ref.pageSlug,
        sectionFolder: ref.sectionFolder || ref.sourceFolder || null,
        sourcePath: ref.sourcePath || null,
        sourceFolder: ref.sourceFolder || ref.sectionFolder || null,
      };
    }
  }
  if (entry?.canonicalPageSlug) {
    const bySlug = list.find((i) => i.pageSlug === entry.canonicalPageSlug);
    if (bySlug) return bySlug;
  }
  if (!list.length) return null;
  if (home) return home;
  const scored = [...list].sort(
    (a, b) => Number(b.extensionScore || 0) - Number(a.extensionScore || 0),
  );
  return scored[0] || list[0];
}

/**
 * Resolve canonical page evidence for a registry component folder.
 * @param {string} projectRoot
 * @param {string} componentFolder
 * @param {object|null} [registryEntry]
 * @returns {Promise<{
 *   componentFolder: string,
 *   pageSlug: string,
 *   sectionFolder: string,
 *   pageDir: string,
 *   evidenceDir: string,
 *   entry: object|null,
 *   instance: object,
 * }|null>}
 */
export async function resolveCanonicalInstance(
  projectRoot,
  componentFolder,
  registryEntry = null,
) {
  const folder = String(componentFolder || '').trim();
  if (!projectRoot || !folder) return null;

  let entry = registryEntry;
  if (!entry) {
    try {
      const manifest = await loadGlobalManifest(
        path.join(projectRoot, SECTION_REGISTRY_DIR),
      );
      entry =
        Object.values(manifest?.components || {}).find(
          (e) => e.folderName === folder,
        ) || null;
    } catch {
      entry = null;
    }
  }

  const dir = registryComponentDir(projectRoot, folder);
  let instances = [];
  try {
    instances = await loadOrMigrateInstances(dir, projectRoot);
  } catch {
    instances = Array.isArray(entry?.instances) ? entry.instances : [];
  }
  if (!instances.length && Array.isArray(entry?.instances)) {
    instances = entry.instances;
  }

  const instance = pickCanonicalInstance(entry, instances);
  if (!instance?.pageSlug) return null;

  const sectionFolder = String(
    instance.sectionFolder || instance.sourceFolder || '',
  ).trim();
  if (!sectionFolder && !instance.sourcePath) return null;

  const evidenceDir =
    resolveRegistryInstanceDir(projectRoot, instance) ||
    (sectionFolder
      ? path.join(projectRoot, instance.pageSlug, 'sections', sectionFolder)
      : null);
  if (!evidenceDir) return null;

  const resolvedSection =
    sectionFolder ||
    path.basename(evidenceDir) ||
    null;
  if (!resolvedSection) return null;

  return {
    componentFolder: folder,
    pageSlug: instance.pageSlug,
    sectionFolder: resolvedSection,
    pageDir: path.join(projectRoot, instance.pageSlug),
    evidenceDir,
    entry,
    instance,
  };
}

/**
 * Registry folders referenced by a page's section-information.json backlinks.
 * @param {string} pageDir
 * @param {string[]} sectionFolders
 * @returns {Promise<string[]>}
 */
export async function listRegistryFoldersReferencedByPage(pageDir, sectionFolders) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const folder of sectionFolders || []) {
    try {
      const info = JSON.parse(
        await readFile(
          path.join(pageDir, 'sections', folder, 'section-information.json'),
          'utf8',
        ),
      );
      const reg = getRegistrySection(info);
      const cf = reg?.componentFolder || String(reg?.registryPath || '').split('/').pop();
      if (cf) out.add(cf);
    } catch {
      /* skip */
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/**
 * Absolute path to canonical page section dir for evidence.
 * Prefers canonicalRef / sourcePath; falls back to legacy instances/ path.
 */
export function canonicalInstanceDir(projectRoot, sharedSection) {
  const reg = sharedSection;
  if (!reg) return null;

  if (reg.sourcePath || (reg.canonicalPageSlug && reg.sectionFolder)) {
    return resolveRegistryInstanceDir(projectRoot, {
      sourcePath: reg.sourcePath,
      pageSlug: reg.canonicalPageSlug,
      sectionFolder: reg.sectionFolder,
    });
  }

  // Resolve via registry component.json canonicalRef when only folder is known
  if (reg.componentFolder && reg.canonicalPageSlug) {
    const viaLegacy = path.join(
      projectRoot,
      SECTION_REGISTRY_DIR,
      reg.componentFolder,
      'instances',
      reg.canonicalPageSlug,
    );
    return viaLegacy;
  }

  return null;
}

/**
 * Resolve evidence section dir: prefer page sourcePath from registry backlink.
 * @param {string} projectRoot
 * @param {string} pageDir
 * @param {string} sectionFolder
 * @param {object} info
 * @param {object|null} registryEntry
 */
export function resolveEvidenceSectionDir(
  projectRoot,
  pageDir,
  sectionFolder,
  info,
  registryEntry = null,
) {
  const reg = getRegistrySection(info);
  if (registryEntry) {
    const canon = resolveCanonicalInstanceDir(projectRoot, registryEntry);
    if (canon) return canon;
  }
  if (reg?.sourcePath) {
    const resolved = resolveRegistryInstanceDir(projectRoot, reg);
    if (resolved) return resolved;
  }
  // Default: this page's section slot
  return path.join(pageDir, 'sections', sectionFolder);
}
