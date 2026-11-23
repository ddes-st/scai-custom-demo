/**
 * Playwright / offline helpers: classify continuous-marquee surface before
 * screenshot normalize resets large translates.
 *
 * Surfaces:
 * - band-ticker: short full-bleed band; static bg; overflowing nowrap text scrolls
 * - item-rail: logo/badge row; items scroll as a track
 */

/**
 * @typedef {{
 *   kind: 'continuous-marquee'|'none',
 *   surface: 'band-ticker'|'item-rail'|'unknown',
 *   scrollingSubtree: 'text-track'|'item-track'|'unknown',
 *   clonesAreNotContent: boolean,
 *   controls: 'none',
 *   loop: boolean,
 *   evidence: string[],
 *   overflowRatio: number|null,
 *   bandHeightPx: number|null,
 *   fullBleed: boolean,
 * }} MotionGeometryResult
 */

const BAND_HEIGHT_MAX_PX = 96;
const FULL_BLEED_RATIO = 0.92;
const OVERFLOW_EPS = 2;

/**
 * Pure classifier from probe measurements (unit-testable offline).
 * @param {{
 *   rootWidth?: number,
 *   rootHeight?: number,
 *   viewportWidth?: number,
 *   overflowRatio?: number,
 *   hasHorizontalOverflow?: boolean,
 *   hasInfiniteAnimation?: boolean,
 *   transformDeltaTx?: number,
 *   imgCount?: number,
 *   textLen?: number,
 *   bgOnRoot?: boolean,
 *   scrollOnDescendant?: boolean,
 *   nowrapText?: boolean,
 * }} raw
 * @returns {MotionGeometryResult}
 */
export function classifyMotionGeometry(raw) {
  /** @type {string[]} */
  const evidence = [];
  const rootW = Number(raw?.rootWidth) || 0;
  const rootH = Number(raw?.rootHeight) || 0;
  const vpW = Number(raw?.viewportWidth) || rootW || 0;
  const overflowRatio =
    raw?.overflowRatio != null && Number.isFinite(Number(raw.overflowRatio))
      ? Number(raw.overflowRatio)
      : null;
  const hasOverflow =
    raw?.hasHorizontalOverflow === true ||
    (overflowRatio != null && overflowRatio > 1.01);
  const imgCount = Number(raw?.imgCount) || 0;
  const textLen = Number(raw?.textLen) || 0;
  const fullBleed =
    vpW > 0 && rootW >= vpW * FULL_BLEED_RATIO;
  const shortBand = rootH > 0 && rootH <= BAND_HEIGHT_MAX_PX;
  const bgOnRoot = raw?.bgOnRoot === true;
  const nowrapText = raw?.nowrapText === true;
  const hasAnim =
    raw?.hasInfiniteAnimation === true ||
    (Math.abs(Number(raw?.transformDeltaTx) || 0) >= 4);

  if (fullBleed) evidence.push('full-bleed-band');
  if (shortBand) evidence.push('short-band-height');
  if (bgOnRoot) evidence.push('bg-on-root');
  if (hasOverflow) evidence.push('horizontal-overflow');
  if (hasAnim) evidence.push('live-translate-or-infinite-anim');
  if (nowrapText) evidence.push('nowrap-text');
  if (imgCount >= 3) evidence.push('multi-image-rail');
  if (textLen >= 24 && imgCount <= 1) evidence.push('text-heavy-track');

  const bandTicker =
    shortBand &&
    fullBleed &&
    (bgOnRoot || nowrapText || textLen >= 24) &&
    (hasOverflow || hasAnim || nowrapText) &&
    imgCount <= 2;

  const itemRail =
    !bandTicker &&
    (imgCount >= 3 || (hasOverflow && imgCount >= 2)) &&
    (hasOverflow || hasAnim);

  /** @type {MotionGeometryResult['surface']} */
  let surface = 'unknown';
  /** @type {MotionGeometryResult['scrollingSubtree']} */
  let scrollingSubtree = 'unknown';
  /** @type {MotionGeometryResult['kind']} */
  let kind = 'none';

  if (bandTicker) {
    surface = 'band-ticker';
    scrollingSubtree =
      raw?.scrollOnDescendant === false && bgOnRoot
        ? 'text-track'
        : 'text-track';
    kind = 'continuous-marquee';
    evidence.push('surface:band-ticker');
  } else if (itemRail) {
    surface = 'item-rail';
    scrollingSubtree = 'item-track';
    kind = 'continuous-marquee';
    evidence.push('surface:item-rail');
  } else if (hasOverflow || hasAnim) {
    kind = 'continuous-marquee';
    surface = textLen >= 40 && imgCount <= 1 ? 'band-ticker' : 'unknown';
    scrollingSubtree = surface === 'band-ticker' ? 'text-track' : 'unknown';
    if (surface === 'band-ticker') evidence.push('surface:band-ticker-soft');
  }

  return {
    kind,
    surface,
    scrollingSubtree,
    clonesAreNotContent: kind === 'continuous-marquee',
    controls: 'none',
    loop: kind === 'continuous-marquee',
    evidence,
    overflowRatio,
    bandHeightPx: rootH > 0 ? Math.round(rootH) : null,
    fullBleed,
  };
}

/**
 * Probe live page for marquee/ticker geometry. Call BEFORE marquee transform reset.
 * Browser fn is fully inlined (no module closures) for page.evaluate.
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @returns {Promise<MotionGeometryResult|null>}
 */
export async function probeMotionGeometry(page, selector) {
  if (!page || !selector) return null;
  const raw = await page.evaluate(async (sel) => {
    const OVERFLOW_EPS = 2;
    let root;
    try {
      root = document.querySelector(sel);
    } catch {
      return null;
    }
    if (!(root instanceof Element)) return null;

    const vpW = window.innerWidth || document.documentElement.clientWidth || 0;
    const rect = root.getBoundingClientRect();
    const cs = window.getComputedStyle(root);
    const bg =
      cs.backgroundImage !== 'none' ||
      (cs.backgroundColor &&
        cs.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        cs.backgroundColor !== 'transparent');

    /** @type {Element[]} */
    const overflowCandidates = [];
    const walk = (el, depth) => {
      if (!(el instanceof Element) || depth > 8) return;
      const s = window.getComputedStyle(el);
      const ox = s.overflowX;
      if (
        (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'overlay') &&
        el.scrollWidth > el.clientWidth + OVERFLOW_EPS
      ) {
        overflowCandidates.push(el);
      }
      for (const child of el.children) walk(child, depth + 1);
    };
    walk(root, 0);

    let maxOverflowRatio = 1;
    let hasHorizontalOverflow = false;
    for (const el of overflowCandidates) {
      const ratio = el.clientWidth > 0 ? el.scrollWidth / el.clientWidth : 1;
      if (ratio > maxOverflowRatio) maxOverflowRatio = ratio;
      hasHorizontalOverflow = true;
    }
    if (root.scrollWidth > root.clientWidth + OVERFLOW_EPS) {
      hasHorizontalOverflow = true;
      const ratio = root.clientWidth > 0 ? root.scrollWidth / root.clientWidth : 1;
      if (ratio > maxOverflowRatio) maxOverflowRatio = ratio;
    }

    const imgs = root.querySelectorAll('img');
    const text = (root.textContent || '').replace(/\s+/g, ' ').trim();

    let nowrapText = false;
    root.querySelectorAll('*').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const s = window.getComputedStyle(el);
      if (
        (s.whiteSpace === 'nowrap' || s.whiteSpace === 'pre') &&
        (el.textContent || '').trim().length >= 12
      ) {
        nowrapText = true;
      }
    });

    let hasInfiniteAnimation = false;
    /** @type {Element[]} */
    const animEls = [root, ...Array.from(root.querySelectorAll('*'))].slice(
      0,
      80,
    );
    for (const el of animEls) {
      try {
        const anims =
          typeof el.getAnimations === 'function' ? el.getAnimations() : [];
        for (const a of anims) {
          const effect = a.effect;
          const timing =
            effect && typeof effect.getTiming === 'function'
              ? effect.getTiming()
              : null;
          if (
            a.playState === 'running' &&
            (timing?.iterations === Infinity ||
              String(timing?.iterations) === 'Infinity')
          ) {
            hasInfiniteAnimation = true;
          }
        }
      } catch {
        /* ignore */
      }
      const csEl = window.getComputedStyle(el);
      if (/infinite/i.test(csEl.animationIterationCount || '')) {
        hasInfiniteAnimation = true;
      }
    }

    const readTx = (el) => {
      const t = window.getComputedStyle(el).transform;
      if (!t || t === 'none') return 0;
      const m = t.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([-\d.]+)/);
      if (m) return Number(m[1]) || 0;
      const m3 = t.match(/translate3d\(\s*([-\d.]+)/);
      if (m3) return Number(m3[1]) || 0;
      const mx = t.match(/translateX\(\s*([-\d.]+)/);
      if (mx) return Number(mx[1]) || 0;
      return 0;
    };

    let maxTx0 = 0;
    for (const el of animEls.slice(0, 40)) {
      maxTx0 = Math.max(maxTx0, Math.abs(readTx(el)));
    }
    await new Promise((r) => setTimeout(r, 280));
    let maxTx1 = 0;
    for (const el of animEls.slice(0, 40)) {
      maxTx1 = Math.max(maxTx1, Math.abs(readTx(el)));
    }
    const transformDeltaTx = Math.abs(maxTx1 - maxTx0);

    const scrollOnDescendant =
      overflowCandidates.length > 0 && !overflowCandidates.includes(root);

    return {
      rootWidth: rect.width,
      rootHeight: rect.height,
      viewportWidth: vpW,
      overflowRatio: maxOverflowRatio,
      hasHorizontalOverflow,
      hasInfiniteAnimation,
      transformDeltaTx,
      imgCount: imgs.length,
      textLen: text.length,
      bgOnRoot: Boolean(bg),
      scrollOnDescendant,
      nowrapText,
    };
  }, selector);
  if (!raw) return null;
  return classifyMotionGeometry(raw);
}

/**
 * Merge per-device probes into a single layout.motion object for section-information.
 * Prefers band-ticker when any device reports it; else item-rail; else first continuous.
 * @param {Record<string, MotionGeometryResult|null|undefined>} byDevice
 * @returns {object|null}
 */
export function mergeMotionGeometryByDevice(byDevice) {
  const entries = Object.entries(byDevice || {}).filter(
    ([, v]) => v && typeof v === 'object',
  );
  if (!entries.length) return null;

  const band = entries.find(([, v]) => v.surface === 'band-ticker');
  const rail = entries.find(([, v]) => v.surface === 'item-rail');
  const cont = entries.find(([, v]) => v.kind === 'continuous-marquee');
  const pick = (band || rail || cont || entries[0])[1];

  if (!pick || pick.kind === 'none') {
    // Still record soft evidence when present
    const anyEvidence = entries.flatMap(([, v]) => v.evidence || []);
    if (!anyEvidence.length) return null;
  }

  if (pick.kind === 'none' && pick.surface === 'unknown') return null;

  return {
    kind: pick.kind === 'none' ? 'continuous-marquee' : pick.kind,
    surface: pick.surface,
    scrollingSubtree: pick.scrollingSubtree,
    clonesAreNotContent: true,
    controls: 'none',
    loop: true,
    evidence: [...new Set(pick.evidence || [])],
    ...(pick.bandHeightPx != null ? { bandHeightPx: pick.bandHeightPx } : {}),
    fullBleed: Boolean(pick.fullBleed),
  };
}
