/**
 * Honor contentFamilyId when emitting definitions:
 * - Owner gets value-merged fields + shared content.items (once per run).
 * - Non-owners get a thin definition pointing at the owner's item template.
 */
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot, defaultCapturesDir } from '../capture/paths.mjs';
import {
  contentFamilyOwnerScore,
  findFamilyOwnerEntry,
} from '../capture/lib/content-families.mjs';
import { getRegistrySection } from '../capture/lib/section-registry-paths.mjs';
import { toKebabCase, toPascalCase } from './naming.mjs';
import { componentDir } from './write-component.mjs';
import {
  alignTsxToFieldTypes,
  applyMergeToOwnerDefinition,
  collectFieldSeedsFromInfo,
  mergeFamilyOwnerDefinition,
  syncSuggestedFieldsInInfo,
} from './content-family-merge.mjs';
import { ensureNewline } from './source-text.mjs';
import { ensureFieldDefaultsFromContentItems } from './field-defaults-from-content.mjs';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** definitionKey → camelCase export prefix (dom-security-article-header → domSecurityArticleHeader) */
function definitionExportPrefix(definitionKey) {
  return String(definitionKey || 'component')
    .split(/[-_]/)
    .filter(Boolean)
    .map((p, i) =>
      i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(),
    )
    .join('');
}

/**
 * Extract datasourceTemplate string from a definition.ts source.
 * @param {string} source
 * @returns {string | null}
 */
export function extractDatasourceTemplatePath(source) {
  const text = String(source || '');
  const m = text.match(/datasourceTemplate\s*:\s*["'`]([^"'`]+)["'`]/);
  return m ? m[1].trim() : null;
}

/**
 * Build Sitecore item-template path from a full (owner) definition source.
 * Prefer the owner's own itemTemplate when the model is full; only fall back to
 * an existing datasourceTemplate when the package is already thin.
 * @param {string} source
 * @param {object} ownerEntry
 */
function inferTemplatePathFromDefinition(source, ownerEntry) {
  const text = String(source || '');
  const emptySections = /sections\s*:\s*\[\s*\]/.test(text);
  const existingDs = extractDatasourceTemplatePath(text);

  // Already-thin package: reuse its datasourceTemplate
  if (emptySections && existingDs) return existingDs;

  const itemName = text.match(/itemTemplate\s*:\s*\{[\s\S]*?name\s*:\s*["'`]([^"'`]+)["'`]/);
  const coll = text.match(/collectionSystem\s*:\s*["'`]([^"'`]+)["'`]/);
  const comp = text.match(/componentName\s*:\s*["'`]([^"'`]+)["'`]/);
  if (itemName && coll && comp && !emptySections) {
    return `/sitecore/templates/Project/${coll[1]}/${comp[1]}/${itemName[1]}`;
  }

  // Full package that still sets datasourceTemplate to itself / another path
  if (existingDs && !emptySections) {
    if (itemName && coll && comp) {
      return `/sitecore/templates/Project/${coll[1]}/${comp[1]}/${itemName[1]}`;
    }
    return existingDs;
  }

  if (existingDs) return existingDs;

  const collGuess = String(coll?.[1] || 'domsecurity');
  const compGuess =
    ownerEntry.componentName ||
    (comp ? comp[1] : null) ||
    `DomSecurity${toPascalCase(ownerEntry.cmsName || ownerEntry.folderName || 'Component')}`;
  const itemGuess =
    (itemName && itemName[1]) ||
    String(ownerEntry.cmsName || ownerEntry.folderName || 'Item')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'Item';
  return `/sitecore/templates/Project/${collGuess}/${compGuess}/${itemGuess}`;
}

/**
 * Candidate FE package dirs for an owner registry entry.
 * @param {string} hostSlug
 * @param {object} ownerEntry
 */
function ownerPackageCandidates(hostSlug, ownerEntry) {
  const names = [
    ownerEntry.componentName,
    ownerEntry.cmsName,
    ownerEntry.folderName
      ? toPascalCase(String(ownerEntry.folderName).replace(/-/g, ' '))
      : null,
  ].filter(Boolean);

  /** @type {string[]} */
  const dirs = [];
  for (const name of names) {
    const pascal = name.startsWith('DomSecurity')
      ? name
      : `DomSecurity${toPascalCase(name)}`;
    const kebab = toKebabCase(pascal);
    dirs.push(path.join(componentDir(hostSlug, pascal), `${kebab}.definition.ts`));
    const plain = toPascalCase(name);
    if (plain !== pascal) {
      dirs.push(path.join(componentDir(hostSlug, plain), `${toKebabCase(plain)}.definition.ts`));
    }
  }

  // Known Dom Security editorial body / article packages (richest news item)
  if (/article.?body|editorial|news-article-body/i.test(`${ownerEntry.folderName} ${ownerEntry.cmsName}`)) {
    dirs.unshift(
      path.join(
        bqRoot,
        'src/components',
        hostSlug,
        'DomSecurityEditorialArticleBody',
        'dom-security-editorial-article-body.definition.ts',
      ),
    );
  }
  if (/news.?teaser|teaser/i.test(`${ownerEntry.folderName} ${ownerEntry.cmsName}`)) {
    dirs.push(
      path.join(
        bqRoot,
        'src/components',
        hostSlug,
        'DomSecurityNewsTeaser',
        'dom-security-news-teaser.definition.ts',
      ),
    );
  }
  if (/article.?header|news-article-header/i.test(`${ownerEntry.folderName} ${ownerEntry.cmsName}`)) {
    dirs.push(
      path.join(
        bqRoot,
        'src/components',
        hostSlug,
        'DomSecurityArticleHeader',
        'dom-security-article-header.definition.ts',
      ),
    );
  }
  return dirs;
}

/**
 * Resolve first existing owner package paths.
 * @param {string} hostSlug
 * @param {object|null} ownerEntry
 */
export async function resolveOwnerPackagePaths(hostSlug, ownerEntry) {
  if (!ownerEntry) return null;
  for (const defPath of ownerPackageCandidates(hostSlug, ownerEntry)) {
    if (!(await exists(defPath))) continue;
    const dir = path.dirname(defPath);
    const base = path.basename(defPath, '.definition.ts');
    const tsxPath = path.join(dir, `${base}.tsx`);
    return {
      definitionPath: defPath,
      tsxPath: (await exists(tsxPath)) ? tsxPath : null,
      componentName: path.basename(dir),
      kebab: base,
    };
  }
  return null;
}

/**
 * Read owner's datasource / item template path from disk package.
 * @param {string} hostSlug
 * @param {object|null} ownerEntry
 */
export async function resolveOwnerDatasourceTemplate(hostSlug, ownerEntry) {
  if (!ownerEntry) return null;

  const pkg = await resolveOwnerPackagePaths(hostSlug, ownerEntry);
  if (pkg) {
    try {
      const src = await readFile(pkg.definitionPath, 'utf8');
      // Prefer constructed path when full (non-thin)
      return inferTemplatePathFromDefinition(src, ownerEntry);
    } catch {
      /* fall through */
    }
  }

  return inferTemplatePathFromDefinition('', ownerEntry);
}

/**
 * Datasource content folder for thin members — follow owner's data folder.
 * @param {object} ownerEntry
 * @param {string} [contentFamilyId]
 */
function datasourceFolderForOwner(ownerEntry, contentFamilyId) {
  const folder = String(ownerEntry?.folderName || '');
  const cms = String(ownerEntry?.cmsName || '');
  if (/article.?body|editorial|body/i.test(folder) || /article.?body|editorial/i.test(cms)) {
    return 'News Articles';
  }
  if (contentFamilyId === 'news-article') return 'News Articles';
  if (/teaser/i.test(folder) || /teaser/i.test(cms)) return 'News Teasers';
  if (/grid|overview/i.test(folder)) return 'News Grid';
  return ownerEntry?.folderName || 'Data';
}

/**
 * Build a thin definition.ts that reuses the owner item template.
 */
export function buildThinDefinitionSource(opts) {
  const displayName =
    opts.displayName ||
    String(opts.componentName || '')
      .replace(/^DomSecurity/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim() ||
    'Component';
  const folderTemplateName = `${displayName} Folder`;
  const dsFolder = opts.datasourceFolder || opts.folderName || 'Data';
  const exportName = `${definitionExportPrefix(opts.definitionKey)}Definition`;

  return `import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

/** Thin rendering — fields from shared family owner item template. */
export const ${exportName} = {
  kind: "component",
  definitionKey: ${JSON.stringify(opts.definitionKey)},
  name: ${JSON.stringify(opts.definitionKey)},
  displayName: ${JSON.stringify(displayName)},
  componentName: ${JSON.stringify(opts.componentName)},
  icon: "Office/32x32/document.png",
  collectionSystem: ${JSON.stringify(opts.collectionSystem)},
  siteSystem: ${JSON.stringify(opts.siteSystem)},
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: [${JSON.stringify(dsFolder)}],
  },
  datasourceTemplate: ${JSON.stringify(opts.datasourceTemplate)},
  model: {
    folderTemplate: { name: ${JSON.stringify(folderTemplateName)} },
    itemTemplate: {
      name: ${JSON.stringify(displayName)},
      sections: [],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
} satisfies ComponentTemplateDefinition;
`;
}

/**
 * Family members from manifest for a given family id (exclude polluted chrome).
 * @param {object} globalManifest
 * @param {string} familyId
 */
export function listFamilyMembers(globalManifest, familyId) {
  const all = Object.values(globalManifest?.components || {}).filter(
    (e) => e.contentFamilyId === familyId,
  );
  if (!all.length) return [];

  // Resolve owner first so we can drop polluted chrome (wrong owner folder)
  const owner = findFamilyOwnerEntry(globalManifest, familyId);
  const ownerFolder = owner?.folderName || all[0]?.contentFamilyOwnerFolder;
  return all
    .filter((e) => {
      if (!ownerFolder) return true;
      return (
        e.contentFamilyOwnerFolder === ownerFolder || e.folderName === ownerFolder
      );
    })
    .sort((a, b) => String(a.folderName).localeCompare(String(b.folderName)));
}

/**
 * Load field seeds from all family member instances under a host capture root.
 * @param {object} opts
 * @param {string} opts.projectRoot — `.bq/captures/{host}`
 * @param {object} opts.globalManifest
 * @param {string} opts.familyId
 * @param {string} opts.ownerFolder
 */
export async function loadFamilyMemberSeeds({
  projectRoot,
  globalManifest,
  familyId,
  ownerFolder,
}) {
  const members = listFamilyMembers(globalManifest, familyId).filter(
    (m) => m.contentFamilyOwnerFolder === ownerFolder || m.folderName === ownerFolder,
  );
  // If filter emptied due to pollution, fall back to ownerFolder match on owner field
  const effective =
    members.length > 0
      ? members
      : Object.values(globalManifest?.components || {}).filter(
          (e) =>
            e.contentFamilyId === familyId &&
            (e.contentFamilyOwnerFolder === ownerFolder || e.folderName === ownerFolder),
        );

  /** @type {object[]} */
  const seeds = [];
  /** @type {Array<{ memberFolder: string, sourcePath: string, infoPath: string }>} */
  const infoRefs = [];

  for (const entry of effective.sort((a, b) =>
    String(a.folderName).localeCompare(String(b.folderName)),
  )) {
    const instances = [...(entry.instances || [])].sort((a, b) =>
      String(a.sourcePath || '').localeCompare(String(b.sourcePath || '')),
    );
    // Prefer canonical + instances
    const refs = instances.length
      ? instances
      : entry.canonicalRef
        ? [entry.canonicalRef]
        : [];
    for (const inst of refs) {
      const sourcePath = inst.sourcePath || '';
      if (!sourcePath) continue;
      const infoPath = path.join(projectRoot, sourcePath, 'section-information.json');
      if (!(await exists(infoPath))) continue;
      try {
        const info = JSON.parse(await readFile(infoPath, 'utf8'));
        infoRefs.push({
          memberFolder: entry.folderName,
          sourcePath,
          infoPath,
        });
        const pageSlug = inst.pageSlug || sourcePath.split('/')[0] || '';
        seeds.push(
          ...collectFieldSeedsFromInfo({
            memberFolder: entry.folderName,
            info,
            pageSlug,
            sourcePath,
          }),
        );
      } catch {
        /* skip bad info */
      }
    }
  }

  return { seeds, infoRefs, members: effective };
}

/**
 * Parse top-level content.items from definition source via Function.
 * @param {string} definitionTs
 * @returns {object[]}
 */
export function parseContentItemsFromDefinition(definitionTs) {
  const text = String(definitionTs || '');
  const m = text.match(/\bcontent\s*:\s*\{/);
  if (!m || m.index == null) return [];
  const open = text.indexOf('{', m.index);
  if (open < 0) return [];
  let depth = 0;
  let end = -1;
  let inStr = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return [];
  const literal = text.slice(open, end + 1);
  try {
    const obj = Function(`"use strict"; return (${literal});`)();
    return Array.isArray(obj?.items) ? obj.items : [];
  } catch {
    return [];
  }
}

/**
 * Ensure the family owner package has merged fields + content.items (once per run).
 * Also syncs page suggestedFields and aligns owner TSX types.
 *
 * @param {object} opts
 * @param {Map<string, object>} [opts.familyOwnerEmitted] — per-run cache
 * @returns {Promise<object>}
 */
export async function ensureFamilyOwnerPackage({
  familyId,
  globalManifest,
  hostSlug,
  projectRoot,
  familyOwnerEmitted,
  definitionTs: incomingOwnerDefinitionTs = null,
  dryRun = false,
  forceMerge = true,
}) {
  if (!familyId || !globalManifest) {
    return { ok: false, reason: 'missing family/manifest' };
  }
  if (familyOwnerEmitted?.has(familyId)) {
    return { ok: true, reused: true, ...familyOwnerEmitted.get(familyId) };
  }

  const owner = findFamilyOwnerEntry(globalManifest, familyId);
  if (!owner) return { ok: false, reason: 'no family owner' };

  const ownerFolder = owner.folderName;
  const { seeds, infoRefs } = await loadFamilyMemberSeeds({
    projectRoot,
    globalManifest,
    familyId,
    ownerFolder,
  });

  let pkg = await resolveOwnerPackagePaths(hostSlug, owner);
  let definitionTs = incomingOwnerDefinitionTs;
  if (!definitionTs && pkg) {
    definitionTs = await readFile(pkg.definitionPath, 'utf8');
  }
  if (!definitionTs) {
    // Synthesize a minimal owner shell when package missing (e.g. --only non-owner first)
    const componentName =
      owner.componentName ||
      `DomSecurity${toPascalCase(owner.cmsName || owner.folderName || 'ArticleBody')}`;
    const definitionKey = owner.definitionKey || toKebabCase(componentName);
    const displayName = String(owner.cmsName || 'Editorial Article Body')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    const dsFolder = datasourceFolderForOwner(owner, familyId);
    definitionTs = `import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const ${definitionExportPrefix(definitionKey)}Definition = {
  kind: "component",
  definitionKey: ${JSON.stringify(definitionKey)},
  name: ${JSON.stringify(definitionKey)},
  displayName: ${JSON.stringify(displayName)},
  componentName: ${JSON.stringify(componentName)},
  icon: "Office/32x32/document_empty_landscape.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: [${JSON.stringify(dsFolder)}],
  },
  model: {
    folderTemplate: { name: ${JSON.stringify(`${displayName} Folder`)} },
    itemTemplate: {
      name: ${JSON.stringify(displayName)},
      sections: [],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: [${JSON.stringify(dsFolder)}] },
    items: [],
  },
} satisfies ComponentTemplateDefinition;
`;
    pkg = {
      definitionPath: path.join(
        componentDir(hostSlug, componentName),
        `${toKebabCase(componentName)}.definition.ts`,
      ),
      tsxPath: path.join(
        componentDir(hostSlug, componentName),
        `${toKebabCase(componentName)}.tsx`,
      ),
      componentName,
      kebab: toKebabCase(componentName),
    };
  }

  const existingItems = parseContentItemsFromDefinition(definitionTs);
  const merged = mergeFamilyOwnerDefinition({
    seeds,
    ownerFolder,
    existingItems,
  });

  const dsFolder = datasourceFolderForOwner(owner, familyId);
  const itemTemplateName = (() => {
    const m = definitionTs.match(/itemTemplate\s*:\s*\{\s*name\s*:\s*["']([^"']+)["']/);
    return m?.[1] || 'Editorial Article Body';
  })();

  let nextDefinition = applyMergeToOwnerDefinition({
    definitionTs,
    fields: merged.fields,
    items: merged.items,
    itemTemplateName,
    datasourceFolder: dsFolder,
  });
  nextDefinition = ensureFieldDefaultsFromContentItems(nextDefinition);

  // Idempotent: never bump mtime when bytes are equal (even with forceMerge).
  let unchanged = true;
  if (!dryRun && pkg?.definitionPath) {
    const { writeFileIfChanged } = await import('../shared/write-file-if-changed.mjs');
    const defWrite = await writeFileIfChanged(
      pkg.definitionPath,
      ensureNewline(nextDefinition),
    );
    unchanged = defWrite.reason === 'unchanged';
  }
  void forceMerge;

  // Align owner TSX to final types
  if (pkg?.tsxPath && (await exists(pkg.tsxPath))) {
    const tsx = await readFile(pkg.tsxPath, 'utf8');
    const aligned = alignTsxToFieldTypes(tsx, merged.fields);
    if (aligned !== tsx && !dryRun) {
      const { writeFileIfChanged } = await import('../shared/write-file-if-changed.mjs');
      const tsxWrite = await writeFileIfChanged(pkg.tsxPath, ensureNewline(aligned));
      if (tsxWrite.wrote) unchanged = false;
    }
  }

  // Sync page originals + registry component.json field hints
  const syncResult = await syncFamilyFieldMappings({
    infoRefs,
    renameMap: merged.renameMap,
    projectRoot,
    globalManifest,
    familyId,
    dryRun,
  });
  if (syncResult.pagesSynced > 0) unchanged = false;

  const datasourceTemplate = inferTemplatePathFromDefinition(nextDefinition, {
    ...owner,
    componentName: pkg?.componentName || owner.componentName,
  });

  const result = {
    ok: true,
    familyId,
    ownerFolder,
    componentName: pkg?.componentName || owner.componentName,
    definitionPath: pkg?.definitionPath || null,
    datasourceTemplate,
    fields: merged.fields,
    itemCount: merged.items.length,
    renameMapSize: merged.renameMap.size,
    pagesSynced: syncResult.pagesSynced,
    unchanged,
  };
  familyOwnerEmitted?.set(familyId, result);
  return result;
}

/**
 * Sync canonical field name/type back to page section-information + registry.
 */
export async function syncFamilyFieldMappings({
  infoRefs,
  renameMap,
  projectRoot,
  globalManifest,
  familyId,
  dryRun = false,
}) {
  let pagesSynced = 0;
  if (!renameMap?.size) return { pagesSynced };

  for (const ref of infoRefs || []) {
    try {
      const raw = await readFile(ref.infoPath, 'utf8');
      const info = JSON.parse(raw);
      const { info: next, changed } = syncSuggestedFieldsInInfo(
        info,
        ref.memberFolder,
        renameMap,
      );
      if (changed && !dryRun) {
        await writeFile(ref.infoPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
        pagesSynced += 1;
      }
    } catch {
      /* skip */
    }
  }

  // Registry component.json — attach fieldHints when useful
  for (const entry of listFamilyMembers(globalManifest, familyId)) {
    const compPath = path.join(projectRoot, 'section-registry', entry.folderName, 'component.json');
    if (!(await exists(compPath))) continue;
    try {
      const comp = JSON.parse(await readFile(compPath, 'utf8'));
      const hints = [];
      for (const [k, v] of renameMap.entries()) {
        if (!k.startsWith(`${entry.folderName}::`)) continue;
        hints.push({
          from: k.slice(entry.folderName.length + 2),
          name: v.name,
          type: v.type,
        });
      }
      hints.sort((a, b) => a.name.localeCompare(b.name) || a.from.localeCompare(b.from));
      const prev = JSON.stringify(comp.familyFieldHints || []);
      const next = JSON.stringify(hints);
      if (prev !== next) {
        comp.familyFieldHints = hints;
        if (!dryRun) {
          await writeFile(compPath, `${JSON.stringify(comp, null, 2)}\n`, 'utf8');
        }
      }
    } catch {
      /* skip */
    }
  }

  return { pagesSynced };
}

/**
 * Align a member package TSX to owner field types (shared template bindings).
 */
export async function alignMemberPackageToOwnerFields({
  hostSlug,
  componentName,
  fields,
  dryRun = false,
}) {
  if (!componentName || !fields?.length) return { aligned: false };
  const kebab = toKebabCase(componentName);
  const tsxPath = path.join(componentDir(hostSlug, componentName), `${kebab}.tsx`);
  if (!(await exists(tsxPath))) return { aligned: false };
  const tsx = await readFile(tsxPath, 'utf8');
  const aligned = alignTsxToFieldTypes(tsx, fields);
  if (aligned === tsx) return { aligned: false, tsxPath };
  if (!dryRun) {
    const { writeFileIfChanged } = await import('../shared/write-file-if-changed.mjs');
    await writeFileIfChanged(tsxPath, ensureNewline(aligned));
  }
  return { aligned: true, tsxPath };
}

/**
 * If this section belongs to a content family and is not the owner,
 * return thin definition source pointing at the owner's item template.
 * Strips content.items from thin members (seeds live on owner only).
 */
export async function maybeThinFamilyDefinition({
  info,
  registryEntry,
  globalManifest,
  hostSlug,
  componentName,
  definitionKey,
  collectionSystem,
  siteSystem,
  definitionTs,
}) {
  const familyId =
    registryEntry?.contentFamilyId || getRegistrySection(info)?.contentFamilyId || null;
  if (!familyId || !globalManifest) {
    return { thin: false, reason: 'no contentFamilyId' };
  }

  const owner = findFamilyOwnerEntry(globalManifest, familyId);
  if (!owner) return { thin: false, reason: 'no family owner' };

  const isOwner =
    registryEntry?.folderName &&
    owner.folderName &&
    registryEntry.folderName === owner.folderName;
  if (isOwner) return { thin: false, reason: 'is family owner (richest member)' };

  const datasourceTemplate = await resolveOwnerDatasourceTemplate(hostSlug, {
    ...owner,
    contentFamilyId: familyId,
  });
  if (!datasourceTemplate) {
    return { thin: false, reason: 'owner datasourceTemplate unresolved' };
  }

  const existingDs = extractDatasourceTemplatePath(definitionTs || '');
  if (
    existingDs === datasourceTemplate &&
    /sections\s*:\s*\[\s*\]/.test(String(definitionTs || ''))
  ) {
    return {
      thin: true,
      definitionTs,
      datasourceTemplate,
      reason: 'already thin',
    };
  }

  const datasourceFolder = datasourceFolderForOwner(owner, familyId);

  return {
    thin: true,
    definitionTs: buildThinDefinitionSource({
      definitionKey,
      componentName,
      collectionSystem,
      siteSystem,
      datasourceTemplate,
      contentFamilyId: familyId,
      datasourceFolder,
      folderName: datasourceFolder,
    }),
    datasourceTemplate,
    reason: `contentFamily ${familyId} non-owner → ${datasourceTemplate}`,
  };
}

/**
 * Apply owner merge onto an owner definition that was just codegen'd.
 * @returns {Promise<{ definitionTs: string, merge: object|null }>}
 */
export async function applyOwnerFamilyMergeToDefinition({
  definitionTs,
  registryEntry,
  globalManifest,
  hostSlug,
  projectRoot,
  familyOwnerEmitted,
  dryRun = false,
}) {
  const familyId =
    registryEntry?.contentFamilyId || null;
  if (!familyId || !globalManifest || !registryEntry) {
    return { definitionTs, merge: null };
  }
  const owner = findFamilyOwnerEntry(globalManifest, familyId);
  if (!owner || owner.folderName !== registryEntry.folderName) {
    return { definitionTs, merge: null };
  }

  const ensured = await ensureFamilyOwnerPackage({
    familyId,
    globalManifest,
    hostSlug,
    projectRoot,
    familyOwnerEmitted,
    definitionTs,
    dryRun,
    forceMerge: true,
  });

  if (!ensured.ok || !ensured.definitionPath) {
    // Merge in-memory even if package path missing
    const { seeds } = await loadFamilyMemberSeeds({
      projectRoot,
      globalManifest,
      familyId,
      ownerFolder: owner.folderName,
    });
    const merged = mergeFamilyOwnerDefinition({
      seeds,
      ownerFolder: owner.folderName,
      existingItems: parseContentItemsFromDefinition(definitionTs),
    });
    const next = applyMergeToOwnerDefinition({
      definitionTs,
      fields: merged.fields,
      items: merged.items,
      datasourceFolder: datasourceFolderForOwner(owner, familyId),
    });
    return { definitionTs: next, merge: merged };
  }

  const disk = await readFile(ensured.definitionPath, 'utf8');
  return {
    definitionTs: disk,
    merge: {
      fields: ensured.fields,
      itemCount: ensured.itemCount,
    },
  };
}

export { contentFamilyOwnerScore, findFamilyOwnerEntry, defaultCapturesDir };
