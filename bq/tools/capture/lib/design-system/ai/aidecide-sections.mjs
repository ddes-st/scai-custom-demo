/**
 * --use-ai (merge): send all page section HTMLs to Azure; cluster into same-component groups;
 * materialize {project}/ai-sections/ with the same layout as sections/.
 */
import { access, cp, mkdir, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeAiUsageMeta } from '../../../../shared/ai-usage-meta.mjs';
import { azureChatCompletion, resolveAzureChatConfig } from './azure-chat.mjs';
import { folderNameFromCmsName } from '../../merge-domain-sections.mjs';
import { writeComponentMetadataFiles } from '../../instance-diff.mjs';
import { structureFromHtml, extensionScore, skeletonSimilarity } from '../../structure-fingerprint.mjs';

import { writeSectionPlans } from '../../section-plan.mjs';
import { saveGlobalManifest } from '../../merge-domain-sections.mjs';
import { readOriginalSectionHtml } from '../../section-html-files.mjs';

export const DOMAIN_SECTIONS_ENRICH_PURPOSE = 'domain-sections-enrich';
const LEGACY_USE_AI_META = 'use-ai.meta.json';
const DEFAULT_BATCH_CHARS = 350_000;

function resolveBatchCharBudget() {
  const raw = process.env.AZURE_AI_DECIDE_MAX_CHARS?.trim() || process.env.AZURE_AI_DESIGN_MAX_CHARS?.trim();
  if (!raw) return DEFAULT_BATCH_CHARS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_BATCH_CHARS;
  return Math.floor(n);
}

/**
 * @param {string} projectRoot
 * @param {string[]} pageDirs
 */
export async function collectPageSectionHtmls(projectRoot, pageDirs) {
  /** @type {Array<{ id: string, pageSlug: string, folderName: string, cmsName: string, html: string, sourceDir: string, alternativeNames?: string[] }>} */
  const items = [];
  for (const pageDir of pageDirs) {
    const pageSlug = path.basename(pageDir);
    const sectionsRoot = path.join(pageDir, 'sections');
    let dirs = [];
    try {
      const entries = await readdir(sectionsRoot, { withFileTypes: true });
      dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    } catch {
      continue;
    }
    for (const folderName of dirs) {
      if (folderName.startsWith('__ai-tmp-')) continue;
      const sourceDir = path.join(sectionsRoot, folderName);
      const original = await readOriginalSectionHtml(sourceDir);
      const html = original?.html || '';
      if (!html.trim()) continue;
      let cmsName = folderNameFromCmsName(folderName);
      /** @type {string[]} */
      let alternativeNames = [];
      try {
        const info = JSON.parse(await readFile(path.join(sourceDir, 'section-information.json'), 'utf8'));
        if (info.cmsName) cmsName = info.cmsName;
        if (Array.isArray(info.alternativeNames)) {
          alternativeNames = info.alternativeNames.map(String);
        }
      } catch {
        /* ignore */
      }
      items.push({
        id: `${pageSlug}::${folderName}`,
        pageSlug,
        folderName,
        cmsName,
        html,
        sourceDir,
        alternativeNames,
      });
    }
  }
  return items;
}

function chunkItemsByChars(items, budget) {
  /** @type {typeof items[]} */
  const batches = [];
  let current = [];
  let used = 0;
  for (const item of items) {
    const size = item.html.length + item.id.length + 64;
    if (current.length && used + size > budget) {
      batches.push(current);
      current = [];
      used = 0;
    }
    current.push(item);
    used += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

function parseGroupsJson(content) {
  let text = String(content || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const parsed = JSON.parse(text);
  const groups = Array.isArray(parsed.groups) ? parsed.groups : Array.isArray(parsed) ? parsed : [];
  return groups
    .map((g) => ({
      members: Array.isArray(g.members) ? g.members.map(String) : [],
      mostExtended: g.mostExtended ? String(g.mostExtended) : null,
      cmsName: g.cmsName ? String(g.cmsName) : null,
    }))
    .filter((g) => g.members.length > 0);
}

/** Union-find merge of group membership across batches. */
function mergeGroupMemberships(allGroups, allIds) {
  const parent = new Map();
  for (const id of allIds) parent.set(id, id);
  const find = (x) => {
    let p = parent.get(x) ?? x;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    parent.set(x, p);
    return p;
  };
  const unite = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  /** @type {Map<string, { mostExtended: string|null, cmsName: string|null }>} */
  const meta = new Map();

  for (const g of allGroups) {
    const members = g.members.filter((id) => parent.has(id));
    if (!members.length) continue;
    for (let i = 1; i < members.length; i++) unite(members[0], members[i]);
    const root = find(members[0]);
    const prev = meta.get(root) || { mostExtended: null, cmsName: null };
    meta.set(root, {
      mostExtended: g.mostExtended && members.includes(g.mostExtended) ? g.mostExtended : prev.mostExtended,
      cmsName: g.cmsName || prev.cmsName,
    });
  }

  /** @type {Map<string, string[]>} */
  const byRoot = new Map();
  for (const id of allIds) {
    const r = find(id);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(id);
  }

  return [...byRoot.entries()].map(([root, members]) => {
    const m = meta.get(root) || {};
    return {
      members: members.sort(),
      mostExtended: m.mostExtended && members.includes(m.mostExtended) ? m.mostExtended : members[0],
      cmsName: m.cmsName || null,
    };
  });
}

async function askAzureForGroups(batch, usageAcc) {
  const system = [
    'You cluster HTML page sections into Sitecore UI components.',
    'Reply with ONLY JSON: {"groups":[{"members":["id1","id2"],"mostExtended":"id1","cmsName":"PascalName"}]}',
    'Each input id must appear in exactly one group (singleton groups allowed).',
    'same group = same layout/slots; ignore copy, images, link targets, repeating-item counts, and UI state (active/current/open/selected).',
    'Prefer the primary BEM / block class as identity when present (e.g. RevealTitle, ComponentD9v0, PromoCards)—match on that root block name.',
    'Heading level is NOT a new component: h1/h2/h3/p/span wrapping the same titled block (same BEM title classes) = same component.',
    'Ignore theme/variant modifiers (is-extended-bg-inverted, is-small, is-visible, inverted, color/spacing utilities) unless they add or remove whole slots.',
    'Do NOT invent numbered twin names (RevealTitle1, Footer2) for the same block—reuse one cmsName for the whole group.',
    'When unsure but the BEM root block matches, group them together.',
    'mostExtended = richest/most complete member for generating the component.',
    'cmsName = short PascalCase name derived from the BEM block (e.g. RevealTitle), without trailing digits.',
    'ROLE-DISTINCT: only share one cmsName across members when they are the SAME layout/slots (true twins).',
    'Never assign one cmsName to both site chrome (header/nav/footer/cookie) and a mid-page content band — those are different components.',
    'When members list alternativeNames (from page AI enrich), you MAY pick a shared cmsName from those alternatives if it fits the cluster better than any single programmatic name.',
  ].join(' ');

  const parts = ['Section HTML fragments follow. Each block is labeled with its id.', ''];
  for (const item of batch) {
    const alts =
      Array.isArray(item.alternativeNames) && item.alternativeNames.length
        ? ` | alternativeNames: ${item.alternativeNames.join(',')}`
        : '';
    parts.push(`===== ID: ${item.id} | cmsName: ${item.cmsName}${alts} =====`);
    parts.push(item.html);
    parts.push('');
  }

  const result = await azureChatCompletion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: parts.join('\n') },
    ],
    responseFormat: { type: 'json_object' },
  });

  if (result.usage) {
    usageAcc.promptTokens += result.usage.promptTokens || 0;
    usageAcc.completionTokens += result.usage.completionTokens || 0;
    usageAcc.totalTokens += result.usage.totalTokens || 0;
  }
  if (result.costEstimate?.totalUsd != null) {
    usageAcc.costUsd += result.costEstimate.totalUsd;
  }
  usageAcc.calls += 1;
  if (result.model) usageAcc.model = result.model;

  if (!result.ok) {
    return { ok: false, skipReason: result.skipReason, groups: [] };
  }

  try {
    const groups = parseGroupsJson(result.content);
    return { ok: true, groups, model: result.model };
  } catch {
    return { ok: false, skipReason: 'AI decide response was not valid JSON groups', groups: [] };
  }
}

function ensureSingletonGroups(groups, allIds) {
  const seen = new Set();
  for (const g of groups) for (const id of g.members) seen.add(id);
  const out = [...groups];
  for (const id of allIds) {
    if (!seen.has(id)) out.push({ members: [id], mostExtended: id, cmsName: null });
  }
  return out;
}

/** Strip trailing digits for soft name match (RevealTitle1 → RevealTitle). */
function normalizeCmsNameStem(name) {
  return String(name || '')
    .replace(/\d+$/g, '')
    .replace(/[-_]+$/g, '')
    .toLowerCase();
}

const SKIP_BLOCK_NAMES = new Set(['NormalizedSlice', 'PictureElement', 'Image']);

/**
 * Extract PascalCase BEM block names from skeleton tokens
 * (tokens may be compound, e.g. "div.RevealTitle.is-extended" or "RevealTitle__title").
 * @param {string[]} tokens
 * @returns {string[]}
 */
function extractBemBlocks(tokens) {
  const out = [];
  for (const t of tokens || []) {
    for (const part of String(t).split('.')) {
      const bem = part.match(/^([A-Z][A-Za-z0-9]+)(?:__|$)/);
      if (bem && !SKIP_BLOCK_NAMES.has(bem[1])) {
        out.push(bem[1]);
        continue;
      }
      if (/^[A-Z][A-Za-z0-9]+$/.test(part) && !SKIP_BLOCK_NAMES.has(part)) {
        out.push(part);
      }
    }
  }
  return out;
}

/** Primary (root) BEM block = first significant block in skeleton order. */
function primaryBlockToken(tokens) {
  const blocks = extractBemBlocks(tokens);
  return blocks[0] || null;
}

function groupStruct(byId, g) {
  const most = byId.get(g.mostExtended) || byId.get(g.members[0]);
  if (!most) {
    return { fp: '', tokens: [], primaryBlock: null, stem: '', cmsName: g.cmsName };
  }
  const s = structureFromHtml(most.html);
  const cmsName = g.cmsName || most.cmsName || '';
  return {
    fp: s.structureFingerprint,
    tokens: s.tokens,
    primaryBlock: primaryBlockToken(s.tokens),
    stem: normalizeCmsNameStem(cmsName),
    cmsName,
  };
}

function consolidateGroupsByIndex(groups, shouldUnite) {
  const parent = new Map();
  for (let i = 0; i < groups.length; i++) parent.set(String(i), String(i));
  const find = (x) => {
    let p = parent.get(x) ?? x;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    parent.set(x, p);
    return p;
  };
  const unite = (a, b) => {
    const ra = find(String(a));
    const rb = find(String(b));
    if (ra !== rb) parent.set(ra, rb);
  };
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      if (shouldUnite(i, j)) unite(i, j);
    }
  }
  /** @type {Map<string, typeof groups>} */
  const byRoot = new Map();
  for (let i = 0; i < groups.length; i++) {
    const r = find(String(i));
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(groups[i]);
  }
  return [...byRoot.values()].map((list) => {
    const members = [...new Set(list.flatMap((g) => g.members))].sort();
    const mostExtended =
      list.find((g) => g.mostExtended && members.includes(g.mostExtended))?.mostExtended ||
      members[0];
    const cmsName =
      list.map((g) => g.cmsName).find((n) => n && !/\d$/.test(n)) ||
      list.find((g) => g.cmsName)?.cmsName ||
      null;
    return { members, mostExtended, cmsName };
  });
}

/**
 * Soft post-merge: same primary BEM block and/or stem cmsName + Jaccard ≥ 0.70.
 * @param {Array<{ members: string[], mostExtended: string|null, cmsName: string|null }>} groups
 * @param {Map<string, { html: string, cmsName: string }>} byId
 */
function mergeGroupsByBemOrSoftSimilarity(groups, byId) {
  const meta = groups.map((g) => groupStruct(byId, g));
  return consolidateGroupsByIndex(groups, (i, j) => {
    const a = meta[i];
    const b = meta[j];
    if (a.primaryBlock && a.primaryBlock === b.primaryBlock) return true;
    if (a.stem && a.stem === b.stem) {
      const sim = skeletonSimilarity(a.tokens, b.tokens);
      if (sim >= 0.7) return true;
    }
    return false;
  });
}

async function copyDirFiles(srcDir, destDir) {
  await mkdir(destDir, { recursive: true });
  await cp(srcDir, destDir, { recursive: true, force: true });
}

/**
 * @param {{ projectRoot: string, pageDirs: string[], url?: string }} opts
 */
export async function buildAiDecideSections(opts) {
  const { projectRoot, pageDirs, url } = opts;
  const {
    resolveSectionRegistryAiRoot,
    SECTION_REGISTRY_AI_DIR,
    pageSectionSourcePath,
  } = await import('../../section-registry-paths.mjs');
  const aiSectionsRoot = await resolveSectionRegistryAiRoot(projectRoot);
  const SHARED_SECTIONS_AI_DIR = SECTION_REGISTRY_AI_DIR;
  const items = await collectPageSectionHtmls(projectRoot, pageDirs);

  const usageAcc = {
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    model: null,
  };

  if (!items.length) {
    console.log('  … use-ai skipped: no page section.html files');
    return { ok: false, skipReason: 'no sections', usage: usageAcc };
  }

  const config = resolveAzureChatConfig();
  if (!config.ok) {
    console.warn(`  … use-ai skipped: ${config.skipReason}`);
    return { ok: false, skipReason: config.skipReason, usage: usageAcc };
  }

  console.log(
    `  … use-ai: clustering ${items.length} section(s) → ${SHARED_SECTIONS_AI_DIR}/`,
  );

  const batches = chunkItemsByChars(items, resolveBatchCharBudget());
  /** @type {Array<{ members: string[], mostExtended: string|null, cmsName: string|null }>} */
  let rawGroups = [];
  for (let i = 0; i < batches.length; i++) {
    const res = await askAzureForGroups(batches[i], usageAcc);
    const cost =
      usageAcc.costUsd > 0 ? `~$${Math.round(usageAcc.costUsd * 1e6) / 1e6}` : 'cost n/a';
    console.log(
      `  … use-ai batch ${i + 1}/${batches.length}: model=${usageAcc.model || '?'} in=${usageAcc.promptTokens} out=${usageAcc.completionTokens} total=${usageAcc.totalTokens} ${cost}`,
    );
    if (!res.ok) {
      console.warn(`  … use-ai failed: ${res.skipReason}`);
      console.log(
        `  ✓ use-ai: sections=${items.length} calls=${usageAcc.calls} in=${usageAcc.promptTokens} out=${usageAcc.completionTokens} total=${usageAcc.totalTokens} ${cost} (failed)`,
      );
      return { ok: false, skipReason: res.skipReason, usage: usageAcc };
    }
    rawGroups.push(...res.groups);
  }

  const allIds = items.map((i) => i.id);
  let groups =
    batches.length > 1
      ? mergeGroupMemberships(rawGroups, allIds)
      : ensureSingletonGroups(rawGroups, allIds);
  if (batches.length === 1) {
    groups = mergeGroupMemberships(groups, allIds);
  }
  groups = ensureSingletonGroups(groups, allIds);

  const byIdEarly = new Map(items.map((i) => [i.id, i]));

  // Unite groups that share exact AI cmsName + structure fingerprint (cross-batch)
  groups = consolidateGroupsByIndex(groups, (i, j) => {
    const a = groups[i];
    const b = groups[j];
    const mostA = byIdEarly.get(a.mostExtended) || byIdEarly.get(a.members[0]);
    const mostB = byIdEarly.get(b.mostExtended) || byIdEarly.get(b.members[0]);
    if (!mostA || !mostB) return false;
    const nameA = (a.cmsName || mostA.cmsName || '').toLowerCase();
    const nameB = (b.cmsName || mostB.cmsName || '').toLowerCase();
    if (!nameA || nameA !== nameB) return false;
    const fpA = structureFromHtml(mostA.html).structureFingerprint;
    const fpB = structureFromHtml(mostB.html).structureFingerprint;
    return Boolean(fpA && fpA === fpB);
  });

  // Soft merge: shared BEM block (RevealTitle) or stem name + Jaccard ≥ 0.70
  groups = mergeGroupsByBemOrSoftSimilarity(groups, byIdEarly);

  const byId = byIdEarly;

  await rm(aiSectionsRoot, { recursive: true, force: true });
  await mkdir(aiSectionsRoot, { recursive: true });

  const components = {};
  const usedFolders = new Set();

  for (const g of groups) {
    const members = g.members.map((id) => byId.get(id)).filter(Boolean);
    if (!members.length) continue;
    const most = byId.get(g.mostExtended) || members[0];
    let cmsName = g.cmsName || most.cmsName || folderNameFromCmsName(most.folderName);
    let folderName = folderNameFromCmsName(cmsName);
    let n = 0;
    while (usedFolders.has(folderName)) {
      n += 1;
      folderName = `${folderNameFromCmsName(cmsName)}-${n}`;
    }
    usedFolders.add(folderName);

    // Unique cmsName key in manifest
    let key = cmsName;
    let k = 0;
    while (components[key]) {
      k += 1;
      key = `${cmsName}${k}`;
    }
    cmsName = key;

    const domainSectionDir = path.join(aiSectionsRoot, folderName);
    await mkdir(domainSectionDir, { recursive: true });

    const instances = [];
    const mostId = most.id;

    for (const m of members) {
      const score = extensionScore(m.html);
      const sourcePath = pageSectionSourcePath(m.pageSlug, m.folderName);
      instances.push({
        pageSlug: m.pageSlug,
        sectionFolder: m.folderName,
        sourcePath,
        sourceCmsName: m.cmsName,
        sourceFolder: m.folderName,
        extensionScore: score,
        sourceId: m.id,
        alternativeNames: m.alternativeNames || [],
      });
    }

    const canonicalPageSlug = most.pageSlug;
    const canonicalSourcePath = pageSectionSourcePath(most.pageSlug, most.folderName);
    const canonicalRef = {
      pageSlug: canonicalPageSlug,
      sectionFolder: most.folderName,
      sourcePath: canonicalSourcePath,
    };
    const struct = structureFromHtml(most.html);
    const alsoKnownAs = [
      ...new Set(
        members
          .flatMap((m) => [m.cmsName, ...(m.alternativeNames || [])])
          .filter((c) => c && c !== cmsName),
      ),
    ];

    const outputs = {};
    for (const device of ['desktop', 'tablet', 'mobile']) {
      const candidates = [
        path.join(most.sourceDir, `${folderName}-${device}.png`),
        path.join(most.sourceDir, `${most.folderName}-${device}.png`),
        path.join(most.sourceDir, `section-${device}.png`),
      ];
      let found = null;
      for (const c of candidates) {
        try {
          await access(c);
          found = path.relative(projectRoot, c).replace(/\\/g, '/');
          break;
        } catch {
          /* next */
        }
      }
      outputs[device] = found;
    }

    const entry = {
      cmsName,
      folderName,
      structureFingerprint: struct.structureFingerprint,
      skeleton: struct.skeleton,
      skeletonTokens: struct.tokens,
      fingerprint: struct.structureFingerprint,
      outputDir: domainSectionDir,
      outputs,
      sectionHtml: `${canonicalSourcePath}/section.html`,
      captured: Object.values(outputs).some(Boolean),
      seenOnPages: [...new Set(members.map((m) => m.pageSlug))],
      alsoKnownAs,
      instances,
      promotedFromPage: canonicalPageSlug,
      canonicalPageSlug,
      canonicalRef,
      canonicalInstance: canonicalSourcePath,
      canonicalExtensionScore: extensionScore(most.html),
      matchedBy: 'use-ai',
      useAiMostExtendedId: mostId,
    };

    components[cmsName] = entry;
    await writeComponentMetadataFiles(domainSectionDir, entry, { projectRoot });
  }

  const manifest = {
    components,
    projectRoot,
    sectionsRoot: aiSectionsRoot,
    updatedAt: new Date().toISOString(),
    source: 'use-ai',
    url: url || null,
  };
  await saveGlobalManifest(aiSectionsRoot, manifest);
  await writeSectionPlans(projectRoot, manifest, { sectionsRoot: aiSectionsRoot });

  const cost =
    usageAcc.costUsd > 0 ? `~$${Math.round(usageAcc.costUsd * 1e6) / 1e6}` : 'cost n/a';
  const groupCount = Object.keys(components).length;
  console.log(
    `  ✓ use-ai: sections=${items.length} calls=${usageAcc.calls} groups=${groupCount} in=${usageAcc.promptTokens} out=${usageAcc.completionTokens} total=${usageAcc.totalTokens} ${cost} → ${SHARED_SECTIONS_AI_DIR}/`,
  );

  await writeAiUsageMeta(aiSectionsRoot, {
    purpose: DOMAIN_SECTIONS_ENRICH_PURPOSE,
    model: usageAcc.model,
    ok: true,
    aggregates: {
      calls: usageAcc.calls,
      promptTokens: usageAcc.promptTokens,
      completionTokens: usageAcc.completionTokens,
      totalTokens: usageAcc.totalTokens,
      costEstimateUsd: usageAcc.costUsd > 0 ? Math.round(usageAcc.costUsd * 1e6) / 1e6 : null,
    },
    context: {
      url: url || null,
      sectionCount: items.length,
      groupCount,
    },
  });
  await unlink(path.join(aiSectionsRoot, LEGACY_USE_AI_META)).catch(() => {});
  console.log(`  → ${aiSectionsRoot}`);

  return { ok: true, usage: usageAcc, groupCount, sectionCount: items.length, aiSectionsRoot };
}
