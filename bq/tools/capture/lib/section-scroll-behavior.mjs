/**
 * Probe sticky / hide-on-scroll / scroll-reveal behavior for a section element.
 * Site-agnostic: computed style + geometry samples only.
 */

/**
 * @typedef {{
 *   scrollY: number,
 *   visible: boolean,
 *   top: number,
 *   bottom: number,
 *   height: number,
 * }} ScrollSample
 */

/**
 * @typedef {{
 *   cssPosition: string,
 *   sticky: boolean,
 *   stickyTopPx: number|null,
 *   visibleAtTop: boolean,
 *   visiblePastOneViewport: boolean,
 *   hidesOnScrollDown: boolean,
 *   showsOnScrollUp: boolean,
 *   hideAfterScrollYPx: number|null,
 *   hideAfterViewports: number|null,
 *   showAfterScrollYPx: number|null,
 *   pinnedEdge: 'top'|'bottom'|null,
 *   evidence: string[],
 * }} ScrollBehaviorDevice
 */

/**
 * Cross-section sticky stack facts (same pinned edge).
 * @typedef {{
 *   edge: 'top'|'bottom',
 *   restingInsetPx: number,
 *   precedingMayCollapse: boolean,
 *   precedingSlots: string[],
 *   stackIndex: number,
 *   stackSize: number,
 * }} ChromeStackInfo
 */

/**
 * @param {number|null|undefined} px
 * @param {number} vh
 * @returns {number|null}
 */
export function scrollYToViewports(px, vh) {
  if (px == null || !Number.isFinite(px) || !Number.isFinite(vh) || vh <= 0) {
    return null;
  }
  return Math.round((px / vh) * 100) / 100;
}

/**
 * One-line summary for AI prompts from a device scrollBehavior block.
 * @param {Partial<ScrollBehaviorDevice>|null|undefined} sb
 * @returns {string}
 */
export function formatScrollBehaviorSummary(sb) {
  if (!sb || typeof sb !== 'object') return '(none)';
  const pos = String(sb.cssPosition || '').trim() || 'static';
  const edge = sb.pinnedEdge ? String(sb.pinnedEdge) : '';
  const pin =
    sb.sticky || pos === 'fixed' || pos === 'sticky'
      ? edge === 'bottom'
        ? 'bottom-fixed'
        : pos === 'sticky'
          ? 'top-sticky'
          : 'top-fixed'
      : pos;

  const stickyTop =
    sb.stickyTopPx != null && Number.isFinite(Number(sb.stickyTopPx))
      ? `; stickyTopPx=${Math.round(Number(sb.stickyTopPx))}`
      : '';

  if (sb.hidesOnScrollDown) {
    const px = sb.hideAfterScrollYPx;
    const vp = sb.hideAfterViewports;
    const thresh =
      px != null && Number.isFinite(px)
        ? vp != null && Number.isFinite(vp)
          ? ` after ~${Math.round(px)}px (~${vp}vh)`
          : ` after ~${Math.round(px)}px`
        : '';
    const reveal = sb.showsOnScrollUp ? '; shows on scroll up' : '';
    return `${pin}; hides on scroll down${thresh}${reveal}${stickyTop}`;
  }

  if (sb.sticky || pos === 'fixed' || pos === 'sticky') {
    return `${pin}; remains while scrolling${stickyTop}`;
  }
  return `${pin}; not sticky`;
}

/**
 * Whether a device scrollBehavior block is sticky/fixed chrome on an edge.
 * @param {Partial<ScrollBehaviorDevice>|null|undefined} sb
 * @returns {boolean}
 */
export function isPinnedChromeBehavior(sb) {
  if (!sb || typeof sb !== 'object') return false;
  const pos = String(sb.cssPosition || '').trim();
  return Boolean(sb.sticky || pos === 'fixed' || pos === 'sticky');
}

/**
 * Build chromeStack for one section given all page sections (same device).
 * @param {{
 *   slot: string,
 *   index?: number,
 *   y0?: number|null,
 *   scrollBehavior?: Partial<ScrollBehaviorDevice>|null,
 * }[]} bands
 * @param {string} selfSlot
 * @returns {ChromeStackInfo|null}
 */
export function deriveChromeStackForSlot(bands, selfSlot) {
  const self = bands.find((b) => b.slot === selfSlot);
  if (!self || !isPinnedChromeBehavior(self.scrollBehavior)) return null;

  const edge =
    self.scrollBehavior?.pinnedEdge === 'bottom' ? 'bottom' : 'top';

  /** @type {typeof bands} */
  const sameEdge = bands.filter((b) => {
    if (!isPinnedChromeBehavior(b.scrollBehavior)) return false;
    const e = b.scrollBehavior?.pinnedEdge === 'bottom' ? 'bottom' : 'top';
    return e === edge;
  });

  sameEdge.sort((a, b) => {
    const ay =
      a.y0 != null && Number.isFinite(Number(a.y0))
        ? Number(a.y0)
        : a.scrollBehavior?.stickyTopPx != null &&
            Number.isFinite(Number(a.scrollBehavior.stickyTopPx))
          ? Number(a.scrollBehavior.stickyTopPx)
          : Number(a.index) || 0;
    const by =
      b.y0 != null && Number.isFinite(Number(b.y0))
        ? Number(b.y0)
        : b.scrollBehavior?.stickyTopPx != null &&
            Number.isFinite(Number(b.scrollBehavior.stickyTopPx))
          ? Number(b.scrollBehavior.stickyTopPx)
          : Number(b.index) || 0;
    if (ay !== by) return ay - by;
    return (Number(a.index) || 0) - (Number(b.index) || 0);
  });

  const stackIndex = sameEdge.findIndex((b) => b.slot === selfSlot);
  if (stackIndex < 0) return null;

  const preceding = sameEdge.slice(0, stackIndex);
  const restingInsetPx =
    self.scrollBehavior?.stickyTopPx != null &&
    Number.isFinite(Number(self.scrollBehavior.stickyTopPx))
      ? Math.round(Number(self.scrollBehavior.stickyTopPx))
      : 0;

  const precedingMayCollapse = preceding.some(
    (b) => b.scrollBehavior?.hidesOnScrollDown === true,
  );

  return {
    edge,
    restingInsetPx,
    precedingMayCollapse,
    precedingSlots: preceding.map((b) => b.slot),
    stackIndex,
    stackSize: sameEdge.length,
  };
}

/**
 * Attach `chromeStack` (per device) onto each section-information-like object.
 * Mutates and returns the same array of infos.
 *
 * @param {Array<{
 *   folderName?: string,
 *   index?: number,
 *   rect?: { y0?: number|null },
 *   scrollBehavior?: Record<string, Partial<ScrollBehaviorDevice>>,
 *   chromeStack?: Record<string, ChromeStackInfo>,
 * }>} infos
 * @returns {typeof infos}
 */
export function enrichSectionInfosWithChromeStack(infos) {
  if (!Array.isArray(infos) || infos.length === 0) return infos;

  /** @type {Set<string>} */
  const deviceKeys = new Set();
  for (const info of infos) {
    const sb = info?.scrollBehavior;
    if (!sb || typeof sb !== 'object') continue;
    for (const key of Object.keys(sb)) {
      if (sb[key] && typeof sb[key] === 'object') deviceKeys.add(key);
    }
  }

  for (const device of deviceKeys) {
    const bands = infos.map((info) => ({
      slot: String(info.folderName || `section-${info.index}`),
      index: info.index,
      y0: info.rect?.y0 ?? null,
      scrollBehavior: info.scrollBehavior?.[device] || null,
    }));

    for (const info of infos) {
      const slot = String(info.folderName || `section-${info.index}`);
      const stack = deriveChromeStackForSlot(bands, slot);
      if (!stack) continue;
      if (!info.chromeStack || typeof info.chromeStack !== 'object') {
        info.chromeStack = {};
      }
      info.chromeStack[device] = stack;
    }
  }

  return infos;
}

/**
 * Pick desktop (or first) scrollBehavior block from section-information shape.
 * @param {object|null|undefined} info
 * @returns {Partial<ScrollBehaviorDevice>}
 */
export function pickDesktopScrollBehavior(info) {
  const sb = info?.scrollBehavior;
  if (!sb || typeof sb !== 'object') return {};
  if (sb.desktop && typeof sb.desktop === 'object') return sb.desktop;
  if (sb.desktopRegular && typeof sb.desktopRegular === 'object') {
    return sb.desktopRegular;
  }
  if (sb.desktopLarge && typeof sb.desktopLarge === 'object') {
    return sb.desktopLarge;
  }
  // Legacy: flat device fields on scrollBehavior itself
  if ('cssPosition' in sb || 'sticky' in sb || 'hidesOnScrollDown' in sb) {
    return sb;
  }
  return {};
}

/**
 * Derive hide/sticky flags from incremental scroll samples (Node-testable).
 * @param {{
 *   cssPosition: string,
 *   stickyTopPx: number|null,
 *   vh: number,
 *   samples: ScrollSample[],
 *   deep?: boolean,
 * }} raw
 * @returns {ScrollBehaviorDevice}
 */
export function analyzeScrollSamples(raw) {
  const cssPosition = String(raw?.cssPosition || 'static');
  const stickyTopPxIn = raw?.stickyTopPx;
  const stickyTopPx =
    stickyTopPxIn != null && Number.isFinite(stickyTopPxIn) ? stickyTopPxIn : null;
  const vh = Number(raw?.vh) > 0 ? Number(raw.vh) : 900;
  const samples = Array.isArray(raw?.samples) ? raw.samples : [];
  const deep = raw?.deep !== false;
  /** @type {string[]} */
  const evidence = [`css:${cssPosition}`];
  const cssSticky = cssPosition === 'sticky' || cssPosition === 'fixed';

  const atTop = samples[0] || {
    scrollY: 0,
    visible: false,
    top: 0,
    bottom: 0,
    height: 0,
  };

  if (!deep) {
    return {
      cssPosition,
      sticky: cssSticky,
      stickyTopPx: stickyTopPx,
      visibleAtTop: Boolean(atTop.visible),
      visiblePastOneViewport: cssSticky ? Boolean(atTop.visible) : false,
      hidesOnScrollDown: false,
      showsOnScrollUp: false,
      hideAfterScrollYPx: null,
      hideAfterViewports: null,
      showAfterScrollYPx: null,
      pinnedEdge: cssSticky ? 'top' : null,
      evidence: cssSticky ? [...evidence, 'css-only'] : evidence,
    };
  }

  const pastOneViewport = samples.find((s) => s.scrollY >= vh * 0.95) || null;
  const visiblePast = pastOneViewport ? Boolean(pastOneViewport.visible) : false;

  /** @type {number|null} */
  let hideAfterScrollYPx = null;
  if (atTop.visible) {
    for (const s of samples) {
      if (s.scrollY <= 4) continue;
      if (!s.visible) {
        hideAfterScrollYPx = Math.round(s.scrollY);
        break;
      }
    }
  }
  const hidesOnScrollDown = hideAfterScrollYPx != null;
  const hideAfterViewports = scrollYToViewports(hideAfterScrollYPx, vh);

  // Reveal on scroll-up: samples after the deepest point, moving back toward top
  /** @type {number|null} */
  let showAfterScrollYPx = null;
  let showsOnScrollUp = false;
  if (hidesOnScrollDown) {
    let sawHiddenDeep = false;
    for (const s of samples) {
      if (!sawHiddenDeep) {
        if (s.scrollY >= (hideAfterScrollYPx || 0) && !s.visible) {
          sawHiddenDeep = true;
        }
        continue;
      }
      // After marking deep-hidden, later samples with lower scrollY that are visible
      if (
        s.visible &&
        s.scrollY > 8 &&
        s.scrollY < (hideAfterScrollYPx || Infinity)
      ) {
        showsOnScrollUp = true;
        showAfterScrollYPx = Math.round(s.scrollY);
        break;
      }
    }
  }

  let sticky = cssSticky;
  let pinnedEdge = cssSticky ? 'top' : null;
  let stickyTopOut = stickyTopPx;

  if (
    pastOneViewport?.visible &&
    atTop.visible &&
    !hidesOnScrollDown
  ) {
    const topDrift = Math.abs(pastOneViewport.top - atTop.top);
    const nearTop =
      pastOneViewport.top >= -4 &&
      pastOneViewport.top <= Math.max(8, (stickyTopPx || 0) + 12);
    if (cssSticky || (nearTop && topDrift <= 10)) {
      sticky = true;
      pinnedEdge = 'top';
      stickyTopOut =
        stickyTopOut != null && Number.isFinite(stickyTopOut)
          ? stickyTopOut
          : Math.round(Math.max(0, pastOneViewport.top));
      evidence.push(
        cssSticky
          ? `rect.top~${Math.round(pastOneViewport.top)} @ scrollY>vh`
          : `geom-sticky top=${Math.round(pastOneViewport.top)}`,
      );
    }
  }

  if (hidesOnScrollDown && hideAfterScrollYPx != null) {
    const vpLabel =
      hideAfterViewports != null ? ` (~${hideAfterViewports}vh)` : '';
    evidence.push(`hidden @ scrollY~${hideAfterScrollYPx}${vpLabel}`);
  }
  if (showsOnScrollUp) {
    evidence.push(
      showAfterScrollYPx != null
        ? `visible again on scroll-up @ ~${showAfterScrollYPx}`
        : 'visible again on scroll-up',
    );
  }

  const midHidden = samples.some(
    (s) =>
      atTop.visible &&
      !s.visible &&
      s.scrollY >= vh * 1.5 &&
      s.scrollY <= vh * 3,
  );
  if (midHidden && !hidesOnScrollDown) {
    evidence.push('hidden @ mid-page');
  }

  // Bottom-pinned floating widgets (cookie bars, chat). Must override CSS-fixed
  // default pinnedEdge=top — fixed bottom chrome still has sticky=true from css.
  const pinSample =
    (pastOneViewport?.visible ? pastOneViewport : null) ||
    samples.find((s) => s.visible) ||
    (atTop.visible ? atTop : null);
  if (
    !hidesOnScrollDown &&
    pinSample &&
    pinSample.bottom >= vh - 24 &&
    pinSample.height < vh * 0.35 &&
    pinSample.top > vh * 0.4
  ) {
    sticky = true;
    pinnedEdge = 'bottom';
    if (!evidence.includes('geom-bottom-pin')) {
      evidence.push('geom-bottom-pin');
    }
  }

  return {
    cssPosition,
    sticky,
    stickyTopPx: stickyTopOut,
    visibleAtTop: Boolean(atTop.visible),
    visiblePastOneViewport: hidesOnScrollDown ? false : visiblePast,
    hidesOnScrollDown,
    showsOnScrollUp,
    hideAfterScrollYPx,
    hideAfterViewports,
    showAfterScrollYPx,
    pinnedEdge,
    evidence,
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {{ deep?: boolean }} [opts]
 * @returns {Promise<ScrollBehaviorDevice|null>}
 */
export async function probeSectionScrollBehavior(page, selector, opts = {}) {
  if (!selector) return null;
  const deep = opts.deep !== false;

  try {
    const raw = await page.evaluate(
      async ({ sel, deep: doDeep }) => {
        const frame = () =>
          new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const settle = async () => {
          await frame();
          await frame();
          // Brief settle for JS scroll listeners / class toggles
          await new Promise((r) => setTimeout(r, 32));
        };

        let el;
        try {
          el = document.querySelector(sel);
        } catch {
          return null;
        }
        if (!(el instanceof Element)) return null;

        const style0 = window.getComputedStyle(el);
        const cssPosition = style0.position || 'static';
        const stickyTopRaw = style0.top;
        const stickyTopPx =
          stickyTopRaw && stickyTopRaw !== 'auto'
            ? parseFloat(stickyTopRaw)
            : null;

        const translateYOffscreen = (node, st, r, vh) => {
          const t = String(st.transform || '');
          if (!t || t === 'none') return false;
          // matrix(a,b,c,d,tx,ty) or matrix3d(..., ty at index 13)
          const m = t.match(/matrix(?:3d)?\(([^)]+)\)/);
          if (!m) return false;
          const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
          const ty =
            parts.length === 6
              ? parts[5]
              : parts.length === 16
                ? parts[13]
                : NaN;
          if (!Number.isFinite(ty)) return false;
          const h = Math.max(r.height, 1);
          // Fully translated above/below viewport
          if (ty <= -h + 2) return true;
          if (ty >= vh - 2 && r.top >= vh - 2) return true;
          return false;
        };

        const isEffectivelyVisible = (node) => {
          if (!(node instanceof Element)) return false;
          const st = window.getComputedStyle(node);
          if (st.display === 'none' || st.visibility === 'hidden') return false;
          if (Number(st.opacity) < 0.05) return false;
          if (parseFloat(st.maxHeight) === 0 || parseFloat(st.height) === 0) {
            const r0 = node.getBoundingClientRect();
            if (r0.height < 2) return false;
          }
          const r = node.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return false;
          const vh = window.innerHeight || 900;
          const vw = window.innerWidth || 1440;
          if (translateYOffscreen(node, st, r, vh)) return false;
          const ix0 = Math.max(0, r.left);
          const iy0 = Math.max(0, r.top);
          const ix1 = Math.min(vw, r.right);
          const iy1 = Math.min(vh, r.bottom);
          const area = Math.max(0, ix1 - ix0) * Math.max(0, iy1 - iy0);
          if (area < 24) return false;
          if (Math.abs(r.top) > vh * 1.5 && r.bottom < 0) return false;
          if (r.bottom <= 0 || r.top >= vh) return false;
          return true;
        };

        const sampleHere = () => {
          const r = el.getBoundingClientRect();
          return {
            scrollY: window.scrollY || window.pageYOffset || 0,
            visible: isEffectivelyVisible(el),
            top: r.top,
            bottom: r.bottom,
            height: r.height,
          };
        };

        const scrollToY = async (y) => {
          window.scrollTo(0, Math.max(0, Math.round(y)));
          await settle();
        };

        const docH = Math.max(
          document.body?.scrollHeight || 0,
          document.documentElement?.scrollHeight || 0,
        );
        const vh = window.innerHeight || 900;

        /** @type {Array<{ scrollY: number, visible: boolean, top: number, bottom: number, height: number }>} */
        const samples = [];

        await scrollToY(0);
        samples.push(sampleHere());

        if (!doDeep) {
          return {
            cssPosition,
            stickyTopPx: Number.isFinite(stickyTopPx) ? stickyTopPx : null,
            vh,
            samples,
            deep: false,
          };
        }

        const maxY = Math.max(0, Math.min(docH - 1, Math.round(vh * 3)));
        const step = Math.max(24, Math.round(vh * 0.25));
        // Incremental scroll-down so direction-aware listeners fire
        for (let y = step; y <= maxY; y += step) {
          await scrollToY(y);
          samples.push(sampleHere());
          // Early exit once hidden and we've gone a bit further
          const last = samples[samples.length - 1];
          const first = samples[0];
          if (first.visible && !last.visible && y >= vh * 0.5) {
            // One more step to confirm
            const confirmY = Math.min(maxY, y + step);
            if (confirmY > y) {
              await scrollToY(confirmY);
              samples.push(sampleHere());
            }
            break;
          }
        }

        // Mid-page sample if we haven't gone that far
        const midY = Math.min(docH - 1, Math.round(Math.min(docH * 0.5, vh * 2)));
        if (midY > (samples[samples.length - 1]?.scrollY || 0) + 40) {
          await scrollToY(midY);
          samples.push(sampleHere());
        }

        // Scroll back up for reveal detection
        const deepest = samples.reduce(
          (a, b) => (b.scrollY > a.scrollY ? b : a),
          samples[0],
        );
        if (samples[0]?.visible && deepest && !deepest.visible) {
          const upTargets = [
            Math.round(deepest.scrollY * 0.5),
            Math.round(deepest.scrollY * 0.35),
            Math.round(deepest.scrollY * 0.2),
          ].filter((y, i, arr) => y > 8 && arr.indexOf(y) === i);
          for (const y of upTargets) {
            await scrollToY(y);
            samples.push(sampleHere());
          }
        }

        await scrollToY(0);
        samples.push(sampleHere());

        return {
          cssPosition,
          stickyTopPx: Number.isFinite(stickyTopPx) ? stickyTopPx : null,
          vh,
          samples,
          deep: true,
        };
      },
      { sel: selector, deep },
    );

    if (!raw) return null;
    return analyzeScrollSamples(raw);
  } catch {
    return null;
  }
}

/**
 * Decide whether a section needs a deep scroll probe.
 * @param {{ track?: string, isOverlay?: boolean, selector?: string }} section
 * @param {import('playwright').Page} page
 */
export async function shouldDeepScrollProbe(page, section) {
  const track = String(section?.track || '').toLowerCase();
  // Header stack + float overlays both need deep sticky/hide probes.
  if (track === 'overlay' || track === 'header' || section?.isOverlay) return true;
  if (!section?.selector) return false;
  try {
    return await page.evaluate((sel) => {
      let el;
      try {
        el = document.querySelector(sel);
      } catch {
        return false;
      }
      if (!(el instanceof Element)) return false;
      const st = window.getComputedStyle(el);
      if (st.position === 'sticky' || st.position === 'fixed') return true;
      const r = el.getBoundingClientRect();
      return r.top < 150 && r.height < (window.innerHeight || 900) * 0.45;
    }, section.selector);
  } catch {
    return false;
  }
}
