/**
 * Detect content families across section-registry components (e.g. news-article).
 * Multi-signal: co-occurrence + field-set overlap + route taxonomy + child hash.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { applyFamilyRoleRenames } from './shared-section-naming.mjs';
import { writeComponentMetadataFiles } from './instance-diff.mjs';

const NEWS_TOKENS = /news|article|press|blog|newsroom/i;
const LIST_TOKENS = /grid|overview|listing|teaser|latest/i;
const DETAIL_HEADER_TOKENS = /title|header|headline|articleheader|newstitle/i;
const DETAIL_BODY_TOKENS = /body|richtext|editorial|contentblock|articlebody/i;
const CHROME_TOKENS =
  /^(header|footer|navigation|primary-navigation|consent-banner|cookie|topbar|site-header|site-footer)$/i;
const CHROME_CMS =
  /header|footer|navigation|consent|cookie|topbar|megamenu/i;

/**
 * Field names from suggestedFields / fields on entry.
 * @param {object} entry
 * @returns {Set<string>}
 */
function fieldNameSet(entry) {
  const names = new Set();
  const fields = entry.suggestedFields || entry.fields || [];
  for (const f of fields) {
    const n = String(f?.name || f?.fieldName || f || '')
      .trim()
      .toLowerCase();
    if (n) names.add(n === 'richtext' ? 'body' : n);
  }
  const blob = `${entry.purpose || ''} ${entry.description || ''} ${entry.cmsName || ''} ${entry.folderName || ''}`;
  for (const key of ['title', 'image', 'date', 'link', 'body', 'richtext', 'description', 'cta']) {
    if (new RegExp(key, 'i').test(blob)) names.add(key === 'richtext' ? 'body' : key);
  }
  // Role/folder heuristics when AI fields are missing
  const role = inferContentFamilyRole(entry);
  if (role === 'detail-body' || /article.?body|editorial|rich.?text/i.test(blob)) {
    names.add('title');
    names.add('body');
    names.add('image');
    names.add('date');
  } else if (role === 'detail-header' || /article.?header|news.?title/i.test(blob)) {
    names.add('title');
    names.add('date');
    names.add('image');
  } else if (role === 'teaser-item' || role === 'list' || /teaser|overview|news.?grid/i.test(blob)) {
    names.add('title');
    names.add('image');
    names.add('date');
    names.add('link');
  }
  return names;
}

/**
 * How rich this member is as a Sitecore item template owner.
 * Prefers field diversity (esp. Body) over listing HTML bulk.
 * @param {object} m
 */
export function contentFamilyOwnerScore(m) {
  const fields = fieldNameSet(m);
  const role = inferContentFamilyRole(m);
  let s = fields.size * 1000;
  if (fields.has('body')) s += 5000;
  // Article body is the content model; listings inflate extensionScore with N cards
  if (role === 'detail-body') s += 4000;
  else if (role === 'detail-header') s += 500;
  else if (role === 'list') s += 100;
  else if (role === 'teaser-item') s += 150;

  const instScores = (m.instances || [])
    .map((i) => Number(i.extensionScore) || 0)
    .filter((n) => n > 0);
  const avgExt = instScores.length
    ? instScores.reduce((a, b) => a + b, 0) / instScores.length
    : Number(m.canonicalExtensionScore) || 0;
  // Weak tie-break only — cap so one huge newsroom grid cannot beat a body
  s += Math.min(avgExt, 20_000) / 200;
  return s;
}

/**
 * Jaccard on two sets.
 * @param {Set<string>} a
 * @param {Set<string>} b
 */
function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/**
 * Identity/purpose text only — never page slugs (those contain "newsroom" for chrome too).
 * @param {object} entry
 */
function entryIdentityBlob(entry) {
  return [
    entry.cmsName,
    entry.folderName,
    entry.purpose,
    entry.description,
    ...(entry.alsoKnownAs || []),
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * @param {object} entry
 */
function isChromeEntry(entry) {
  const folder = String(entry.folderName || '');
  const cms = String(entry.cmsName || '');
  if (CHROME_TOKENS.test(folder)) return true;
  if (CHROME_CMS.test(cms) && !NEWS_TOKENS.test(cms)) return true;
  const track = String(entry.track || '').toLowerCase();
  if (track === 'chrome' || track === 'overlay') return true;
  return false;
}

/**
 * True when the component itself is news/article-related (not merely on a newsroom URL).
 * @param {object} entry
 */
function isNewsContentEntry(entry) {
  if (isChromeEntry(entry)) return false;
  const identity = entryIdentityBlob(entry);
  if (NEWS_TOKENS.test(identity)) return true;
  const role = inferContentFamilyRole(entry);
  if (role === 'detail-header' || role === 'detail-body' || role === 'list' || role === 'teaser-item') {
    // Role alone is weak — require at least one news token in identity or aka
    return NEWS_TOKENS.test(identity);
  }
  return false;
}

/**
 * @param {object} entry
 * @returns {'list'|'detail-header'|'detail-body'|'teaser-item'|'unknown'}
 */
export function inferContentFamilyRole(entry) {
  const blob = entryIdentityBlob(entry);
  const folder = String(entry.folderName || '');
  if (isChromeEntry(entry)) return 'unknown';
  if (DETAIL_BODY_TOKENS.test(folder) || DETAIL_BODY_TOKENS.test(blob)) {
    if (!DETAIL_HEADER_TOKENS.test(folder)) return 'detail-body';
  }
  if (DETAIL_HEADER_TOKENS.test(folder) || DETAIL_HEADER_TOKENS.test(blob)) {
    return 'detail-header';
  }
  if (/teaser/i.test(folder) || (/teaser|latest news/i.test(blob) && !/overview|grid/i.test(folder))) {
    return 'teaser-item';
  }
  if (LIST_TOKENS.test(folder) || LIST_TOKENS.test(blob)) return 'list';
  return 'unknown';
}

/**
 * Pages that host this component.
 * @param {object} entry
 */
function pagesOf(entry) {
  return new Set(entry.seenOnPages || (entry.instances || []).map((i) => i.pageSlug).filter(Boolean));
}

/**
 * Co-occurrence: share of pages of A that also have B.
 * @param {Set<string>} pagesA
 * @param {Set<string>} pagesB
 */
function coOccurrence(pagesA, pagesB) {
  if (!pagesA.size) return 0;
  let both = 0;
  for (const p of pagesA) if (pagesB.has(p)) both += 1;
  return both / pagesA.size;
}

/**
 * Child contentHash overlap across instances (structural child match signal).
 * @param {object} a
 * @param {object} b
 */
function childHashOverlap(a, b) {
  const ha = new Set(
    (a.contentHashes || []).concat(a.contentHash ? [a.contentHash] : []).filter(Boolean),
  );
  const hb = new Set(
    (b.contentHashes || []).concat(b.contentHash ? [b.contentHash] : []).filter(Boolean),
  );
  // Also instance-level hashes
  for (const i of a.instances || []) if (i.contentHash) ha.add(i.contentHash);
  for (const i of b.instances || []) if (i.contentHash) hb.add(i.contentHash);
  if (ha.size < 1 || hb.size < 1) return 0;
  let inter = 0;
  for (const h of ha) if (hb.has(h)) inter += 1;
  // Exact same contentHash across different layouts is rare; treat any overlap as strong-ish
  return inter > 0 ? 1 : 0;
}

/**
 * Evaluate strong signals between two entries.
 * @returns {{ signals: string[], score: number }}
 */
function evaluatePair(entryA, entryB) {
  const signals = [];
  const pagesA = pagesOf(entryA);
  const pagesB = pagesOf(entryB);
  const coAB = coOccurrence(pagesA, pagesB);
  const coBA = coOccurrence(pagesB, pagesA);
  const co = Math.max(coAB, coBA);
  if (co >= 0.7 && pagesA.size >= 1 && pagesB.size >= 1) {
    signals.push('coOccurrence');
  }

  const fieldsA = fieldNameSet(entryA);
  const fieldsB = fieldNameSet(entryB);
  let inter = 0;
  for (const f of fieldsA) if (fieldsB.has(f)) inter += 1;
  const jac = jaccard(fieldsA, fieldsB);
  if (jac >= 0.5 && inter >= 3) {
    signals.push('fieldSetOverlap');
  }

  const taxA = isNewsContentEntry(entryA);
  const taxB = isNewsContentEntry(entryB);
  const roleA = inferContentFamilyRole(entryA);
  const roleB = inferContentFamilyRole(entryB);
  const listDetailPair =
    (roleA === 'list' || roleA === 'teaser-item') &&
    (roleB === 'detail-header' || roleB === 'detail-body');
  const listDetailPairRev =
    (roleB === 'list' || roleB === 'teaser-item') &&
    (roleA === 'detail-header' || roleA === 'detail-body');
  // Both must be news content — never link chrome via shared newsroom URLs
  if (taxA && taxB) {
    signals.push('routeTaxonomy');
    if (listDetailPair || listDetailPairRev) {
      signals.push('listDetailPair');
    }
  }

  if (childHashOverlap(entryA, entryB) >= 1 && taxA && taxB) {
    signals.push('datasourceIdentity');
  }

  return { signals, score: signals.length, co, jac, inter, roleA, roleB };
}

/**
 * Detect news-article (and similar) families in a registry manifest.
 * @param {object} globalManifest
 * @returns {{ families: object[] }}
 */
export function detectContentFamilies(globalManifest) {
  const entries = Object.values(globalManifest.components || {});
  /** @type {object[]} */
  const families = [];

  // Candidate pool: news content only (exclude chrome / footer / nav)
  const newsish = entries.filter((e) => isNewsContentEntry(e));
  if (newsish.length < 2) {
    return { families };
  }

  // Union-find style clustering of pairs with ≥2 strong signals
  const idOf = (e) => e.folderName || e.cmsName;
  /** @type {Map<string, string>} */
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
    return parent.get(x);
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  /** @type {Map<string, string[]>} */
  const pairSignals = new Map();

  for (let i = 0; i < newsish.length; i++) {
    for (let j = i + 1; j < newsish.length; j++) {
      const a = newsish[i];
      const b = newsish[j];
      const { signals } = evaluatePair(a, b);
      if (signals.length >= 2) {
        union(idOf(a), idOf(b));
        pairSignals.set(`${idOf(a)}|${idOf(b)}`, signals);
      }
    }
  }

  /** @type {Map<string, object[]>} */
  const clusters = new Map();
  for (const e of newsish) {
    const root = find(idOf(e));
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(e);
  }

  for (const members of clusters.values()) {
    if (members.length < 2) continue;

    const memberFolders = members.map((m) => m.folderName);
    const roles = members.map((m) => ({
      folderName: m.folderName,
      role: inferContentFamilyRole(m),
      cmsName: m.cmsName,
    }));

    // Owner = richest item template (field diversity / Body), not largest listing HTML
    let owner = members[0];
    let ownerScore = -1;
    for (const m of members) {
      const s = contentFamilyOwnerScore(m);
      if (s > ownerScore) {
        ownerScore = s;
        owner = m;
      }
    }

    const allSignals = new Set();
    for (const [, sigs] of pairSignals) {
      for (const s of sigs) allSignals.add(s);
    }

    const confidence = Math.min(
      0.95,
      0.5 + members.length * 0.08 + allSignals.size * 0.08,
    );

    families.push({
      id: 'news-article',
      memberFolders,
      members: roles,
      sharedItemTemplateOwner: owner.folderName,
      ownerCmsName: owner.cmsName,
      signals: [...allSignals],
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  // Deduplicate if multiple news-article clusters — keep largest
  const newsFamilies = families.filter((f) => f.id === 'news-article');
  if (newsFamilies.length > 1) {
    newsFamilies.sort((a, b) => b.memberFolders.length - a.memberFolders.length);
    const keep = newsFamilies[0];
    return { families: [keep, ...families.filter((f) => f.id !== 'news-article')] };
  }

  return { families };
}

/**
 * Apply family ids/roles onto manifest entries, rename weak folders, write content-families.json.
 * @param {object} globalManifest
 * @param {string} sectionRegistryRoot
 * @param {string} projectRoot
 */
export async function applyContentFamilies(globalManifest, sectionRegistryRoot, projectRoot) {
  const { families } = detectContentFamilies(globalManifest);

  for (const family of families) {
    for (const member of family.members || []) {
      const entry = Object.values(globalManifest.components || {}).find(
        (e) => e.folderName === member.folderName,
      );
      if (!entry) continue;
      entry.contentFamilyId = family.id;
      entry.contentFamilyRole = member.role;
      entry.contentFamilyOwnerFolder = family.sharedItemTemplateOwner;
    }
  }

  // Role-based renames for unlocked weak names
  const renameInput = families.map((f) => ({
    id: f.id,
    members: (f.members || [])
      .filter((m) => m.role && m.role !== 'unknown')
      .map((m) => ({
        folderName: m.folderName,
        role: m.role,
      })),
  }));
  const { renames } = await applyFamilyRoleRenames(
    globalManifest,
    sectionRegistryRoot,
    renameInput,
  );

  // Refresh memberFolders after renames
  for (const family of families) {
    family.memberFolders = (family.members || [])
      .map((m) => {
        const renamed = renames.find((r) => r.from === m.folderName && r.familyId === family.id);
        if (renamed) {
          m.folderName = renamed.to;
          return renamed.to;
        }
        return m.folderName;
      })
      .filter(Boolean);
    if (family.sharedItemTemplateOwner) {
      const ownerRename = renames.find(
        (r) => r.from === family.sharedItemTemplateOwner && r.familyId === family.id,
      );
      if (ownerRename) family.sharedItemTemplateOwner = ownerRename.to;
    }
  }

  // Rewrite component.json for family members
  for (const entry of Object.values(globalManifest.components || {})) {
    if (!entry.contentFamilyId) continue;
    const dir = path.join(sectionRegistryRoot, entry.folderName);
    try {
      await writeComponentMetadataFiles(dir, entry, { projectRoot });
    } catch {
      /* optional */
    }
  }

  await mkdir(sectionRegistryRoot, { recursive: true });
  const outPath = path.join(sectionRegistryRoot, 'content-families.json');
  const payload = {
    generatedAt: new Date().toISOString(),
    families,
  };
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  return { families, renames, contentFamiliesPath: outPath };
}

/**
 * Look up family owner definitionKey / template path hints from registry.
 * @param {object} globalManifest
 * @param {string} contentFamilyId
 */
export function findFamilyOwnerEntry(globalManifest, contentFamilyId) {
  if (!contentFamilyId) return null;
  const members = Object.values(globalManifest.components || {}).filter(
    (e) => e.contentFamilyId === contentFamilyId,
  );
  if (!members.length) return null;

  // Prefer members that are their own owner folder (declared sharedItemTemplateOwner)
  const selfOwners = members
    .filter((m) => m.folderName && m.folderName === m.contentFamilyOwnerFolder)
    .sort(
      (a, b) =>
        contentFamilyOwnerScore(b) - contentFamilyOwnerScore(a) ||
        String(a.folderName).localeCompare(String(b.folderName)),
    );
  if (selfOwners.length) return selfOwners[0];

  // Majority vote on contentFamilyOwnerFolder (stable sort for ties)
  /** @type {Map<string, number>} */
  const votes = new Map();
  for (const m of members) {
    const f = m.contentFamilyOwnerFolder;
    if (!f) continue;
    votes.set(f, (votes.get(f) || 0) + 1);
  }
  let ownerFolder = null;
  let bestVotes = -1;
  for (const f of [...votes.keys()].sort((a, b) => a.localeCompare(b))) {
    const n = votes.get(f) || 0;
    if (n > bestVotes) {
      bestVotes = n;
      ownerFolder = f;
    }
  }
  if (ownerFolder) {
    const hit = members.find((m) => m.folderName === ownerFolder);
    if (hit) return hit;
  }

  // Deterministic fallback: richest member
  return [...members].sort(
    (a, b) =>
      contentFamilyOwnerScore(b) - contentFamilyOwnerScore(a) ||
      String(a.folderName).localeCompare(String(b.folderName)),
  )[0];
}
