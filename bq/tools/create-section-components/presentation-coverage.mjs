/**
 * Homepage presentation completeness: capture order, coverage gate, body-band guards.
 */
import path from 'node:path';
import { readSectionConversion } from './provenance.mjs';
import { inferEnrichPageRole } from './enrich-structure-fingerprint.mjs';
import { isPartialChromeRole, isSiteChromeDefinitionKey } from './presentation.mjs';
import {
  mapChromeBandRoles,
  normalizeChromeCatalogue,
} from './chrome-bands.mjs';
import { shouldSkipCookieBannerLayoutPlacement } from './cookie-banner-placement.mjs';

/**
 * Parse 1-based section index from folder name `section-01` → 1.
 * @param {string|null|undefined} folderName
 * @returns {number|null}
 */
function sectionIndexFromFolder(folderName) {
  const m = String(folderName || '').match(/section-(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Marketing / body bands that must never become partial-header (even if sticky/early).
 * @param {string} blob lowercase cmsName + purpose + reasons
 */
export function isBodyMarketingBandBlob(blob) {
  const b = String(blob || '').toLowerCase();
  if (!b.trim()) return false;
  // Explicit site chrome wins over marketing keywords in the same blob.
  if (
    /\b(main.?nav|site.?header|announcement|notification.?bar|cookie|consent|gdpr|osano|cmp)\b/.test(
      b,
    ) &&
    !/\b(hero|video.?hero|media.?slider|media.?section|callout|promo.?banner)\b/.test(b)
  ) {
    return false;
  }
  return /\b(hero|video.?feature|video.?hero|media.?slider|media.?section|technology.?hero|platform.?hero|ai.?assisted|banner|callout|demo.?callout|conversion.?banner|card.?grid|capability.?card|awards.?carousel|logo.?carousel|event.?carousel|case.?study|analyst.?report|recommendation)\b/.test(
    b,
  );
}

/**
 * @param {string|null|undefined} definitionKey
 */
export function isBodyMarketingDefinitionKey(definitionKey) {
  const k = String(definitionKey || '').toLowerCase();
  if (!k) return false;
  if (isSiteChromeDefinitionKey(k)) return false;
  return /hero|video-feature|video-hero|media-slider|media-section|callout|demo-callout|conversion|card-grid|capability|awards-carousel|logo-carousel|event-carousel|case-study|analyst-report|recommendation|platform-hero|technology-hero|aiassisted|ai-assisted/.test(
    k,
  );
}

/**
 * Parent definitionKey from a section-conversion payload.
 * @param {object|null|undefined} conversion
 * @returns {string|null}
 */
export function parentDefinitionKeyFromConversion(conversion) {
  const components = conversion?.components || [];
  const parent =
    components.find((c) => c.role === 'section') || components[0] || null;
  const key = parent?.definitionKey ? String(parent.definitionKey).trim() : '';
  return key || null;
}

/**
 * Resolve wiring role for coverage (mirrors run resolveSectionWiringRole loosely).
 * @param {object|null|undefined} conversion
 * @param {object|null|undefined} info
 * @param {string|null|undefined} definitionKey
 */
export function resolveCoverageRole(conversion, info, definitionKey) {
  // Prefer visual chrome catalogue + band role (no cookie partial).
  const catalogue = String(
    conversion?.chromeCatalogue || info?.chromeCatalogue || '',
  ).trim();
  if (catalogue) {
    const cat = catalogue.toLowerCase();
    if (cat === 'header' || cat === 'breadcrumb') return 'partial-header';
    if (cat === 'footer') return 'partial-footer';
    if (cat === 'other' || cat === 'cookie' || cat === 'normal') return 'page';
  }
  let prior = String(
    conversion?.role || conversion?.pageWiring?.role || info?.role || '',
  ).trim();
  // Cookie partial retired — treat as page body.
  if (prior === 'partial-cookie') prior = 'page';
  if (prior && prior !== 'page') return prior;
  if (definitionKey && isBodyMarketingDefinitionKey(definitionKey)) return 'page';
  const enrich = inferEnrichPageRole(
    info
      ? { ...info, role: undefined, pageWiring: undefined }
      : null,
  );
  if (enrich === 'partial-cookie') return 'page';
  if (enrich && enrich !== 'page') return enrich;
  if (!prior && definitionKey && isSiteChromeDefinitionKey(definitionKey)) {
    const k = String(definitionKey).toLowerCase();
    if (/consent|cookie|privacy-consent/.test(k)) return 'page';
    if (
      /footer/.test(k) &&
      !/footer-legal|footer-navigation|footer-signpost|footer-social|footer-branding|footer-link/.test(
        k,
      )
    ) {
      return 'partial-footer';
    }
    return 'partial-header';
  }
  return prior || 'page';
}

/**
 * Build ordered parent definitionKeys from detected-sections + conversion logs.
 * @param {{ sectionsDir: string }} capture
 * @param {{ sections?: Array<{ folderName?: string, cmsName?: string }> }|null} detected
 * @param {(abs: string) => Promise<object|null>} [readConversion]
 * @returns {Promise<string[]>}
 */
export async function buildDetectedDefinitionKeyOrder(
  capture,
  detected,
  readConversion = readSectionConversion,
) {
  /** @type {string[]} */
  const order = [];
  const seen = new Set();
  for (const s of detected?.sections || []) {
    const folderName = s.folderName;
    if (!folderName) continue;
    const conversion = await readConversion(path.join(capture.sectionsDir, folderName));
    const key = parentDefinitionKeyFromConversion(conversion);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    order.push(key);
  }
  return order;
}

/**
 * Sort home renderings in place by detected definitionKey order.
 * Unknown keys sort after known ones (stable relative order among unknowns).
 * @param {Array<{ definitionKey?: string }>} homeRenderings
 * @param {string[]} orderedKeys
 */
export function sortHomeRenderingsByDetectedOrder(homeRenderings, orderedKeys) {
  const index = new Map(orderedKeys.map((k, i) => [k, i]));
  homeRenderings.sort((a, b) => {
    const ka = a?.definitionKey || '';
    const kb = b?.definitionKey || '';
    const ia = index.has(ka) ? /** @type {number} */ (index.get(ka)) : Number.MAX_SAFE_INTEGER;
    const ib = index.has(kb) ? /** @type {number} */ (index.get(kb)) : Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    return 0;
  });
  return homeRenderings;
}

/**
 * Placeholder-composite child packages from conversion (distinct definitionKeys).
 * Excludes same-definition childItemTemplate repeats (FAQ / tiles / badges).
 * @param {object|null|undefined} conversion
 * @param {string} parentKey
 * @returns {number}
 */
export function expectedPresentationChildCount(conversion, parentKey) {
  const parent = String(parentKey || '').trim();
  return (conversion?.components || []).filter((c) => {
    if (!c?.definitionKey) return false;
    if (c.role === 'section') return false;
    const key = String(c.definitionKey).trim();
    if (!key || key === parent) return false;
    // Explicit child packages (placeholder composites)
    return c.role === 'child' || c.role === 'partial' || !c.role;
  }).length;
}

/**
 * Expected authorable child count from enrich repeats / conversion children.
 * Prefer presentation (placeholder) children only — not childItemTemplate seeds.
 * @param {object|null|undefined} info
 * @param {object|null|undefined} conversion
 * @param {string} [parentKey]
 * @returns {number}
 */
export function expectedEnrichChildCount(info, conversion, parentKey = '') {
  const fromPresentation = expectedPresentationChildCount(
    conversion,
    parentKey || parentDefinitionKeyFromConversion(conversion) || '',
  );
  if (fromPresentation > 0) return fromPresentation;
  // No distinct child packages → childItemTemplate / single package; presentation
  // children stay empty by design (ComponentQuery loads nested content).
  return 0;
}

/**
 * Fail when a wired parent has zero presentation children while conversion lists
 * distinct placeholder child packages. Does **not** fail for childItemTemplate
 * packages (tiles / recognition / award badges / FAQ) — those nest under content.
 * @param {{
 *   folderName: string,
 *   cmsName?: string,
 *   definitionKey: string,
 *   conversion?: object|null,
 *   info?: object|null,
 *   wired?: { children?: object[], content?: { items?: object[] } }|null,
 * }} opts
 * @returns {string[]}
 */
export function assertNonemptyWiredChildren(opts) {
  const {
    folderName,
    cmsName,
    definitionKey,
    conversion,
    wired,
  } = opts;
  /** @type {string[]} */
  const errors = [];
  const expected = expectedEnrichChildCount(
    opts.info,
    conversion,
    definitionKey,
  );
  if (expected <= 0) return errors;
  const wiredChildren = Array.isArray(wired?.children) ? wired.children : [];
  if (wiredChildren.length === 0) {
    errors.push(
      `${folderName} (${cmsName || '?'}): definitionKey="${definitionKey}" wired with 0 presentation children but conversion lists ~${expected} placeholder child package(s)`,
    );
  }
  return errors;
}

/**
 * Per definitionKey: layoutSketch peers ≈ wired presentation children ≈ content.items.
 * @param {{
 *   folderName?: string,
 *   layoutSketch?: object|null,
 *   wiredChildren?: Array<{ definitionKey?: string, datasourceItem?: string }>,
 *   contentItemNamesByKey?: Map<string, string[]>|Record<string, string[]>,
 *   componentResults?: Array<{ componentName?: string, definitionKey?: string }>,
 * }} opts
 * @returns {string[]}
 */
export function assertPeerCardinality(opts = {}) {
  /** @type {string[]} */
  const errors = [];
  const sketch = opts.layoutSketch;
  if (!sketch) return errors;

  /** @type {Map<string, string>} */
  const nameToKey = new Map();
  for (const c of opts.componentResults || []) {
    const name = String(c?.componentName || '').trim();
    const key = String(c?.definitionKey || '').trim();
    if (name && key) nameToKey.set(name.toLowerCase(), key);
  }

  /** @type {Map<string, number>} */
  const sketchByKey = new Map();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    const ph = node.placeholders;
    if (ph && typeof ph === 'object' && !Array.isArray(ph)) {
      for (const list of Object.values(ph)) {
        if (!Array.isArray(list)) continue;
        for (const child of list) {
          const name = String(child?.componentName || '').trim();
          const key =
            nameToKey.get(name.toLowerCase()) ||
            String(child?.definitionKey || '').trim();
          if (key) sketchByKey.set(key, (sketchByKey.get(key) || 0) + 1);
          visit(child);
        }
      }
    }
    if (Array.isArray(node.renderings)) {
      for (const r of node.renderings) visit(r);
    }
  };
  visit(sketch);

  /** @type {Map<string, number>} */
  const wiredByKey = new Map();
  for (const c of opts.wiredChildren || []) {
    const key = String(c?.definitionKey || '').trim();
    if (!key) continue;
    wiredByKey.set(key, (wiredByKey.get(key) || 0) + 1);
  }

  /** @type {Map<string, number>} */
  const seedByKey = new Map();
  const seedMap = opts.contentItemNamesByKey;
  if (seedMap instanceof Map) {
    for (const [key, names] of seedMap) {
      seedByKey.set(key, Array.isArray(names) ? names.length : 0);
    }
  } else if (seedMap && typeof seedMap === 'object') {
    for (const [key, names] of Object.entries(seedMap)) {
      seedByKey.set(key, Array.isArray(names) ? names.length : 0);
    }
  }

  const folder = opts.folderName || 'section';
  for (const [key, sketchCount] of sketchByKey) {
    if (sketchCount < 2) continue;
    const wiredCount = wiredByKey.get(key) || 0;
    const seedCount = seedByKey.has(key) ? seedByKey.get(key) : null;
    if (wiredCount > 0 && wiredCount < sketchCount) {
      errors.push(
        `${folder}: ${key} presentation children=${wiredCount} < layoutSketch peers=${sketchCount}`,
      );
    }
    if (seedCount != null && seedCount < sketchCount) {
      errors.push(
        `${folder}: ${key} content.items=${seedCount} < layoutSketch peers=${sketchCount}`,
      );
    }
  }
  return errors;
}

/**
 * Footer enrich roles (signpost/nav/social/legal) must map to covered placeholder bases.
 * @param {{
 *   folderName: string,
 *   cmsName?: string,
 *   definitionKey: string,
 *   info?: object|null,
 *   conversion?: object|null,
 *   partials?: Array<{ signature?: string, definitionKey?: string, children?: object[] }>,
 * }} opts
 * @returns {string[]}
 */
/**
 * @deprecated Legacy enrich→footer-social/legal checklist removed.
 * Footer structure follows AI/parent definition keys only.
 * @returns {string[]}
 */
export function assertFooterPlaceholderCoverage(_opts) {
  return [];
}

/**
 * @param {{
 *   detected: { sections?: Array<{ folderName?: string, cmsName?: string, index?: number }> }|null,
 *   sectionsDir: string,
 *   homeRenderings: Array<{ definitionKey?: string }>,
 *   partials: Array<{ signature?: string, definitionKey?: string, siblingsBefore?: Array<{ definitionKey?: string }> }>,
 *   cookieBannerPlacement?: 'place'|'none',
 *   readConversion?: (abs: string) => Promise<object|null>,
 *   readSectionInfo?: (abs: string) => Promise<object|null>,
 * }} opts
 * @returns {Promise<{ ok: boolean, errors: string[] }>}
 */
export async function assertPresentationCoverage(opts) {
  const {
    detected,
    sectionsDir,
    homeRenderings,
    partials,
    cookieBannerPlacement = 'none',
    readConversion = readSectionConversion,
    readSectionInfo = async (abs) => {
      try {
        const { readFile } = await import('node:fs/promises');
        return JSON.parse(await readFile(path.join(abs, 'section-information.json'), 'utf8'));
      } catch {
        return null;
      }
    },
  } = opts;

  /** @type {string[]} */
  const errors = [];
  const homeKeys = new Set(
    (homeRenderings || []).map((r) => r.definitionKey).filter(Boolean),
  );
  const partialBySig = new Map(
    (partials || []).map((p) => [String(p.signature || '').toLowerCase(), p]),
  );

  const hasPartialKey = (definitionKey) => {
    const key = String(definitionKey || '');
    const walk = (nodes) => {
      for (const n of nodes || []) {
        if (n?.definitionKey === key) return true;
        if (walk(n.children)) return true;
      }
      return false;
    };
    for (const p of partials || []) {
      if (p.definitionKey === key) return true;
      if (walk(p.children) || walk(p.siblingsBefore)) return true;
    }
    return false;
  };

  /** @type {Array<{ index: number, chromeCatalogue: string, definitionKey: string }>} */
  const bandInputs = [];
  /** @type {Array<{ s: object, folderName: string, conversion: object, info: object|null, definitionKey: string }>} */
  const sectionRows = [];

  for (const s of detected?.sections || []) {
    const folderName = s.folderName;
    if (!folderName) continue;
    const sectionAbs = path.join(sectionsDir, folderName);
    const conversion = await readConversion(sectionAbs);
    if (!conversion?.components?.length) {
      errors.push(
        `${folderName} (${s.cmsName || '?'}): missing section-conversion.json — cannot verify coverage`,
      );
      continue;
    }
    const definitionKey = parentDefinitionKeyFromConversion(conversion);
    if (!definitionKey) {
      errors.push(`${folderName} (${s.cmsName || '?'}): conversion has no parent definitionKey`);
      continue;
    }
    const info = await readSectionInfo(sectionAbs);
    const idx =
      Number(s.index) ||
      sectionIndexFromFolder(folderName) ||
      bandInputs.length + 1;
    bandInputs.push({
      index: idx,
      chromeCatalogue: normalizeChromeCatalogue(
        conversion?.chromeCatalogue || conversion?.role || 'other',
      ),
      definitionKey,
    });
    sectionRows.push({ s, folderName, conversion, info, definitionKey });
  }

  // Same cuts as wire-time band expansion (pre-header other → header partial).
  const { byDefinitionKey } = mapChromeBandRoles(bandInputs);

  for (const row of sectionRows) {
    const { s, folderName, conversion, info, definitionKey } = row;
    if (
      shouldSkipCookieBannerLayoutPlacement(
        cookieBannerPlacement,
        info,
        definitionKey,
      )
    ) {
      continue;
    }
    const bandRole = byDefinitionKey.get(definitionKey);
    const role =
      bandRole || resolveCoverageRole(conversion, info, definitionKey);

    if (role === 'page') {
      if (!homeKeys.has(definitionKey)) {
        errors.push(
          `${folderName} (${s.cmsName || '?'}): role=page definitionKey="${definitionKey}" missing from pages.home / homeRenderings`,
        );
      } else {
        const wired = (homeRenderings || []).find(
          (r) => r.definitionKey === definitionKey,
        );
        const nonempty = assertNonemptyWiredChildren({
          folderName,
          cmsName: s.cmsName,
          definitionKey,
          conversion,
          info,
          wired,
        });
        errors.push(...nonempty);
        /** @type {Map<string, string[]>} */
        const contentItemNamesByKey = new Map();
        for (const c of conversion?.components || []) {
          const key = String(c?.definitionKey || '').trim();
          if (!key) continue;
          const names = Array.isArray(c.contentItemNames)
            ? c.contentItemNames.map(String)
            : [];
          if (!contentItemNamesByKey.has(key)) {
            contentItemNamesByKey.set(key, names);
          } else if (names.length) {
            contentItemNamesByKey.set(key, names);
          }
        }
        errors.push(
          ...assertPeerCardinality({
            folderName,
            layoutSketch: conversion?.layoutSketch || null,
            wiredChildren: Array.isArray(wired?.children) ? wired.children : [],
            contentItemNamesByKey,
            componentResults: conversion?.components || [],
          }),
        );
      }
    } else if (role === 'partial-footer') {
      const p = partialBySig.get('footer');
      if (!p || (p.definitionKey !== definitionKey && !hasPartialKey(definitionKey))) {
        errors.push(
          `${folderName} (${s.cmsName || '?'}): role=partial-footer definitionKey="${definitionKey}" missing from footer partial`,
        );
      }
    } else if (role === 'partial-header') {
      if (!hasPartialKey(definitionKey)) {
        errors.push(
          `${folderName} (${s.cmsName || '?'}): role=partial-header definitionKey="${definitionKey}" missing from header partial (or siblingsBefore)`,
        );
      }
    } else if (isPartialChromeRole(role)) {
      errors.push(
        `${folderName} (${s.cmsName || '?'}): unknown partial role "${role}" for "${definitionKey}"`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * For --only home runs: every section folder must have a conversion log
 * (siblings merged + targets that will be written). Call after sibling seed,
 * before processing --only targets, OR after the full loop with expected folders.
 *
 * @param {{
 *   allFolders: string[],
 *   sectionsDir: string,
 *   onlyFolders?: string[]|null,
 *   readConversion?: (abs: string) => Promise<object|null>,
 * }} opts
 */
export async function assertHomeConversionLogsComplete(opts) {
  const {
    allFolders,
    sectionsDir,
    onlyFolders = null,
    readConversion = readSectionConversion,
  } = opts;
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const missingFolders = [];
  const onlySet = onlyFolders?.length ? new Set(onlyFolders) : null;

  for (const folder of allFolders) {
    // Targets in --only will get logs this run; still require siblings to already have logs
    // (or be expanded into this run's convert set by the caller).
    if (onlySet?.has(folder)) continue;
    const conversion = await readConversion(path.join(sectionsDir, folder));
    if (!conversion?.components?.length) {
      missingFolders.push(folder);
      errors.push(
        `${folder}: missing section-conversion.json (required to keep a complete home presentation)`,
      );
    }
  }
  return { ok: errors.length === 0, errors, missingFolders };
}

/**
 * Throw a single Error with all coverage messages (for create:sectioncomponents).
 * @param {{ ok: boolean, errors: string[] }} result
 * @param {string} label
 */
export function throwIfCoverageFailed(result, label = 'Presentation coverage') {
  if (result.ok) return;
  const body = result.errors.map((e) => `  • ${e}`).join('\n');
  throw new Error(`${label} failed:\n${body}`);
}

/**
 * @param {string} definitionTs
 * @returns {string[]}
 */
export function parseContentItemNamesFromDefinitionText(definitionTs) {
  const text = String(definitionTs || '');
  /** @type {string[]} */
  const names = [];
  const itemsIdx = text.search(/\bitems\s*:\s*\[/);
  if (itemsIdx < 0) return names;
  const slice = text.slice(itemsIdx);
  for (const m of slice.matchAll(/\bname\s*:\s*["']([^"']+)["']/g)) {
    names.push(m[1]);
  }
  return [...new Set(names)];
}

/**
 * Find presentation children whose datasourceItem is missing from that package's content.items.
 * @param {Array<{ definitionKey?: string, children?: Array<{ definitionKey?: string, datasourceItem?: string, children?: object[] }> }>} renderings
 * @param {Map<string, Set<string>>} contentNamesByKey
 * @returns {Array<{ parentKey: string, definitionKey: string, datasourceItem: string }>}
 */
export function collectPresentationDatasourceMismatches(
  renderings,
  contentNamesByKey,
) {
  /** @type {Array<{ parentKey: string, definitionKey: string, datasourceItem: string }>} */
  const mismatches = [];
  const walk = (nodes, parentKey) => {
    for (const n of nodes || []) {
      const key = String(n?.definitionKey || '');
      const ds = String(n?.datasourceItem || '').trim();
      if (key && ds) {
        const names = contentNamesByKey.get(key);
        if (names && names.size > 0 && !names.has(ds)) {
          mismatches.push({
            parentKey: parentKey || '(root)',
            definitionKey: key,
            datasourceItem: ds,
          });
        }
      }
      if (Array.isArray(n?.children) && n.children.length) {
        walk(n.children, key || parentKey);
      }
    }
  };
  walk(renderings, '');
  return mismatches;
}

/**
 * Warn when presentation wires datasourceItem names absent from the child definition seeds.
 * Catches cross-page package clobber leftover presentation children.
 *
 * @param {object[]} renderings home / page renderings with nested children
 * @param {Array<{ definitionKey?: string, contentItemNames?: string[], sources?: { definition?: string } }>} components
 * @param {{ readDefinition?: (relPath: string) => string|null }} [opts]
 * @returns {Array<{ parentKey: string, definitionKey: string, datasourceItem: string }>}
 */
export function warnPresentationDatasourceContentMismatches(
  renderings,
  components,
  opts = {},
) {
  /** @type {Map<string, Set<string>>} */
  const contentNamesByKey = new Map();
  for (const c of components || []) {
    const key = String(c?.definitionKey || '').trim();
    if (!key) continue;
    if (!contentNamesByKey.has(key)) contentNamesByKey.set(key, new Set());
    const set = contentNamesByKey.get(key);
    for (const n of c.contentItemNames || []) {
      if (n) set.add(String(n));
    }
    if (set.size === 0 && c.sources?.definition && opts.readDefinition) {
      try {
        const text = opts.readDefinition(c.sources.definition);
        for (const n of parseContentItemNamesFromDefinitionText(text || '')) {
          set.add(n);
        }
      } catch {
        /* ignore */
      }
    }
  }

  const mismatches = collectPresentationDatasourceMismatches(
    renderings,
    contentNamesByKey,
  );
  for (const m of mismatches) {
    console.warn(
      `  ⚠ Presentation: datasourceItem "${m.datasourceItem}" not in content.items for ${m.definitionKey} (under ${m.parentKey}) — child package was likely overwritten or seeds drifted`,
    );
  }
  if (mismatches.length) {
    console.warn(
      `  ⚠ Presentation: ${mismatches.length} datasourceItem ↔ content.items mismatch(es) — re-run create:sectioncomponents after page-scoped name reuse so each page gets its own child package`,
    );
  }
  return mismatches;
}
