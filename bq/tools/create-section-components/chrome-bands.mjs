/**
 * Chrome band catalogue / cut helpers for section role inference.
 */

const OTHER_ALIASES = new Set([
  'cookie',
  'partial-cookie',
  'normal',
  'page',
  'empty',
  'other',
  '',
]);

/** @param {unknown} raw */
export function normalizeChromeCatalogue(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'header' || s === 'partial-header') return 'header';
  if (s === 'footer' || s === 'partial-footer') return 'footer';
  if (s === 'breadcrumb') return 'breadcrumb';
  if (OTHER_ALIASES.has(s)) return 'other';
  return 'other';
}

/**
 * @param {number} sectionIndex
 * @param {number} sectionCount
 * @returns {'early'|'mid'|'late'}
 */
export function positionBand(sectionIndex, sectionCount) {
  const count = Number(sectionCount) || 0;
  if (count <= 0) return 'mid';
  // Treat index as 1-based if >= 1, else 0-based.
  const oneBased = sectionIndex >= 1 ? sectionIndex : sectionIndex + 1;
  if (oneBased <= 2) return 'early';
  if (count >= 3 && oneBased >= count - 1) return 'late';
  return 'mid';
}

/**
 * @param {{
 *   sharedAcrossPages?: unknown,
 *   pageCount?: unknown,
 *   instancePages?: unknown,
 *   sectionIndex: number,
 *   sectionCount: number,
 * }} args
 */
export function buildChromeEvidence({
  sharedAcrossPages,
  pageCount,
  instancePages,
  sectionIndex,
  sectionCount,
}) {
  return {
    sharedAcrossPages,
    pageCount,
    instancePages,
    sectionIndex,
    sectionCount,
    positionBand: positionBand(sectionIndex, sectionCount),
  };
}

/**
 * @param {Array<{ index: number, chromeCatalogue: string }>} sections
 * @returns {{ headerCut: number|null, footerCut: number|null }}
 */
export function computeChromeBandCuts(sections) {
  let H = null;
  let F = null;
  for (const s of sections || []) {
    const cat = normalizeChromeCatalogue(s?.chromeCatalogue);
    const idx = Number(s?.index);
    if (!Number.isFinite(idx)) continue;
    if (cat === 'header' || cat === 'breadcrumb') {
      if (H == null || idx > H) H = idx;
    } else if (cat === 'footer') {
      if (F == null || idx < F) F = idx;
    }
  }
  if (H != null && F != null && H >= F) {
    H = F - 1;
    if (H < 0) H = null;
  }
  return { headerCut: H, footerCut: F };
}

/**
 * @param {number} index
 * @param {{ headerCut?: number|null, footerCut?: number|null }} cuts
 * @returns {'partial-header'|'partial-footer'|'page'}
 */
export function resolveBandRole(index, cuts) {
  const { headerCut = null, footerCut = null } = cuts || {};
  if (headerCut != null && index <= headerCut) return 'partial-header';
  if (footerCut != null && index >= footerCut) return 'partial-footer';
  return 'page';
}

/**
 * @param {unknown} catalogue
 * @returns {'partial-header'|'partial-footer'|'page'}
 */
export function catalogueToProvisionalRole(catalogue) {
  const cat = normalizeChromeCatalogue(catalogue);
  if (cat === 'header' || cat === 'breadcrumb') return 'partial-header';
  if (cat === 'footer') return 'partial-footer';
  return 'page';
}

/**
 * Map each section index → band landing role after cuts.
 * @param {Array<{ index: number, chromeCatalogue: string, definitionKey?: string }>} sections
 * @returns {{
 *   cuts: { headerCut: number|null, footerCut: number|null },
 *   byDefinitionKey: Map<string, 'partial-header'|'partial-footer'|'page'>,
 * }}
 */
export function mapChromeBandRoles(sections) {
  const cuts = computeChromeBandCuts(sections);
  /** @type {Map<string, 'partial-header'|'partial-footer'|'page'>} */
  const byDefinitionKey = new Map();
  for (const s of sections || []) {
    const key = String(s?.definitionKey || '').trim();
    if (!key) continue;
    byDefinitionKey.set(key, resolveBandRole(Number(s.index), cuts));
  }
  return { cuts, byDefinitionKey };
}
