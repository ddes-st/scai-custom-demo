/**
 * Best registry cmsName / folder across multi-page instances (vote + specificity).
 * Prefers content-role names over generic HTML structure names.
 */
import { access, rename } from 'node:fs/promises';
import path from 'node:path';
import { folderNameFromCmsName } from './section-registry-paths.mjs';

const CHROME_NAMES = new Set([
  'header',
  'footer',
  'navigation',
  'primarynavigation',
  'mainnavigation',
  'siteheader',
  'sitefooter',
  'topbar',
  'cookieconsent',
  'consentbanner',
  'cookiebanner',
]);

const GENERIC_NAMES = new Set([
  'contentblock',
  'section',
  'main',
  'container',
  'wrapper',
  'block',
  'richtext',
  'richtextentry',
  'richtextblock',
  'textblock',
  'ehgrid',
  'ctagroup',
  'cta',
  'grid',
]);

/** Tokens that indicate content role (boost). */
const CONTENT_ROLE_RE =
  /news|article|teaser|header|footer|navigation|overview|listing|grid|press|blog|dealer|locator|hero|banner/i;

/** Tokens that indicate generic HTML structure (penalize). */
const GENERIC_TOKEN_RE =
  /richtext|contentblock|ehgrid|ctagroup|wrapper|container|section$/i;

function normalizeNameKey(name) {
  return String(name || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();
}

function isChromeName(name) {
  const k = normalizeNameKey(name);
  if (!k) return false;
  if (CHROME_NAMES.has(k)) return true;
  return /header|footer|nav|cookie|consent|menu/i.test(String(name || ''));
}

function isGenericName(name) {
  const k = normalizeNameKey(name);
  if (GENERIC_NAMES.has(k)) return true;
  return GENERIC_TOKEN_RE.test(String(name || ''));
}

/**
 * Normalize purpose/description for soft text similarity.
 * @param {string} text
 */
export function normalizeDescText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Token Jaccard on normalized description/purpose text (0..1).
 * @param {string} a
 * @param {string} b
 */
export function descriptionSimilarity(a, b) {
  const ta = new Set(normalizeDescText(a).split(' ').filter((t) => t.length > 2));
  const tb = new Set(normalizeDescText(b).split(' ').filter((t) => t.length > 2));
  if (!ta.size && !tb.size) return 1;
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

/**
 * Score a candidate cmsName for a registry entry.
 * @param {string} name
 * @param {{
 *   voteCount: number,
 *   track?: string|null,
 *   purpose?: string|null,
 *   description?: string|null,
 *   routeHints?: string|null,
 * }} ctx
 */
export function scoreSharedCmsName(name, ctx) {
  const n = String(name || '').trim();
  if (!n) return -Infinity;
  let score = Math.min(ctx.voteCount || 0, 5) * 30;
  if (isGenericName(n)) score -= 160;
  const track = String(ctx.track || '').toLowerCase();
  if (
    (track === 'overlay' || track === 'chrome' || /header|footer|nav/.test(track)) &&
    isChromeName(n)
  ) {
    score += 40;
  } else if (isChromeName(n)) {
    score += 20;
  }
  if (CONTENT_ROLE_RE.test(n)) score += 90;
  if (GENERIC_TOKEN_RE.test(n) && !CONTENT_ROLE_RE.test(n)) score -= 80;

  const contextText = `${ctx.purpose || ''} ${ctx.description || ''} ${ctx.routeHints || ''}`;
  if (/news|article|press|blog/i.test(contextText)) {
    if (/news|article/i.test(n)) score += 70;
    if (/richtext|contentblock/i.test(n)) score -= 100;
  }

  const keyLen = normalizeNameKey(n).length;
  score += Math.min(keyLen, 48) * 4;
  if (/primarynavigation|mainnavigation|megamenu|consentbanner/i.test(n)) score += 80;
  else if (/navigation/i.test(n)) score += 50;
  if (/newsarticlebody|editorialarticlebody|articlebody/i.test(n)) score += 120;
  if (/newsarticleheader|articleheader|newstitle/i.test(n)) score += 100;
  return score;
}

/**
 * Suggest a content-role cmsName when news/article signals are present.
 * @param {object} entry
 * @returns {string | null}
 */
export function suggestContentRoleCmsName(entry) {
  const purpose = `${entry.purpose || ''} ${entry.description || ''}`.toLowerCase();
  const names = [
    entry.cmsName,
    ...(entry.alsoKnownAs || []),
    ...(entry.instances || []).map((i) => i.sourceCmsName),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const routes = (entry.seenOnPages || []).join(' ').toLowerCase();
  const blob = `${purpose} ${names} ${routes}`;

  const isNews =
    /news|article|press|blog/.test(blob) ||
    /newsroom|news-/.test(routes);

  if (!isNews) return null;

  const current = String(entry.cmsName || '');
  const curKey = normalizeNameKey(current);

  // Body / rich text
  if (
    /richtext|contentblock|editorial|body|articlebody/.test(curKey) ||
    (/body|rich.?text|article content|full.?text/.test(purpose) &&
      !/header|title|teaser|grid|overview/.test(curKey))
  ) {
    return 'NewsArticleBody';
  }

  // Header / title
  if (
    /newstitle|articleheader|article.?title|news.?title/.test(curKey) ||
    (/title|headline|header/.test(purpose) && /news|article/.test(blob))
  ) {
    return 'NewsArticleHeader';
  }

  // Grid / overview listing
  if (
    /overview|newsgrid|newsroom|listing|ehgrid/.test(curKey) ||
    (/grid|overview|listing|all news/.test(purpose) && /news/.test(blob))
  ) {
    return 'NewsGrid';
  }

  // Teasers strip
  if (
    /teaser|latest.?news/.test(curKey) ||
    (/teaser|latest news|recent/.test(purpose) && /news/.test(blob))
  ) {
    return 'NewsTeasers';
  }

  return null;
}

/**
 * Pick best cmsName from instance source names + alternativeNames.
 * @param {object} entry — domain manifest component entry
 * @returns {{ cmsName: string, alsoKnownAs: string[], votes: Record<string, number> }}
 */
export function pickBestSharedCmsName(entry) {
  /** @type {Map<string, number>} */
  const votes = new Map();
  const add = (name, weight = 1) => {
    const n = String(name || '').trim();
    if (!n) return;
    votes.set(n, (votes.get(n) || 0) + weight);
  };

  add(entry.cmsName, 1);
  for (const aka of entry.alsoKnownAs || []) add(aka, 1);
  for (const inst of entry.instances || []) {
    add(inst.sourceCmsName, 2);
  }
  for (const alt of entry.alternativeNames || []) add(alt, 0.5);

  const roleHint = suggestContentRoleCmsName(entry);
  if (roleHint) add(roleHint, 3);

  const routeHints = (entry.seenOnPages || []).join(' ');
  let best = entry.cmsName || 'Section';
  let bestScore = -Infinity;
  for (const [name, voteCount] of votes) {
    const score = scoreSharedCmsName(name, {
      voteCount,
      track: entry.track,
      purpose: entry.purpose,
      description: entry.description,
      routeHints,
    });
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  const alsoKnownAs = [...votes.keys()].filter((n) => n !== best);
  return {
    cmsName: best,
    alsoKnownAs,
    votes: Object.fromEntries(votes),
  };
}

/**
 * Apply best-name pick across all manifest components; optionally rename folders
 * when no definitionKey/package is locked.
 * @param {object} globalManifest
 * @param {string} sectionRegistryRoot
 * @param {{ packageExists?: (folder: string, cmsName: string) => Promise<boolean> }} [opts]
 */
export async function applyBestNamesToManifest(globalManifest, sectionRegistryRoot, opts = {}) {
  const components = globalManifest.components || {};
  /** @type {Record<string, object>} */
  const next = {};
  const renames = [];

  for (const [key, entry] of Object.entries(components)) {
    const picked = pickBestSharedCmsName(entry);
    const locked =
      Boolean(entry.definitionKey) ||
      entry.status === 'created' ||
      (opts.packageExists
        ? await opts.packageExists(entry.folderName, picked.cmsName)
        : false);

    let cmsName = locked ? entry.cmsName || picked.cmsName : picked.cmsName;
    let folderName = entry.folderName;
    const alsoKnownAs = new Set([
      ...(entry.alsoKnownAs || []),
      ...picked.alsoKnownAs,
      ...(locked && picked.cmsName !== cmsName ? [picked.cmsName] : []),
    ]);
    alsoKnownAs.delete(cmsName);

    if (!locked && picked.cmsName !== entry.cmsName) {
      const desiredFolder = folderNameFromCmsName(picked.cmsName);
      let candidate = desiredFolder;
      let n = 0;
      while (
        Object.values(next).some((e) => e.folderName === candidate) ||
        (candidate !== entry.folderName &&
          Object.values(components).some((e) => e !== entry && e.folderName === candidate))
      ) {
        n += 1;
        candidate = `${desiredFolder}-${n}`;
      }
      if (candidate !== entry.folderName) {
        const fromDir = path.join(sectionRegistryRoot, entry.folderName);
        const toDir = path.join(sectionRegistryRoot, candidate);
        try {
          await access(fromDir);
          await rename(fromDir, toDir);
          renames.push({ from: entry.folderName, to: candidate, cmsName: picked.cmsName });
          folderName = candidate;
          if (entry.sectionHtml) {
            entry.sectionHtml = String(entry.sectionHtml).replace(
              `${entry.folderName}/`,
              `${candidate}/`,
            );
          }
        } catch {
          /* keep folder */
        }
      }
      cmsName = picked.cmsName;
    }

    // Manifest keys are cmsName — never let best-name collapse distinct folders
    // (e.g. sticky SiteHeader + mid-page "Header" nav grid both pick cmsName Header).
    let manifestKey = cmsName;
    if (
      next[manifestKey] &&
      next[manifestKey].folderName &&
      next[manifestKey].folderName !== folderName
    ) {
      let n = 2;
      while (next[`${cmsName} ${n}`]) n += 1;
      manifestKey = `${cmsName} ${n}`;
      cmsName = manifestKey;
      alsoKnownAs.delete(cmsName);
    }

    const updated = {
      ...entry,
      cmsName,
      folderName,
      outputDir: path.join(sectionRegistryRoot, folderName),
      alsoKnownAs: [...alsoKnownAs],
      nameVotes: picked.votes,
    };
    next[manifestKey] = updated;
  }

  globalManifest.components = next;
  return { renames };
}

/**
 * Rename unlocked family members to role folders (e.g. rich-text-entry → news-article-body).
 * @param {object} globalManifest
 * @param {string} sectionRegistryRoot
 * @param {Array<{ id: string, members: Array<{ folderName: string, role: string, cmsNameHint?: string }> }>} familyRenames
 */
export async function applyFamilyRoleRenames(globalManifest, sectionRegistryRoot, familyRenames) {
  const renames = [];
  const ROLE_CMS = {
    'detail-body': 'NewsArticleBody',
    'detail-header': 'NewsArticleHeader',
    list: 'NewsGrid',
    'teaser-item': 'NewsTeasers',
  };
  const ROLE_FOLDER = {
    'detail-body': 'news-article-body',
    'detail-header': 'news-article-header',
    list: 'news-grid',
    'teaser-item': 'news-teasers',
  };

  for (const family of familyRenames || []) {
    for (const member of family.members || []) {
      const entry = Object.values(globalManifest.components || {}).find(
        (e) => e.folderName === member.folderName,
      );
      if (!entry) continue;
      if (entry.definitionKey || entry.status === 'created') continue;

      const desiredCms = member.cmsNameHint || ROLE_CMS[member.role];
      const desiredFolder = member.folderHint || ROLE_FOLDER[member.role];
      if (!desiredCms || !desiredFolder) continue;
      if (entry.folderName === desiredFolder && entry.cmsName === desiredCms) continue;

      let candidate = desiredFolder;
      let n = 0;
      while (
        Object.values(globalManifest.components || {}).some(
          (e) => e !== entry && e.folderName === candidate,
        )
      ) {
        n += 1;
        candidate = `${desiredFolder}-${n}`;
      }

      if (candidate !== entry.folderName) {
        const fromDir = path.join(sectionRegistryRoot, entry.folderName);
        const toDir = path.join(sectionRegistryRoot, candidate);
        try {
          await access(fromDir);
          await rename(fromDir, toDir);
          renames.push({
            from: entry.folderName,
            to: candidate,
            cmsName: desiredCms,
            familyId: family.id,
            role: member.role,
          });
          entry.folderName = candidate;
          entry.outputDir = toDir;
        } catch (err) {
          console.warn(
            `  … family rename failed ${entry.folderName} → ${candidate}: ${err?.message || err}`,
          );
        }
      }

      // Always apply role cmsName when unlocked (even if folder rename skipped)
      const oldKey = entry.cmsName;
      entry.cmsName = desiredCms;
      entry.contentFamilyRole = member.role;
      entry.contentFamilyId = family.id;
      if (oldKey !== desiredCms) {
        delete globalManifest.components[oldKey];
      }
      globalManifest.components[desiredCms] = entry;
    }
  }

  return { renames };
}
