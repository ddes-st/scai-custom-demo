/**
 * Site-generic sticky header stack vs true overlay classification.
 * Geometry / occupancy first — never brand cmsNames or site-specific classes.
 */

/**
 * @typedef {{
 *   id: string,
 *   top: number,
 *   bottom: number,
 *   height: number,
 *   type?: string,
 *   roleDialog?: boolean,
 *   pinnedEdgeHint?: 'top'|'bottom'|null,
 * }} ChromeBandInput
 */

/**
 * @typedef {{
 *   track: 'header'|'overlay',
 *   isOverlay: boolean,
 *   chromeKind: 'header-stack'|'float-overlay',
 *   reason: string,
 * }} ChromeKindResult
 */

const CLEARANCE_TOL_PX = 12;
const STACK_ADJ_TOL_PX = 8;
const TOP_STRIP_MAX_PX = 120;

/**
 * @param {number} a
 * @param {number} b
 * @param {number} tol
 */
function near(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

/**
 * Forced float-overlay (cookie/CMP/dialog/bottom pin) — site-generic signals only.
 * @param {ChromeBandInput} band
 * @param {{ mainTop: number, viewportHeight: number }} ctx
 * @returns {boolean}
 */
export function isForcedFloatOverlay(band, ctx) {
  const type = String(band.type || '').toLowerCase();
  if (/cookie|consent|privacy|cmp|gdpr/.test(type)) return true;
  if (band.roleDialog === true) return true;
  if (band.pinnedEdgeHint === 'bottom') return true;

  const vh = ctx.viewportHeight > 0 ? ctx.viewportHeight : 900;
  const mainTop = Number.isFinite(ctx.mainTop) ? ctx.mainTop : 0;
  const h = Math.max(0, Number(band.height) || 0);
  const top = Number(band.top) || 0;
  const bottom = Number(band.bottom) || top + h;

  // Bottom-pinned strip (lower third, not a short top chrome band).
  if (top > vh * 0.45 && bottom > vh * 0.7) return true;

  // Centered / mid-viewport float that covers content below main clearance.
  if (top > TOP_STRIP_MAX_PX && h >= 80 && bottom > mainTop + 20 && top < vh * 0.85) {
    return true;
  }

  return false;
}

/**
 * Build contiguous top stacks by adjacency (band[i].top ≈ sum of prior heights).
 * @param {ChromeBandInput[]} bands
 * @param {number} [tol]
 * @returns {ChromeBandInput[][]}
 */
export function buildTopStacks(bands, tol = STACK_ADJ_TOL_PX) {
  const topish = bands
    .filter((b) => (Number(b.top) || 0) <= TOP_STRIP_MAX_PX + 40)
    .slice()
    .sort((a, b) => (Number(a.top) || 0) - (Number(b.top) || 0));

  /** @type {ChromeBandInput[][]} */
  const stacks = [];
  /** @type {ChromeBandInput[]} */
  let current = [];
  let runningH = 0;

  for (const band of topish) {
    const top = Number(band.top) || 0;
    const h = Math.max(0, Number(band.height) || Math.max(0, (Number(band.bottom) || 0) - top));
    if (current.length === 0) {
      if (top <= TOP_STRIP_MAX_PX) {
        current = [band];
        runningH = h;
      }
      continue;
    }
    if (near(top, runningH, tol)) {
      current.push(band);
      runningH += h;
    } else {
      stacks.push(current);
      current = top <= TOP_STRIP_MAX_PX ? [band] : [];
      runningH = current.length ? h : 0;
    }
  }
  if (current.length) stacks.push(current);
  return stacks;
}

/**
 * Whether main content clears under a stack height.
 * @param {number} stackH
 * @param {{ mainTop: number, bodyPadTop?: number, occupancyReserved?: boolean }} ctx
 */
export function stackClearsContent(stackH, ctx) {
  if (!(stackH > 0)) return false;
  if (ctx.occupancyReserved === true) return true;
  const mainTop = Number(ctx.mainTop);
  const bodyPad = Number(ctx.bodyPadTop) || 0;
  if (Number.isFinite(mainTop) && near(mainTop, stackH, CLEARANCE_TOL_PX)) return true;
  if (bodyPad > 0 && near(bodyPad, stackH, CLEARANCE_TOL_PX)) return true;
  return false;
}

/**
 * Classify chrome bands into header-stack vs float-overlay.
 *
 * @param {ChromeBandInput[]} bands
 * @param {{
 *   mainTop: number,
 *   bodyPadTop?: number,
 *   viewportHeight: number,
 *   occupancyReserved?: boolean,
 * }} ctx
 * @returns {Map<string, ChromeKindResult>}
 */
export function classifyChromeBands(bands, ctx) {
  /** @type {Map<string, ChromeKindResult>} */
  const out = new Map();
  if (!Array.isArray(bands) || bands.length === 0) return out;

  const vh = ctx.viewportHeight > 0 ? ctx.viewportHeight : 900;
  const mainTop = Number.isFinite(ctx.mainTop) ? ctx.mainTop : 0;

  /** @type {ChromeBandInput[]} */
  const forced = [];
  /** @type {ChromeBandInput[]} */
  const candidates = [];

  for (const band of bands) {
    if (isForcedFloatOverlay(band, { mainTop, viewportHeight: vh })) {
      forced.push(band);
    } else {
      candidates.push(band);
    }
  }

  for (const band of forced) {
    out.set(band.id, {
      track: 'overlay',
      isOverlay: true,
      chromeKind: 'float-overlay',
      reason: 'forced-float (dialog/cmp/bottom/cover)',
    });
  }

  const stacks = buildTopStacks(candidates);
  /** @type {Set<string>} */
  const inClearedStack = new Set();

  for (const stack of stacks) {
    const stackH = stack.reduce((sum, b) => {
      const top = Number(b.top) || 0;
      const h = Math.max(0, Number(b.height) || Math.max(0, (Number(b.bottom) || 0) - top));
      return sum + h;
    }, 0);

    if (stackClearsContent(stackH, ctx)) {
      for (const band of stack) {
        inClearedStack.add(band.id);
        out.set(band.id, {
          track: 'header',
          isOverlay: false,
          chromeKind: 'header-stack',
          reason: `header-stack clearance stackH=${Math.round(stackH)}`,
        });
      }
    }
  }

  for (const band of candidates) {
    if (out.has(band.id)) continue;
    // Top strip that did not clear content → true float over hero/content.
    out.set(band.id, {
      track: 'overlay',
      isOverlay: true,
      chromeKind: 'float-overlay',
      reason: 'top-float without content clearance',
    });
  }

  return out;
}

/**
 * Apply classification onto section-like objects (mutates).
 * Expects cssTop/cssBottom/cssHeight or rect; uses selector|cmsName as id fallback.
 *
 * @param {Array<object>} sections
 * @param {{ mainTop: number, bodyPadTop?: number, viewportHeight: number, occupancyReserved?: boolean }} ctx
 * @returns {Array<object>}
 */
export function stampChromeKindOnSections(sections, ctx) {
  if (!Array.isArray(sections)) return sections;

  const bands = sections.map((s, i) => {
    const top = Number(s.cssTop ?? s.top ?? s.rect?.y0 ?? 0);
    const bottom = Number(s.cssBottom ?? s.bottom ?? s.rect?.y1 ?? top);
    const height = Number(s.cssHeight ?? s.height ?? Math.max(0, bottom - top));
    const type = String(s.type || s.componentType || '').toLowerCase();
    const blob = `${s.cmsName || ''} ${type} ${s.folderName || ''}`.toLowerCase();
    const roleDialog =
      s.roleDialog === true ||
      /dialog|alertdialog/.test(String(s.role || '').toLowerCase()) ||
      (/cookie|consent|cmp|gdpr|privacy/.test(blob) && /dialog|banner|modal/.test(blob));
    let pinnedEdgeHint = s.pinnedEdgeHint || null;
    if (!pinnedEdgeHint && ctx.viewportHeight > 0) {
      if (top > ctx.viewportHeight * 0.45) pinnedEdgeHint = 'bottom';
      else if (top <= TOP_STRIP_MAX_PX) pinnedEdgeHint = 'top';
    }
    return {
      id: String(s.selector || s.cmsName || `band-${i}`),
      top,
      bottom,
      height,
      type: type || (roleDialog ? 'cookie-banner' : ''),
      roleDialog,
      pinnedEdgeHint,
      _section: s,
    };
  });

  const classified = classifyChromeBands(bands, ctx);
  for (const band of bands) {
    const result = classified.get(band.id);
    if (!result) continue;
    const s = band._section;
    s.track = result.track;
    s.isOverlay = result.isOverlay;
    s.chromeKind = result.chromeKind;
    s.chromeKindReason = result.reason;
    if (result.track === 'header') {
      s.hints = [...new Set([...(s.hints || []).filter((h) => h !== 'overlay'), 'header', 'sticky'])];
    }
  }
  return sections;
}

/**
 * Drop nested header-stack twins: when one header band's rect is mostly contained
 * in another, keep the outer landmark and remove the inner (e.g. region-header-inner
 * inside header.region). Sibling stacked strips (announcement above nav) are kept.
 *
 * @param {Array<object>} sections
 * @param {{ containmentRatio?: number, domContains?: boolean[][] }} [opts]
 *   domContains[i][j] === true when sections[i]'s element contains sections[j]'s (optional).
 * @returns {Array<object>}
 */
export function dropNestedHeaderStackSections(sections, opts = {}) {
  if (!Array.isArray(sections) || sections.length < 2) return sections;
  const ratioNeed = Number(opts.containmentRatio) > 0 ? Number(opts.containmentRatio) : 0.85;
  const domContains = Array.isArray(opts.domContains) ? opts.domContains : null;

  const isHeaderStack = (s) =>
    String(s?.chromeKind || '').toLowerCase() === 'header-stack' ||
    String(s?.track || '').toLowerCase() === 'header';

  const rectOf = (s) => {
    const top = Number(s.cssTop ?? s.top ?? s.rect?.y0 ?? 0);
    const bottom = Number(s.cssBottom ?? s.bottom ?? s.rect?.y1 ?? top);
    const left = Number(s.cssLeft ?? s.left ?? s.rect?.x0 ?? 0);
    const right = Number(s.cssRight ?? s.right ?? s.rect?.x1 ?? left);
    return { top, bottom, left, right };
  };

  const areaOf = (r) => Math.max(0, r.bottom - r.top) * Math.max(0, r.right - r.left);

  /** Fraction of `inner` area that lies inside `outer`. */
  const containmentRatio = (inner, outer) => {
    const interTop = Math.max(inner.top, outer.top);
    const interBottom = Math.min(inner.bottom, outer.bottom);
    const interLeft = Math.max(inner.left, outer.left);
    const interRight = Math.min(inner.right, outer.right);
    const inter =
      Math.max(0, interBottom - interTop) * Math.max(0, interRight - interLeft);
    const a = areaOf(inner);
    return a > 0 ? inter / a : 0;
  };

  const heightOf = (s) => {
    const r = rectOf(s);
    return Math.max(0, r.bottom - r.top) || Number(s.cssHeight ?? s.height ?? 0);
  };

  const preferKeepAsOuter = (a, b) => {
    const landmarkScore = (s) => {
      const name = String(s.cmsName || '');
      if (/^header$/i.test(name)) return 3;
      if (/header/i.test(name)) return 2;
      if (/nav/i.test(name)) return 1;
      return 0;
    };
    const la = landmarkScore(a);
    const lb = landmarkScore(b);
    if (la !== lb) return la > lb;
    return heightOf(a) >= heightOf(b);
  };

  /** @type {Set<number>} */
  const drop = new Set();
  const n = sections.length;
  for (let i = 0; i < n; i++) {
    if (!isHeaderStack(sections[i]) || drop.has(i)) continue;
    for (let j = i + 1; j < n; j++) {
      if (!isHeaderStack(sections[j]) || drop.has(j)) continue;
      const a = sections[i];
      const b = sections[j];
      const ra = rectOf(a);
      const rb = rectOf(b);
      const aInB = containmentRatio(ra, rb) >= ratioNeed;
      const bInA = containmentRatio(rb, ra) >= ratioNeed;
      const aDomInB = Boolean(domContains?.[j]?.[i]);
      const bDomInA = Boolean(domContains?.[i]?.[j]);
      const dropA = aInB || aDomInB;
      const dropB = bInA || bDomInA;
      if (!dropA && !dropB) continue;
      if (dropA && !dropB) {
        drop.add(i);
      } else if (dropB && !dropA) {
        drop.add(j);
      } else if (preferKeepAsOuter(a, b)) {
        drop.add(j);
      } else {
        drop.add(i);
      }
    }
  }

  if (!drop.size) return sections;
  return sections
    .filter((_, idx) => !drop.has(idx))
    .map((s, order) => ({ ...s, order }));
}

/**
 * True when section is chrome export (header stack or float overlay).
 * @param {{ track?: string, isOverlay?: boolean }|null|undefined} s
 */
export function isChromeExportTrack(s) {
  const track = String(s?.track || '').toLowerCase();
  return track === 'overlay' || track === 'header' || s?.isOverlay === true;
}

/**
 * True when section is a float overlay (not sticky header).
 * @param {{ track?: string, isOverlay?: boolean, chromeKind?: string }|null|undefined} s
 */
export function isFloatOverlaySection(s) {
  if (s?.chromeKind === 'header-stack' || String(s?.track || '').toLowerCase() === 'header') {
    return false;
  }
  return s?.isOverlay === true || String(s?.track || '').toLowerCase() === 'overlay';
}
