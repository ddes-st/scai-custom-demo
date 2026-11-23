/**
 * Promote page-local section crops into the host section-registry/ catalog.
 * Page folders are positional (section-01, …); registry keys use contentHash /
 * structure fingerprint / soft description+HTML match (cmsName is assist only).
 * One component folder per unique layout; instances.json refs page sections
 * (no full copies under instances/).
 */
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { writeAiUsageMeta } from '../../shared/ai-usage-meta.mjs';
import {
  extensionScore,
  similarityBand,
  skeletonSimilarity,
  structureFromSectionDir,
  SIM_SURE_SAME,
} from './structure-fingerprint.mjs';
import { judgeSectionSimilarity } from './design-system/ai/merge-section-similarity.mjs';
import { writeComponentMetadataFiles } from './instance-diff.mjs';
import {
  folderNameFromCmsName,
  pageSectionSourcePath,
  registryPath,
  resolveRegistryInstanceDir,
} from './section-registry-paths.mjs';
import { descriptionSimilarity } from './shared-section-naming.mjs';
import {
  buildEnrichStructurePayload,
  computeEnrichStructureFingerprint,
  layoutRolesCompatible,
} from '../../create-section-components/enrich-structure-fingerprint.mjs';
import { sectionContentHash } from './export-detected-sections.mjs';

export { folderNameFromCmsName };

/**
 * Load section-information.json beside a page slot (layout/repeats for merge gates).
 * @param {string} sectionDir
 * @returns {Promise<object|null>}
 */
async function readSectionInformation(sectionDir) {
  try {
    const raw = String(
      await readFile(path.join(sectionDir, 'section-information.json'), 'utf8'),
    ).replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Refuse merging dissimilar enrich layouts into one registry folder (e.g. CTA
 * "footer" vs stacked-footer partial). Exact contentHash matches still allowed.
 * Loads canonical section-information when the registry entry lacks enrich payload
 * so soft/skeleton merges cannot ignore pattern mismatches.
 * @param {object|null} incomingInfo
 * @param {object|null} existingEntry
 * @param {string} [projectRoot]
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function enrichLayoutsCompatibleForMerge(
  incomingInfo,
  existingEntry,
  projectRoot = '',
) {
  if (!incomingInfo || !existingEntry) return { ok: true };
  let existingPayload = existingEntry.enrichStructurePayload || null;
  const pat = String(existingPayload?.layoutPattern || '').toLowerCase();
  if (!existingPayload || !pat || pat === '(none)') {
    if (existingEntry.layout || existingEntry.purpose) {
      existingPayload = buildEnrichStructurePayload(existingEntry);
    }
  }
  const pat2 = String(existingPayload?.layoutPattern || '').toLowerCase();
  if ((!existingPayload || !pat2 || pat2 === '(none)') && projectRoot) {
    const canonDir = resolveCanonicalInstanceDir(projectRoot, existingEntry);
    if (canonDir) {
      const canonInfo = await readSectionInformation(canonDir);
      if (canonInfo) existingPayload = buildEnrichStructurePayload(canonInfo);
    }
  }
  if (!existingPayload) {
    return {
      ok: false,
      reason: 'existing registry entry missing enrich layout pattern',
    };
  }
  return layoutRolesCompatible(incomingInfo, existingPayload);
}

const ROOT_KEEP = new Set([
  'component.json',
  'section-plan.json',
  'instances.json',
  'instances', // cleaned after migration
  'ai-debug', // wiped on create; may nest child package dirs beside it
]);

const PAGE_SECTION_SLOT_RE = /^section-\d+$/;

/** Soft-match thresholds (description + skeleton both required). */
const DESC_SOFT_MIN = 0.55;
const SKELETON_SOFT_MIN = 0.75;

/** @deprecated kept for callers; variants no longer created by content fingerprint */
export function disambiguateCmsName(baseCmsName, { heading, pageSlug }) {
  const short = (pageSlug || 'page').split('--').pop() ?? 'page';
  const shortPascal = short
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  const prefix = heading?.trim()?.slice(0, 20) || shortPascal;
  return `${prefix}${baseCmsName}`.replace(/\s+/g, '');
}

/** @deprecated content-sensitive; use structureFromSectionDir */
export async function fingerprintSectionDir(sectionDir, folderName) {
  const { structureFingerprint } = await structureFromSectionDir(sectionDir);
  return structureFingerprint || folderName;
}

function findDomainEntryByContentHash(globalManifest, contentHash) {
  if (!contentHash) return null;
  for (const entry of Object.values(globalManifest.components ?? {})) {
    if (entry.contentHash === contentHash) return entry;
    if ((entry.contentHashes || []).includes(contentHash)) return entry;
    for (const inst of entry.instances || []) {
      if (inst.contentHash === contentHash) return entry;
    }
  }
  return null;
}

function findDomainEntryByFingerprint(globalManifest, structureFingerprint) {
  if (!structureFingerprint) return null;
  for (const entry of Object.values(globalManifest.components ?? {})) {
    if (entry.structureFingerprint === structureFingerprint) return entry;
  }
  return null;
}

/**
 * cmsName is assist-only: only accept when structure fingerprint also matches
 * or skeleton is already in the "same" band.
 */
function findDomainEntryByCmsNameAssist(globalManifest, cmsName, structureFingerprint, tokens) {
  if (!cmsName) return null;
  let byName = null;
  const direct = globalManifest.components?.[cmsName];
  if (direct) byName = direct;
  else {
    for (const entry of Object.values(globalManifest.components ?? {})) {
      if (entry.cmsName === cmsName || (entry.alsoKnownAs || []).includes(cmsName)) {
        byName = entry;
        break;
      }
    }
  }
  if (!byName) return null;
  if (
    structureFingerprint &&
    byName.structureFingerprint &&
    byName.structureFingerprint === structureFingerprint
  ) {
    return byName;
  }
  const sim = skeletonSimilarity(tokens, byName.skeletonTokens || []);
  if (similarityBand(sim) === 'same') return byName;
  return null;
}

function findBestSimilarityCandidate(globalManifest, tokens) {
  let best = null;
  let bestSim = 0;
  for (const entry of Object.values(globalManifest.components ?? {})) {
    const sim = skeletonSimilarity(tokens, entry.skeletonTokens || []);
    if (sim > bestSim) {
      bestSim = sim;
      best = entry;
    }
  }
  return best ? { entry: best, similarity: bestSim } : null;
}

function findSoftDescHtmlMatch(globalManifest, sectionMeta, tokens) {
  const desc = `${sectionMeta.purpose || ''} ${sectionMeta.description || ''}`;
  let best = null;
  let bestScore = 0;
  for (const entry of Object.values(globalManifest.components ?? {})) {
    const entryDesc = `${entry.purpose || ''} ${entry.description || ''}`;
    const dSim = descriptionSimilarity(desc, entryDesc);
    const sSim = skeletonSimilarity(tokens, entry.skeletonTokens || []);
    if (dSim >= DESC_SOFT_MIN && sSim >= SKELETON_SOFT_MIN) {
      const score = dSim * 0.45 + sSim * 0.55;
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
  }
  return best ? { entry: best, score: bestScore } : null;
}

/** Resolve device PNG paths under a page section directory. */
async function resolveInstanceOutputs(instanceDir, folderName, domainFolder) {
  const outputs = {};
  for (const device of ['desktop', 'tablet', 'mobile']) {
    const candidates = [
      path.join(instanceDir, `${domainFolder}-${device}.png`),
      path.join(instanceDir, `${folderName}-${device}.png`),
      path.join(instanceDir, `section-${device}.png`),
    ];
    let found = null;
    for (const c of candidates) {
      try {
        await access(c);
        found = c;
        break;
      } catch {
        /* try next */
      }
    }
    outputs[device] = found;
  }
  return outputs;
}

function relOutputs(sectionsRoot, outputs) {
  return Object.fromEntries(
    Object.entries(outputs).map(([device, p]) => [
      device,
      p ? path.relative(sectionsRoot, p).replace(/\\/g, '/') : null,
    ]),
  );
}

/** Remove capture leftovers from component root (keep generated metadata). */
export async function cleanComponentRootArtifacts(domainSectionDir) {
  let names = [];
  try {
    names = await readdir(domainSectionDir);
  } catch {
    return;
  }
  for (const name of names) {
    if (ROOT_KEEP.has(name)) continue;
    try {
      await unlink(path.join(domainSectionDir, name));
    } catch {
      /* dirs or locked — ignore */
    }
  }
}

function upsertInstanceList(existingInstances, instance) {
  const list = Array.isArray(existingInstances) ? [...existingInstances] : [];
  const idx = list.findIndex((i) => i.pageSlug === instance.pageSlug);
  if (idx >= 0) list[idx] = instance;
  else list.push(instance);
  return list;
}

/**
 * Persist instances.json (refs + optional diff summary) under a registry component folder.
 * Prefer writeComponentMetadataFiles when a full diff is available.
 * @param {string} domainSectionDir
 * @param {object[]} instances
 * @param {{ identical?: boolean, differences?: object[], canonicalPageSlug?: string|null }} [extra]
 */
export async function writeInstancesJson(domainSectionDir, instances, extra = {}) {
  await mkdir(domainSectionDir, { recursive: true });
  const list = Array.isArray(instances) ? instances : [];
  const payload = {
    identical: extra.identical != null ? Boolean(extra.identical) : list.length <= 1,
    canonicalPageSlug: extra.canonicalPageSlug ?? list[0]?.pageSlug ?? null,
    instanceCount: list.length,
    differences: Array.isArray(extra.differences) ? extra.differences : [],
    instances: list,
  };
  await writeFile(
    path.join(domainSectionDir, 'instances.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );
}

/**
 * Load instances.json; if missing, migrate from materialized instances/ folders.
 * @param {string} domainSectionDir
 * @param {string} projectRoot
 * @returns {Promise<object[]>}
 */
export async function loadOrMigrateInstances(domainSectionDir, projectRoot) {
  const jsonPath = path.join(domainSectionDir, 'instances.json');
  try {
    const raw = String(await readFile(jsonPath, 'utf8')).replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    if (Array.isArray(data.instances)) return data.instances;
    if (Array.isArray(data)) return data;
  } catch {
    /* migrate below */
  }

  const instancesRoot = path.join(domainSectionDir, 'instances');
  /** @type {object[]} */
  const migrated = [];
  let pageDirs = [];
  try {
    const entries = await readdir(instancesRoot, { withFileTypes: true });
    pageDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }

  for (const pageSlug of pageDirs) {
    const instDir = path.join(instancesRoot, pageSlug);
    let info = {};
    try {
      info = JSON.parse(
        String(await readFile(path.join(instDir, 'section-information.json'), 'utf8')).replace(
          /^\uFEFF/,
          '',
        ),
      );
    } catch {
      /* empty */
    }
    const sectionFolder =
      info.folderName ||
      info.sharedSection?.sourceFolder ||
      info.registrySection?.sectionFolder ||
      null;
    // Prefer live page section if we can find a matching slot
    let sourcePath = null;
    let resolvedSectionFolder = sectionFolder;
    if (sectionFolder) {
      sourcePath = pageSectionSourcePath(pageSlug, sectionFolder);
    } else {
      // Probe page sections/ for contentHash or cmsName match
      const pageSectionsRoot = path.join(projectRoot, pageSlug, 'sections');
      try {
        const slots = await readdir(pageSectionsRoot, { withFileTypes: true });
        for (const s of slots) {
          if (!s.isDirectory()) continue;
          const pageInfoPath = path.join(pageSectionsRoot, s.name, 'section-information.json');
          try {
            const pageInfo = JSON.parse(
              String(await readFile(pageInfoPath, 'utf8')).replace(/^\uFEFF/, ''),
            );
            const reg = pageInfo.registrySection || pageInfo.sharedSection;
            const folderMatch =
              reg?.componentFolder === path.basename(domainSectionDir) ||
              (info.cmsName && pageInfo.cmsName === info.cmsName);
            if (folderMatch || (info.contentHash && pageInfo.contentHash === info.contentHash)) {
              resolvedSectionFolder = s.name;
              sourcePath = pageSectionSourcePath(pageSlug, s.name);
              break;
            }
          } catch {
            /* next */
          }
        }
      } catch {
        /* no page */
      }
    }
    if (!sourcePath && resolvedSectionFolder) {
      sourcePath = pageSectionSourcePath(pageSlug, resolvedSectionFolder);
    }
    migrated.push({
      pageSlug,
      sectionFolder: resolvedSectionFolder || null,
      sourcePath,
      contentHash: info.contentHash || null,
      sourceCmsName: info.cmsName || info.sourceCmsName || null,
      extensionScore: info.extensionScore || null,
    });
  }

  if (migrated.length) {
    await writeInstancesJson(domainSectionDir, migrated);
    try {
      await rm(instancesRoot, { recursive: true, force: true });
      console.log(
        `  … migrated ${path.basename(domainSectionDir)}/instances/ → instances.json (${migrated.length} refs)`,
      );
    } catch {
      /* keep if locked */
    }
  }
  return migrated;
}

/**
 * Absolute dir for a registry entry's canonical evidence (page section).
 * @param {string} projectRoot
 * @param {object} entry
 */
export function resolveCanonicalInstanceDir(projectRoot, entry) {
  if (!entry) return null;
  if (entry.canonicalRef) {
    return resolveRegistryInstanceDir(projectRoot, entry.canonicalRef);
  }
  const instances = entry.instances || [];
  const canon =
    instances.find((i) => i.pageSlug === entry.canonicalPageSlug) || instances[0] || null;
  if (canon) return resolveRegistryInstanceDir(projectRoot, canon);
  return null;
}

/**
 * Write registrySection pointer into the page slot's section-information.json.
 * Also mirrors onto legacy sharedSection for older readers.
 */
export async function writeSharedSectionBacklink({ pageSectionDir, sharedSection, registrySection }) {
  const infoPath = path.join(pageSectionDir, 'section-information.json');
  let info = {};
  try {
    info = JSON.parse(String(await readFile(infoPath, 'utf8')).replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
  const payload = registrySection || sharedSection;
  if (!payload) return null;
  info.registrySection = {
    ...(info.registrySection || {}),
    ...payload,
  };
  // Read-compat for create/bridge until fully migrated
  info.sharedSection = { ...info.registrySection };
  await writeFile(infoPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
  return info.registrySection;
}

/**
 * @param {object} params
 * @param {string} params.pageDir
 * @param {string} params.domainSectionsRoot
 * @param {string} params.pageSlug
 * @param {object} params.globalManifest
 * @param {Array<object>} params.pageSections
 * @param {boolean} [params.ai]
 * @param {object} [params.aiStats]
 */
export async function mergePageSectionsIntoDomain({
  pageDir,
  domainSectionsRoot,
  pageSlug,
  globalManifest,
  pageSections,
  ai = false,
  aiStats = null,
}) {
  const pageSectionsRoot = path.join(pageDir, 'sections');
  const projectRoot = path.dirname(domainSectionsRoot);
  const report = {
    pageSlug,
    pageDir: path.relative(projectRoot, pageDir).replace(/\\/g, '/'),
    pageSectionsRoot: path.relative(projectRoot, pageSectionsRoot).replace(/\\/g, '/'),
    domainSectionsRoot: path.relative(projectRoot, domainSectionsRoot).replace(/\\/g, '/'),
    mergedAt: new Date().toISOString(),
    sections: [],
    componentsToBuild: [],
  };

  const stats = aiStats || {
    called: 0,
    sureSame: 0,
    sureDifferent: 0,
    unsureNoAi: 0,
    failed: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
  };

  try {
    await access(pageSectionsRoot);
  } catch {
    return report;
  }

  const entries = await readdir(pageSectionsRoot, { withFileTypes: true });
  const allFolders = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const positional = allFolders.filter((n) => PAGE_SECTION_SLOT_RE.test(n));
  const sectionFolders = positional.length ? positional : allFolders;

  for (const sectionMeta of pageSections) {
    if (sectionMeta.metadataOnly || sectionMeta.screenshotSkipped) continue;

    const folderName = sectionMeta.folderName;
    if (!folderName || !sectionFolders.includes(folderName)) continue;

    const pageSectionDir = path.join(pageSectionsRoot, folderName);
    const sectionInfo =
      (await readSectionInformation(pageSectionDir)) || sectionMeta;
    const structure = await structureFromSectionDir(pageSectionDir);
    const { html, skeleton, structureFingerprint, tokens } = structure;
    // Prefer live stripped hash from HTML so data-* volatility cannot split twins.
    const contentHash =
      (html ? sectionContentHash(html) : null) ||
      sectionMeta.contentHash ||
      sectionInfo.contentHash ||
      null;
    const { payload: enrichPayload, fingerprint: enrichFp } =
      computeEnrichStructureFingerprint(sectionInfo);

    let existing = findDomainEntryByContentHash(globalManifest, contentHash);
    let matchedBy = existing ? 'contentHash' : null;

    if (!existing) {
      existing = findDomainEntryByFingerprint(globalManifest, structureFingerprint);
      if (existing) {
        // Same shell: merge when stripped contentHash matches (ignore enrich
        // layout.pattern noise such as modal-overlay vs modal-dialog).
        let strippedEqual = false;
        if (contentHash) {
          const existingHashes = new Set();
          if (existing.contentHash) existingHashes.add(existing.contentHash);
          for (const h of existing.contentHashes || []) {
            if (h) existingHashes.add(h);
          }
          for (const inst of existing.instances || []) {
            if (inst.contentHash) existingHashes.add(inst.contentHash);
          }
          if (existingHashes.has(contentHash)) {
            strippedEqual = true;
          } else {
            const canonDir = resolveCanonicalInstanceDir(projectRoot, existing);
            if (canonDir) {
              const prior = await structureFromSectionDir(canonDir);
              if (prior?.html && sectionContentHash(prior.html) === contentHash) {
                strippedEqual = true;
              }
            }
          }
        }
        if (strippedEqual) {
          matchedBy = 'structureFingerprint+contentHash';
        } else {
          const layoutOk = await enrichLayoutsCompatibleForMerge(
            sectionInfo,
            existing,
            projectRoot,
          );
          if (!layoutOk.ok) {
            console.log(
              `    … skip structureFingerprint merge for ${sectionMeta.cmsName}: ${layoutOk.reason}`,
            );
            existing = null;
          } else {
            matchedBy = 'structureFingerprint';
          }
        }
      }
    }

    if (!existing) {
      const cand = findBestSimilarityCandidate(globalManifest, tokens);
      if (cand && similarityBand(cand.similarity) === 'same') {
        const layoutOk = await enrichLayoutsCompatibleForMerge(
          sectionInfo,
          cand.entry,
          projectRoot,
        );
        if (layoutOk.ok) {
          existing = cand.entry;
          matchedBy = 'skeletonSimilarity';
          stats.sureSame += 1;
        } else {
          console.log(
            `    … skip skeleton merge for ${sectionMeta.cmsName}: ${layoutOk.reason}`,
          );
          stats.sureDifferent += 1;
        }
      } else if (cand && similarityBand(cand.similarity) === 'unsure') {
        const soft = findSoftDescHtmlMatch(globalManifest, sectionMeta, tokens);
        if (soft && soft.entry === cand.entry) {
          const layoutOk = await enrichLayoutsCompatibleForMerge(
            sectionInfo,
            soft.entry,
            projectRoot,
          );
          if (layoutOk.ok) {
            existing = soft.entry;
            matchedBy = 'descHtmlSoft';
            stats.sureSame += 1;
          }
        } else if (ai) {
          let htmlB = '';
          const canonDir = resolveCanonicalInstanceDir(projectRoot, cand.entry);
          if (canonDir) {
            htmlB = (await structureFromSectionDir(canonDir)).html;
          }
          if (!htmlB) {
            // Legacy materialized instance
            if (cand.entry.canonicalPageSlug) {
              htmlB = (
                await structureFromSectionDir(
                  path.join(
                    domainSectionsRoot,
                    cand.entry.folderName,
                    'instances',
                    cand.entry.canonicalPageSlug,
                  ),
                )
              ).html;
            }
          }
          if (!htmlB) {
            htmlB = (
              await structureFromSectionDir(path.join(domainSectionsRoot, cand.entry.folderName))
            ).html;
          }

          stats.called += 1;
          const judgment = await judgeSectionSimilarity({
            htmlA: html,
            htmlB,
            labelA: `${pageSlug}/${sectionMeta.cmsName}`,
            labelB: `${cand.entry.cmsName}`,
          });
          if (judgment.usage) {
            stats.promptTokens += judgment.usage.promptTokens || 0;
            stats.completionTokens += judgment.usage.completionTokens || 0;
            stats.totalTokens += judgment.usage.totalTokens || 0;
          }
          if (judgment.costEstimate?.totalUsd != null) {
            stats.costUsd += judgment.costEstimate.totalUsd;
          }
          if (judgment.ok && judgment.same) {
            const layoutOk = await enrichLayoutsCompatibleForMerge(
              sectionInfo,
              cand.entry,
              projectRoot,
            );
            if (!layoutOk.ok) {
              stats.sureDifferent += 1;
              console.log(
                `    … AI merge: ${sectionMeta.cmsName} ~ ${cand.entry.cmsName} → blocked (${layoutOk.reason})`,
              );
            } else {
              existing = cand.entry;
              matchedBy = 'ai';
              existing._aiMostExtended = judgment.mostExtended;
              existing._aiReason = judgment.reason;
              const u = judgment.usage;
              const cost =
                judgment.costEstimate?.totalUsd != null
                  ? `~$${judgment.costEstimate.totalUsd}`
                  : 'cost n/a';
              console.log(
                `    … AI merge: ${sectionMeta.cmsName} ~ ${cand.entry.cmsName} → same (extended=${judgment.mostExtended}) in=${u?.promptTokens ?? '?'} out=${u?.completionTokens ?? '?'} ${cost}`,
              );
            }
          } else if (judgment.ok) {
            stats.sureDifferent += 1;
            console.log(
              `    … AI merge: ${sectionMeta.cmsName} ~ ${cand.entry.cmsName} → different (${judgment.reason || 'n/a'})`,
            );
          } else {
            stats.failed += 1;
            console.warn(`    … AI merge skipped: ${judgment.skipReason}`);
          }
        } else {
          const soft = findSoftDescHtmlMatch(globalManifest, sectionMeta, tokens);
          if (soft) {
            const layoutOk = await enrichLayoutsCompatibleForMerge(
              sectionInfo,
              soft.entry,
              projectRoot,
            );
            if (layoutOk.ok) {
              existing = soft.entry;
              matchedBy = 'descHtmlSoft';
              stats.sureSame += 1;
            } else {
              stats.unsureNoAi += 1;
            }
          } else {
            stats.unsureNoAi += 1;
          }
        }
      } else if (cand) {
        stats.sureDifferent += 1;
      }
    }

    if (!existing) {
      const byName = findDomainEntryByCmsNameAssist(
        globalManifest,
        sectionMeta.cmsName,
        structureFingerprint,
        tokens,
      );
      if (byName) {
        const layoutOk = await enrichLayoutsCompatibleForMerge(
          sectionInfo,
          byName,
          projectRoot,
        );
        if (layoutOk.ok) {
          existing = byName;
          matchedBy = 'cmsNameAssist';
          stats.sureSame += 1;
        } else {
          console.log(
            `    … skip cmsNameAssist merge for ${sectionMeta.cmsName}: ${layoutOk.reason}`,
          );
        }
      }
    } else if (
      matchedBy === 'contentHash' ||
      matchedBy === 'structureFingerprint' ||
      matchedBy === 'structureFingerprint+contentHash'
    ) {
      stats.sureSame += 1;
    }

    const isNew = !existing;
    let domainCmsName = existing?.cmsName || sectionMeta.cmsName;
    let domainFolder =
      existing?.folderName || folderNameFromCmsName(domainCmsName || sectionMeta.cmsName);
    let action = isNew ? 'promoted' : 'reuse';

    if (isNew) {
      let n = 0;
      // Prefer distinct stems when several sections share a catalogue cmsName
      // (e.g. sticky SiteHeader vs mid-page "Header" nav grid) so we never
      // overwrite another registry folder that failed soft-merge.
      const baseFolder = folderNameFromCmsName(domainCmsName || sectionMeta.cmsName);
      domainFolder = baseFolder;
      while (
        Object.values(globalManifest.components || {}).some(
          (e) => e.folderName === domainFolder,
        )
      ) {
        n += 1;
        domainFolder = `${baseFolder}-${n}`;
      }
      if (n > 0 && domainCmsName) {
        // Keep component map keys unique when cmsName collides across folders
        domainCmsName = `${domainCmsName} ${n + 1}`.trim();
      }
    }

    const domainSectionDir = path.join(domainSectionsRoot, domainFolder);
    await mkdir(domainSectionDir, { recursive: true });

    // Migrate any leftover materialized copies once
    if (existing) {
      const prior = await loadOrMigrateInstances(domainSectionDir, projectRoot);
      if (prior.length && (!existing.instances || !existing.instances.length)) {
        existing.instances = prior;
      }
    }

    const sourcePath = pageSectionSourcePath(pageSlug, folderName);
    const incomingScore = extensionScore(html);
    const prevCanonicalScore = existing?.canonicalExtensionScore ?? 0;
    let useIncomingAsCanonical = isNew;

    if (!isNew) {
      if (matchedBy === 'ai' && existing._aiMostExtended === 'a') {
        useIncomingAsCanonical = true;
      } else if (matchedBy === 'ai' && existing._aiMostExtended === 'b') {
        useIncomingAsCanonical = false;
      } else {
        useIncomingAsCanonical = incomingScore > prevCanonicalScore;
      }
    }

    const instances = upsertInstanceList(existing?.instances, {
      pageSlug,
      sectionFolder: folderName,
      sourcePath,
      sourceCmsName: sectionMeta.cmsName,
      sourceFolder: folderName,
      contentHash,
      extensionScore: incomingScore,
    });

    // Canonical = highest extensionScore (AI “most extended” may force incoming)
    const ranked = [...instances].sort(
      (a, b) => (b.extensionScore || 0) - (a.extensionScore || 0),
    );
    let canonicalInst = ranked[0] || instances.find((i) => i.pageSlug === pageSlug);
    if (useIncomingAsCanonical) {
      canonicalInst = instances.find((i) => i.pageSlug === pageSlug) || canonicalInst;
    }
    const canonicalPageSlug = canonicalInst?.pageSlug || pageSlug;
    const canonicalSectionFolder = canonicalInst?.sectionFolder || folderName;
    const canonicalSourcePath =
      canonicalInst?.sourcePath || pageSectionSourcePath(canonicalPageSlug, canonicalSectionFolder);

    const canonicalRef = {
      pageSlug: canonicalPageSlug,
      sectionFolder: canonicalSectionFolder,
      sourcePath: canonicalSourcePath,
    };
    const canonicalInstanceDir =
      resolveRegistryInstanceDir(projectRoot, canonicalRef) || pageSectionDir;
    const outputs = await resolveInstanceOutputs(
      canonicalInstanceDir,
      folderName,
      domainFolder,
    );

    const seen = new Set(existing?.seenOnPages ?? []);
    seen.add(pageSlug);

    const alsoKnownAs = new Set(existing?.alsoKnownAs ?? []);
    if (sectionMeta.cmsName && sectionMeta.cmsName !== domainCmsName) {
      alsoKnownAs.add(sectionMeta.cmsName);
    }

    const contentHashes = new Set(existing?.contentHashes ?? []);
    if (contentHash) contentHashes.add(contentHash);
    if (existing?.contentHash) contentHashes.add(existing.contentHash);

    await writeInstancesJson(domainSectionDir, instances);
    // Drop any leftover materialized tree
    try {
      await rm(path.join(domainSectionDir, 'instances'), { recursive: true, force: true });
    } catch {
      /* none */
    }

    const entry = {
      ...sectionMeta,
      ...(existing || {}),
      cmsName: domainCmsName,
      folderName: domainFolder,
      contentHash: contentHash || existing?.contentHash || null,
      contentHashes: [...contentHashes],
      structureFingerprint,
      skeleton,
      skeletonTokens: tokens,
      fingerprint: structureFingerprint,
      // Prefer canonical enrich fingerprint when this instance becomes canonical
      enrichStructureFingerprint: useIncomingAsCanonical
        ? enrichFp
        : existing?.enrichStructureFingerprint || enrichFp,
      enrichStructurePayload: useIncomingAsCanonical
        ? enrichPayload
        : existing?.enrichStructurePayload || enrichPayload,
      layout: useIncomingAsCanonical
        ? sectionInfo.layout || existing?.layout || null
        : existing?.layout || sectionInfo.layout || null,
      purpose: useIncomingAsCanonical
        ? sectionInfo.purpose || existing?.purpose || null
        : existing?.purpose || sectionInfo.purpose || null,
      outputDir: domainSectionDir,
      outputs: relOutputs(domainSectionsRoot, outputs),
      sectionHtml: `${canonicalSourcePath}/section.html`,
      captured: Object.values(outputs).some(Boolean),
      seenOnPages: [...seen],
      alsoKnownAs: [...alsoKnownAs],
      instances,
      promotedFromPage: existing?.promotedFromPage || pageSlug,
      canonicalPageSlug,
      canonicalRef,
      canonicalInstance: canonicalSourcePath,
      canonicalExtensionScore: useIncomingAsCanonical
        ? incomingScore
        : Math.max(prevCanonicalScore, incomingScore),
      status: existing?.status || 'merged',
      definitionKey: existing?.definitionKey || null,
      componentName: existing?.componentName || null,
      contentFamilyId: existing?.contentFamilyId || null,
      contentFamilyRole: existing?.contentFamilyRole || null,
      ...(matchedBy === 'ai'
        ? { matchedBy: 'ai', aiMatchReason: existing._aiReason || null }
        : matchedBy
          ? { matchedBy }
          : {}),
    };
    delete entry._aiMostExtended;
    delete entry._aiReason;

    if (existing && existing.cmsName && existing.cmsName !== domainCmsName) {
      delete globalManifest.components[existing.cmsName];
    }
    globalManifest.components[domainCmsName] = entry;

    await cleanComponentRootArtifacts(domainSectionDir);
    await writeComponentMetadataFiles(domainSectionDir, entry, { projectRoot });

    const registrySection = {
      registryPath: registryPath(domainFolder),
      componentFolder: domainFolder,
      contentHash: contentHash || null,
      matchedBy: matchedBy || (isNew ? 'promoted' : 'reuse'),
      canonicalPageSlug,
      sourcePath,
      sectionFolder: folderName,
      definitionKey: entry.definitionKey || null,
      componentName: entry.componentName || null,
      status: entry.definitionKey ? entry.status || 'created' : 'merged',
      contentFamilyId: entry.contentFamilyId || null,
    };
    await writeSharedSectionBacklink({ pageSectionDir, registrySection });

    report.sections.push({
      action,
      cmsName: domainCmsName,
      sourceCmsName: sectionMeta.cmsName,
      domainFolder,
      pageSectionFolder: path.relative(projectRoot, pageSectionDir).replace(/\\/g, '/'),
      sourcePath,
      structureFingerprint,
      contentHash,
      matchedBy,
      buildComponent: isNew,
      canonical: useIncomingAsCanonical,
      sharedSection: registrySection,
      registrySection,
    });
    if (isNew) report.componentsToBuild.push(domainCmsName);
  }

  await writeAiUsageMeta(pageDir, {
    purpose: 'section-similarity-merge',
    model: null,
    ok: true,
    aggregates: {
      calls: stats.called || 0,
      promptTokens: stats.promptTokens || 0,
      completionTokens: stats.completionTokens || 0,
      totalTokens: stats.totalTokens || 0,
      costEstimateUsd:
        typeof stats.costUsd === 'number' && stats.costUsd > 0
          ? Math.round(stats.costUsd * 1e6) / 1e6
          : null,
    },
    context: {
      called: stats.called || 0,
      sureSame: stats.sureSame || 0,
      sureDifferent: stats.sureDifferent || 0,
      unsureNoAi: stats.unsureNoAi || 0,
      failed: stats.failed || 0,
    },
  });

  const manifestPath = path.join(pageDir, 'new-sections-manifest.json');
  await writeFile(manifestPath, JSON.stringify(report, null, 2), 'utf8');
  return report;
}

export async function loadGlobalManifest(sectionsRoot) {
  const manifestPath = path.join(sectionsRoot, 'manifest.json');
  try {
    const raw = String(await readFile(manifestPath, 'utf8')).replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return { components: {}, pages: [] };
  }
}

export async function saveGlobalManifest(sectionsRoot, manifest) {
  await mkdir(sectionsRoot, { recursive: true });
  await writeFile(path.join(sectionsRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

export { SIM_SURE_SAME };
