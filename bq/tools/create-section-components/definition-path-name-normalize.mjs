/**
 * Post-AI: HTML-derived content item Path names → English via translation cache;
 * original → displayName. Remap layoutSketch datasourceName with the same map.
 * AI-invented already-English identities are left alone.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveEnglishItemName } from '../shared/english-item-name.ts';
import { proposeValidItemName } from '../shared/naming.ts';
import {
  getTranslationRunStats,
  isClearlyNonEnglishSource,
  looksAlreadyEnglish,
} from '../shared/translate.ts';
import {
  aiDebugStem,
  formatRawAiJsonDump,
  isAiDebugDumpEnabled,
  resolveAiDebugOutDir,
} from './ai-debug-dump.mjs';

/**
 * @param {string} source
 * @returns {string|null}
 */
export function extractDefinitionContentCulture(source) {
  const m = String(source || '').match(
    /\bculture\s*:\s*(['"])([a-z]{2}(?:-[A-Za-z]{2})?)\1/i,
  );
  return m ? m[2] : null;
}

/** AI-invented Title Case identities (keep; do not nl→en). */
const STRUCTURAL_EN_IDENTITY_RE =
  /\b(Section|Sections|Hero|Folder|Card|Cards|Content|Navigation|Nav|Group|Groups|Footer|Header|Banner|Accordion|Carousel|List|Block|Panel|Rail|Support|Introduction|Legal|Global|Template|Rendering)\b/;

/**
 * Extra Dutch cues beyond translate-core DUTCH_RE (headlines often omit those tokens).
 */
const PATH_DUTCH_HINT_RE =
  /\b(wordt|worden|persoonlijk|medicijn(?:en)?|wachtlijst(?:en)?|verzekerd(?:e)?|anderzorg|gebruiken|slapen|behandeling|iedereen|vitaliteit|zorgzaken|zorgplafonds|korter|medicijntekorten|wachtlijstbemiddeling|therapieland)\b/iu;

function normLabel(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isNonEnglishCulture(culture) {
  const c = String(culture || '')
    .trim()
    .replace(/_/g, '-');
  if (!c) return false;
  return !/^en\b/i.test(c);
}

function isStructuralEnglishIdentity(name) {
  const s = String(name || '').trim();
  if (!s) return false;
  if (isClearlyNonEnglishSource(s) || PATH_DUTCH_HINT_RE.test(s)) return false;
  if (!looksAlreadyEnglish(s)) return false;
  return STRUCTURAL_EN_IDENTITY_RE.test(s);
}

/**
 * True when name was copied from HTML heading/title (same label / prefix).
 * @param {string} name
 * @param {string} heading
 */
function namesMatchHtmlLabel(name, heading) {
  const n = normLabel(name);
  const h = normLabel(heading);
  if (!n || !h) return false;
  if (n === h) return true;
  if (h.startsWith(`${n}:`) || h.startsWith(`${n}.`) || h.startsWith(`${n},`)) {
    return true;
  }
  return false;
}

/**
 * @param {string} raw
 * @param {string} sourceCulture
 * @param {string} [headingOrTitle]
 */
function needsPathTranslate(raw, sourceCulture, headingOrTitle = '') {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (isClearlyNonEnglishSource(s) || PATH_DUTCH_HINT_RE.test(s)) return true;
  if (!looksAlreadyEnglish(s)) return true;
  // Already-English Path after a prior normalize must stay stable (no re-translate).
  // Only force translate when a non-en culture still has name === HTML Heading
  // and it is not a structural AI identity (e.g. "Image Content Section").
  if (
    isNonEnglishCulture(sourceCulture) &&
    headingOrTitle &&
    namesMatchHtmlLabel(s, headingOrTitle) &&
    !isStructuralEnglishIdentity(s)
  ) {
    return true;
  }
  return false;
}

/**
 * Peek Heading/Title string near an item `name` match.
 * @param {string} region
 * @param {number} fromIndex
 */
function peekHeadingOrTitle(region, fromIndex) {
  const slice = String(region || '').slice(fromIndex, fromIndex + 1200);
  const m = slice.match(
    /\b(?:Heading|Title)\s*:\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/,
  );
  return m ? m[2] : '';
}

/**
 * @param {string} raw
 * @param {string} sourceCulture
 * @param {Map<string, string>} nameMap
 * @param {object[]} remaps
 * @param {string} kind
 * @param {string} [headingOrTitle]
 */
async function resolvePathName(
  raw,
  sourceCulture,
  nameMap,
  remaps,
  kind,
  headingOrTitle = '',
) {
  const source = String(raw || '').trim();
  if (!source) return source;
  if (nameMap.has(source)) {
    const mapped = nameMap.get(source);
    if (
      kind === 'datasourceName' &&
      mapped &&
      mapped !== source &&
      !remaps.some(
        (r) =>
          r.kind === 'datasourceName' &&
          r.before === source &&
          r.after === mapped,
      )
    ) {
      remaps.push({
        kind: 'datasourceName',
        before: source,
        after: mapped,
        cacheHit: true,
        culture: `${sourceCulture}→en`,
        purpose: 'item-name-en',
      });
    }
    return mapped;
  }
  if (!needsPathTranslate(source, sourceCulture, headingOrTitle)) {
    nameMap.set(source, source);
    return source;
  }
  const beforeStats = getTranslationRunStats();
  const english = await resolveEnglishItemName(source, {
    sourceLanguage: sourceCulture,
  });
  const afterStats = getTranslationRunStats();
  const cacheHit = afterStats.cacheMissAi === beforeStats.cacheMissAi;
  const after = String(english || source).trim() || source;
  nameMap.set(source, after);
  if (after !== source) {
    remaps.push({
      kind,
      before: source,
      after,
      displayName: source,
      cacheHit,
      culture: `${sourceCulture}→en`,
      purpose: 'item-name-en',
    });
  }
  return after;
}

/**
 * Rewrite content.items[].name (objects that have fields:) to English Path +
 * capture-lang displayName when the name is not already English.
 *
 * @param {string} source
 * @param {{ sourceCulture?: string|null, nameMap?: Map<string, string> }} [opts]
 * @returns {Promise<{ text: string, remaps: object[], nameMap: Map<string, string>, sourceCulture: string }>}
 */
export async function normalizeDefinitionContentItemPathNames(
  source,
  opts = {},
) {
  let text = String(source || '');
  /** @type {object[]} */
  const remaps = [];
  /** @type {Map<string, string>} */
  const nameMap = opts.nameMap instanceof Map ? opts.nameMap : new Map();
  const sourceCulture =
    String(opts.sourceCulture || '').trim() ||
    extractDefinitionContentCulture(text) ||
    'nl-BE';

  if (!text.trim()) {
    return { text, remaps, nameMap, sourceCulture };
  }

  const contentIdx = text.search(/\bcontent\s*:/);
  if (contentIdx < 0) {
    return { text, remaps, nameMap, sourceCulture };
  }

  const head = text.slice(0, contentIdx);
  const region = text.slice(contentIdx);

  // Item objects: { name: "…", [displayName: "…",] fields:
  const itemRe =
    /(\{\s*name\s*:\s*)(['"])((?:\\.|(?!\2)[^\\])*)\2(\s*,\s*)(?:(displayName\s*:\s*)(['"])((?:\\.|(?!\6)[^\\])*)\6(\s*,\s*))?(?=fields\s*:)/g;

  /** @type {{ full: string, namePrefix: string, rawName: string, mid: string, hasDn: boolean, dnPrefix: string, dnRaw: string, dnMid: string, index: number }[]} */
  const hits = [];
  let m;
  while ((m = itemRe.exec(region))) {
    hits.push({
      full: m[0],
      namePrefix: m[1],
      rawName: m[3],
      mid: m[4],
      hasDn: Boolean(m[5]),
      dnPrefix: m[5] || '',
      dnRaw: m[7] || '',
      dnMid: m[8] || '',
      index: m.index,
    });
  }

  if (!hits.length) {
    return { text, remaps, nameMap, sourceCulture };
  }

  let outRegion = region;
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i];
    const heading = peekHeadingOrTitle(region, hit.index);
    const english = await resolvePathName(
      hit.rawName,
      sourceCulture,
      nameMap,
      remaps,
      'item-name',
      heading,
    );
    // Last resort: Sitecore ItemNameValidation (periods, apostrophes, …).
    const sanitized = proposeValidItemName(
      english || hit.rawName,
      'unnamed-item',
    );
    // Keep nameMap aligned for layoutSketch datasourceName remaps.
    nameMap.set(hit.rawName, sanitized);
    if (english !== hit.rawName && english !== sanitized) {
      nameMap.set(english, sanitized);
    }

    if (sanitized === hit.rawName) continue;

    if (sanitized !== english) {
      remaps.push({
        kind: 'item-name-sanitize',
        before: english,
        after: sanitized,
        displayName: hit.rawName,
        cacheHit: true,
        culture: sourceCulture,
        purpose: 'item-name-sanitize',
      });
    }

    // Path changed: keep existing displayName when present; else original name.
    const displaySource =
      hit.hasDn && String(hit.dnRaw || '').trim()
        ? hit.dnRaw
        : hit.rawName;
    const replacement = hit.hasDn
      ? `${hit.namePrefix}${JSON.stringify(sanitized)}${hit.mid}` +
        `${hit.dnPrefix}${JSON.stringify(displaySource)}${hit.dnMid}`
      : `${hit.namePrefix}${JSON.stringify(sanitized)}${hit.mid}` +
        `displayName: ${JSON.stringify(displaySource)}, `;
    outRegion =
      outRegion.slice(0, hit.index) +
      replacement +
      outRegion.slice(hit.index + hit.full.length);
  }

  return {
    text: head + outRegion,
    remaps,
    nameMap,
    sourceCulture,
  };
}

/**
 * Sync-only Path sanitize for content.items / children `{ name, fields:` hits.
 * Strips ItemNameValidation-invalid chars via proposeValidItemName — no AI
 * translate. Use after JSON-bag promote (titles with `?` become Path names).
 *
 * @param {string} source
 * @returns {{ text: string, changed: number }}
 */
export function sanitizeDefinitionContentItemPathNamesSync(source) {
  let text = String(source || '');
  if (!text.trim()) return { text, changed: 0 };

  const contentIdx = text.search(/\bcontent\s*:/);
  if (contentIdx < 0) return { text, changed: 0 };

  const head = text.slice(0, contentIdx);
  const region = text.slice(contentIdx);
  const itemRe =
    /(\{\s*name\s*:\s*)(['"])((?:\\.|(?!\2)[^\\])*)\2(\s*,\s*)(?:(displayName\s*:\s*)(['"])((?:\\.|(?!\6)[^\\])*)\6(\s*,\s*))?(?=fields\s*:)/g;

  /** @type {{ full: string, namePrefix: string, rawName: string, mid: string, hasDn: boolean, dnPrefix: string, dnRaw: string, dnMid: string, index: number }[]} */
  const hits = [];
  let m;
  while ((m = itemRe.exec(region))) {
    hits.push({
      full: m[0],
      namePrefix: m[1],
      rawName: m[3],
      mid: m[4],
      hasDn: Boolean(m[5]),
      dnPrefix: m[5] || '',
      dnRaw: m[7] || '',
      dnMid: m[8] || '',
      index: m.index,
    });
  }
  if (!hits.length) return { text, changed: 0 };

  let outRegion = region;
  let changed = 0;
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i];
    const sanitized = proposeValidItemName(hit.rawName, 'unnamed-item');
    if (sanitized === hit.rawName) continue;
    changed += 1;
    const displaySource =
      hit.hasDn && String(hit.dnRaw || '').trim()
        ? hit.dnRaw
        : hit.rawName;
    const replacement = hit.hasDn
      ? `${hit.namePrefix}${JSON.stringify(sanitized)}${hit.mid}` +
        `${hit.dnPrefix}${JSON.stringify(displaySource)}${hit.dnMid}`
      : `${hit.namePrefix}${JSON.stringify(sanitized)}${hit.mid}` +
        `displayName: ${JSON.stringify(displaySource)}, `;
    outRegion =
      outRegion.slice(0, hit.index) +
      replacement +
      outRegion.slice(hit.index + hit.full.length);
  }

  return { text: head + outRegion, changed };
}

/**
 * Remap layoutSketch datasourceName values using nameMap; translate any
 * remaining non-English names into the map.
 *
 * @param {object|null|undefined} sketch
 * @param {{ sourceCulture?: string|null, nameMap?: Map<string, string> }} [opts]
 * @returns {Promise<{ layoutSketch: object|null, remaps: object[], nameMap: Map<string, string> }>}
 */
export async function remapLayoutSketchDatasourceNames(sketch, opts = {}) {
  /** @type {object[]} */
  const remaps = [];
  /** @type {Map<string, string>} */
  const nameMap = opts.nameMap instanceof Map ? opts.nameMap : new Map();
  const sourceCulture = String(opts.sourceCulture || '').trim() || 'nl-BE';

  if (!sketch || typeof sketch !== 'object') {
    return { layoutSketch: sketch ?? null, remaps, nameMap };
  }

  /**
   * @param {unknown} node
   * @returns {Promise<unknown>}
   */
  async function walk(node) {
    if (Array.isArray(node)) {
      const out = [];
      for (const el of node) out.push(await walk(el));
      return out;
    }
    if (!node || typeof node !== 'object') return node;
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'datasourceName' && typeof v === 'string') {
        const raw = v.trim();
        const after = await resolvePathName(
          raw,
          sourceCulture,
          nameMap,
          remaps,
          'datasourceName',
        );
        out[k] = after;
      } else {
        out[k] = await walk(v);
      }
    }
    return out;
  }

  const layoutSketch = /** @type {object} */ (await walk(sketch));
  return { layoutSketch, remaps, nameMap };
}

/**
 * Normalize all packages' definitionTs + layoutSketch datasource names.
 *
 * @param {{
 *   packages: object[],
 *   layoutSketch?: object|null,
 *   sourceCulture?: string|null,
 * }} opts
 */
export async function normalizeSitecoreizePathNames(opts) {
  const packages = Array.isArray(opts.packages) ? opts.packages : [];
  /** @type {Map<string, string>} */
  const nameMap = new Map();
  /** @type {object[]} */
  const remaps = [];
  let sourceCulture = String(opts.sourceCulture || '').trim();

  const nextPackages = [];
  for (const pkg of packages) {
    const definitionTs = String(pkg?.definitionTs || '');
    if (!sourceCulture) {
      sourceCulture = extractDefinitionContentCulture(definitionTs) || '';
    }
    const result = await normalizeDefinitionContentItemPathNames(definitionTs, {
      sourceCulture: sourceCulture || undefined,
      nameMap,
    });
    remaps.push(...result.remaps);
    if (!sourceCulture) sourceCulture = result.sourceCulture;
    nextPackages.push({
      ...pkg,
      definitionTs: result.text,
    });
  }

  const sketchResult = await remapLayoutSketchDatasourceNames(
    opts.layoutSketch,
    {
      sourceCulture: sourceCulture || 'nl-BE',
      nameMap,
    },
  );
  remaps.push(...sketchResult.remaps);

  return {
    packages: nextPackages,
    layoutSketch: sketchResult.layoutSketch,
    remaps,
    nameMap,
    sourceCulture: sourceCulture || 'nl-BE',
  };
}

/**
 * @param {object[]} remaps
 */
export function formatDefinitionNameNormalizeLog(remaps) {
  const lines = [
    '=== AI definition Path name normalize ===',
    'HTML-derived item/datasource names → English Path (translation cache).',
    'Original kept as displayName where applicable.',
    '',
  ];
  for (const r of remaps || []) {
    const kind = r.kind || 'item-name';
    const culture = r.culture || '';
    const hit =
      r.cacheHit === true ? 'cache hit' : r.cacheHit === false ? 'AI+store' : '';
    const dn =
      kind === 'item-name' && r.displayName
        ? ' (displayName kept)'
        : '';
    const bits = [culture, hit].filter(Boolean).join(', ');
    lines.push(
      `[${kind}] ${JSON.stringify(r.before)} → ${JSON.stringify(r.after)}${dn}` +
        (bits ? ` (${bits})` : ''),
    );
  }
  if (!(remaps || []).length) {
    lines.push('(no remaps)');
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Write ai-debug evidence when remaps occurred.
 *
 * @param {{
 *   aiDebugRoot?: string,
 *   pageSectionDir?: string,
 *   stem?: string,
 *   componentName?: string,
 *   remaps: object[],
 *   packagesJson?: object,
 * }} opts
 * @returns {{ outDir: string, stem: string, namesPath: string, metaPath: string, logPath: string }|null}
 */
export function writeDefinitionNameNormalizeDump(opts) {
  if (!isAiDebugDumpEnabled()) return null;
  const remaps = Array.isArray(opts.remaps) ? opts.remaps : [];
  if (!remaps.length) return null;
  const outDir = resolveAiDebugOutDir(opts);
  if (!outDir) return null;
  const stem =
    String(opts.stem || '').trim() ||
    aiDebugStem('codegen-sitecoreize', opts.componentName || 'Section');

  try {
    mkdirSync(outDir, { recursive: true });
    const namesPath = path.join(outDir, `${stem}.names.raw.ai.json`);
    const metaPath = path.join(outDir, `${stem}.ai-names.meta.json`);
    const logPath = path.join(outDir, `${stem}.ai-names.log`);

    const body =
      opts.packagesJson != null
        ? formatRawAiJsonDump(JSON.stringify(opts.packagesJson))
        : `${JSON.stringify({ remaps }, null, 2)}\n`;
    writeFileSync(namesPath, body, 'utf8');
    writeFileSync(
      metaPath,
      `${JSON.stringify(
        {
          purpose: 'definition-path-name-normalize',
          componentName: opts.componentName || '',
          changed: remaps.length,
          writtenAt: new Date().toISOString(),
          stem,
          remaps,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    writeFileSync(logPath, formatDefinitionNameNormalizeLog(remaps), 'utf8');
    return { outDir, stem, namesPath, metaPath, logPath };
  } catch {
    return null;
  }
}
